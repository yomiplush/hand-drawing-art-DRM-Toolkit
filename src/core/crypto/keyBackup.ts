import { derivePublicKeyFromSeed, computePublicKeyFingerprint } from './ed25519';
import { base64UrlDecode, base64UrlEncode, constantTimeEqual } from './sha256';

export const KEY_BACKUP_FORMAT = 'certified-handmade-key-backup';
export const KEY_BACKUP_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 5_000_000;
const SEED_MAGIC = new Uint8Array([0x43, 0x48, 0x53, 0x4b]); // "CHSK"

export interface EncryptedKeyBackup {
  format: typeof KEY_BACKUP_FORMAT;
  version: typeof KEY_BACKUP_VERSION;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  publicKey: string;
  fingerprint: string;
  label: string;
  createdAt: string;
  ciphertext: string;
}

export interface DecryptedKeyBackup {
  seed32: Uint8Array;
  publicKey32: Uint8Array;
  label: string;
  createdAt: string;
  fingerprint: string;
}

function buildBackupAad(publicKeyBase64Url: string): Uint8Array {
  return new TextEncoder().encode(`CHM-KEY-BACKUP-v1:${publicKeyBase64Url}`);
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const passBytes = new TextEncoder().encode(passphrase);
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    passBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  return await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltCopy.buffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function encryptKeyBackup(params: {
  seed32: Uint8Array;
  publicKey32: Uint8Array;
  passphrase: string;
  label: string;
  createdAt?: string;
  iterations?: number;
}): Promise<EncryptedKeyBackup> {
  const {
    seed32,
    publicKey32,
    passphrase,
    label,
    createdAt = new Date().toISOString(),
    iterations = DEFAULT_PBKDF2_ITERATIONS,
  } = params;

  if (seed32.length !== 32) {
    throw new Error('Ed25519 seed must be 32 bytes');
  }
  if (publicKey32.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }
  if (passphrase.length < 8) {
    throw new Error('Backup passphrase must be at least 8 characters');
  }
  if (iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error('Invalid PBKDF2 iteration count');
  }

  const derivedPublic = derivePublicKeyFromSeed(seed32);
  if (!constantTimeEqual(derivedPublic, publicKey32)) {
    throw new Error('Private seed does not match public key');
  }

  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const publicKeyB64 = base64UrlEncode(publicKey32);
  const aad = buildBackupAad(publicKeyB64);
  const aesKey = await deriveAesKey(passphrase, salt, iterations, ['encrypt']);

  const plaintext = new Uint8Array(SEED_MAGIC.length + 32);
  plaintext.set(SEED_MAGIC, 0);
  plaintext.set(seed32, SEED_MAGIC.length);

  try {
    const aadCopy = new Uint8Array(aad.byteLength);
    aadCopy.set(aad);
    const ivCopy = new Uint8Array(iv.byteLength);
    ivCopy.set(iv);
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivCopy.buffer, additionalData: aadCopy.buffer, tagLength: 128 },
      aesKey,
      plaintext.buffer,
    );

    const fp = await computePublicKeyFingerprint(publicKey32);
    return {
      format: KEY_BACKUP_FORMAT,
      version: KEY_BACKUP_VERSION,
      kdf: 'PBKDF2-SHA256',
      iterations,
      cipher: 'AES-256-GCM',
      salt: base64UrlEncode(salt),
      iv: base64UrlEncode(iv),
      publicKey: publicKeyB64,
      fingerprint: fp.fullHex,
      label: label.trim().slice(0, 64) || 'Artist Key',
      createdAt,
      ciphertext: base64UrlEncode(new Uint8Array(encrypted)),
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptKeyBackup(
  rawBackup: unknown,
  passphrase: string,
): Promise<DecryptedKeyBackup> {
  if (!rawBackup || typeof rawBackup !== 'object') {
    throw new Error('Invalid key backup JSON');
  }
  const obj = rawBackup as Record<string, unknown>;
  if (obj.format !== KEY_BACKUP_FORMAT || obj.version !== KEY_BACKUP_VERSION) {
    throw new Error('Unsupported key backup format or version');
  }
  if (obj.kdf !== 'PBKDF2-SHA256' || obj.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported backup KDF or cipher');
  }
  if (
    typeof obj.iterations !== 'number' ||
    !Number.isInteger(obj.iterations) ||
    obj.iterations < MIN_PBKDF2_ITERATIONS ||
    obj.iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error('Invalid backup PBKDF2 iterations');
  }
  if (
    typeof obj.salt !== 'string' ||
    typeof obj.iv !== 'string' ||
    typeof obj.publicKey !== 'string' ||
    typeof obj.ciphertext !== 'string'
  ) {
    throw new Error('Missing encrypted backup fields');
  }

  const salt = base64UrlDecode(obj.salt);
  const iv = base64UrlDecode(obj.iv);
  const publicKey32 = base64UrlDecode(obj.publicKey);
  const ciphertext = base64UrlDecode(obj.ciphertext);

  if (salt.length !== 16 || iv.length !== 12 || publicKey32.length !== 32 || ciphertext.length < 36) {
    throw new Error('Malformed encrypted backup byte lengths');
  }

  const aad = buildBackupAad(obj.publicKey);
  const aesKey = await deriveAesKey(passphrase, salt, obj.iterations, ['decrypt']);

  let decrypted: ArrayBuffer;
  try {
    const aadCopy = new Uint8Array(aad.byteLength);
    aadCopy.set(aad);
    const ivCopy = new Uint8Array(iv.byteLength);
    ivCopy.set(iv);
    const ctCopy = new Uint8Array(ciphertext.byteLength);
    ctCopy.set(ciphertext);
    decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivCopy.buffer, additionalData: aadCopy.buffer, tagLength: 128 },
      aesKey,
      ctCopy.buffer,
    );
  } catch {
    throw new Error('Failed to decrypt key backup (wrong passphrase or corrupted file)');
  }

  const plainBytes = new Uint8Array(decrypted);
  try {
    if (plainBytes.length !== SEED_MAGIC.length + 32) {
      throw new Error('Unexpected decrypted seed length');
    }
    if (!constantTimeEqual(plainBytes.subarray(0, SEED_MAGIC.length), SEED_MAGIC)) {
      throw new Error('Decrypted key payload failed magic validation');
    }
    const seed32 = plainBytes.slice(SEED_MAGIC.length);
    const derivedPublic = derivePublicKeyFromSeed(seed32);
    if (!constantTimeEqual(derivedPublic, publicKey32)) {
      seed32.fill(0);
      throw new Error('Restored private key does not match public key');
    }
    const fp = await computePublicKeyFingerprint(publicKey32);
    return {
      seed32,
      publicKey32,
      label: typeof obj.label === 'string' ? obj.label.trim().slice(0, 64) || 'Restored Key' : 'Restored Key',
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      fingerprint: fp.fullHex,
    };
  } finally {
    plainBytes.fill(0);
  }
}
