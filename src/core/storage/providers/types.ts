import type {
  EncryptedVaultBackupV1,
  VaultBackupBundleV1,
} from '../../vault/types';

export type StorageProviderId = 'indexeddb' | 'portable-file' | 'google-drive' | (string & {});

export type StorageProviderKind = 'local' | 'file' | 'cloud' | 'decentralized';

export interface StorageProviderCapabilities {
  supportsIncrementalSync: boolean;
  supportsOffline: boolean;
  requiresNetwork: boolean;
  supportsPassphraseEncryption: boolean;
  supportsAccountSwitch: boolean;
}

export interface StorageProviderStatus {
  id: StorageProviderId;
  kind: StorageProviderKind;
  label: string;
  available: boolean;
  connected: boolean;
  active: boolean;
  accountLabel?: string;
  vaultId?: string;
  lastSyncedAt?: string;
  pendingOperations: number;
  conflictCount: number;
  detail?: string;
  error?: string;
}

export interface VaultSnapshotImportResult {
  importedProofs: number;
  rejectedProofs: number;
  importedTrustedArtists: number;
  importedProfiles: number;
  importedPresets: number;
  restoredSettings: boolean;
  restoredProfile: boolean;
}

export interface StorageSyncResult {
  providerId: StorageProviderId;
  ok: boolean;
  uploadedCount: number;
  downloadedCount: number;
  skippedDuplicateCount: number;
  conflictCount: number;
  tombstonesApplied: number;
  syncedAt: string;
  message: string;
}

export interface StorageProvider {
  readonly id: StorageProviderId;
  readonly kind: StorageProviderKind;
  readonly label: string;
  readonly capabilities: StorageProviderCapabilities;
  getStatus(): Promise<StorageProviderStatus>;
  exportSnapshot(): Promise<VaultBackupBundleV1>;
  importSnapshot(bundle: VaultBackupBundleV1): Promise<VaultSnapshotImportResult>;
  exportEncryptedSnapshot?(passphrase: string): Promise<EncryptedVaultBackupV1>;
  importEncryptedSnapshot?(
    encrypted: EncryptedVaultBackupV1 | string,
    passphrase: string,
  ): Promise<VaultSnapshotImportResult>;
  sync?(): Promise<StorageSyncResult>;
  disconnect?(options?: { revokeAuthorization?: boolean }): Promise<void>;
}
