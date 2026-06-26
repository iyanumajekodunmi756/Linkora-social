'use client';

/**
 * HTTP client for the Linkora DM relay service.
 *
 * The relay is transport-only: it stores and routes encrypted blobs without
 * ever seeing plaintext.  Authentication uses Stellar Ed25519 signatures so
 * the relay can prove the sender is who they claim to be.
 *
 * Auth scheme (mirrors services/dm-relay/auth.ts):
 *   authData  = sender_stellar_address + unix_timestamp_seconds
 *   hash      = SHA-256(authData)
 *   signature = Ed25519_sign(freighter_private_key, hash)   — via signBlob
 *   sent as hex string in the JSON body
 */

import { bytesToHex, bytesToBase64, base64ToBytes, createConversationId } from './crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RelayMessage {
  id: string;
  sender: string;
  recipient: string;
  ciphertext_b64: string;
  message_index: number;
  timestamp: number;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const RELAY_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DM_RELAY_URL) ||
  'http://localhost:3001';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function sha256Web(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(buf);
}


/**
 * Signs hash = SHA-256(sender + timestamp) with the user's Freighter key
 * and returns the 64-byte Ed25519 signature as a hex string.
 *
 * Freighter v2 exposes `signBlob(base64Data, opts)` which signs raw bytes
 * with the wallet's Ed25519 private key and returns base64-encoded signature.
 */
async function buildAuthSignature(
  senderAddress: string,
  timestamp: number,
): Promise<string> {
  const authBytes = new TextEncoder().encode(senderAddress + String(timestamp));
  const hash = await sha256Web(authBytes);
  const hashBase64 = bytesToBase64(hash);

  // Dynamic import keeps this wallet call out of SSR bundles
  const { signBlob } = await import('@stellar/freighter-api');
  const sigBase64: string = await (signBlob as Function)(hashBase64, {
    accountToSign: senderAddress,
  });

  return bytesToHex(base64ToBytes(sigBase64));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt-then-send a message to the relay.
 * The caller is responsible for encrypting `ciphertext` before calling this.
 */
export async function sendRelayMessage(
  senderAddress: string,
  recipientAddress: string,
  ciphertext: Uint8Array,
  messageIndex: number,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await buildAuthSignature(senderAddress, timestamp);

  const ciphertextB64 = bytesToBase64(ciphertext);

  const res = await fetch(`${RELAY_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: senderAddress,
      recipient: recipientAddress,
      ciphertext_b64: ciphertextB64,
      message_index: messageIndex,
      timestamp,
      signature,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Relay send failed (${res.status}): ${detail}`);
  }
}

/**
 * Fetch all messages for the conversation between myAddress and theirAddress.
 * The conversation ID is derived deterministically from the sorted addresses,
 * matching the relay server's own computation.
 */
export async function fetchRelayMessages(
  myAddress: string,
  theirAddress: string,
  limit = 50,
): Promise<RelayMessage[]> {
  const conversationId = createConversationId(myAddress, theirAddress);
  const params = new URLSearchParams({ limit: String(limit) });

  const res = await fetch(`${RELAY_URL}/api/messages/${conversationId}?${params}`);

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Relay fetch failed (${res.status}): ${detail}`);
  }

  const data: { messages: RelayMessage[]; has_more: boolean } = await res.json();
  return data.messages ?? [];
}
