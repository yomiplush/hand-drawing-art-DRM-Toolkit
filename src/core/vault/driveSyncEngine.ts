import { computePublicKeyFingerprintSync, parsePairingQrInput } from '@yomiplush/chm-exchange/core';
import { isValidStrictEd25519PublicKey } from '../crypto/ed25519';
import {
  KEY_BACKUP_FORMAT,
  KEY_BACKUP_VERSION,
  type EncryptedKeyBackup,
} from '../crypto/keyBackup';
import { base64UrlDecode, bytesToHex, sha256Sync } from '../crypto/sha256';
import {
  NOSTR_WRAPPING_KEY_RECORD_ID,
  isValidNostrDeviceKeyRecord,
  type NostrDeviceKeyRecord,
} from '../nostr/nostrKeyStore';
import {
  listPolicyPresets,
  upsertPolicyPresetsBatch,
  type VaultTombstoneRecord,
} from '../policies/policyStore';
import type { PolicyPreset } from '../policies/types';
import {
  listAuthorProfiles,
  upsertAuthorProfilesBatch,
} from '../profiles/profileStore';
import type { AuthorProfile } from '../profiles/types';
import type { DeviceRevocationRecord, PairedDeviceRecord } from '../storage/devicePairingStore';
import {
  importDeviceRevocationNotice,
  loadDevicePairingState,
} from '../storage/devicePairingStore';
import {
  STORE_CREATOR_PROFILES,
  STORE_NOSTR_KEYS,
  STORE_PAIRED_DEVICES,
  STORE_POLICY_PRESETS,
  STORE_PROOF_VAULT,
  STORE_STORAGE_STATE,
  STORE_TRUSTED_KEYS,
  type TrustedKeyRecord,
  getAuthorKey,
  listAuthorKeys,
  listTrustedKeys,
  restoreAuthorKeyFromBackup,
  runChmTransaction,
  withChmStore,
} from '../storage/keyStore';
import type { StorageSyncResult } from '../storage/providers/types';
import { GoogleDriveClient } from '../google/driveApi';
import {
  type CrossDeviceVaultKeyShareEnvelope,
  type EncryptedVaultRecordEnvelope,
  type UnlockedVaultKeyring,
  type WrappedVaultKeyringEnvelope,
  computeRecordContentHash,
  createUnlockedVaultKeyring,
  decryptVaultRecordJson,
  encryptVaultRecordJson,
  exportCrossDeviceVaultKeyShare,
  importCrossDeviceVaultKeyShare,
  rotateVaultKeyringEpoch,
  unwrapVaultKeyringWithPassphrase,
  wrapVaultKeyringWithPassphrase,
} from './vaultCrypto';
import {
  listVaultTombstones,
  loadVaultSettings,
  recordVaultTombstones,
  saveVaultSettings,
} from './settingsStore';
import type { VaultProofRecord, VaultSettingsSnapshot } from './types';
import {
  listAllVaultProofs,
  saveVaultProofBatch,
  verifyAndBuildVaultProofRecord,
} from './vaultStore';

const utf8Encoder = new TextEncoder();

export interface DriveRemoteChunkRef {
  chunkId: string;
  fileId: string;
  contentHash: string;
  epoch: number;
  proofIds: string[];
}

export interface SyncedAuthorIdentityRecord {
  publicKeyBase64Url: string;
  fingerprintHex: string;
  fingerprintShort: string;
  label: string;
  createdAt: string;
  sourceKind: 'author-public' | 'trusted-artist';
  verificationState?: 'confirmed' | 'unconfirmed';
  linkedNostrPubkeyHex?: string;
  linkedNostrNpub?: string;
}

export interface SyncedDevicesSnapshotPayload {
  schemaVersion: 1;
  pairedDevices: PairedDeviceRecord[];
  revocations: DeviceRevocationRecord[];
}

export interface SyncedRecoveryKeyEntry {
  publicKey: string;
  fingerprint: string;
  label: string;
  createdAt: string;
  uploadedAt: string;
  encryptedKeyEnvelope: EncryptedKeyBackup;
}

export interface SyncedRecoveryVaultPayload {
  format: 'chm-recovery-vault-bundle-v1';
  version: 1;
  entries: SyncedRecoveryKeyEntry[];
}

export interface EncryptedDriveManifestPayload {
  schemaVersion: 1;
  vaultId: string;
  manifestSeq: number;
  prevManifestHash: string;
  epoch: number;
  updatedAt: string;
  proofChunks: DriveRemoteChunkRef[];
  profilesFile?: { fileId: string; contentHash: string };
  policiesFile?: { fileId: string; contentHash: string };
  settingsFile?: { fileId: string; contentHash: string };
  identitiesFile?: { fileId: string; contentHash: string };
  devicesFile?: { fileId: string; contentHash: string };
  recoveryFile?: { fileId: string; contentHash: string };
  tombstones: VaultTombstoneRecord[];
}

export interface VaultSyncConflict {
  id: string;
  entityType: 'profile' | 'policy-preset' | 'setting';
  entityId: string;
  label: string;
  localContentHash: string;
  remoteContentHash: string;
  localRecord: unknown;
  remoteRecord: unknown;
  detectedAt: string;
}

export interface PendingSyncQueueEntry {
  id: string;
  entityType: 'proof' | 'profile' | 'policy-preset' | 'setting' | 'tombstone';
  entityId: string;
  action: 'upsert' | 'delete';
  queuedAt: string;
  retryCount: number;
  nextRetryAt?: string;
}

export interface PersistedDriveAccountState {
  id: string; // `drive-account:${accountHash}`
  accountHash: string;
  vaultId: string;
  folderId?: string;
  keyringFileId?: string;
  manifestFileId?: string;
  profilesFileId?: string;
  policiesFileId?: string;
  settingsFileId?: string;
  identitiesFileId?: string;
  devicesFileId?: string;
  recoveryFileId?: string;
  lastSyncedAt?: string;
  lastManifestSeq: number;
  lastManifestHash: string;
  syncedEntityHashes: Record<string, string>;
  knownProofChunks: DriveRemoteChunkRef[];
  pendingQueue: PendingSyncQueueEntry[];
  conflicts: VaultSyncConflict[];
  rollbackWarning?: string;
}

const FORBIDDEN_SYNC_KEYS = new Set([
  'raster',
  'rgba',
  'pixels',
  'pngBytes',
  'imageData',
  'projectFileBytes',
  'webCryptoPrivateKey',
  'encryptedBackup',
  'seed32',
  'privateKey',
  'secretKey',
  'nsec',
  'nip49',
  'encryptedSecret',
  'accessToken',
  'access_token',
]);

/**
 * Defense-in-depth validator proving no artwork pixels, project files, Ed25519 keys,
 * Nostr secret keys, or OAuth tokens can ever enter an encrypted Drive payload.
 */
export function assertNoForbiddenSyncSecrets(value: unknown, path = 'root'): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return;
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    throw new Error(`Refusing to sync raw binary buffer at ${path}`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoForbiddenSyncSecrets(value[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SYNC_KEYS.has(k)) {
      throw new Error(`Security policy blocked prohibited sync field: ${path}.${k}`);
    }
    assertNoForbiddenSyncSecrets(v, `${path}.${k}`);
  }
}

export function hashGoogleAccountKey(accountKey: string): string {
  return bytesToHex(sha256Sync(utf8Encoder.encode(`chm-google-acct:${accountKey}`))).slice(0, 32);
}

function accountStateStorageId(accountHash: string): string {
  return `drive-account:${accountHash}`;
}

export async function loadDriveAccountState(
  accountKey: string,
): Promise<PersistedDriveAccountState> {
  const accountHash = hashGoogleAccountKey(accountKey);
  const id = accountStateStorageId(accountHash);
  try {
    const existing = await withChmStore<PersistedDriveAccountState | undefined>(
      STORE_STORAGE_STATE,
      'readonly',
      (s) => s.get(id),
    );
    if (existing && existing.accountHash === accountHash) {
      return {
        ...existing,
        syncedEntityHashes: existing.syncedEntityHashes ?? {},
        knownProofChunks: existing.knownProofChunks ?? [],
        pendingQueue: existing.pendingQueue ?? [],
        conflicts: existing.conflicts ?? [],
      };
    }
  } catch {
    // IDB unavailable
  }
  return {
    id,
    accountHash,
    vaultId: '',
    lastManifestSeq: 0,
    lastManifestHash: '',
    syncedEntityHashes: {},
    knownProofChunks: [],
    pendingQueue: [],
    conflicts: [],
  };
}

