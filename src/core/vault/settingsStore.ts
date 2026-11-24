import type { VaultTombstoneRecord } from '../policies/policyStore';
import {
  STORE_STORAGE_STATE,
  STORE_VAULT_TOMBSTONES,
  runChmTransaction,
  withChmStore,
} from '../storage/keyStore';
import type { VaultSettingsSnapshot } from './types';

const STORAGE_STATE_SETTINGS_ID = 'vault-user-settings';

export async function loadVaultSettings(): Promise<VaultSettingsSnapshot> {
  try {
    const rec = await withChmStore<(VaultSettingsSnapshot & { id: string }) | undefined>(
      STORE_STORAGE_STATE,
      'readonly',
      (s) => s.get(STORAGE_STATE_SETTINGS_ID),
    );
    if (rec && typeof rec === 'object') {
      return {
        verifyBaseUrl: rec.verifyBaseUrl,
        preferredQrMode: rec.preferredQrMode,
        preferredLocale: rec.preferredLocale,
        activeAuthorProfileId: rec.activeAuthorProfileId,
        activePolicyPresetId: rec.activePolicyPresetId,
        updatedAt: rec.updatedAt || new Date().toISOString(),
        version: typeof rec.version === 'number' ? rec.version : 1,
      };
    }
  } catch {
    // IndexedDB unavailable
  }
  return {
    updatedAt: new Date(0).toISOString(),
    version: 1,
  };
}

export async function saveVaultSettings(
  patch: Partial<Omit<VaultSettingsSnapshot, 'updatedAt' | 'version'>>,
): Promise<VaultSettingsSnapshot> {
  const current = await loadVaultSettings();
  const next: VaultSettingsSnapshot & { id: string } = {
    id: STORAGE_STATE_SETTINGS_ID,
    verifyBaseUrl: patch.verifyBaseUrl !== undefined ? patch.verifyBaseUrl : current.verifyBaseUrl,
    preferredQrMode:
      patch.preferredQrMode !== undefined ? patch.preferredQrMode : current.preferredQrMode,
    preferredLocale:
      patch.preferredLocale !== undefined ? patch.preferredLocale : current.preferredLocale,
    activeAuthorProfileId:
      patch.activeAuthorProfileId !== undefined
        ? patch.activeAuthorProfileId
        : current.activeAuthorProfileId,
    activePolicyPresetId:
      patch.activePolicyPresetId !== undefined
        ? patch.activePolicyPresetId
        : current.activePolicyPresetId,
    updatedAt: new Date().toISOString(),
    version: (current.version || 0) + 1,
  };
  await withChmStore(STORE_STORAGE_STATE, 'readwrite', (s) => s.put(next));
  return {
    verifyBaseUrl: next.verifyBaseUrl,
    preferredQrMode: next.preferredQrMode,
    preferredLocale: next.preferredLocale,
    activeAuthorProfileId: next.activeAuthorProfileId,
    activePolicyPresetId: next.activePolicyPresetId,
    updatedAt: next.updatedAt,
    version: next.version,
  };
}

export async function listVaultTombstones(): Promise<VaultTombstoneRecord[]> {
  try {
    const rows = await withChmStore<VaultTombstoneRecord[]>(STORE_VAULT_TOMBSTONES, 'readonly', (s) =>
      s.getAll(),
    );
    return (rows ?? []).filter(
      (r) => r && typeof r.id === 'string' && typeof r.entityId === 'string',
    );
  } catch {
    return [];
  }
}

export async function recordVaultTombstones(entries: VaultTombstoneRecord[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await runChmTransaction([STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_VAULT_TOMBSTONES);
      for (const entry of entries) {
        store.put(entry);
      }
    });
  } catch {
    // Ignore when IDB unavailable
  }
}

export async function clearVaultTombstone(entityType: VaultTombstoneRecord['entityType'], entityId: string): Promise<void> {
  try {
    await withChmStore(STORE_VAULT_TOMBSTONES, 'readwrite', (s) => s.delete(`${entityType}:${entityId}`));
  } catch {
    // Ignore
  }
}
