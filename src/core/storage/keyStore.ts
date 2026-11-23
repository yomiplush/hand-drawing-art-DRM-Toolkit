import { parsePublicKeyExchangeInput } from '@yomiplush/chm-exchange/core';
import {
  computePublicKeyFingerprint,
  generateEd25519KeyMaterial,
  importNonExtractablePrivateKey,
  signWithCryptoKey,
  signWithSeed,
  supportsWebCryptoEd25519,
} from '../crypto/ed25519';
import { decryptKeyBackup, encryptKeyBackup } from '../crypto/keyBackup';
import type { EncryptedKeyBackup } from '../crypto/keyBackup';
import { base64UrlEncode } from '../crypto/sha256';
import { verifyKeyNoticeInput } from '../manifest/keyNotice';
import type { KeyNoticeReason, KeyNoticeType, VerifiedKeyNoticeResult } from '../manifest/keyNotice';

export const CHM_DB_NAME = 'certified-handmade-store';
export const CHM_DB_VERSION = 3;
export const STORE_AUTHOR_KEYS = 'authorKeys';
export const STORE_TRUSTED_KEYS = 'trustedKeys';
export const STORE_KEY_NOTICES = 'keyNotices';
export const STORE_DEVICE_IDENTITIES = 'deviceIdentities';
export const STORE_PAIRING_SESSIONS = 'pairingSessions';
export const STORE_USED_PAIRING_NONCES = 'usedPairingNonces';
export const STORE_PAIRED_DEVICES = 'pairedDevices';
export const STORE_DEVICE_REVOCATIONS = 'deviceRevocations';

export interface AuthorKeyRecord {
  id: string;
  label: string;
  publicKey: Uint8Array;
  publicKeyBase64Url: string;
  fingerprintHex: string;
  fingerprintShort: string;
  storageMode: 'webcrypto-non-extractable' | 'noble-encrypted-seed';
  webCryptoPrivateKey?: CryptoKey;
  encryptedBackup?: EncryptedKeyBackup;
  hasBackupDownloaded: boolean;
  createdAt: string;
}

export type TrustedKeyVerificationState = 'confirmed' | 'unconfirmed';

export interface TrustedKeyRecord {
  publicKeyBase64Url: string;
  publicKey: Uint8Array;
  fingerprintHex: string;
  fingerprintShort: string;
  label: string;
  note?: string;
  addedAt: string;
  verificationState?: TrustedKeyVerificationState;
  confirmedAt?: string;
}

export interface StoredKeyNoticeRecord {
  id: string;
  noticeType: KeyNoticeType;
  reason: KeyNoticeReason;
  subjectPublicKeyBase64Url: string;
  subjectFingerprintHex: string;
  subjectFingerprintShort: string;
  replacementPublicKeyBase64Url?: string;
  replacementFingerprintHex?: string;
  replacementFingerprintShort?: string;
  noticeIssuedAt: number;
  importedAt: string;
  token: string;
  note?: string;
}

export interface PublicKeyExportBundle {
  format: 'certified-handmade-public-key';
  version: 1;
  algorithm: 'Ed25519';
  publicKey: string;
  fingerprint: string;
  label: string;
  exportedAt: string;
}