export async function saveDriveAccountState(state: PersistedDriveAccountState): Promise<void> {
  await withChmStore(STORE_STORAGE_STATE, 'readwrite', (s) => s.put(state));
}

export async function queuePendingVaultSyncMutation(params: {
  accountKey: string;
  entityType: PendingSyncQueueEntry['entityType'];
  entityId: string;
  action: 'upsert' | 'delete';
}): Promise<PersistedDriveAccountState> {
  const state = await loadDriveAccountState(params.accountKey);
  const entryId = `${params.entityType}:${params.entityId}`;
  const filtered = state.pendingQueue.filter((q) => q.id !== entryId);
  filtered.push({
    id: entryId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  });
  const next: PersistedDriveAccountState = {
    ...state,
    pendingQueue: filtered,
  };
  await saveDriveAccountState(next);
  return next;
}

function hashProfileRecord(p: AuthorProfile): string {
  return p.contentHash || computeRecordContentHash(JSON.stringify(p));
}

function hashPolicyRecord(p: PolicyPreset): string {
  return p.contentHash || computeRecordContentHash(JSON.stringify(p));
}

function hashSettingsRecord(s: VaultSettingsSnapshot): string {
  return computeRecordContentHash(
    JSON.stringify({
      verifyBaseUrl: s.verifyBaseUrl,
      preferredQrMode: s.preferredQrMode,
      preferredLocale: s.preferredLocale,
      activeAuthorProfileId: s.activeAuthorProfileId,
      activePolicyPresetId: s.activePolicyPresetId,
      version: s.version,
    }),
  );
}

function mergeTombstones(
  local: VaultTombstoneRecord[],
  remote: VaultTombstoneRecord[],
): VaultTombstoneRecord[] {
  const map = new Map<string, VaultTombstoneRecord>();
  for (const t of [...local, ...remote]) {
    const existing = map.get(t.id);
    if (!existing || t.deletedAt > existing.deletedAt) {
      map.set(t.id, t);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function listLocalPublicNostrIdentity(): Promise<{ pubkeyHex: string; npub: string } | null> {
  try {
    const rows = await withChmStore<unknown[]>(STORE_NOSTR_KEYS, 'readonly', (s) => s.getAll());
    for (const row of rows ?? []) {
      if (
        row &&
        typeof row === 'object' &&
        (row as { deviceIdHex?: string }).deviceIdHex !== NOSTR_WRAPPING_KEY_RECORD_ID &&
        isValidNostrDeviceKeyRecord(row)
      ) {
        const rec = row as NostrDeviceKeyRecord;
        return { pubkeyHex: rec.nostrPubkeyHex, npub: rec.npub };
      }
    }
  } catch {
    // Store unavailable
  }
  return null;
}

function validateRemoteAuthorIdentity(raw: unknown): SyncedAuthorIdentityRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Partial<SyncedAuthorIdentityRecord>;
  if (
    typeof r.publicKeyBase64Url !== 'string' ||
    typeof r.fingerprintHex !== 'string' ||
    typeof r.fingerprintShort !== 'string' ||
    typeof r.label !== 'string' ||
    typeof r.createdAt !== 'string'
  ) {
    return null;
  }
  try {
    const pk = base64UrlDecode(r.publicKeyBase64Url);
    if (pk.length !== 32 || !isValidStrictEd25519PublicKey(pk)) return null;
    const fp = computePublicKeyFingerprintSync(pk);
    if (fp.fullHex !== r.fingerprintHex) return null;
    return {
      publicKeyBase64Url: r.publicKeyBase64Url,
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      label: r.label.trim().slice(0, 64) || 'Synced Artist',
      createdAt: r.createdAt,
      sourceKind: r.sourceKind === 'author-public' ? 'author-public' : 'trusted-artist',
      verificationState: r.verificationState === 'confirmed' ? 'confirmed' : 'unconfirmed',
      ...(typeof r.linkedNostrPubkeyHex === 'string' && /^[0-9a-f]{64}$/i.test(r.linkedNostrPubkeyHex)
        ? { linkedNostrPubkeyHex: r.linkedNostrPubkeyHex.toLowerCase() }
        : {}),
      ...(typeof r.linkedNostrNpub === 'string' && r.linkedNostrNpub.startsWith('npub1')
        ? { linkedNostrNpub: r.linkedNostrNpub }
        : {}),
    };
  } catch {
    return null;
  }
}

function assertValidEncryptedKeyBackupEnvelope(raw: unknown): EncryptedKeyBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Encrypted key backup must be an object');
  }
  const b = raw as Partial<EncryptedKeyBackup>;
  if (
    b.format !== KEY_BACKUP_FORMAT ||
    b.version !== KEY_BACKUP_VERSION ||
    b.kdf !== 'PBKDF2-SHA256' ||
    b.cipher !== 'AES-256-GCM' ||
    typeof b.salt !== 'string' ||
    typeof b.iv !== 'string' ||
    typeof b.publicKey !== 'string' ||
    typeof b.fingerprint !== 'string' ||
    typeof b.ciphertext !== 'string'
  ) {
    throw new Error('Only client-side AES-256-GCM + PBKDF2-SHA256 encrypted key backups can be uploaded.');
  }
  assertNoForbiddenSyncSecrets(b, 'encryptedKeyBackup');
  return b as EncryptedKeyBackup;
}

export interface InitializeOrUnlockDriveVaultResult {
  vaultId: string;
  keyring: UnlockedVaultKeyring;
  mode: 'created-new-vault' | 'unlocked-existing-vault' | 'recovered-local-vault';
  state: PersistedDriveAccountState;
}

/**
 * Ensures the user's hidden `Certified Handmade` Drive appDataFolder exists (recovering via
 * appProperties if needed) and initializes or unlocks the passphrase-protected Vault keyring.
 * Connecting Google alone NEVER unlocks an existing remote Vault without the passphrase
 * (or a cross-device VMK share imported beforehand).
 */
export async function initializeOrUnlockDriveVault(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  vaultPassphrase: string;
  pbkdf2Iterations?: number;
  importedKeyring?: UnlockedVaultKeyring;
}): Promise<InitializeOrUnlockDriveVaultResult> {
  const state = await loadDriveAccountState(params.accountKey);
  const { folder } = await params.client.ensureVaultRootFolder({
    accessToken: params.accessToken,
    knownFolderId: state.folderId,
  });

  const keyringFiles = await params.client.findKeyringFiles({
    accessToken: params.accessToken,
    folderId: folder.id,
  });

  if (keyringFiles.length > 0) {
    const targetKeyringFile =
      (state.vaultId &&
        keyringFiles.find((f) => f.appProperties?.chmVaultId === state.vaultId)) ||
      keyringFiles[0];
    const wrapped = await params.client.downloadJsonFile<WrappedVaultKeyringEnvelope>({
      accessToken: params.accessToken,
      fileId: targetKeyringFile.id,
    });
    const keyring =
      params.importedKeyring && params.importedKeyring.vaultId === wrapped.vaultId
        ? params.importedKeyring
        : await unwrapVaultKeyringWithPassphrase({
            envelope: wrapped,
            passphrase: params.vaultPassphrase,
          });

    const isSwitchedVault = Boolean(state.vaultId && state.vaultId !== keyring.vaultId);
    const updatedState: PersistedDriveAccountState = {
      ...(isSwitchedVault
        ? {
            id: state.id,
            accountHash: state.accountHash,
            lastManifestSeq: 0,
            lastManifestHash: '',
            syncedEntityHashes: {},
            knownProofChunks: [],
            pendingQueue: [],
            conflicts: [],
          }
        : state),
      folderId: folder.id,
      vaultId: keyring.vaultId,
      keyringFileId: targetKeyringFile.id,
      rollbackWarning: undefined,
    };
    await saveDriveAccountState(updatedState);
    return {
      vaultId: keyring.vaultId,
      keyring,
      mode: 'unlocked-existing-vault',
      state: updatedState,
    };
  }

  // No remote keyring found yet: create a fresh VMK keyring (or keep existing vaultId if recovering after folder deletion)
  const keyring =
    params.importedKeyring ??
    createUnlockedVaultKeyring(state.vaultId || undefined);
  const wrapped = await wrapVaultKeyringWithPassphrase({
    keyring,
    passphrase: params.vaultPassphrase,
    iterations: params.pbkdf2Iterations,
  });
  const uploaded = await params.client.upsertJsonFile({
    accessToken: params.accessToken,
    folderId: folder.id,
    opaqueFileName: 'keyring.chmk',
    appProperties: {
      chmRole: 'keyring',
      chmVaultId: keyring.vaultId,
      chmEpoch: String(keyring.currentEpoch),
    },
    jsonPayload: wrapped,
  });

  const nextState: PersistedDriveAccountState = {
    ...state,
    folderId: folder.id,
    vaultId: keyring.vaultId,
    keyringFileId: uploaded.id,
    // If folder was recreated, clear stale file IDs so chunks & manifest re-upload safely
    manifestFileId: undefined,
    profilesFileId: undefined,
    policiesFileId: undefined,
    settingsFileId: undefined,
    identitiesFileId: undefined,
    devicesFileId: undefined,
    recoveryFileId: undefined,
    knownProofChunks: [],
    rollbackWarning: undefined,
  };
  await saveDriveAccountState(nextState);
  return {
    vaultId: keyring.vaultId,
    keyring,
    mode: state.vaultId ? 'recovered-local-vault' : 'created-new-vault',
    state: nextState,
  };
}

