const VAULT_DB_NAME = 'certified-handmade-encrypted-vaults';
const VAULT_DB_VERSION = 1;
const STORE_VAULTS = 'vaults';

export interface LocalEncryptedVaultMeta {
  id: string;
  vaultName: string;
  itemCount: number;
  byteLength: number;
  createdAt: number;
}

export interface LocalEncryptedVaultRecord extends LocalEncryptedVaultMeta {
  /** Zero-knowledge encrypted .gdvault binary (never stores plaintext or passphrase). */
  encryptedBytes: Uint8Array;
}

const memoryStore = new Map<string, LocalEncryptedVaultRecord>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VAULTS)) {
        db.createObjectStore(STORE_VAULTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open local encrypted vault DB'));
  });
}

export async function saveLocalEncryptedVault(params: {
  id?: string;
  vaultName: string;
  itemCount: number;
  vaultBlob: Blob;
}): Promise<LocalEncryptedVaultMeta> {
  const id =
    params.id ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const encryptedBytes = new Uint8Array(await params.vaultBlob.arrayBuffer());
  const record: LocalEncryptedVaultRecord = {
    id,
    vaultName: params.vaultName.trim() || 'GalleryDeck Vault',
    itemCount: params.itemCount,
    byteLength: encryptedBytes.byteLength,
    createdAt: Date.now(),
    encryptedBytes,
  };

  memoryStore.set(id, record);
  if (hasIndexedDb()) {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VAULTS, 'readwrite');
      tx.objectStore(STORE_VAULTS).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to save encrypted vault locally'));
      };
    });
  }

  return {
    id: record.id,
    vaultName: record.vaultName,
    itemCount: record.itemCount,
    byteLength: record.byteLength,
    createdAt: record.createdAt,
  };
}

export async function listLocalEncryptedVaults(): Promise<LocalEncryptedVaultMeta[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryStore.values())
      .map(({ id, vaultName, itemCount, byteLength, createdAt }) => ({
        id,
        vaultName,
        itemCount,
        byteLength,
        createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  const db = await openVaultDb();
  return new Promise<LocalEncryptedVaultMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORE_VAULTS, 'readonly');
    const req = tx.objectStore(STORE_VAULTS).getAll();
    req.onsuccess = () => {
      db.close();
      const rows = (req.result as LocalEncryptedVaultRecord[] | undefined) ?? [];
      resolve(
        rows
          .map(({ id, vaultName, itemCount, byteLength, createdAt }) => ({
            id,
            vaultName,
            itemCount,
            byteLength,
            createdAt,
          }))
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to list local encrypted vaults'));
    };
  });
}

export async function loadLocalEncryptedVaultFile(id: string): Promise<File | null> {
  let record: LocalEncryptedVaultRecord | undefined = memoryStore.get(id);
  if (!record && hasIndexedDb()) {
    const db = await openVaultDb();
    record = await new Promise<LocalEncryptedVaultRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_VAULTS, 'readonly');
      const req = tx.objectStore(STORE_VAULTS).get(id);
      req.onsuccess = () => {
        db.close();
        resolve(req.result as LocalEncryptedVaultRecord | undefined);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Failed to load local encrypted vault'));
      };
    });
  }
  if (!record) return null;
  const safeName = record.vaultName.replace(/[^a-zA-Z0-9_-]/g, '-') || 'vault';
  return new File([record.encryptedBytes.slice()], `${safeName}.gdvault`, {
    type: 'application/octet-stream',
  });
}

export async function deleteLocalEncryptedVault(id: string): Promise<void> {
  memoryStore.delete(id);
  if (!hasIndexedDb()) return;
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VAULTS, 'readwrite');
    tx.objectStore(STORE_VAULTS).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to delete local encrypted vault'));
    };
  });
}
