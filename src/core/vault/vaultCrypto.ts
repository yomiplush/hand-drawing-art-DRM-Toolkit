import { DEFAULT_PBKDF2_ITERATIONS, MIN_PASSPHRASE_LENGTH } from '../crypto/keyBackup';
import { base64UrlDecode, base64UrlEncode, bytesToHex, sha256Sync } from '../crypto/sha256';

export const VAULT_CRYPTO_FORMAT = 'chm-vault-aead-v1' as const;
export const VAULT_KEYRING_FORMAT = 'chm-vault-keyring-v1' as const;
export const VAULT_KEY_SHARE_FORMAT = 'chm-vault-keyshare-v1' as const;
const MIN_ALLOWED_PBKDF2_ITERATIONS = 100_000;
const MAX_ALLOWED_PBKDF2_ITERATIONS = 5_000_000;

export type VaultCryptoPurpose =
  | 'manifest'
  | 'proofs'
  | 'profiles'
  | 'policies'
  | 'settings'
  | 'snapshots'
  | 'identities'
  | 'devices'
  | 'recovery';

export interface VaultKeyEpoch {
  epoch: number;
  vmkBase64Url: string;
  createdAt: string;
  rotationReason?: 'initial' | 'device-revoked' | 'manual-rotation';
}

export interface UnlockedVaultKeyring {
  vaultId: string;
  currentEpoch: number;
  epochs: Record<number, Uint8Array>;
  createdAt: string;
  updatedAt: string;
}

export interface WrappedVaultKeyringEnvelope {
  format: typeof VAULT_KEYRING_FORMAT;
  version: 1;
  vaultId: string;
  currentEpoch: number;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedVaultRecordEnvelope {
  format: typeof VAULT_CRYPTO_FORMAT;
  version: 1;
  vaultId: string;
  epoch: number;
  purpose: VaultCryptoPurpose;
  recordId: string;
  contentHash: string;
  cipher: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
  encryptedAt: string;
}

export interface CrossDeviceVaultKeyShareEnvelope {
  format: typeof VAULT_KEY_SHARE_FORMAT;
  version: 1;
  vaultId: string;
  currentEpoch: number;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto API is required for Vault encryption');
  }
  return subtle;
}

export function generateVaultId(): string {
  const raw = new Uint8Array(16);
  globalThis.crypto.getRandomValues(raw);
  return `vault-${base64UrlEncode(raw)}`;
}

/**
 * Generates an independent 256-bit Vault Master Key.
 * Never derived from Ed25519 signing keys or Nostr secp256k1 keys.
 */
export function generateVaultMasterKey(): Uint8Array {
  const vmk = new Uint8Array(32);
  globalThis.crypto.getRandomValues(vmk);
  return vmk;
}

/**
 * Guards against accidentally passing raw Ed25519 or Nostr private keys or tokens
 * as the Vault encryption passphrase.
 */
export function assertVaultPassphraseValid(passphrase: string): void {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Vault passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
  const trimmed = passphrase.trim();
  if (/^nsec1[a-z0-9]{20,}$/i.test(trimmed)) {
    throw new Error('Refusing to reuse a Nostr nsec secret key as the Vault encryption passphrase');
  }
  if (/^chm-key-?backup/i.test(trimmed)) {
    throw new Error('Refusing to use a key backup marker as the Vault encryption passphrase');
  }
}

function buildKeyringAad(vaultId: string, currentEpoch: number): Uint8Array<ArrayBuffer> {
  return toArrayBufferView(
    utf8Encoder.encode(`CHM-VAULT-KEYRING-v1|vault=${vaultId}|epoch=${currentEpoch}`),
  );
}

function buildRecordAad(params: {
  vaultId: string;
  epoch: number;
  purpose: VaultCryptoPurpose;
  recordId: string;
  contentHash: string;
}): Uint8Array<ArrayBuffer> {
  return toArrayBufferView(
    utf8Encoder.encode(
      `CHM-VAULT-REC-v1|v=${params.vaultId}|p=${params.purpose}|e=${params.epoch}|id=${params.recordId}|h=${params.contentHash}`,
    ),
  );
}

function buildKeyShareAad(vaultId: string, currentEpoch: number): Uint8Array<ArrayBuffer> {
  return toArrayBufferView(
    utf8Encoder.encode(`CHM-VAULT-SHARE-v1|vault=${vaultId}|epoch=${currentEpoch}`),
  );
}