const PROOF_CHUNK_SIZE = 100;

function sanitizeProofForSync(p: VaultProofRecord): VaultProofRecord {
  const copy: VaultProofRecord = {
    id: p.id,
    schemaVersion: p.schemaVersion,
    protocolVersion: p.protocolVersion,
    artworkIdHex: p.artworkIdHex,
    authorPublicKeyBase64Url: p.authorPublicKeyBase64Url,
    authorFingerprintHex: p.authorFingerprintHex,
    authorFingerprintShort: p.authorFingerprintShort,
    ...(p.authorName ? { authorName: p.authorName } : {}),
    ...(p.artworkTitle ? { artworkTitle: p.artworkTitle } : {}),
    ...(p.creationMethod ? { creationMethod: p.creationMethod } : {}),
    licenseId: p.licenseId,
    commercialUse: p.commercialUse,
    redistribution: p.redistribution,
    aiTraining: p.aiTraining,
    imageSha256Hex: p.imageSha256Hex,
    issuedAt: p.issuedAt,
    proofBase64Url: p.proofBase64Url,
    ...(p.detailsSnapshot ? { detailsSnapshot: p.detailsSnapshot } : {}),
    syncSelected: p.syncSelected,
    publicIndexOptIn: p.publicIndexOptIn,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  assertNoForbiddenSyncSecrets(copy, `proof:${p.id}`);
  return copy;
}

/**
 * Full bi-directional incremental encrypted Vault sync with Google Drive (`appDataFolder`):
 * - Recovers folder via appProperties if deleted/reset
 * - Checks monotonic manifest sequence/hash for rollback attacks
 * - Applies three-way conflict detection & preserves local+remote without LWW overwrites
 * - Treats signed proofs as immutable content-addressed records + delta chunks
 * - Syncs public Author Identities (+ linked Nostr public key) without transferring signing keys
 * - Syncs verified Paired Device enrollment certificates & monotonic Device Revocations
 * - Synchronizes logical delete tombstones
 * - NEVER auto-uploads raw private keys or artwork images
 */
export async function runGoogleDriveSync(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  keyring: UnlockedVaultKeyring;
}): Promise<{ syncResult: StorageSyncResult; state: PersistedDriveAccountState }> {
  let state = await loadDriveAccountState(params.accountKey);
  if (state.vaultId && state.vaultId !== params.keyring.vaultId) {
    throw new Error('Unlocked keyring belongs to a different Vault ID than this Google account');
  }

  const { folder, recovered } = await params.client.ensureVaultRootFolder({
    accessToken: params.accessToken,
    knownFolderId: state.folderId,
  });

  if (recovered && state.folderId && state.folderId !== folder.id) {
    state = {
      ...state,
      folderId: folder.id,
      manifestFileId: undefined,
      profilesFileId: undefined,
      policiesFileId: undefined,
      settingsFileId: undefined,
      identitiesFileId: undefined,
      devicesFileId: undefined,
      recoveryFileId: undefined,
      knownProofChunks: [],
    };
  } else {
    state = { ...state, folderId: folder.id, vaultId: params.keyring.vaultId };
  }

  const driveFiles = await params.client.findVaultFilesInFolder({
    accessToken: params.accessToken,
    folderId: folder.id,
    vaultId: params.keyring.vaultId,
  });

  const remoteManifestMeta =
    (state.manifestFileId && driveFiles.find((f) => f.id === state.manifestFileId)) ||
    driveFiles.find((f) => f.appProperties?.chmRole === 'manifest');

  let remoteManifest: EncryptedDriveManifestPayload | null = null;
  let remoteManifestHash = '';
  if (remoteManifestMeta) {
    const manifestEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remoteManifestMeta.id,
    });
    remoteManifest = await decryptVaultRecordJson<EncryptedDriveManifestPayload>({
      keyring: params.keyring,
      envelope: manifestEnv,
      expectedPurpose: 'manifest',
      expectedRecordId: 'manifest',
    });
    remoteManifestHash = manifestEnv.contentHash;

    // Rollback detection!
    if (
      remoteManifest.manifestSeq < state.lastManifestSeq ||
      (state.lastManifestSeq > 0 &&
        remoteManifest.manifestSeq === state.lastManifestSeq &&
        state.lastManifestHash &&
        remoteManifestHash !== state.lastManifestHash)
    ) {
      const warnMsg = `Rollback or divergent remote manifest detected (remote seq ${remoteManifest.manifestSeq}, local seq ${state.lastManifestSeq}). Aborting automatic pull to protect local data.`;
      state = { ...state, rollbackWarning: warnMsg };
      await saveDriveAccountState(state);
      throw new Error(warnMsg);
    }
  }

  let uploadedCount = 0;
  let downloadedCount = 0;
  let skippedDuplicateCount = 0;
  let tombstonesApplied = 0;
  const conflicts: VaultSyncConflict[] = [...state.conflicts];

  // 1. Merge tombstones first
  const localTombstones = await listVaultTombstones();
  const mergedTombstones = mergeTombstones(localTombstones, remoteManifest?.tombstones ?? []);
  const tombstoneSet = new Set(mergedTombstones.map((t) => t.id));
  await recordVaultTombstones(mergedTombstones);

  // 2. Proofs: immutable union + tombstones + content-hash chunk deduplication
  const localProofsBefore = await listAllVaultProofs();
  const localProofById = new Map(localProofsBefore.map((p) => [p.id, p]));

  // Apply remote proof tombstones locally
  for (const t of mergedTombstones) {
    if (t.entityType === 'proof' && localProofById.has(t.entityId)) {
      await withChmStore(STORE_PROOF_VAULT, 'readwrite', (s) => s.delete(t.entityId));
      localProofById.delete(t.entityId);
      tombstonesApplied++;
    }
  }

  const knownProofIdsRemote = new Set<string>();
  const validRemoteChunks: DriveRemoteChunkRef[] = [];
  for (const chunkRef of remoteManifest?.proofChunks ?? []) {
    const fileExists = driveFiles.some((f) => f.id === chunkRef.fileId);
    if (!fileExists) continue;
    validRemoteChunks.push(chunkRef);
    const missingLocally = chunkRef.proofIds.some(
      (pid) => !localProofById.has(pid) && !tombstoneSet.has(`proof:${pid}`),
    );
    for (const pid of chunkRef.proofIds) {
      knownProofIdsRemote.add(pid);
    }
    if (!missingLocally) {
      skippedDuplicateCount += chunkRef.proofIds.length;
      continue;
    }

    const chunkEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: chunkRef.fileId,
    });
    const decryptedProofs = await decryptVaultRecordJson<VaultProofRecord[]>({
      keyring: params.keyring,
      envelope: chunkEnv,
      expectedPurpose: 'proofs',
      expectedRecordId: chunkRef.chunkId,
    });

    const verifiedToStore: VaultProofRecord[] = [];
    for (const entry of decryptedProofs) {
      if (tombstoneSet.has(`proof:${entry.id}`)) continue;
      if (localProofById.has(entry.id)) {
        skippedDuplicateCount++;
        continue;
      }
      const verified = await verifyAndBuildVaultProofRecord({
        proofInput: entry.proofBase64Url,
        creationMethod: entry.creationMethod,
        detailsSnapshot: entry.detailsSnapshot,
        syncSelected: false,
        publicIndexOptIn: false,
        createdAt: entry.createdAt,
      });
      if (verified.id !== entry.id) {
        throw new Error('Remote proof ID did not match canonical proof SHA-256 digest');
      }
      verifiedToStore.push(verified);
      localProofById.set(verified.id, verified);
      downloadedCount++;
    }
    if (verifiedToStore.length > 0) {
      await saveVaultProofBatch(verifiedToStore);
    }
  }

  // Upload any local proofs not already present in remote chunks
  const proofsToUpload = Array.from(localProofById.values()).filter(
    (p) => !knownProofIdsRemote.has(p.id) && !tombstoneSet.has(`proof:${p.id}`),
  );
  const nextChunks = [...validRemoteChunks];
  for (let i = 0; i < proofsToUpload.length; i += PROOF_CHUNK_SIZE) {
    const batch = proofsToUpload.slice(i, i + PROOF_CHUNK_SIZE).map(sanitizeProofForSync);
    const batchHash = computeRecordContentHash(batch.map((b) => b.id).join(',')).slice(0, 16);
    const chunkId = `chunk-${batchHash}-${params.keyring.currentEpoch}`;
    const env = await encryptVaultRecordJson({
      keyring: params.keyring,
      purpose: 'proofs',
      recordId: chunkId,
      payload: batch,
    });
    const meta = await params.client.upsertJsonFile({
      accessToken: params.accessToken,
      folderId: folder.id,
      opaqueFileName: `${chunkId}.chmv`,
      appProperties: {
        chmRole: 'proofs-chunk',
        chmVaultId: params.keyring.vaultId,
        chmHash: env.contentHash.slice(0, 24),
      },
      jsonPayload: env,
    });
    nextChunks.push({
      chunkId,
      fileId: meta.id,
      contentHash: env.contentHash,
      epoch: env.epoch,
      proofIds: batch.map((b) => b.id),
    });
    uploadedCount += batch.length;
  }

  // 3. Profiles three-way merge with conflict detection
  const syncedHashes = { ...state.syncedEntityHashes };
  const localProfiles = await listAuthorProfiles();
  const localProfileMap = new Map(localProfiles.map((p) => [p.id, p]));
  let remoteProfiles: AuthorProfile[] = [];
  let remoteProfilesMeta = remoteManifest?.profilesFile
    ? driveFiles.find((f) => f.id === remoteManifest!.profilesFile!.fileId)
    : driveFiles.find((f) => f.appProperties?.chmRole === 'profiles');

  if (remoteProfilesMeta) {
    const profEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remoteProfilesMeta.id,
    });
    remoteProfiles = await decryptVaultRecordJson<AuthorProfile[]>({
      keyring: params.keyring,
      envelope: profEnv,
      expectedPurpose: 'profiles',
      expectedRecordId: 'profiles',
    });
  }

  const remoteProfileMap = new Map(remoteProfiles.map((p) => [p.id, p]));
  const allProfileIds = new Set([...localProfileMap.keys(), ...remoteProfileMap.keys()]);
  const profilesToSaveLocal: AuthorProfile[] = [];
  const mergedProfilesForRemote: AuthorProfile[] = [];

  for (const pid of allProfileIds) {
    if (tombstoneSet.has(`profile:${pid}`)) {
      if (localProfileMap.has(pid)) {
        await withChmStore(STORE_CREATOR_PROFILES, 'readwrite', (s) => s.delete(pid));
        tombstonesApplied++;
      }
      delete syncedHashes[`profile:${pid}`];
      continue;
    }
    const local = localProfileMap.get(pid);
    const remote = remoteProfileMap.get(pid);
    const baseHash = syncedHashes[`profile:${pid}`];
    const localHash = local ? hashProfileRecord(local) : undefined;
    const remoteHash = remote ? hashProfileRecord(remote) : undefined;

    if (local && remote) {
      if (localHash === remoteHash) {
        mergedProfilesForRemote.push(local);
        syncedHashes[`profile:${pid}`] = localHash!;
      } else if (localHash === baseHash) {
        profilesToSaveLocal.push(remote);
        mergedProfilesForRemote.push(remote);
        syncedHashes[`profile:${pid}`] = remoteHash!;
        downloadedCount++;
      } else if (remoteHash === baseHash) {
        mergedProfilesForRemote.push(local);
        syncedHashes[`profile:${pid}`] = localHash!;
      } else {
        if (!conflicts.some((c) => c.entityType === 'profile' && c.entityId === pid)) {
          conflicts.push({
            id: `conflict:profile:${pid}`,
            entityType: 'profile',
            entityId: pid,
            label: local.profileName || remote.profileName,
            localContentHash: localHash!,
            remoteContentHash: remoteHash!,
            localRecord: local,
            remoteRecord: remote,
            detectedAt: new Date().toISOString(),
          });
        }
        mergedProfilesForRemote.push(remote);
      }
    } else if (remote && !local) {
      profilesToSaveLocal.push(remote);
      mergedProfilesForRemote.push(remote);
      syncedHashes[`profile:${pid}`] = remoteHash!;
      downloadedCount++;
    } else if (local && !remote) {
      mergedProfilesForRemote.push(local);
      syncedHashes[`profile:${pid}`] = localHash!;
    }
  }
  if (profilesToSaveLocal.length > 0) {
    await upsertAuthorProfilesBatch(profilesToSaveLocal);
  }

  let nextProfilesFile = remoteManifest?.profilesFile;
  if (mergedProfilesForRemote.length > 0 || !remoteProfilesMeta) {
    assertNoForbiddenSyncSecrets(mergedProfilesForRemote, 'profiles');
    const localProfilesPayloadHash = computeRecordContentHash(
      JSON.stringify(mergedProfilesForRemote),
    );
    if (localProfilesPayloadHash !== remoteManifest?.profilesFile?.contentHash) {
      const env = await encryptVaultRecordJson({
        keyring: params.keyring,
        purpose: 'profiles',
        recordId: 'profiles',
        payload: mergedProfilesForRemote,
      });
      const uploadedProf = await params.client.upsertJsonFile({
        accessToken: params.accessToken,
        folderId: folder.id,
        existingFileId: remoteProfilesMeta?.id ?? state.profilesFileId,
        opaqueFileName: 'profiles.chmv',
        appProperties: {
          chmRole: 'profiles',
          chmVaultId: params.keyring.vaultId,
          chmHash: env.contentHash.slice(0, 24),
        },
        jsonPayload: env,
      });
      remoteProfilesMeta = uploadedProf;
      nextProfilesFile = { fileId: uploadedProf.id, contentHash: env.contentHash };
      uploadedCount++;
    } else {
      skippedDuplicateCount++;
    }
  }

  // 4. Policy Presets three-way merge
  const localPresets = await listPolicyPresets();
  const localPresetMap = new Map(localPresets.map((p) => [p.id, p]));
  let remotePresets: PolicyPreset[] = [];
  let remotePoliciesMeta = remoteManifest?.policiesFile
    ? driveFiles.find((f) => f.id === remoteManifest!.policiesFile!.fileId)
    : driveFiles.find((f) => f.appProperties?.chmRole === 'policies');

  if (remotePoliciesMeta) {
    const polEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remotePoliciesMeta.id,
    });
    remotePresets = await decryptVaultRecordJson<PolicyPreset[]>({
      keyring: params.keyring,
      envelope: polEnv,
      expectedPurpose: 'policies',
      expectedRecordId: 'policies',
    });
  }

  const remotePresetMap = new Map(remotePresets.map((p) => [p.id, p]));
  const allPresetIds = new Set([...localPresetMap.keys(), ...remotePresetMap.keys()]);
  const presetsToSaveLocal: PolicyPreset[] = [];
  const mergedPresetsForRemote: PolicyPreset[] = [];

  for (const id of allPresetIds) {
    if (tombstoneSet.has(`policy-preset:${id}`)) {
      if (localPresetMap.has(id)) {
        await withChmStore(STORE_POLICY_PRESETS, 'readwrite', (s) => s.delete(id));
        tombstonesApplied++;
      }
      delete syncedHashes[`policy-preset:${id}`];
      continue;
    }
    const local = localPresetMap.get(id);
    const remote = remotePresetMap.get(id);
    const baseHash = syncedHashes[`policy-preset:${id}`];
    const localHash = local ? hashPolicyRecord(local) : undefined;
    const remoteHash = remote ? hashPolicyRecord(remote) : undefined;

    if (local && remote) {
      if (localHash === remoteHash) {
        mergedPresetsForRemote.push(local);
        syncedHashes[`policy-preset:${id}`] = localHash!;
      } else if (localHash === baseHash) {
        presetsToSaveLocal.push(remote);
        mergedPresetsForRemote.push(remote);
        syncedHashes[`policy-preset:${id}`] = remoteHash!;
        downloadedCount++;
      } else if (remoteHash === baseHash) {
        mergedPresetsForRemote.push(local);
        syncedHashes[`policy-preset:${id}`] = localHash!;
      } else {
        if (!conflicts.some((c) => c.entityType === 'policy-preset' && c.entityId === id)) {
          conflicts.push({
            id: `conflict:policy-preset:${id}`,
            entityType: 'policy-preset',
            entityId: id,
            label: local.name || remote.name,
            localContentHash: localHash!,
            remoteContentHash: remoteHash!,
            localRecord: local,
            remoteRecord: remote,
            detectedAt: new Date().toISOString(),
          });
        }
        mergedPresetsForRemote.push(remote);
      }
    } else if (remote && !local) {
      presetsToSaveLocal.push(remote);
      mergedPresetsForRemote.push(remote);
      syncedHashes[`policy-preset:${id}`] = remoteHash!;
      downloadedCount++;
    } else if (local && !remote) {
      mergedPresetsForRemote.push(local);
      syncedHashes[`policy-preset:${id}`] = localHash!;
    }
  }
  if (presetsToSaveLocal.length > 0) {
    await upsertPolicyPresetsBatch(presetsToSaveLocal);
  }

  let nextPoliciesFile = remoteManifest?.policiesFile;
  if (mergedPresetsForRemote.length > 0 || !remotePoliciesMeta) {
    assertNoForbiddenSyncSecrets(mergedPresetsForRemote, 'policies');
    const localPolHash = computeRecordContentHash(JSON.stringify(mergedPresetsForRemote));
    if (localPolHash !== remoteManifest?.policiesFile?.contentHash) {
      const env = await encryptVaultRecordJson({
        keyring: params.keyring,
        purpose: 'policies',
        recordId: 'policies',
        payload: mergedPresetsForRemote,
      });
      const uploadedPol = await params.client.upsertJsonFile({
        accessToken: params.accessToken,
        folderId: folder.id,
        existingFileId: remotePoliciesMeta?.id ?? state.policiesFileId,
        opaqueFileName: 'policies.chmv',
        appProperties: {
          chmRole: 'policies',
          chmVaultId: params.keyring.vaultId,
          chmHash: env.contentHash.slice(0, 24),
        },
        jsonPayload: env,
      });
      remotePoliciesMeta = uploadedPol;
      nextPoliciesFile = { fileId: uploadedPol.id, contentHash: env.contentHash };
      uploadedCount++;
    } else {
      skippedDuplicateCount++;
    }
  }

  // 5. Settings merge
  const localSettings = await loadVaultSettings();
  let remoteSettings: VaultSettingsSnapshot | null = null;
  let remoteSettingsMeta = remoteManifest?.settingsFile
    ? driveFiles.find((f) => f.id === remoteManifest!.settingsFile!.fileId)
    : driveFiles.find((f) => f.appProperties?.chmRole === 'settings');
  if (remoteSettingsMeta) {
    const setEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remoteSettingsMeta.id,
    });
    remoteSettings = await decryptVaultRecordJson<VaultSettingsSnapshot>({
      keyring: params.keyring,
      envelope: setEnv,
      expectedPurpose: 'settings',
      expectedRecordId: 'settings',
    });
  }

  let effectiveSettings = localSettings;
  const baseSettingsHash = syncedHashes['setting:vault-user-settings'];
  const localSettingsHash = hashSettingsRecord(localSettings);
  const remoteSettingsHash = remoteSettings ? hashSettingsRecord(remoteSettings) : undefined;
  if (remoteSettings && remoteSettingsHash) {
    if (localSettingsHash === remoteSettingsHash) {
      syncedHashes['setting:vault-user-settings'] = localSettingsHash;
    } else if (!baseSettingsHash || localSettingsHash === baseSettingsHash) {
      await saveVaultSettings(remoteSettings);
      effectiveSettings = remoteSettings;
      syncedHashes['setting:vault-user-settings'] = remoteSettingsHash;
      downloadedCount++;
    } else if (remoteSettingsHash === baseSettingsHash) {
      syncedHashes['setting:vault-user-settings'] = localSettingsHash;
    } else {
      if (!conflicts.some((c) => c.entityType === 'setting')) {
        conflicts.push({
          id: 'conflict:setting:vault-user-settings',
          entityType: 'setting',
          entityId: 'vault-user-settings',
          label: 'Vault User Preferences',
          localContentHash: localSettingsHash,
          remoteContentHash: remoteSettingsHash,
          localRecord: localSettings,
          remoteRecord: remoteSettings,
          detectedAt: new Date().toISOString(),
        });
      }
      effectiveSettings = remoteSettings;
    }
  } else {
    syncedHashes['setting:vault-user-settings'] = localSettingsHash;
  }

  let nextSettingsFile = remoteManifest?.settingsFile;
  assertNoForbiddenSyncSecrets(effectiveSettings, 'settings');
  const effectiveSettingsPayloadHash = computeRecordContentHash(JSON.stringify(effectiveSettings));
  if (effectiveSettingsPayloadHash !== remoteManifest?.settingsFile?.contentHash) {
    const env = await encryptVaultRecordJson({
      keyring: params.keyring,
      purpose: 'settings',
      recordId: 'settings',
      payload: effectiveSettings,
    });
    const uploadedSet = await params.client.upsertJsonFile({
      accessToken: params.accessToken,
      folderId: folder.id,
      existingFileId: remoteSettingsMeta?.id ?? state.settingsFileId,
      opaqueFileName: 'settings.chmv',
      appProperties: {
        chmRole: 'settings',
        chmVaultId: params.keyring.vaultId,
        chmHash: env.contentHash.slice(0, 24),
      },
      jsonPayload: env,
    });
    remoteSettingsMeta = uploadedSet;
    nextSettingsFile = { fileId: uploadedSet.id, contentHash: env.contentHash };
    uploadedCount++;
  } else {
    skippedDuplicateCount++;
  }

  // 6. Public Author Identities + Linked Nostr Public Key Sync (ZERO private keys ever!)
  const [localAuthorKeys, localTrustedKeys, localNostrPub] = await Promise.all([
    listAuthorKeys(),
    listTrustedKeys(),
    listLocalPublicNostrIdentity(),
  ]);
  const localAuthorPubMap = new Map(localAuthorKeys.map((k) => [k.publicKeyBase64Url, k]));
  const localTrustedMap = new Map(localTrustedKeys.map((t) => [t.publicKeyBase64Url, t]));

  let remoteIdentitiesMeta = remoteManifest?.identitiesFile
    ? driveFiles.find((f) => f.id === remoteManifest!.identitiesFile!.fileId)
    : driveFiles.find((f) => f.appProperties?.chmRole === 'identities');
  let remoteIdentities: SyncedAuthorIdentityRecord[] = [];
  if (remoteIdentitiesMeta) {
    const idEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remoteIdentitiesMeta.id,
    });
    const rawIdentities = await decryptVaultRecordJson<unknown[]>({
      keyring: params.keyring,
      envelope: idEnv,
      expectedPurpose: 'identities',
      expectedRecordId: 'identities',
    });
    if (Array.isArray(rawIdentities)) {
      remoteIdentities = rawIdentities
        .map(validateRemoteAuthorIdentity)
        .filter((x): x is SyncedAuthorIdentityRecord => Boolean(x));
    }
  }

  const identityMap = new Map<string, SyncedAuthorIdentityRecord>();
  for (const ak of localAuthorKeys) {
    identityMap.set(ak.publicKeyBase64Url, {
      publicKeyBase64Url: ak.publicKeyBase64Url,
      fingerprintHex: ak.fingerprintHex,
      fingerprintShort: ak.fingerprintShort,
      label: ak.label,
      createdAt: ak.createdAt,
      sourceKind: 'author-public',
      verificationState: 'confirmed',
      ...(localNostrPub
        ? {
            linkedNostrPubkeyHex: localNostrPub.pubkeyHex,
            linkedNostrNpub: localNostrPub.npub,
          }
        : {}),
    });
  }
  for (const tk of localTrustedKeys) {
    if (!identityMap.has(tk.publicKeyBase64Url)) {
      identityMap.set(tk.publicKeyBase64Url, {
        publicKeyBase64Url: tk.publicKeyBase64Url,
        fingerprintHex: tk.fingerprintHex,
        fingerprintShort: tk.fingerprintShort,
        label: tk.label,
        createdAt: tk.addedAt,
        sourceKind: 'trusted-artist',
        verificationState: tk.verificationState ?? 'confirmed',
      });
    }
  }

  const newTrustedToStore: TrustedKeyRecord[] = [];
  for (const rem of remoteIdentities) {
    if (!identityMap.has(rem.publicKeyBase64Url)) {
      identityMap.set(rem.publicKeyBase64Url, rem);
    }
    if (!localAuthorPubMap.has(rem.publicKeyBase64Url) && !localTrustedMap.has(rem.publicKeyBase64Url)) {
      const pkBytes = base64UrlDecode(rem.publicKeyBase64Url);
      const isConfirmed = rem.sourceKind === 'author-public' || rem.verificationState === 'confirmed';
      newTrustedToStore.push({
        publicKeyBase64Url: rem.publicKeyBase64Url,
        publicKey: pkBytes,
        fingerprintHex: rem.fingerprintHex,
        fingerprintShort: rem.fingerprintShort,
        label: rem.label,
        note: rem.linkedNostrNpub
          ? `Synced identity • Nostr ${rem.linkedNostrNpub}`
          : 'Synced from encrypted Google Drive Vault',
        addedAt: rem.createdAt,
        verificationState: isConfirmed ? 'confirmed' : 'unconfirmed',
        confirmedAt: isConfirmed ? new Date().toISOString() : undefined,
      });
      downloadedCount++;
    }
  }
  if (newTrustedToStore.length > 0) {
    await runChmTransaction([STORE_TRUSTED_KEYS], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_TRUSTED_KEYS);
      for (const rec of newTrustedToStore) {
        store.put(rec);
      }
    });
  }

  const mergedIdentitiesForRemote = Array.from(identityMap.values()).sort((a, b) =>
    a.publicKeyBase64Url.localeCompare(b.publicKeyBase64Url),
  );
  let nextIdentitiesFile = remoteManifest?.identitiesFile;
  if (mergedIdentitiesForRemote.length > 0) {
    assertNoForbiddenSyncSecrets(mergedIdentitiesForRemote, 'identities');
    const localIdsHash = computeRecordContentHash(JSON.stringify(mergedIdentitiesForRemote));
    if (localIdsHash !== remoteManifest?.identitiesFile?.contentHash) {
      const env = await encryptVaultRecordJson({
        keyring: params.keyring,
        purpose: 'identities',
        recordId: 'identities',
        payload: mergedIdentitiesForRemote,
      });
      const uploadedIds = await params.client.upsertJsonFile({
        accessToken: params.accessToken,
        folderId: folder.id,
        existingFileId: remoteIdentitiesMeta?.id ?? state.identitiesFileId,
        opaqueFileName: 'identities.chmv',
        appProperties: {
          chmRole: 'identities',
          chmVaultId: params.keyring.vaultId,
          chmHash: env.contentHash.slice(0, 24),
        },
        jsonPayload: env,
      });
      remoteIdentitiesMeta = uploadedIds;
      nextIdentitiesFile = { fileId: uploadedIds.id, contentHash: env.contentHash };
      uploadedCount++;
    } else {
      skippedDuplicateCount++;
    }
  }

  // 7. Paired Devices & Monotonic Device Revocations Sync
  let remoteDevicesMeta = remoteManifest?.devicesFile
    ? driveFiles.find((f) => f.id === remoteManifest!.devicesFile!.fileId)
    : driveFiles.find((f) => f.appProperties?.chmRole === 'devices');
  let remoteDevicesPayload: SyncedDevicesSnapshotPayload | null = null;
  if (remoteDevicesMeta) {
    const devEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: remoteDevicesMeta.id,
    });
    remoteDevicesPayload = await decryptVaultRecordJson<SyncedDevicesSnapshotPayload>({
      keyring: params.keyring,
      envelope: devEnv,
      expectedPurpose: 'devices',
      expectedRecordId: 'devices',
    });
  }

  const localPairingBefore = await loadDevicePairingState();
  const localRevMap = new Map(localPairingBefore.revocations.map((r) => [r.key, r]));
  for (const remRev of remoteDevicesPayload?.revocations ?? []) {
    if (!remRev || typeof remRev.token !== 'string') continue;
    const localRev = localRevMap.get(remRev.key);
    if (!localRev || remRev.sequence > localRev.sequence) {
      try {
        await importDeviceRevocationNotice(remRev.token);
        downloadedCount++;
      } catch {
        // Ignore forged or malformed remote revocation tokens
      }
    }
  }

  const pairingAfterRevs = await loadDevicePairingState();
  const localDevMap = new Map(pairingAfterRevs.pairedDevices.map((d) => [d.key, d]));
  const revokedPubSet = new Set(pairingAfterRevs.revocations.map((r) => r.devicePublicKeyBase64Url));
  const revAfterMap = new Map(pairingAfterRevs.revocations.map((r) => [r.key, r]));

  const remoteDevicesToStore: PairedDeviceRecord[] = [];
  for (const remDev of remoteDevicesPayload?.pairedDevices ?? []) {
    if (!remDev || typeof remDev.key !== 'string' || localDevMap.has(remDev.key)) continue;
    if (!remDev.enrollmentToken) continue;
    try {
      const parsed = parsePairingQrInput(remDev.enrollmentToken);
      if (parsed.kind !== 'enrollment-certificate') continue;
      const cert = parsed.certificate.payload;
      if (
        cert.ownerFingerprintHex !== remDev.ownerFingerprintHex ||
        cert.ownerPublicKeyBase64Url !== remDev.ownerPublicKeyBase64Url ||
        cert.deviceIdHex !== remDev.deviceIdHex ||
        cert.devicePublicKeyBase64Url !== remDev.devicePublicKeyBase64Url
      ) {
        continue;
      }
      const revMatch = revAfterMap.get(remDev.key);
      const isRevoked = Boolean(revMatch) || revokedPubSet.has(remDev.devicePublicKeyBase64Url);
      const recordToStore: PairedDeviceRecord = {
        ...remDev,
        localVerificationStatus: isRevoked
          ? 'revoked'
          : remDev.ownerConfirmedTrust
            ? 'active-trusted'
            : 'active-unverified-owner',
        revocationNoticeToken: revMatch?.token ?? remDev.revocationNoticeToken,
        revokedAt: revMatch?.revokedAt ?? remDev.revokedAt,
        revocationReason: revMatch?.reason ?? remDev.revocationReason,
        revocationSequence: revMatch?.sequence ?? remDev.revocationSequence,
      };
      remoteDevicesToStore.push(recordToStore);
      localDevMap.set(recordToStore.key, recordToStore);
      downloadedCount++;
    } catch {
      // Skip malformed enrollment token
    }
  }
  if (remoteDevicesToStore.length > 0) {
    await runChmTransaction([STORE_PAIRED_DEVICES], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_PAIRED_DEVICES);
      for (const dev of remoteDevicesToStore) {
        store.put(dev);
      }
    });
  }

  const finalPairingState = await loadDevicePairingState();
  const mergedDevicesPayload: SyncedDevicesSnapshotPayload = {
    schemaVersion: 1,
    pairedDevices: [...finalPairingState.pairedDevices].sort((a, b) => a.key.localeCompare(b.key)),
    revocations: [...finalPairingState.revocations].sort((a, b) => a.key.localeCompare(b.key)),
  };

  let nextDevicesFile = remoteManifest?.devicesFile;
  if (
    mergedDevicesPayload.pairedDevices.length > 0 ||
    mergedDevicesPayload.revocations.length > 0
  ) {
    assertNoForbiddenSyncSecrets(mergedDevicesPayload, 'devices');
    const localDevsHash = computeRecordContentHash(JSON.stringify(mergedDevicesPayload));
    if (localDevsHash !== remoteManifest?.devicesFile?.contentHash) {
      const env = await encryptVaultRecordJson({
        keyring: params.keyring,
        purpose: 'devices',
        recordId: 'devices',
        payload: mergedDevicesPayload,
      });
      const uploadedDevs = await params.client.upsertJsonFile({
        accessToken: params.accessToken,
        folderId: folder.id,
        existingFileId: remoteDevicesMeta?.id ?? state.devicesFileId,
        opaqueFileName: 'devices.chmv',
        appProperties: {
          chmRole: 'devices',
          chmVaultId: params.keyring.vaultId,
          chmHash: env.contentHash.slice(0, 24),
        },
        jsonPayload: env,
      });
      remoteDevicesMeta = uploadedDevs;
      nextDevicesFile = { fileId: uploadedDevs.id, contentHash: env.contentHash };
      uploadedCount++;
    } else {
      skippedDuplicateCount++;
    }
  }

  // 8. Publish updated encrypted manifest with incremented sequence
  const nextSeq = Math.max(state.lastManifestSeq, remoteManifest?.manifestSeq ?? 0) + 1;
  const manifestPayload: EncryptedDriveManifestPayload = {
    schemaVersion: 1,
    vaultId: params.keyring.vaultId,
    manifestSeq: nextSeq,
    prevManifestHash: remoteManifestHash || state.lastManifestHash || 'genesis',
    epoch: params.keyring.currentEpoch,
    updatedAt: new Date().toISOString(),
    proofChunks: nextChunks,
    ...(nextProfilesFile ? { profilesFile: nextProfilesFile } : {}),
    ...(nextPoliciesFile ? { policiesFile: nextPoliciesFile } : {}),
    ...(nextSettingsFile ? { settingsFile: nextSettingsFile } : {}),
    ...(nextIdentitiesFile ? { identitiesFile: nextIdentitiesFile } : {}),
    ...(nextDevicesFile ? { devicesFile: nextDevicesFile } : {}),
    ...(remoteManifest?.recoveryFile ? { recoveryFile: remoteManifest.recoveryFile } : {}),
    tombstones: mergedTombstones,
  };
  assertNoForbiddenSyncSecrets(manifestPayload, 'manifest');
  const manifestEnv = await encryptVaultRecordJson({
    keyring: params.keyring,
    purpose: 'manifest',
    recordId: 'manifest',
    payload: manifestPayload,
  });
  const uploadedManifest = await params.client.upsertJsonFile({
    accessToken: params.accessToken,
    folderId: folder.id,
    existingFileId: remoteManifestMeta?.id ?? state.manifestFileId,
    opaqueFileName: 'manifest.chme',
    appProperties: {
      chmRole: 'manifest',
      chmVaultId: params.keyring.vaultId,
      chmSeq: String(nextSeq),
      chmEpoch: String(params.keyring.currentEpoch),
    },
    jsonPayload: manifestEnv,
  });

  const syncedAt = new Date().toISOString();
  const nextState: PersistedDriveAccountState = {
    id: state.id,
    accountHash: state.accountHash,
    vaultId: params.keyring.vaultId,
    folderId: folder.id,
    keyringFileId: state.keyringFileId,
    manifestFileId: uploadedManifest.id,
    profilesFileId: remoteProfilesMeta?.id,
    policiesFileId: remotePoliciesMeta?.id,
    settingsFileId: remoteSettingsMeta?.id,
    identitiesFileId: remoteIdentitiesMeta?.id,
    devicesFileId: remoteDevicesMeta?.id,
    recoveryFileId: state.recoveryFileId,
    lastSyncedAt: syncedAt,
    lastManifestSeq: nextSeq,
    lastManifestHash: manifestEnv.contentHash,
    syncedEntityHashes: syncedHashes,
    knownProofChunks: nextChunks,
    pendingQueue: [],
    conflicts,
    rollbackWarning: undefined,
  };
  await saveDriveAccountState(nextState);

  return {
    state: nextState,
    syncResult: {
      providerId: 'google-drive',
      ok: true,
      uploadedCount,
      downloadedCount,
      skippedDuplicateCount,
      conflictCount: conflicts.length,
      tombstonesApplied,
      syncedAt,
      message:
        conflicts.length > 0
          ? `Synced with ${conflicts.length} conflict(s) preserved for review.`
          : 'Encrypted Vault synchronized with Google Drive App Data.',
    },
  };
}

