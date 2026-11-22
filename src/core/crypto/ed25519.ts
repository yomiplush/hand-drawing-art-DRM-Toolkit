import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, sha256 } from './sha256';

// Configure audited SHA-512 implementation for @noble/ed25519 v3
ed25519.hashes.sha512 = sha512;

// RFC 8410 ASN.1 DER prefixes for Ed25519 SPKI and PKCS#8
const ED25519_SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

let webCryptoEd25519SupportedCache: boolean | null = null;

export async function supportsWebCryptoEd25519(): Promise<boolean> {
  if (webCryptoEd25519SupportedCache !== null) {
    return webCryptoEd25519SupportedCache;
  }
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    webCryptoEd25519SupportedCache = false;
    return false;
  }
  try {
    const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    webCryptoEd25519SupportedCache = Boolean(kp && 'privateKey' in kp && 'publicKey' in kp);
  } catch {
    webCryptoEd25519SupportedCache = false;
  }
  return webCryptoEd25519SupportedCache;
}

export function wrapEd25519PublicKeySpki(publicKey32: Uint8Array): Uint8Array {
  if (publicKey32.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }
  const out = new Uint8Array(ED25519_SPKI_PREFIX.length + 32);
  out.set(ED25519_SPKI_PREFIX, 0);
  out.set(publicKey32, ED25519_SPKI_PREFIX.length);
  return out;
}

export function wrapEd25519SeedPkcs8(seed32: Uint8Array): Uint8Array {
  if (seed32.length !== 32) {
    throw new Error('Ed25519 seed must be 32 bytes');
  }
  const out = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  out.set(ED25519_PKCS8_PREFIX, 0);
  out.set(seed32, ED25519_PKCS8_PREFIX.length);
  return out;
}

export async function importNonExtractablePrivateKey(seed32: Uint8Array): Promise<CryptoKey> {
  const pkcs8 = wrapEd25519SeedPkcs8(seed32);
  try {
    const copy = new Uint8Array(pkcs8.byteLength);
    copy.set(pkcs8);
    return await globalThis.crypto.subtle.importKey(
      'pkcs8',
      copy.buffer,
      { name: 'Ed25519' },
      false, // Non-extractable!
      ['sign'],
    );
  } finally {
    pkcs8.fill(0);
  }
}

export async function importPublicKeyWebCrypto(publicKey32: Uint8Array): Promise<CryptoKey> {
  const spki = wrapEd25519PublicKeySpki(publicKey32);
  const copy = new Uint8Array(spki.byteLength);
  copy.set(spki);
  return await globalThis.crypto.subtle.importKey('spki', copy.buffer, { name: 'Ed25519' }, true, ['verify']);
}

export function derivePublicKeyFromSeed(seed32: Uint8Array): Uint8Array {
  if (seed32.length !== 32) {
    throw new Error('Ed25519 private seed must be 32 bytes');
  }
  return ed25519.getPublicKey(seed32);
}

export function generateRandomSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  globalThis.crypto.getRandomValues(seed);
  return seed;
}

export interface GeneratedKeyMaterial {
  publicKey: Uint8Array;
  webCryptoPrivateKey?: CryptoKey;
  storageMode: 'webcrypto-non-extractable' | 'noble-encrypted-seed';
  seed32: Uint8Array;
  wipeSeed: () => void;
}

export async function generateEd25519KeyMaterial(): Promise<GeneratedKeyMaterial> {
  const seed32 = generateRandomSeed();
  const publicKey = derivePublicKeyFromSeed(seed32);
  const canUseWebCrypto = await supportsWebCryptoEd25519();

  if (canUseWebCrypto) {
    try {
      const webCryptoPrivateKey = await importNonExtractablePrivateKey(seed32);
      return {
        publicKey,
        webCryptoPrivateKey,
        storageMode: 'webcrypto-non-extractable',
        seed32,
        wipeSeed: () => seed32.fill(0),
      };
    } catch {
      // Fallback cleanly if importKey fails in an edge browser build
    }
  }

  return {
    publicKey,
    storageMode: 'noble-encrypted-seed',
    seed32,
    wipeSeed: () => seed32.fill(0),
  };
}

export async function signWithCryptoKey(privateKey: CryptoKey, message: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(message.byteLength);
  copy.set(message);
  const sig = await globalThis.crypto.subtle.sign({ name: 'Ed25519' }, privateKey, copy.buffer);
  return new Uint8Array(sig);
}

export function signWithSeed(seed32: Uint8Array, message: Uint8Array): Uint8Array {
  if (seed32.length !== 32) {
    throw new Error('Ed25519 seed must be 32 bytes');
  }
  return ed25519.sign(message, seed32);
}

export async function verifyEd25519Signature(
  publicKey32: Uint8Array,
  message: Uint8Array,
  signature64: Uint8Array,
): Promise<boolean> {
  if (publicKey32.length !== 32 || signature64.length !== 64) {
    return false;
  }
  try {
    // Audited @noble/ed25519 verifies canonical R/S and rejects small-order/malleated signatures
    const nobleOk = ed25519.verify(signature64, message, publicKey32);
    if (!nobleOk) return false;

    // If Web Crypto Ed25519 is available, cross-verify for defense-in-depth
    if (await supportsWebCryptoEd25519()) {
      try {
        const key = await importPublicKeyWebCrypto(publicKey32);
        const msgCopy = new Uint8Array(message.byteLength);
        msgCopy.set(message);
        const sigCopy = new Uint8Array(signature64.byteLength);
        sigCopy.set(signature64);
        return await globalThis.crypto.subtle.verify(
          { name: 'Ed25519' },
          key,
          sigCopy.buffer,
          msgCopy.buffer,
        );
      } catch {
        return nobleOk;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function computePublicKeyFingerprint(publicKey32: Uint8Array): Promise<{
  fullHex: string;
  shortDisplay: string;
}> {
  if (publicKey32.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }
  const digest = await sha256(publicKey32);
  const fullHex = bytesToHex(digest);
  const shortHex = fullHex.slice(0, 32).toUpperCase();
  const groups = shortHex.match(/.{1,4}/g) ?? [];
  return {
    fullHex,
    shortDisplay: `CHM-${groups.slice(0, 4).join('-')}`,
  };
}
