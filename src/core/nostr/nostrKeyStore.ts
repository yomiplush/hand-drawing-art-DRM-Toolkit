import {
  decryptNip49PrivateKey,
  encryptNip49PrivateKey,
  type Nip49KeySecurityByte,
} from './nip49';
import {
  assertDistinctFromEd25519Secrets,
  assertValidNostrPubkeyHex,
  assertValidNostrSecretKeyBytes,
  deriveNostrPublicKeyHex,
  encodeNpub,
  generateNostrKeypair,
  wipeBytes,
} from './secp256k1';
import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import {
  STORE_NOSTR_KEYS,
  withChmStore,
} from '../storage/keyStore';

export const NOSTR_WRAPPING_KEY_RECORD_ID = '__chm_nostr_wrap_v1__';

export type NostrKeyStorageMode = 'webcrypto-aesgcm-wrapped' | 'nip49-encrypted';

export interface NostrWrappingKeyRecord {
  deviceIdHex: typeof NOSTR_WRAPPING_KEY_RECORD_ID;
  recordKind: 'wrap-key';
  wrappingKey: CryptoKey;
  createdAt: string;
}

export interface NostrDeviceKeyRecord {
  deviceIdHex: string;
  recordKind: 'device-nostr-key';
  nostrPubkeyHex: string;
  npub: string;
  storageMode: NostrKeyStorageMode;
  wrappedSecret?: {
    ivBase64Url: string;
    ciphertextBase64Url: string;
  };
  encryptedNcryptsec?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNostrDeviceKeyInfo {
  deviceIdHex: string;
  nostrPubkeyHex: string;
  npub: string;
  storageMode: NostrKeyStorageMode;
  createdAt: string;
  updatedAt: string;
}

function isWrappingKeyRecord(raw: unknown): raw is NostrWrappingKeyRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const rec = raw as Partial<NostrWrappingKeyRecord>;
  return (
    rec.deviceIdHex === NOSTR_WRAPPING_KEY_RECORD_ID &&
    rec.recordKind === 'wrap-key' &&
    Boolean(rec.wrappingKey)
  );
}

export function isValidNostrDeviceKeyRecord(raw: unknown): raw is NostrDeviceKeyRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const rec = raw as Partial<NostrDeviceKeyRecord>;
  if (
    typeof rec.deviceIdHex !== 'string' ||
    rec.deviceIdHex === NOSTR_WRAPPING_KEY_RECORD_ID ||
    rec.recordKind !== 'device-nostr-key' ||
    typeof rec.nostrPubkeyHex !== 'string' ||
    typeof rec.npub !== 'string' ||
    typeof rec.createdAt !== 'string' ||
    typeof rec.updatedAt !== 'string'
  ) {
    return false;
  }
  try {
    assertValidNostrPubkeyHex(rec.nostrPubkeyHex);
    if (encodeNpub(rec.nostrPubkeyHex) !== rec.npub) return false;
  } catch {
    return false;
  }
  if (rec.storageMode === 'webcrypto-aesgcm-wrapped') {
    return Boolean(
      rec.wrappedSecret &&
        typeof rec.wrappedSecret.ivBase64Url === 'string' &&
        typeof rec.wrappedSecret.ciphertextBase64Url === 'string',
    );
  }
  if (rec.storageMode === 'nip49-encrypted') {
    return typeof rec.encryptedNcryptsec === 'string' && rec.encryptedNcryptsec.startsWith('ncryptsec1');
  }
  return false;
}

export function toPublicNostrDeviceKeyInfo(
  record: NostrDeviceKeyRecord,
): PublicNostrDeviceKeyInfo {
  return {
    deviceIdHex: record.deviceIdHex,
    nostrPubkeyHex: record.nostrPubkeyHex,
    npub: record.npub,
    storageMode: record.storageMode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildWrapAad(deviceIdHex: string, nostrPubkeyHex: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(`chm-nostr-device-key-v1:${deviceIdHex}:${nostrPubkeyHex}`);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

async function getOrCreateAesGcmWrappingKey(): Promise<CryptoKey | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.generateKey !== 'function') {
    return null;
  }
  try {
    const existing = await withChmStore<unknown>(STORE_NOSTR_KEYS, 'readonly', (s) =>
      s.get(NOSTR_WRAPPING_KEY_RECORD_ID),
    );
    if (isWrappingKeyRecord(existing)) {
      return existing.wrappingKey;
    }
  } catch {
    // Fall through to generation attempt
  }

  try {
    const key = await subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // Non-extractable whenever Web Crypto is available
      ['encrypt', 'decrypt'],
    );
    const record: NostrWrappingKeyRecord = {
      deviceIdHex: NOSTR_WRAPPING_KEY_RECORD_ID,
      recordKind: 'wrap-key',
      wrappingKey: key,
      createdAt: new Date().toISOString(),
    };
    await withChmStore(STORE_NOSTR_KEYS, 'readwrite', (s) => s.put(record));
    return key;
  } catch {
    // Fallback when environment cannot structured-clone CryptoKey into IndexedDB (e.g., restricted environments)
    return null;
  }
}