/**
 * Explicit opt-in ONLY: uploads a client-side AES-256-GCM + PBKDF2-SHA256 encrypted
 * Author Key recovery bundle into the user's hidden Drive appDataFolder.
 * Raw private seeds are NEVER accepted or transmitted.
 */
export async function uploadEncryptedKeyRecoveryBackup(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  keyring: UnlockedVaultKeyring;
  authorKeyId?: string;
  encryptedKeyEnvelope?: EncryptedKeyBackup;
}): Promise<{ entries: SyncedRecoveryKeyEntry[]; fileId: string }> {
  let envelope: EncryptedKeyBackup | undefined = params.encryptedKeyEnvelope;
  let labelOverride: string | undefined;
  if (!envelope && params.authorKeyId) {
    const key = await getAuthorKey(params.authorKeyId);
    if (!key) {
      throw new Error('Selected Author key not found locally');
    }
    if (!key.encryptedBackup) {
      throw new Error(
        'This key uses non-extractable hardware/Web Crypto storage without a passphrase-encrypted backup envelope. Export or create a passphrase-protected backup first.',
      );
    }
    envelope = key.encryptedBackup;
    labelOverride = key.label;
  }
  const validated = assertValidEncryptedKeyBackupEnvelope(envelope);

  const state = await loadDriveAccountState(params.accountKey);
  const { folder } = await params.client.ensureVaultRootFolder({
    accessToken: params.accessToken,
    knownFolderId: state.folderId,
  });
  const driveFiles = await params.client.findVaultFilesInFolder({
    accessToken: params.accessToken,
    folderId: folder.id,
    vaultId: params.keyring.vaultId,
  });
  const existingMeta =
    (state.recoveryFileId && driveFiles.find((f) => f.id === state.recoveryFileId)) ||
    driveFiles.find((f) => f.appProperties?.chmRole === 'recovery');

  let existingEntries: SyncedRecoveryKeyEntry[] = [];
  if (existingMeta) {
    const rawEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
      accessToken: params.accessToken,
      fileId: existingMeta.id,
    });
    const decrypted = await decryptVaultRecordJson<SyncedRecoveryVaultPayload>({
      keyring: params.keyring,
      envelope: rawEnv,
      expectedPurpose: 'recovery',
      expectedRecordId: 'recovery',
    });
    if (decrypted?.format === 'chm-recovery-vault-bundle-v1' && Array.isArray(decrypted.entries)) {
      existingEntries = decrypted.entries;
    }
  }

  const nextEntry: SyncedRecoveryKeyEntry = {
    publicKey: validated.publicKey,
    fingerprint: validated.fingerprint,
    label: labelOverride ?? validated.label,
    createdAt: validated.createdAt,
    uploadedAt: new Date().toISOString(),
    encryptedKeyEnvelope: validated,
  };
  const filtered = existingEntries.filter((e) => e.publicKey !== nextEntry.publicKey);
  filtered.push(nextEntry);

  const payload: SyncedRecoveryVaultPayload = {
    format: 'chm-recovery-vault-bundle-v1',
    version: 1,
    entries: filtered,
  };
  assertNoForbiddenSyncSecrets(payload, 'recovery');

  const env = await encryptVaultRecordJson({
    keyring: params.keyring,
    purpose: 'recovery',
    recordId: 'recovery',
    payload,
  });
  const uploaded = await params.client.upsertJsonFile({
    accessToken: params.accessToken,
    folderId: folder.id,
    existingFileId: existingMeta?.id ?? state.recoveryFileId,
    opaqueFileName: 'recovery.chmkb',
    appProperties: {
      chmRole: 'recovery',
      chmVaultId: params.keyring.vaultId,
      chmHash: env.contentHash.slice(0, 24),
    },
    jsonPayload: env,
  });

  await saveDriveAccountState({
    ...state,
    folderId: folder.id,
    vaultId: params.keyring.vaultId,
    recoveryFileId: uploaded.id,
  });

  return { entries: filtered, fileId: uploaded.id };
}

