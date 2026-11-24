import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { decodeBech32, encodeBech32 } from './bech32';
import { assertValidNostrSecretKeyBytes, wipeBytes } from './secp256k1';

const NIP49_VERSION = 0x02;
const NIP49_SALT_BYTES = 16;
const NIP49_NONCE_BYTES = 24;
const NIP49_DECODED_BYTES = 91; // 1 + 1 + 16 + 24 + 1 + (32 + 16)

export type Nip49KeySecurityByte = 0x00 | 0x01 | 0x02;

/**
 * Encrypts a 32-byte Nostr secp256k1 secret key using NIP-49 (ncryptsec):
 * - NFKC Unicode password normalization
 * - scrypt(N = 2^logN, r = 8, p = 1)
 * - XChaCha20-Poly1305 with 1-byte keySecurityByte as AAD
 */
export async function encryptNip49PrivateKey(params: {
  secretKey: Uint8Array;
  password: string;
  logN?: number;
  keySecurityByte?: Nip49KeySecurityByte;
}): Promise<string> {
  assertValidNostrSecretKeyBytes(params.secretKey);
  if (typeof params.password !== 'string' || params.password.length === 0) {
    throw new Error('Password is required for NIP-49 ncryptsec encryption');
  }
  const logN = params.logN ?? 16;
  if (!Number.isInteger(logN) || logN < 12 || logN > 22) {
    throw new Error('NIP-49 logN must be an integer between 12 and 22');
  }
  const securityByte: Nip49KeySecurityByte = params.keySecurityByte ?? 0x01;
  if (securityByte !== 0x00 && securityByte !== 0x01 && securityByte !== 0x02) {
    throw new Error('Invalid NIP-49 keySecurityByte');
  }

  const normalizedPass = new TextEncoder().encode(params.password.normalize('NFKC'));
  const salt = new Uint8Array(NIP49_SALT_BYTES);
  const nonce = new Uint8Array(NIP49_NONCE_BYTES);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(nonce);

  const symKey = await scryptAsync(normalizedPass, salt, {
    N: 2 ** logN,
    r: 8,
    p: 1,
    dkLen: 32,
  });
  const aad = new Uint8Array([securityByte]);

  try {
    const aead = xchacha20poly1305(symKey, nonce, aad);
    const ciphertext = aead.encrypt(params.secretKey);
    const concat = new Uint8Array(NIP49_DECODED_BYTES);
    let offset = 0;
    concat[offset++] = NIP49_VERSION;
    concat[offset++] = logN;
    concat.set(salt, offset);
    offset += NIP49_SALT_BYTES;
    concat.set(nonce, offset);
    offset += NIP49_NONCE_BYTES;
    concat[offset++] = securityByte;
    concat.set(ciphertext, offset);
    return encodeBech32('ncryptsec', concat);
  } finally {
    wipeBytes(normalizedPass, symKey);
  }
}

export async function decryptNip49PrivateKey(
  ncryptsec: string,
  password: string,
): Promise<{
  secretKey: Uint8Array;
  logN: number;
  keySecurityByte: Nip49KeySecurityByte;
}> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required to decrypt ncryptsec');
  }
  const { bytes } = decodeBech32(ncryptsec, 'ncryptsec', 256);
  if (bytes.length !== NIP49_DECODED_BYTES) {
    throw new Error(`Invalid ncryptsec decoded length (${bytes.length}, expected ${NIP49_DECODED_BYTES})`);
  }
  const version = bytes[0];
  if (version !== NIP49_VERSION) {
    throw new Error(`Unsupported NIP-49 version: ${version}`);
  }
  const logN = bytes[1];
  if (logN < 12 || logN > 22) {
    throw new Error(`Unsupported NIP-49 scrypt work factor logN=${logN}`);
  }
  const salt = bytes.subarray(2, 18);
  const nonce = bytes.subarray(18, 42);
  const keySecurityByte = bytes[42];
  if (keySecurityByte !== 0x00 && keySecurityByte !== 0x01 && keySecurityByte !== 0x02) {
    throw new Error('Invalid NIP-49 keySecurityByte');
  }
  const ciphertext = bytes.subarray(43);

  const normalizedPass = new TextEncoder().encode(password.normalize('NFKC'));
  const symKey = await scryptAsync(normalizedPass, salt, {
    N: 2 ** logN,
    r: 8,
    p: 1,
    dkLen: 32,
  });
  try {
    const aead = xchacha20poly1305(symKey, nonce, new Uint8Array([keySecurityByte]));
    const secretKey = aead.decrypt(ciphertext);
    assertValidNostrSecretKeyBytes(secretKey, 'Decrypted ncryptsec secret key');
    return {
      secretKey,
      logN,
      keySecurityByte,
    };
  } finally {
    wipeBytes(normalizedPass, symKey);
  }
}
