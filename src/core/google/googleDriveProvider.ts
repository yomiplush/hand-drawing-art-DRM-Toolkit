import type { EncryptedKeyBackup } from '../crypto/keyBackup';
import { exportVaultBackupBundle, importVaultBackupJson } from '../vault/vaultBackup';
import type { VaultBackupBundleV1 } from '../vault/types';
import {
  type UnlockedVaultKeyring,
  zeroizeUnlockedVaultKeyring,
} from '../vault/vaultCrypto';
import {
  type PersistedDriveAccountState,
  type SyncedRecoveryKeyEntry,
  createDriveVaultKeyShareForDevice,
  initializeOrUnlockDriveVault,
  listEncryptedKeyRecoveryBackups,
  loadDriveAccountState,
  resolveVaultSyncConflict,
  restoreAuthorKeyFromDriveRecovery,
  rotateDriveVaultKeyEpoch,
  runGoogleDriveSync,
  uploadEncryptedKeyRecoveryBackup,
} from '../vault/driveSyncEngine';
import type {
  StorageProvider,
  StorageProviderCapabilities,
  StorageProviderStatus,
  StorageSyncResult,
  VaultSnapshotImportResult,
} from '../storage/providers/types';
import { checkGoogleDriveEnvironmentSupport } from './config';
import { GoogleDriveClient } from './driveApi';
import { googleAuthManager, type InMemoryGoogleAuthManager } from './gisAuth';

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly id = 'google-drive' as const;
  readonly kind = 'cloud' as const;
  readonly label = 'Google Drive App Data (Encrypted Vault)';
  readonly capabilities: StorageProviderCapabilities = {
    supportsIncrementalSync: true,
    supportsOffline: false,
    requiresNetwork: true,
    supportsPassphraseEncryption: true,
    supportsAccountSwitch: true,
  };

  private readonly authManager: InMemoryGoogleAuthManager;
  private readonly driveClient: GoogleDriveClient;
  private unlockedKeyring: UnlockedVaultKeyring | null = null;
  private activeAccountKey: string | null = null;

  constructor(options?: {
    authManager?: InMemoryGoogleAuthManager;
    driveClient?: GoogleDriveClient;
  }) {
    this.authManager = options?.authManager ?? googleAuthManager;
    this.driveClient = options?.driveClient ?? new GoogleDriveClient();
  }

  getAuthManager(): InMemoryGoogleAuthManager {
    return this.authManager;
  }

  getDriveClient(): GoogleDriveClient {
    return this.driveClient;
  }

  isVaultUnlocked(): boolean {
    const auth = this.authManager.getState();
    return Boolean(
      auth.connected &&
        this.unlockedKeyring &&
        this.activeAccountKey === auth.account?.accountKey,
    );
  }

  getUnlockedKeyring(): UnlockedVaultKeyring | null {
    return this.unlockedKeyring;
  }

  async connectAccount(prompt: 'select_account' | 'consent' = 'select_account') {
    const result = await this.authManager.connectInteractive({ prompt });
    if (result.switchedAccount && this.unlockedKeyring) {
      zeroizeUnlockedVaultKeyring(this.unlockedKeyring);
      this.unlockedKeyring = null;
    }
    this.activeAccountKey = result.account?.accountKey ?? null;
    return result;
  }

  async unlockOrInitializeVault(params: {
    vaultPassphrase: string;
    pbkdf2Iterations?: number;
    importedKeyring?: UnlockedVaultKeyring;
  }) {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account) {
      throw new Error('Google account metadata unavailable');
    }
    const res = await initializeOrUnlockDriveVault({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      vaultPassphrase: params.vaultPassphrase,
      pbkdf2Iterations: params.pbkdf2Iterations,
      importedKeyring: params.importedKeyring,
    });
    if (this.unlockedKeyring && this.unlockedKeyring !== res.keyring) {
      zeroizeUnlockedVaultKeyring(this.unlockedKeyring);
    }
    this.unlockedKeyring = res.keyring;
    this.activeAccountKey = account.accountKey;
    return res;
  }

  async getPersistedAccountState(): Promise<PersistedDriveAccountState | null> {
    const account = this.authManager.getState().account;
    if (!account) return null;
    return loadDriveAccountState(account.accountKey);
  }

  async getStatus(): Promise<StorageProviderStatus> {
    const env = checkGoogleDriveEnvironmentSupport();
    const auth = this.authManager.getState();
    const accountKey = auth.account?.accountKey;
    const state = accountKey ? await loadDriveAccountState(accountKey) : null;
    const accountLabel =
      auth.account?.emailAddress || auth.account?.displayName || undefined;

    return {
      id: this.id,
      kind: this.kind,
      label: this.label,
      available: env.supported,
      connected: auth.connected,
      active: auth.connected && this.isVaultUnlocked(),
      accountLabel,
      vaultId: state?.vaultId || undefined,
      lastSyncedAt: state?.lastSyncedAt,
      pendingOperations: state?.pendingQueue.length ?? 0,
      conflictCount: state?.conflicts.length ?? 0,
      detail: !env.supported
        ? env.message
        : !auth.connected
          ? 'Not connected. Local browser storage works 100% independently.'
          : !this.isVaultUnlocked()
            ? `Connected as ${accountLabel ?? 'Google user'} (appDataFolder scope). Enter Vault passphrase to unlock sync.`
            : `Synced as ${accountLabel ?? 'Google user'} in hidden appDataFolder (client-side AES-256-GCM encrypted).`,
      error: auth.lastError ?? state?.rollbackWarning,
    };
  }

  async sync(): Promise<StorageSyncResult> {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account) {
      throw new Error('Google account not verified');
    }
    if (!this.unlockedKeyring || this.activeAccountKey !== account.accountKey) {
      throw new Error('Unlock your Google Drive Vault with its passphrase before syncing.');
    }
    const { syncResult } = await runGoogleDriveSync({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      keyring: this.unlockedKeyring,
    });
    return syncResult;
  }

  async uploadOptionalEncryptedRecoveryBackup(params: {
    authorKeyId?: string;
    encryptedKeyEnvelope?: EncryptedKeyBackup;
  }): Promise<{ entries: SyncedRecoveryKeyEntry[]; fileId: string }> {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account || !this.unlockedKeyring || this.activeAccountKey !== account.accountKey) {
      throw new Error('Unlock Google Drive Vault before uploading an encrypted key recovery backup.');
    }
    return uploadEncryptedKeyRecoveryBackup({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      keyring: this.unlockedKeyring,
      authorKeyId: params.authorKeyId,
      encryptedKeyEnvelope: params.encryptedKeyEnvelope,
    });
  }

  async listOptionalEncryptedRecoveryBackups(): Promise<SyncedRecoveryKeyEntry[]> {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account || !this.unlockedKeyring || this.activeAccountKey !== account.accountKey) {
      throw new Error('Unlock Google Drive Vault first to view encrypted key recovery backups.');
    }
    return listEncryptedKeyRecoveryBackups({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      keyring: this.unlockedKeyring,
    });
  }

  async restoreKeyFromOptionalRecoveryBackup(params: {
    publicKey: string;
    backupPassphrase: string;
  }) {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account || !this.unlockedKeyring || this.activeAccountKey !== account.accountKey) {
      throw new Error('Unlock Google Drive Vault first to restore an encrypted key backup.');
    }
    return restoreAuthorKeyFromDriveRecovery({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      keyring: this.unlockedKeyring,
      publicKey: params.publicKey,
      backupPassphrase: params.backupPassphrase,
    });
  }

  async resolveConflict(params: {
    conflictId: string;
    resolution: 'keep-local' | 'accept-remote' | 'keep-both';
  }): Promise<PersistedDriveAccountState> {
    const account = this.authManager.getState().account;
    if (!account) {
      throw new Error('Connect Google account first');
    }
    return resolveVaultSyncConflict({
      accountKey: account.accountKey,
      conflictId: params.conflictId,
      resolution: params.resolution,
    });
  }

  async rotateKeyAfterDeviceRevocation(params: {
    vaultPassphrase: string;
    pbkdf2Iterations?: number;
  }) {
    const token = this.authManager.getAccessTokenOrThrow();
    const account = this.authManager.getState().account;
    if (!account || !this.unlockedKeyring) {
      throw new Error('Unlock Google Drive Vault before rotating keys');
    }
    const rotated = await rotateDriveVaultKeyEpoch({
      client: this.driveClient,
      accessToken: token,
      accountKey: account.accountKey,
      currentKeyring: this.unlockedKeyring,
      vaultPassphrase: params.vaultPassphrase,
      pbkdf2Iterations: params.pbkdf2Iterations,
    });
    this.unlockedKeyring = rotated.keyring;
    return rotated;
  }

  async createCrossDeviceKeyShare(params: { transferPassphrase: string; iterations?: number }) {
    if (!this.unlockedKeyring) {
      throw new Error('Unlock Google Drive Vault first to export a cross-device key share');
    }
    return createDriveVaultKeyShareForDevice({
      keyring: this.unlockedKeyring,
      transferPassphrase: params.transferPassphrase,
      iterations: params.iterations,
    });
  }

  async exportSnapshot(): Promise<VaultBackupBundleV1> {
    return exportVaultBackupBundle();
  }

  async importSnapshot(bundle: VaultBackupBundleV1): Promise<VaultSnapshotImportResult> {
    return importVaultBackupJson({ rawJson: bundle });
  }

  async disconnect(options?: { revokeAuthorization?: boolean }): Promise<void> {
    zeroizeUnlockedVaultKeyring(this.unlockedKeyring);
    this.unlockedKeyring = null;
    this.activeAccountKey = null;
    await this.authManager.disconnect(options);
  }
}

export const defaultGoogleDriveProvider = new GoogleDriveStorageProvider();