export async function listEncryptedKeyRecoveryBackups(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  keyring: UnlockedVaultKeyring;
}): Promise<SyncedRecoveryKeyEntry[]> {
  const state = await loadDriveAccountState(params.accountKey);
  const { folder } = await params.client.ensureVaultRootFolder({
    accessToken: params.accessToken,
    knownFolderId: state.folderId,
  });
  const driveFiles = await params.client.findVaultFilesInFolder({
    accessToken: params.accessToken,
    folderId: folder.id,
    vaultId: params.keyring.vaultId,
  });
  const meta =
    (state.recoveryFileId && driveFiles.find((f) => f.id === state.recoveryFileId)) ||
    driveFiles.find((f) => f.appProperties?.chmRole === 'recovery');
  if (!meta) return [];

  const rawEnv = await params.client.downloadJsonFile<EncryptedVaultRecordEnvelope>({
    accessToken: params.accessToken,
    fileId: meta.id,
  });
  const decrypted = await decryptVaultRecordJson<SyncedRecoveryVaultPayload>({
    keyring: params.keyring,
    envelope: rawEnv,
    expectedPurpose: 'recovery',
    expectedRecordId: 'recovery',
  });
  if (decrypted?.format !== 'chm-recovery-vault-bundle-v1' || !Array.isArray(decrypted.entries)) {
    return [];
  }
  return decrypted.entries;
}

