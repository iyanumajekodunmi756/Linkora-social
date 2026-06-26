'use client';

/**
 * End-to-end encryption for Linkora direct messages.
 *
 * Key agreement : X25519 Diffie-Hellman
 * Key derivation: HKDF-SHA256
 * Encryption    : ChaCha20-Poly1305 AEAD
 *
 * Mirrors packages/sdk/src/dm/crypto.ts so both apps share the same protocol.
 */

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { chacha20poly1305 } from '@noble/ciphers/chacha';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DmKeypair {
  /** 32-byte X25519 public key */
  publicKey: Uint8Array;
  /** 32-byte X25519 private key */
  privateKey: Uint8Array;
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

// ── Key generation ────────────────────────────────────────────────────────────

export function generateDmKeypair(): DmKeypair {
  const privateKey = x25519.utils.randomPrivateKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

// ── Deterministic conversation ID ─────────────────────────────────────────────

/**
 * Deterministic conversation ID from two Stellar addresses.
 * Sorts lexicographically so hash(A,B) === hash(B,A).
 */
export function createConversationId(addrA: string, addrB: string): string {
  const sorted = [addrA, addrB].sort();
  const bytes = new TextEncoder().encode(sorted[0] + sorted[1]);
  return bytesToHex(sha256(bytes));
}

// ── Encryption ────────────────────────────────────────────────────────────────

export function encryptDirectMessage(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array,
  myAddress: string,
  theirAddress: string,
  plaintext: string,
  messageIndex: number,
): Uint8Array {
  const sharedSecret = x25519.getSharedSecret(myPrivateKey, theirPublicKey);
  const conversationId = createConversationId(myAddress, theirAddress);

  const key = hkdf(
    sha256,
    sharedSecret,
    undefined,
    new TextEncoder().encode(`linkora-dm-v1:${conversationId}`),
    32,
  );

  const nonce = hkdf(
    sha256,
    key,
    undefined,
    new TextEncoder().encode(`nonce:${messageIndex}`),
    12,
  );

  return chacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(plaintext));
}

// ── Decryption ────────────────────────────────────────────────────────────────

/**
 * Works for both sent and received messages because X25519 is symmetric:
 * x25519(alice_priv, bob_pub) === x25519(bob_priv, alice_pub).
 *
 * Call as: decryptDirectMessage(myPriv, otherPub, myAddr, otherAddr, ...)
 * for every message in the conversation regardless of direction.
 */
export function decryptDirectMessage(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array,
  myAddress: string,
  theirAddress: string,
  ciphertext: Uint8Array,
  messageIndex: number,
): string {
  try {
    const sharedSecret = x25519.getSharedSecret(myPrivateKey, theirPublicKey);
    const conversationId = createConversationId(myAddress, theirAddress);

    const key = hkdf(
      sha256,
      sharedSecret,
      undefined,
      new TextEncoder().encode(`linkora-dm-v1:${conversationId}`),
      32,
    );

    const nonce = hkdf(
      sha256,
      key,
      undefined,
      new TextEncoder().encode(`nonce:${messageIndex}`),
      12,
    );

    const plaintext = chacha20poly1305(key, nonce).decrypt(ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch (err) {
    throw new DecryptionError(
      `Decryption failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Byte utilities ────────────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Array.from(atob(b64), (c) => c.charCodeAt(0)));
}
