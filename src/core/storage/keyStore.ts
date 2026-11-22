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

const DB_NAME = 'certified-handmade-store';
const DB_VERSION = 1;
const STORE_AUTHOR_KEYS = 'authorKeys';
const STORE_TRUSTED_KEYS = 'trustedKeys';

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

export interface TrustedKeyRecord {
  publicKeyBase64Url: string;
  publicKey: Uint8Array;
  fingerprintHex: string;
  fingerprintShort: string;
  label: string;
  note?: string;
  addedAt: string;
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

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUTHOR_KEYS)) {
        db.createObjectStore(STORE_AUTHOR_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TRUSTED_KEYS)) {
        db.createObjectStore(STORE_TRUSTED_KEYS, { keyPath: 'publicKeyBase64Url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB transaction failed'));
    });
  } finally {
    db.close();
  }
}

export async function listAuthorKeys(): Promise<AuthorKeyRecord[]> {
  try {
    const list = await withStore<AuthorKeyRecord[]>(STORE_AUTHOR_KEYS, 'readonly', (s) => s.getAll());
    return (list ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getAuthorKey(id: string): Promise<AuthorKeyRecord | undefined> {
  return withStore<AuthorKeyRecord | undefined>(STORE_AUTHOR_KEYS, 'readonly', (s) => s.get(id));
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

    await withStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(record));
    return { record, encryptedBackup };
  } finally {
    material.wipeSeed();
  }
}

export async function markAuthorKeyBackedUp(id: string): Promise<void> {
  const rec = await getAuthorKey(id);
  if (!rec) return;
  rec.hasBackupDownloaded = true;
  await withStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(rec));
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

    await withStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.put(record));
    return record;
  } finally {
    decrypted.seed32.fill(0);
  }
}

export async function deleteAuthorKey(id: string): Promise<void> {
  await withStore(STORE_AUTHOR_KEYS, 'readwrite', (s) => s.delete(id));
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
    const list = await withStore<TrustedKeyRecord[]>(STORE_TRUSTED_KEYS, 'readonly', (s) =>
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
    return await withStore<TrustedKeyRecord | undefined>(STORE_TRUSTED_KEYS, 'readonly', (s) =>
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
}): Promise<TrustedKeyRecord> {
  const imported = parsePublicKeyExchangeInput(params.publicKeyInput);
  const resolvedLabel = params.label.trim() || imported.displayName || 'Trusted Artist';

  const record: TrustedKeyRecord = {
    publicKeyBase64Url: imported.publicKeyBase64Url,
    publicKey: imported.publicKeyBytes,
    fingerprintHex: imported.fingerprintHex,
    fingerprintShort: imported.fingerprintShort,
    label: resolvedLabel.slice(0, 64) || 'Trusted Artist',
    note: params.note?.trim().slice(0, 200) || undefined,
    addedAt: new Date().toISOString(),
  };

  await withStore(STORE_TRUSTED_KEYS, 'readwrite', (s) => s.put(record));
  return record;
}

export async function removeTrustedKey(publicKeyBase64Url: string): Promise<void> {
  await withStore(STORE_TRUSTED_KEYS, 'readwrite', (s) => s.delete(publicKeyBase64Url));
}