export async function restoreAuthorKeyFromDriveRecovery(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  keyring: UnlockedVaultKeyring;
  publicKey: string;
  backupPassphrase: string;
}) {
  const entries = await listEncryptedKeyRecoveryBackups({
    client: params.client,
    accessToken: params.accessToken,
    accountKey: params.accountKey,
    keyring: params.keyring,
  });
  const match = entries.find((e) => e.publicKey === params.publicKey);
  if (!match) {
    throw new Error('Encrypted recovery backup not found for this Author key.');
  }
  return restoreAuthorKeyFromBackup(match.encryptedKeyEnvelope, params.backupPassphrase);
}

/**
 * Resolves a preserved conflict explicitly chosen by the user without discarding
 * data silently.
 */
export async function resolveVaultSyncConflict(params: {
  accountKey: string;
  conflictId: string;
  resolution: 'keep-local' | 'accept-remote' | 'keep-both';
}): Promise<PersistedDriveAccountState> {
  const state = await loadDriveAccountState(params.accountKey);
  const target = state.conflicts.find((c) => c.id === params.conflictId);
  if (!target) {
    throw new Error(`Conflict not found: ${params.conflictId}`);
  }

  const syncedHashes = { ...state.syncedEntityHashes };

  if (target.entityType === 'profile') {
    const local = target.localRecord as AuthorProfile;
    const remote = target.remoteRecord as AuthorProfile;
    if (params.resolution === 'accept-remote') {
      await upsertAuthorProfilesBatch([remote]);
      syncedHashes[`profile:${target.entityId}`] = hashProfileRecord(remote);
    } else if (params.resolution === 'keep-local') {
      syncedHashes[`profile:${target.entityId}`] = target.remoteContentHash;
    } else {
      const cloned: AuthorProfile = {
        ...remote,
        id: `${remote.id}-copy-${Date.now().toString(36)}`,
        profileName: `${remote.profileName} (Remote Copy)`.slice(0, 64),
        isDefault: false,
        version: 1,
      };
      await upsertAuthorProfilesBatch([local, cloned]);
      syncedHashes[`profile:${target.entityId}`] = target.remoteContentHash;
    }
  } else if (target.entityType === 'policy-preset') {
    const local = target.localRecord as PolicyPreset;
    const remote = target.remoteRecord as PolicyPreset;
    if (params.resolution === 'accept-remote') {
      await upsertPolicyPresetsBatch([remote]);
      syncedHashes[`policy-preset:${target.entityId}`] = hashPolicyRecord(remote);
    } else if (params.resolution === 'keep-local') {
      syncedHashes[`policy-preset:${target.entityId}`] = target.remoteContentHash;
    } else {
      const cloned: PolicyPreset = {
        ...remote,
        id: `${remote.id}-copy-${Date.now().toString(36)}`,
        name: `${remote.name} (Remote Copy)`.slice(0, 64),
        isDefault: false,
        version: 1,
      };
      await upsertPolicyPresetsBatch([local, cloned]);
      syncedHashes[`policy-preset:${target.entityId}`] = target.remoteContentHash;
    }
  } else if (target.entityType === 'setting') {
    const remote = target.remoteRecord as VaultSettingsSnapshot;
    if (params.resolution === 'accept-remote') {
      await saveVaultSettings(remote);
      syncedHashes['setting:vault-user-settings'] = hashSettingsRecord(remote);
    } else {
      syncedHashes['setting:vault-user-settings'] = target.remoteContentHash;
    }
  }

  const nextState: PersistedDriveAccountState = {
    ...state,
    syncedEntityHashes: syncedHashes,
    conflicts: state.conflicts.filter((c) => c.id !== params.conflictId),
  };
  await saveDriveAccountState(nextState);
  return nextState;
}

