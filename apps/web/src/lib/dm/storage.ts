'use client';

/**
 * Secure-as-possible localStorage persistence for DM keypairs.
 *
 * Keys are stored per-wallet-address so multiple Freighter accounts on the
 * same browser each get their own DM identity.
 *
 * Mobile counterpart uses expo-secure-store (see apps/mobile).
 */

import { type DmKeypair, bytesToBase64, base64ToBytes } from './crypto';

const PREFIX = 'linkora_dm_';

function pubKey(addr: string) {
  return `${PREFIX}x25519_pub_${addr}`;
}

function privKey(addr: string) {
  return `${PREFIX}x25519_priv_${addr}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function hasDmKeypair(address: string): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem(pubKey(address)) !== null &&
    localStorage.getItem(privKey(address)) !== null
  );
}

export function storeDmKeypair(address: string, keypair: DmKeypair): void {
  localStorage.setItem(pubKey(address), bytesToBase64(keypair.publicKey));
  localStorage.setItem(privKey(address), bytesToBase64(keypair.privateKey));
}

export function loadDmKeypair(address: string): DmKeypair | null {
  const pub = localStorage.getItem(pubKey(address));
  const priv = localStorage.getItem(privKey(address));
  if (!pub || !priv) return null;
  return {
    publicKey: base64ToBytes(pub),
    privateKey: base64ToBytes(priv),
  };
}

export function clearDmKeypair(address: string): void {
  localStorage.removeItem(pubKey(address));
  localStorage.removeItem(privKey(address));
}
