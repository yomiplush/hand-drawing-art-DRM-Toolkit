import { schnorr, secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, constantTimeEqual, hexToBytes } from '../crypto/sha256';
import { decodeBech32, encodeBech32 } from './bech32';

export const NOSTR_SECRET_KEY_BYTES = 32;
export const NOSTR_PUBLIC_KEY_BYTES = 32;
export const NOSTR_SCHNORR_SIG_BYTES = 64;

const LOWERCASE_HEX_64_RE = /^[0-9a-f]{64}$/;
const LOWERCASE_HEX_128_RE = /^[0-9a-f]{128}$/;

export function wipeBytes(...arrays: Array<Uint8Array | undefined | null>): void {
  for (const arr of arrays) {
    if (arr instanceof Uint8Array) {
      arr.fill(0);
    }
  }
}

export function assertValidNostrSecretKeyBytes(
  secretBytes: Uint8Array,
  label = 'Nostr secret key',
): Uint8Array {
  if (!(secretBytes instanceof Uint8Array) || secretBytes.length !== NOSTR_SECRET_KEY_BYTES) {
    throw new Error(`${label} must be exactly ${NOSTR_SECRET_KEY_BYTES} bytes`);
  }
  if (!secp256k1.utils.isValidSecretKey(secretBytes)) {
    throw new Error(`${label} scalar is outside valid secp256k1 range [1, n-1]`);
  }
  return secretBytes;
}

/**
 * Enforces strict cryptographic separation between CHM Ed25519 keys and Nostr secp256k1 keys.
 * A Nostr secret scalar must never reuse or equal an Ed25519 private seed/public key.
 */
export function assertDistinctFromEd25519Secrets(
  nostrSecret32: Uint8Array,
  disallowedSecrets: ReadonlyArray<Uint8Array | undefined | null>,
): void {
  assertValidNostrSecretKeyBytes(nostrSecret32);
  for (const candidate of disallowedSecrets) {
    if (
      candidate instanceof Uint8Array &&
      candidate.length === NOSTR_SECRET_KEY_BYTES &&
      constantTimeEqual(nostrSecret32, candidate)
    ) {
      throw new Error(
        'Key separation violation: CHM Ed25519 key material must never be reused as a Nostr secp256k1 key',
      );
    }
  }
}

export function assertValidNostrPubkeyHex(pubkeyHex: string, label = 'Nostr public key'): string {
  if (typeof pubkeyHex !== 'string' || !LOWERCASE_HEX_64_RE.test(pubkeyHex)) {
    throw new Error(`${label} must be a 64-character lowercase hex x-only public key`);
  }
  const bytes = hexToBytes(pubkeyHex);
  const compressed = new Uint8Array(33);
  compressed[0] = 0x02;
  compressed.set(bytes, 1);
  try {
    secp256k1.Point.fromBytes(compressed);
  } catch {
    throw new Error(`${label} does not represent a valid secp256k1 x-only curve point`);
  }
  return pubkeyHex;
}

export function isValidNostrPubkeyHex(pubkeyHex: unknown): pubkeyHex is string {
  if (typeof pubkeyHex !== 'string') return false;
  try {
    assertValidNostrPubkeyHex(pubkeyHex);
    return true;
  } catch {
    return false;
  }
}

export function isValidLowercaseHex64(value: unknown): value is string {
  return typeof value === 'string' && LOWERCASE_HEX_64_RE.test(value);
}

export function isValidLowercaseHex128(value: unknown): value is string {
  return typeof value === 'string' && LOWERCASE_HEX_128_RE.test(value);
}

/**
 * Generates an independent secp256k1 keypair using the platform CSPRNG (Web Crypto).
 */
export function generateNostrKeypair(
  disallowedEd25519Secrets: ReadonlyArray<Uint8Array | undefined | null> = [],
): {
  secretKey: Uint8Array;
  publicKeyHex: string;
} {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Cryptographic CSPRNG (crypto.getRandomValues) is required');
  }
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = new Uint8Array(NOSTR_SECRET_KEY_BYTES);
    globalThis.crypto.getRandomValues(candidate);
    if (!secp256k1.utils.isValidSecretKey(candidate)) {
      candidate.fill(0);
      continue;
    }
    try {
      assertDistinctFromEd25519Secrets(candidate, disallowedEd25519Secrets);
    } catch {
      candidate.fill(0);
      continue;
    }
    const pubBytes = schnorr.getPublicKey(candidate);
    return {
      secretKey: candidate,
      publicKeyHex: bytesToHex(pubBytes),
    };
  }
  throw new Error('Failed to generate valid secp256k1 keypair');
}

export function deriveNostrPublicKeyHex(secretKey: Uint8Array): string {
  assertValidNostrSecretKeyBytes(secretKey);
  return bytesToHex(schnorr.getPublicKey(secretKey));
}

export function signSchnorrDigestHex(digest32: Uint8Array, secretKey: Uint8Array): string {
  if (!(digest32 instanceof Uint8Array) || digest32.length !== 32) {
    throw new Error('Schnorr signing message digest must be 32 bytes');
  }
  assertValidNostrSecretKeyBytes(secretKey);
  const sig = schnorr.sign(digest32, secretKey);
  return bytesToHex(sig);
}

export function verifySchnorrDigestHex(
  digest32: Uint8Array,
  sigHex: string,
  pubkeyHex: string,
): boolean {
  if (!(digest32 instanceof Uint8Array) || digest32.length !== 32) return false;
  if (!isValidLowercaseHex128(sigHex)) return false;
  try {
    assertValidNostrPubkeyHex(pubkeyHex);
    return schnorr.verify(hexToBytes(sigHex), digest32, hexToBytes(pubkeyHex));
  } catch {
    return false;
  }
}

export function encodeNpub(pubkeyHex: string): string {
  const valid = assertValidNostrPubkeyHex(pubkeyHex);
  return encodeBech32('npub', hexToBytes(valid));
}

export function decodeNpub(npub: string): string {
  const { bytes } = decodeBech32(npub, 'npub', 128);
  if (bytes.length !== NOSTR_PUBLIC_KEY_BYTES) {
    throw new Error('Decoded npub must be 32 bytes');
  }
  return assertValidNostrPubkeyHex(bytesToHex(bytes));
}

export function encodeNsec(secretKey: Uint8Array): string {
  assertValidNostrSecretKeyBytes(secretKey);
  return encodeBech32('nsec', secretKey);
}

export function decodeNsec(nsec: string): Uint8Array {
  const { bytes } = decodeBech32(nsec, 'nsec', 128);
  try {
    assertValidNostrSecretKeyBytes(bytes, 'Decoded nsec');
    return bytes;
  } catch (err) {
    bytes.fill(0);
    throw err;
  }
}