async function wrapSecretWithCryptoKey(params: {
  wrappingKey: CryptoKey;
  secretKey: Uint8Array;
  deviceIdHex: string;
  nostrPubkeyHex: string;
}): Promise<{ ivBase64Url: string; ciphertextBase64Url: string }> {
  const iv = new Uint8Array(new ArrayBuffer(12));
  globalThis.crypto.getRandomValues(iv);
  const aad = buildWrapAad(params.deviceIdHex, params.nostrPubkeyHex);
  const plainBuf = toArrayBufferView(params.secretKey);
  try {
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      params.wrappingKey,
      plainBuf,
    );
    return {
      ivBase64Url: base64UrlEncode(iv),
      ciphertextBase64Url: base64UrlEncode(new Uint8Array(encrypted)),
    };
  } finally {
    plainBuf.fill(0);
  }
}

async function unwrapSecretWithCryptoKey(params: {
  wrappingKey: CryptoKey;
  wrappedSecret: { ivBase64Url: string; ciphertextBase64Url: string };
  deviceIdHex: string;
  nostrPubkeyHex: string;
}): Promise<Uint8Array> {
  const iv = toArrayBufferView(base64UrlDecode(params.wrappedSecret.ivBase64Url));
  const ciphertext = toArrayBufferView(base64UrlDecode(params.wrappedSecret.ciphertextBase64Url));
  const aad = buildWrapAad(params.deviceIdHex, params.nostrPubkeyHex);
  const plainBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    params.wrappingKey,
    ciphertext,
  );
  const secretKey = new Uint8Array(plainBuf);
  try {
    assertValidNostrSecretKeyBytes(secretKey, 'Unwrapped Nostr device secret key');
    const derivedPub = deriveNostrPublicKeyHex(secretKey);
    if (derivedPub !== params.nostrPubkeyHex) {
      throw new Error('Unwrapped Nostr secret key does not match stored public key');
    }
    return secretKey;
  } catch (err) {
    secretKey.fill(0);
    throw err;
  }
}