export function openChmDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CHM_DB_NAME, CHM_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUTHOR_KEYS)) {
        db.createObjectStore(STORE_AUTHOR_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TRUSTED_KEYS)) {
        db.createObjectStore(STORE_TRUSTED_KEYS, { keyPath: 'publicKeyBase64Url' });
      }
      if (!db.objectStoreNames.contains(STORE_KEY_NOTICES)) {
        db.createObjectStore(STORE_KEY_NOTICES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DEVICE_IDENTITIES)) {
        db.createObjectStore(STORE_DEVICE_IDENTITIES, { keyPath: 'deviceIdHex' });
      }
      if (!db.objectStoreNames.contains(STORE_PAIRING_SESSIONS)) {
        db.createObjectStore(STORE_PAIRING_SESSIONS, { keyPath: 'requestIdHex' });
      }
      if (!db.objectStoreNames.contains(STORE_USED_PAIRING_NONCES)) {
        db.createObjectStore(STORE_USED_PAIRING_NONCES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PAIRED_DEVICES)) {
        db.createObjectStore(STORE_PAIRED_DEVICES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_DEVICE_REVOCATIONS)) {
        db.createObjectStore(STORE_DEVICE_REVOCATIONS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function withChmStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openChmDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      let resultValue: T;
      let hasResult = false;
      req.onsuccess = () => {
        resultValue = req.result;
        hasResult = true;
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      tx.oncomplete = () => {
        resolve(hasResult ? resultValue : (req.result as T));
      };
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function runChmTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openChmDatabase();
  try {
    const tx = db.transaction(storeNames, mode);
    const completion = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    const out = await fn(tx);
    await completion;
    return out;
  } finally {
    db.close();
  }
}

export function idbReqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function listAuthorKeys(): Promise<AuthorKeyRecord[]> {
  try {
    const list = await withChmStore<AuthorKeyRecord[]>(STORE_AUTHOR_KEYS, 'readonly', (s) =>
      s.getAll(),
    );
    return (list ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getAuthorKey(id: string): Promise<AuthorKeyRecord | undefined> {
  return withChmStore<AuthorKeyRecord | undefined>(STORE_AUTHOR_KEYS, 'readonly', (s) => s.get(id));
}

export async function createAuthorKey(params: {
  label: string;
  backupPassphrase?: string;
}): Promise<{ record: AuthorKeyRecord; encryptedBackup?: EncryptedKeyBackup }> {
  const label = params.label.trim().slice(0, 64) || 'My Artist Key';
  const material = await generateEd25519KeyMaterial();

  try {
    if (material.storageMode === 'noble-encrypted-seed' && !params.backupPassphrase) {
      throw new Error(
        'This browser requires a passphrase to store the private key encrypted (Web Crypto Ed25519 unavailable)',
      );
    }

    let encryptedBackup: EncryptedKeyBackup | undefined;
    if (params.backupPassphrase && params.backupPassphrase.length > 0) {
      encryptedBackup = await encryptKeyBackup({
        seed32: material.seed32,
        publicKey32: material.publicKey,
        passphrase: params.backupPassphrase,
        label,
      });
    }

    const fp = await computePublicKeyFingerprint(material.publicKey);
    const idBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(idBytes);
    const id = base64UrlEncode(idBytes);

    const record: AuthorKeyRecord = {
      id,
      label,
      publicKey: material.publicKey,
      publicKeyBase64Url: base64UrlEncode(material.publicKey),
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      storageMode: material.storageMode,
      webCryptoPrivateKey: material.webCryptoPrivateKey,
      encryptedBackup,
      hasBackupDownloaded: false,
      createdAt: new Date().toISOString(),
    };

    await withChmStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(record));
    return { record, encryptedBackup };
  } finally {
    material.wipeSeed();
  }
}

export async function markAuthorKeyBackedUp(id: string): Promise<void> {
  const rec = await getAuthorKey(id);
  if (!rec) return;
  rec.hasBackupDownloaded = true;
  await withChmStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(rec));
}

export async function restoreAuthorKeyFromBackup(
  rawBackup: unknown,
  passphrase: string,
): Promise<AuthorKeyRecord> {
  const decrypted = await decryptKeyBackup(rawBackup, passphrase);
  try {
    const canWebCrypto = await supportsWebCryptoEd25519();
    let webCryptoPrivateKey: CryptoKey | undefined;
    let storageMode: AuthorKeyRecord['storageMode'] = 'noble-encrypted-seed';

    if (canWebCrypto) {
      try {
        webCryptoPrivateKey = await importNonExtractablePrivateKey(decrypted.seed32);
        storageMode = 'webcrypto-non-extractable';
      } catch {
        storageMode = 'noble-encrypted-seed';
      }
    }

    const encryptedBackup = await encryptKeyBackup({
      seed32: decrypted.seed32,
      publicKey32: decrypted.publicKey32,
      passphrase,
      label: decrypted.label,
      createdAt: decrypted.createdAt,
    });

    const fp = await computePublicKeyFingerprint(decrypted.publicKey32);
    const idBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(idBytes);

    const record: AuthorKeyRecord = {
      id: base64UrlEncode(idBytes),
      label: decrypted.label,
      publicKey: decrypted.publicKey32,
      publicKeyBase64Url: base64UrlEncode(decrypted.publicKey32),
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      storageMode,
      webCryptoPrivateKey,
      encryptedBackup,
      hasBackupDownloaded: true,
      createdAt: decrypted.createdAt,
    };

    await withChmStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(record));
    return record;
  } finally {
    decrypted.seed32.fill(0);
  }
}

export async function deleteAuthorKey(id: string): Promise<void> {
  await withChmStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.delete(id));
}

export async function signWithAuthorKey(
  record: AuthorKeyRecord,
  message: Uint8Array,
  passphraseIfEncrypted?: string,
): Promise<Uint8Array> {
  if (record.storageMode === 'webcrypto-non-extractable' && record.webCryptoPrivateKey) {
    return signWithCryptoKey(record.webCryptoPrivateKey, message);
  }
  if (!record.encryptedBackup) {
    throw new Error('No signing key material available');
  }
  if (!passphraseIfEncrypted) {
    throw new Error('Passphrase required to unlock encrypted signing key');
  }
  const decrypted = await decryptKeyBackup(record.encryptedBackup, passphraseIfEncrypted);
  try {
    return signWithSeed(decrypted.seed32, message);
  } finally {
    decrypted.seed32.fill(0);
  }
}

export function buildPublicKeyExportBundle(record: {
  publicKeyBase64Url: string;
  fingerprintHex: string;
  label: string;
}): PublicKeyExportBundle {
  return {
    format: 'certified-handmade-public-key',
    version: 1,
    algorithm: 'Ed25519',
    publicKey: record.publicKeyBase64Url,
    fingerprint: record.fingerprintHex,
    label: record.label,
    exportedAt: new Date().toISOString(),
  };
}

export async function listTrustedKeys(): Promise<TrustedKeyRecord[]> {
  try {
    const list = await withChmStore<TrustedKeyRecord[]>(STORE_TRUSTED_KEYS, 'readonly', (s) =>
      s.getAll(),
    );
    return (list ?? []).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  } catch {
    return [];
  }
}

export async function findTrustedKeyByPublicKey(
  publicKey32: Uint8Array,
): Promise<TrustedKeyRecord | undefined> {
  const b64 = base64UrlEncode(publicKey32);
  try {
    return await withChmStore<TrustedKeyRecord | undefined>(STORE_TRUSTED_KEYS, 'readonly', (s) =>
      s.get(b64),
    );
  } catch {
    return undefined;
  }
}

export async function addTrustedKey(params: {
  publicKeyInput: string;
  label: string;
  note?: string;
  verificationState?: TrustedKeyVerificationState;
}): Promise<TrustedKeyRecord> {
  const imported = parsePublicKeyExchangeInput(params.publicKeyInput);
  const resolvedLabel = params.label.trim() || imported.displayName || 'Trusted Artist';
  const nowIso = new Date().toISOString();
  const verificationState: TrustedKeyVerificationState = params.verificationState ?? 'confirmed';

  const record: TrustedKeyRecord = {
    publicKeyBase64Url: imported.publicKeyBase64Url,
    publicKey: imported.publicKeyBytes,
    fingerprintHex: imported.fingerprintHex,
    fingerprintShort: imported.fingerprintShort,
    label: resolvedLabel.slice(0, 64) || 'Trusted Artist',
    note: params.note?.trim().slice(0, 200) || undefined,
    addedAt: nowIso,
    verificationState,
    confirmedAt: verificationState === 'confirmed' ? nowIso : undefined,
  };

  await withChmStore(STORE_TRUSTED_KEYS, 'readwrite', (s) => s.put(record));
  return record;
}

export async function confirmTrustedKey(
  publicKeyBase64Url: string,
): Promise<TrustedKeyRecord | undefined> {
  const existing = await withChmStore<TrustedKeyRecord | undefined>(
    STORE_TRUSTED_KEYS,
    'readonly',
    (s) => s.get(publicKeyBase64Url),
  );
  if (!existing) return undefined;
  const updated: TrustedKeyRecord = {
    ...existing,
    verificationState: 'confirmed',
    confirmedAt: new Date().toISOString(),
  };
  await withChmStore(STORE_TRUSTED_KEYS, 'readwrite', (s) => s.put(updated));
  return updated;
}

export async function removeTrustedKey(publicKeyBase64Url: string): Promise<void> {
  await withChmStore(STORE_TRUSTED_KEYS, 'readwrite', (s) => s.delete(publicKeyBase64Url));
}

export async function saveVerifiedKeyNotice(rawInput: string): Promise<{
  record: StoredKeyNoticeRecord;
  verified: VerifiedKeyNoticeResult;
}> {
  const verified = await verifyKeyNoticeInput(rawInput);
  if (!verified.valid) {
    throw new Error(verified.errors.join(' '));
  }
  const record: StoredKeyNoticeRecord = {
    id: verified.notice.noticeIdHex,
    noticeType: verified.notice.noticeType,
    reason: verified.notice.reason,
    subjectPublicKeyBase64Url: verified.subjectPublicKeyBase64Url,
    subjectFingerprintHex: verified.subjectFingerprintHex,
    subjectFingerprintShort: verified.subjectFingerprintShort,
    replacementPublicKeyBase64Url: verified.replacementPublicKeyBase64Url,
    replacementFingerprintHex: verified.replacementFingerprintHex,
    replacementFingerprintShort: verified.replacementFingerprintShort,
    noticeIssuedAt: verified.noticeIssuedAt,
    importedAt: new Date().toISOString(),
    token: verified.token,
    note: verified.notice.note,
  };
  await withChmStore(STORE_KEY_NOTICES, 'readwrite', (s) => s.put(record));
  return { record, verified };
}

export async function listKeyNotices(): Promise<StoredKeyNoticeRecord[]> {
  try {
    const list = await withChmStore<StoredKeyNoticeRecord[]>(STORE_KEY_NOTICES, 'readonly', (s) =>
      s.getAll(),
    );
    return (list ?? []).sort((a, b) => b.noticeIssuedAt - a.noticeIssuedAt);
  } catch {
    return [];
  }
}

export async function findKeyNoticesByPublicKey(
  publicKey32: Uint8Array,
): Promise<StoredKeyNoticeRecord[]> {
  const b64 = base64UrlEncode(publicKey32);
  const all = await listKeyNotices();
  return all.filter((n) => n.subjectPublicKeyBase64Url === b64);
}

export async function deleteKeyNotice(id: string): Promise<void> {
  await withChmStore(STORE_KEY_NOTICES, 'readwrite', (s) => s.delete(id));
}