/**
 * Rotates the Vault encryption epoch (e.g. after revoking a trusted device)
 * and re-wraps the remote keyring under the new epoch. Note: previously downloaded
 * remote data and older keys on revoked devices cannot be remotely wiped.
 */
export async function rotateDriveVaultKeyEpoch(params: {
  client: GoogleDriveClient;
  accessToken: string;
  accountKey: string;
  currentKeyring: UnlockedVaultKeyring;
  vaultPassphrase: string;
  pbkdf2Iterations?: number;
}): Promise<{ keyring: UnlockedVaultKeyring; state: PersistedDriveAccountState }> {
  const rotated = rotateVaultKeyringEpoch(params.currentKeyring);
  const state = await loadDriveAccountState(params.accountKey);
  if (!state.folderId) {
    throw new Error('Google Drive Vault folder is not initialized');
  }
  const wrapped = await wrapVaultKeyringWithPassphrase({
    keyring: rotated,
    passphrase: params.vaultPassphrase,
    iterations: params.pbkdf2Iterations,
  });
  const uploaded = await params.client.upsertJsonFile({
    accessToken: params.accessToken,
    folderId: state.folderId,
    existingFileId: state.keyringFileId,
    opaqueFileName: 'keyring.chmk',
    appProperties: {
      chmRole: 'keyring',
      chmVaultId: rotated.vaultId,
      chmEpoch: String(rotated.currentEpoch),
    },
    jsonPayload: wrapped,
  });

  const nextState: PersistedDriveAccountState = {
    ...state,
    keyringFileId: uploaded.id,
  };
  await saveDriveAccountState(nextState);

  const synced = await runGoogleDriveSync({
    client: params.client,
    accessToken: params.accessToken,
    accountKey: params.accountKey,
    keyring: rotated,
  });
  return { keyring: rotated, state: synced.state };
}

export async function createDriveVaultKeyShareForDevice(params: {
  keyring: UnlockedVaultKeyring;
  transferPassphrase: string;
  iterations?: number;
}): Promise<CrossDeviceVaultKeyShareEnvelope> {
  return exportCrossDeviceVaultKeyShare(params);
}

export async function unlockDriveVaultFromKeyShare(params: {
  envelope: CrossDeviceVaultKeyShareEnvelope;
  transferPassphrase: string;
}): Promise<UnlockedVaultKeyring> {
  return importCrossDeviceVaultKeyShare(params);
}

/**
 * Helper to delete all proofs/tombstones safely only if needed inside tests.
 */
export async function clearDriveAccountState(accountKey: string): Promise<void> {
  const accountHash = hashGoogleAccountKey(accountKey);
  await runChmTransaction([STORE_STORAGE_STATE], 'readwrite', (tx) => {
    tx.objectStore(STORE_STORAGE_STATE).delete(accountStateStorageId(accountHash));
  });
}