export async function getDeviceNostrKeyRecord(
  deviceIdHex: string,
): Promise<NostrDeviceKeyRecord | null> {
  try {
    const raw = await withChmStore<unknown>(STORE_NOSTR_KEYS, 'readonly', (s) =>
      s.get(deviceIdHex),
    );
    return isValidNostrDeviceKeyRecord(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function getOrCreateDeviceNostrKey(params: {
  deviceIdHex: string;
  passphraseIfFallback?: string;
  disallowedEd25519Bytes?: ReadonlyArray<Uint8Array | undefined | null>;
  nip49LogN?: number;
}): Promise<NostrDeviceKeyRecord> {
  const existing = await getDeviceNostrKeyRecord(params.deviceIdHex);
  if (existing) {
    return existing;
  }

  const generated = generateNostrKeypair(params.disallowedEd25519Bytes ?? []);
  try {
    return await persistDeviceNostrSecret({
      deviceIdHex: params.deviceIdHex,
      secretKey: generated.secretKey,
      passphraseIfFallback: params.passphraseIfFallback,
      disallowedEd25519Bytes: params.disallowedEd25519Bytes,
      nip49LogN: params.nip49LogN,
    });
  } finally {
    wipeBytes(generated.secretKey);
  }
}

async function persistDeviceNostrSecret(params: {
  deviceIdHex: string;
  secretKey: Uint8Array;
  passphraseIfFallback?: string;
  disallowedEd25519Bytes?: ReadonlyArray<Uint8Array | undefined | null>;
  nip49LogN?: number;
}): Promise<NostrDeviceKeyRecord> {
  if (!params.deviceIdHex || params.deviceIdHex === NOSTR_WRAPPING_KEY_RECORD_ID) {
    throw new Error('Invalid deviceIdHex for Nostr key storage');
  }
  assertValidNostrSecretKeyBytes(params.secretKey);
  assertDistinctFromEd25519Secrets(params.secretKey, params.disallowedEd25519Bytes ?? []);

  const nostrPubkeyHex = deriveNostrPublicKeyHex(params.secretKey);
  const npub = encodeNpub(nostrPubkeyHex);
  const now = new Date().toISOString();

  const wrappingKey = await getOrCreateAesGcmWrappingKey();
  let record: NostrDeviceKeyRecord;

  if (wrappingKey) {
    const wrappedSecret = await wrapSecretWithCryptoKey({
      wrappingKey,
      secretKey: params.secretKey,
      deviceIdHex: params.deviceIdHex,
      nostrPubkeyHex,
    });
    record = {
      deviceIdHex: params.deviceIdHex,
      recordKind: 'device-nostr-key',
      nostrPubkeyHex,
      npub,
      storageMode: 'webcrypto-aesgcm-wrapped',
      wrappedSecret,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    if (!params.passphraseIfFallback || params.passphraseIfFallback.length === 0) {
      throw new Error(
        'Web Crypto AES-GCM wrapping is unavailable in this environment; a passphrase is required to encrypt the Nostr device key with NIP-49.',
      );
    }
    const encryptedNcryptsec = await encryptNip49PrivateKey({
      secretKey: params.secretKey,
      password: params.passphraseIfFallback,
      logN: params.nip49LogN ?? 16,
      keySecurityByte: 0x01,
    });
    record = {
      deviceIdHex: params.deviceIdHex,
      recordKind: 'device-nostr-key',
      nostrPubkeyHex,
      npub,
      storageMode: 'nip49-encrypted',
      encryptedNcryptsec,
      createdAt: now,
      updatedAt: now,
    };
  }

  await withChmStore(STORE_NOSTR_KEYS, 'readwrite', (s) => s.put(record));
  return record;
}

/**
 * Unlocks the stored Nostr device secret key only inside the callback lifetime,
 * and unconditionally wipes the decrypted secret scalar in `finally`.
 */
export async function withUnlockedDeviceNostrSecret<T>(
  params: {
    deviceIdHex: string;
    passphraseIfFallback?: string;
  },
  fn: (secretKey: Uint8Array, record: NostrDeviceKeyRecord) => Promise<T> | T,
): Promise<T> {
  const record = await getDeviceNostrKeyRecord(params.deviceIdHex);
  if (!record) {
    throw new Error('No Nostr sync key exists for this device yet.');
  }

  let secretKey: Uint8Array | undefined;
  try {
    if (record.storageMode === 'webcrypto-aesgcm-wrapped') {
      if (!record.wrappedSecret) {
        throw new Error('Missing AES-GCM wrapped Nostr key payload');
      }
      const wrapRaw = await withChmStore<unknown>(STORE_NOSTR_KEYS, 'readonly', (s) =>
        s.get(NOSTR_WRAPPING_KEY_RECORD_ID),
      );
      if (!isWrappingKeyRecord(wrapRaw)) {
        throw new Error('Device Nostr wrapping CryptoKey is missing or unreadable.');
      }
      secretKey = await unwrapSecretWithCryptoKey({
        wrappingKey: wrapRaw.wrappingKey,
        wrappedSecret: record.wrappedSecret,
        deviceIdHex: record.deviceIdHex,
        nostrPubkeyHex: record.nostrPubkeyHex,
      });
    } else {
      if (!record.encryptedNcryptsec) {
        throw new Error('Missing NIP-49 encrypted Nostr key payload');
      }
      if (!params.passphraseIfFallback) {
        throw new Error('Passphrase required to unlock NIP-49 encrypted Nostr device key.');
      }
      const dec = await decryptNip49PrivateKey(record.encryptedNcryptsec, params.passphraseIfFallback);
      if (deriveNostrPublicKeyHex(dec.secretKey) !== record.nostrPubkeyHex) {
        dec.secretKey.fill(0);
        throw new Error('Decrypted NIP-49 key does not match stored Nostr public key.');
      }
      secretKey = dec.secretKey;
    }
    return await fn(secretKey, record);
  } finally {
    wipeBytes(secretKey);
  }
}

export async function exportDeviceNostrBackupNcryptsec(params: {
  deviceIdHex: string;
  backupPassword: string;
  unlockPassphraseIfFallback?: string;
  logN?: number;
  keySecurityByte?: Nip49KeySecurityByte;
}): Promise<{ ncryptsec: string; npub: string; nostrPubkeyHex: string }> {
  return withUnlockedDeviceNostrSecret(
    {
      deviceIdHex: params.deviceIdHex,
      passphraseIfFallback: params.unlockPassphraseIfFallback,
    },
    async (secretKey, record) => {
      const ncryptsec = await encryptNip49PrivateKey({
        secretKey,
        password: params.backupPassword,
        logN: params.logN ?? 16,
        keySecurityByte: params.keySecurityByte ?? 0x01,
      });
      return {
        ncryptsec,
        npub: record.npub,
        nostrPubkeyHex: record.nostrPubkeyHex,
      };
    },
  );
}

export async function importDeviceNostrBackupNcryptsec(params: {
  deviceIdHex: string;
  ncryptsec: string;
  backupPassword: string;
  passphraseIfFallback?: string;
  disallowedEd25519Bytes?: ReadonlyArray<Uint8Array | undefined | null>;
  nip49LogN?: number;
}): Promise<NostrDeviceKeyRecord> {
  const decrypted = await decryptNip49PrivateKey(params.ncryptsec, params.backupPassword);
  try {
    return await persistDeviceNostrSecret({
      deviceIdHex: params.deviceIdHex,
      secretKey: decrypted.secretKey,
      passphraseIfFallback: params.passphraseIfFallback ?? params.backupPassword,
      disallowedEd25519Bytes: params.disallowedEd25519Bytes,
      nip49LogN: params.nip49LogN,
    });
  } finally {
    wipeBytes(decrypted.secretKey);
  }
}

export async function deleteDeviceNostrKey(deviceIdHex: string): Promise<void> {
  if (!deviceIdHex || deviceIdHex === NOSTR_WRAPPING_KEY_RECORD_ID) return;
  await withChmStore(STORE_NOSTR_KEYS, 'readwrite', (s) => s.delete(deviceIdHex));
}
