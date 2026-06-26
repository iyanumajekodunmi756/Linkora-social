'use client';

/**
 * Soroban contract helpers for DM key management.
 *
 * getDmKey       – read-only simulation, no signing needed
 * publishDmKey   – write transaction, signed by Freighter then submitted to RPC
 *
 * Both methods mirror the corresponding LinkoraClient methods from
 * packages/sdk/src/client.ts but are inlined here to avoid a full SDK build
 * dependency in apps/web.
 */

import {
  rpc,
  Contract,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  Account,
  Keypair,
} from '@stellar/stellar-sdk';

// ── Config (falls back to Stellar testnet) ────────────────────────────────────

const RPC_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOROBAN_RPC_URL) ||
  'https://soroban-testnet.stellar.org';

const CONTRACT_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CONTRACT_ID) || '';

const NETWORK_PASSPHRASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE) ||
  'Test SDF Network ; September 2015';

const HORIZON_URL = NETWORK_PASSPHRASE.includes('Test')
  ? 'https://horizon-testnet.stellar.org'
  : 'https://horizon.stellar.org';

const TX_TIMEOUT = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scvAddress(value: string) {
  return nativeToScVal(value, { type: 'address' });
}

/** Build a temporary unsigned transaction purely for fee simulation. */
function buildTempTx(op: ReturnType<Contract['call']>) {
  const tempSource = Keypair.random();
  const tempAccount = new Account(tempSource.publicKey(), '0');
  return new TransactionBuilder(tempAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(TX_TIMEOUT)
    .build();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the X25519 public key published by `address` to the Linkora contract.
 * Returns null if the user has never called publishDmKey.
 */
export async function getDmKey(address: string): Promise<Uint8Array | null> {
  if (!CONTRACT_ID) return null;

  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const op = contract.call('get_dm_key', scvAddress(address));

  const tempTx = buildTempTx(op);
  const result = await server.simulateTransaction(tempTx);

  if (!rpc.Api.isSimulationSuccess(result) || !result.result) return null;

  const native = scValToNative(result.result.retval);
  return native ? new Uint8Array(native as number[]) : null;
}

/**
 * Publish the caller's X25519 public key to the Linkora contract.
 *
 * Flow:
 *   1. Simulate transaction to get accurate resource fees.
 *   2. Build the real transaction with the user's account as source.
 *   3. Hand the XDR to Freighter for signing.
 *   4. Submit the signed transaction to the Soroban RPC.
 */
export async function publishDmKey(
  userAddress: string,
  x25519PubKey: Uint8Array,
): Promise<void> {
  if (!CONTRACT_ID) throw new Error('NEXT_PUBLIC_CONTRACT_ID is not set');
  if (x25519PubKey.length !== 32) throw new Error('X25519 public key must be 32 bytes');

  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);

  const op = contract.call(
    'publish_dm_key',
    scvAddress(userAddress),
    nativeToScVal(Array.from(x25519PubKey), { type: 'bytes' }),
  );

  // ── Step 1: Simulate for fees ──────────────────────────────────────────────
  const tempTx = buildTempTx(op);
  const sim = await server.simulateTransaction(tempTx);

  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Transaction simulation failed — check contract configuration');
  }

  // ── Step 2: Fetch user account sequence from Horizon ─────────────────────
  const accountRes = await fetch(`${HORIZON_URL}/accounts/${userAddress}`);
  if (!accountRes.ok) {
    throw new Error(
      'Could not fetch account details. Make sure your wallet is funded on testnet.',
    );
  }
  const accountData: { sequence: string } = await accountRes.json();

  const userAccount = new Account(userAddress, accountData.sequence);
  const resourceFee = Number(sim.result?.minResourceFee ?? '0');

  let builder = new TransactionBuilder(userAccount, {
    fee: String(resourceFee + 100),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(TX_TIMEOUT);

  if (sim.result?.sorobanData) {
    builder = builder.setSorobanData(sim.result.sorobanData);
  }

  const unsignedXdr = builder.build().toEnvelope().toXDR('base64');

  // ── Step 3: Sign via Freighter ─────────────────────────────────────────────
  const { signTransaction } = await import('@stellar/freighter-api');
  const signedXdr = await signTransaction(unsignedXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    accountToSign: userAddress,
  });

  // ── Step 4: Submit to RPC ──────────────────────────────────────────────────
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const submitResult = await server.submitTransaction(signedTx);

  if (!submitResult) {
    throw new Error('Transaction submission returned no result');
  }
}