async function derivePassphraseWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  assertVaultPassphraseValid(passphrase);
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_ALLOWED_PBKDF2_ITERATIONS ||
    iterations > MAX_ALLOWED_PBKDF2_ITERATIONS
  ) {
    throw new Error('Invalid PBKDF2 iteration count');
  }
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    toArrayBufferView(utf8Encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBufferView(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

/**
 * HKDF-SHA256 subkey derivation enforcing cryptographic separation between
 * manifest, proofs, profiles, policy presets, settings, snapshots, identities, devices, and recovery.
 */
async function derivePurposeSubkey(params: {
  vmkBytes: Uint8Array;
  vaultId: string;
  epoch: number;
  purpose: VaultCryptoPurpose;
  usage: KeyUsage[];
}): Promise<CryptoKey> {
  if (params.vmkBytes.length !== 32) {
    throw new Error('Vault Master Key must be 32 bytes');
  }
  const subtle = getSubtle();
  const hkdfKey = await subtle.importKey(
    'raw',
    toArrayBufferView(params.vmkBytes),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const salt = toArrayBufferView(sha256Sync(utf8Encoder.encode(`chm-hkdf-salt:${params.vaultId}`)));
  const info = toArrayBufferView(
    utf8Encoder.encode(`chm-vault-v1:${params.purpose}:epoch=${params.epoch}`),
  );
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    params.usage,
  );
}

export function createUnlockedVaultKeyring(vaultId = generateVaultId()): UnlockedVaultKeyring {
  const now = new Date().toISOString();
  return {
    vaultId,
    currentEpoch: 1,
    epochs: {
      1: generateVaultMasterKey(),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function rotateVaultKeyringEpoch(
  keyring: UnlockedVaultKeyring,
): UnlockedVaultKeyring {
  const nextEpoch = keyring.currentEpoch + 1;
  return {
    vaultId: keyring.vaultId,
    currentEpoch: nextEpoch,
    epochs: {
      ...keyring.epochs,
      [nextEpoch]: generateVaultMasterKey(),
    },
    createdAt: keyring.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function zeroizeUnlockedVaultKeyring(keyring: UnlockedVaultKeyring | null | undefined): void {
  if (!keyring) return;
  for (const keyBytes of Object.values(keyring.epochs)) {
    keyBytes.fill(0);
  }
}

export async function wrapVaultKeyringWithPassphrase(params: {
  keyring: UnlockedVaultKeyring;
  passphrase: string;
  iterations?: number;
}): Promise<WrappedVaultKeyringEnvelope> {
  const iterations = params.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const serializableEpochs: VaultKeyEpoch[] = Object.entries(params.keyring.epochs)
    .map(([ep, bytes]) => ({
      epoch: Number(ep),
      vmkBase64Url: base64UrlEncode(bytes),
      createdAt: params.keyring.updatedAt,
    }))
    .sort((a, b) => a.epoch - b.epoch);

  const plaintext = utf8Encoder.encode(
    JSON.stringify({
      vaultId: params.keyring.vaultId,
      currentEpoch: params.keyring.currentEpoch,
      epochs: serializableEpochs,
      createdAt: params.keyring.createdAt,
      updatedAt: params.keyring.updatedAt,
    }),
  );

  try {
    const wrappingKey = await derivePassphraseWrappingKey(params.passphrase, salt, iterations, [
      'encrypt',
    ]);
    const aad = buildKeyringAad(params.keyring.vaultId, params.keyring.currentEpoch);
    const ctBuf = await getSubtle().encrypt(
      { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
      wrappingKey,
      toArrayBufferView(plaintext),
    );
    return {
      format: VAULT_KEYRING_FORMAT,
      version: 1,
      vaultId: params.keyring.vaultId,
      currentEpoch: params.keyring.currentEpoch,
      kdf: 'PBKDF2-SHA256',
      iterations,
      cipher: 'AES-256-GCM',
      salt: base64UrlEncode(salt),
      iv: base64UrlEncode(iv),
      ciphertext: base64UrlEncode(new Uint8Array(ctBuf)),
      createdAt: params.keyring.createdAt,
      updatedAt: params.keyring.updatedAt,
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function unwrapVaultKeyringWithPassphrase(params: {
  envelope: WrappedVaultKeyringEnvelope;
  passphrase: string;
}): Promise<UnlockedVaultKeyring> {
  const env = params.envelope;
  if (
    !env ||
    env.format !== VAULT_KEYRING_FORMAT ||
    env.version !== 1 ||
    env.kdf !== 'PBKDF2-SHA256' ||
    env.cipher !== 'AES-256-GCM'
  ) {
    throw new Error('Unsupported or malformed encrypted Vault keyring envelope');
  }
  const salt = base64UrlDecode(env.salt);
  const iv = base64UrlDecode(env.iv);
  const ciphertext = base64UrlDecode(env.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 32) {
    throw new Error('Invalid encrypted Vault keyring byte lengths');
  }

  const wrappingKey = await derivePassphraseWrappingKey(params.passphrase, salt, env.iterations, [
    'decrypt',
  ]);
  const aad = buildKeyringAad(env.vaultId, env.currentEpoch);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await getSubtle().decrypt(
      { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
      wrappingKey,
      toArrayBufferView(ciphertext),
    );
  } catch {
    throw new Error('Failed to unlock Vault keyring (wrong passphrase or tampered metadata)');
  }

  const plainBytes = new Uint8Array(plainBuf);
  try {
    const parsed = JSON.parse(utf8Decoder.decode(plainBytes)) as {
      vaultId: string;
      currentEpoch: number;
      epochs: VaultKeyEpoch[];
      createdAt: string;
      updatedAt: string;
    };
    if (
      parsed.vaultId !== env.vaultId ||
      parsed.currentEpoch !== env.currentEpoch ||
      !Array.isArray(parsed.epochs) ||
      parsed.epochs.length === 0
    ) {
      throw new Error('Decrypted Vault keyring failed structural validation');
    }
    const epochs: Record<number, Uint8Array> = {};
    for (const item of parsed.epochs) {
      const keyBytes = base64UrlDecode(item.vmkBase64Url);
      if (keyBytes.length !== 32) {
        throw new Error('Invalid VMK byte length inside Vault keyring');
      }
      epochs[item.epoch] = keyBytes;
    }
    if (!epochs[parsed.currentEpoch]) {
      throw new Error('Current epoch key missing from Vault keyring');
    }
    return {
      vaultId: parsed.vaultId,
      currentEpoch: parsed.currentEpoch,
      epochs,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } finally {
    plainBytes.fill(0);
  }
}

export async function exportCrossDeviceVaultKeyShare(params: {
  keyring: UnlockedVaultKeyring;
  transferPassphrase: string;
  iterations?: number;
}): Promise<CrossDeviceVaultKeyShareEnvelope> {
  const iterations = params.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const epochs = Object.entries(params.keyring.epochs).map(([ep, bytes]) => ({
    epoch: Number(ep),
    vmkBase64Url: base64UrlEncode(bytes),
  }));
  const plaintext = utf8Encoder.encode(
    JSON.stringify({
      vaultId: params.keyring.vaultId,
      currentEpoch: params.keyring.currentEpoch,
      epochs,
    }),
  );
  try {
    const wrappingKey = await derivePassphraseWrappingKey(
      params.transferPassphrase,
      salt,
      iterations,
      ['encrypt'],
    );
    const aad = buildKeyShareAad(params.keyring.vaultId, params.keyring.currentEpoch);
    const ctBuf = await getSubtle().encrypt(
      { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
      wrappingKey,
      toArrayBufferView(plaintext),
    );
    return {
      format: VAULT_KEY_SHARE_FORMAT,
      version: 1,
      vaultId: params.keyring.vaultId,
      currentEpoch: params.keyring.currentEpoch,
      kdf: 'PBKDF2-SHA256',
      iterations,
      cipher: 'AES-256-GCM',
      salt: base64UrlEncode(salt),
      iv: base64UrlEncode(iv),
      ciphertext: base64UrlEncode(new Uint8Array(ctBuf)),
      createdAt: new Date().toISOString(),
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function importCrossDeviceVaultKeyShare(params: {
  envelope: CrossDeviceVaultKeyShareEnvelope;
  transferPassphrase: string;
}): Promise<UnlockedVaultKeyring> {
  const env = params.envelope;
  if (
    !env ||
    env.format !== VAULT_KEY_SHARE_FORMAT ||
    env.version !== 1 ||
    env.kdf !== 'PBKDF2-SHA256' ||
    env.cipher !== 'AES-256-GCM'
  ) {
    throw new Error('Malformed cross-device Vault key share');
  }
  const salt = base64UrlDecode(env.salt);
  const iv = base64UrlDecode(env.iv);
  const ciphertext = base64UrlDecode(env.ciphertext);
  const wrappingKey = await derivePassphraseWrappingKey(
    params.transferPassphrase,
    salt,
    env.iterations,
    ['decrypt'],
  );
  const aad = buildKeyShareAad(env.vaultId, env.currentEpoch);
  const plainBuf = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
    wrappingKey,
    toArrayBufferView(ciphertext),
  );
  const plainBytes = new Uint8Array(plainBuf);
  try {
    const parsed = JSON.parse(utf8Decoder.decode(plainBytes)) as {
      vaultId: string;
      currentEpoch: number;
      epochs: Array<{ epoch: number; vmkBase64Url: string }>;
    };
    const epochs: Record<number, Uint8Array> = {};
    for (const item of parsed.epochs) {
      const k = base64UrlDecode(item.vmkBase64Url);
      if (k.length !== 32) throw new Error('Invalid VMK inside key share');
      epochs[item.epoch] = k;
    }
    const now = new Date().toISOString();
    return {
      vaultId: parsed.vaultId,
      currentEpoch: parsed.currentEpoch,
      epochs,
      createdAt: now,
      updatedAt: now,
    };
  } finally {
    plainBytes.fill(0);
  }
}

export function computeRecordContentHash(plaintextJson: string | Uint8Array): string {
  const bytes =
    typeof plaintextJson === 'string' ? utf8Encoder.encode(plaintextJson) : plaintextJson;
  return bytesToHex(sha256Sync(bytes));
}

export async function encryptVaultRecordJson(params: {
  keyring: UnlockedVaultKeyring;
  purpose: VaultCryptoPurpose;
  recordId: string;
  payload: unknown;
  epoch?: number;
}): Promise<EncryptedVaultRecordEnvelope> {
  const epoch = params.epoch ?? params.keyring.currentEpoch;
  const vmk = params.keyring.epochs[epoch];
  if (!vmk) {
    throw new Error(`Missing Vault Master Key for epoch ${epoch}`);
  }
  const plaintextJson = JSON.stringify(params.payload);
  const plaintextBytes = utf8Encoder.encode(plaintextJson);
  const contentHash = computeRecordContentHash(plaintextBytes);

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const key = await derivePurposeSubkey({
    vmkBytes: vmk,
    vaultId: params.keyring.vaultId,
    epoch,
    purpose: params.purpose,
    usage: ['encrypt'],
  });

  const aad = buildRecordAad({
    vaultId: params.keyring.vaultId,
    epoch,
    purpose: params.purpose,
    recordId: params.recordId,
    contentHash,
  });

  const ciphertextBuf = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
    key,
    toArrayBufferView(plaintextBytes),
  );

  return {
    format: VAULT_CRYPTO_FORMAT,
    version: 1,
    vaultId: params.keyring.vaultId,
    epoch,
    purpose: params.purpose,
    recordId: params.recordId,
    contentHash,
    cipher: 'AES-256-GCM',
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertextBuf)),
    encryptedAt: new Date().toISOString(),
  };
}

export async function decryptVaultRecordJson<T = unknown>(params: {
  keyring: UnlockedVaultKeyring;
  envelope: EncryptedVaultRecordEnvelope;
  expectedPurpose: VaultCryptoPurpose;
  expectedRecordId?: string;
}): Promise<T> {
  const env = params.envelope;
  if (
    !env ||
    env.format !== VAULT_CRYPTO_FORMAT ||
    env.version !== 1 ||
    env.cipher !== 'AES-256-GCM'
  ) {
    throw new Error('Malformed encrypted Vault record envelope');
  }
  if (env.vaultId !== params.keyring.vaultId) {
    throw new Error('Encrypted record belongs to a different Vault ID');
  }
  if (env.purpose !== params.expectedPurpose) {
    throw new Error(`Purpose mismatch: expected ${params.expectedPurpose}, got ${env.purpose}`);
  }
  if (params.expectedRecordId && env.recordId !== params.expectedRecordId) {
    throw new Error(`Record ID mismatch: expected ${params.expectedRecordId}, got ${env.recordId}`);
  }

  const vmk = params.keyring.epochs[env.epoch];
  if (!vmk) {
    throw new Error(`No decryption key available for Vault epoch ${env.epoch}`);
  }

  const iv = base64UrlDecode(env.iv);
  const ciphertext = base64UrlDecode(env.ciphertext);
  if (iv.length !== 12 || ciphertext.length < 16) {
    throw new Error('Invalid ciphertext envelope lengths');
  }

  const key = await derivePurposeSubkey({
    vmkBytes: vmk,
    vaultId: env.vaultId,
    epoch: env.epoch,
    purpose: env.purpose,
    usage: ['decrypt'],
  });

  const aad = buildRecordAad({
    vaultId: env.vaultId,
    epoch: env.epoch,
    purpose: env.purpose,
    recordId: env.recordId,
    contentHash: env.contentHash,
  });

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await getSubtle().decrypt(
      { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad, tagLength: 128 },
      key,
      toArrayBufferView(ciphertext),
    );
  } catch {
    throw new Error('Encrypted Vault record failed integrity authentication');
  }

  const plainBytes = new Uint8Array(plainBuf);
  const actualHash = computeRecordContentHash(plainBytes);
  if (actualHash !== env.contentHash) {
    throw new Error('Decrypted Vault record content hash mismatch');
  }
  return JSON.parse(utf8Decoder.decode(plainBytes)) as T;
}
