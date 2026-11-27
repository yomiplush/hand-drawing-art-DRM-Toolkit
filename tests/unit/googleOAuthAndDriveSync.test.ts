// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import {
  DRIVE_FOLDER_MIME,
  DRIVE_APPDATA_SPACE,
  GOOGLE_DRIVE_APPDATA_SCOPE,
  GoogleDriveClient,
  GoogleDriveStorageProvider,
  InMemoryGoogleAuthManager,
  checkGoogleDriveEnvironmentSupport,
  type GisOAuth2Global,
} from '../../src/core/google';
import { savePolicyPreset } from '../../src/core/policies';
import { listAuthorProfiles, saveAuthorProfile } from '../../src/core/profiles';
import { createAuthorKey, listAuthorKeys, openChmDatabase } from '../../src/core/storage/keyStore';
import {
  VAULT_CRYPTO_FORMAT,
  VAULT_KEYRING_FORMAT,
  assertNoForbiddenSyncSecrets,
  listAllVaultProofs,
  saveDriveAccountState,
  saveProofToVault,
  listEncryptedKeyRecoveryBackups,
  restoreAuthorKeyFromDriveRecovery,
  saveVaultSettings,
  uploadEncryptedKeyRecoveryBackup,
} from '../../src/core/vault';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

interface MockDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties: Record<string, string>;
  modifiedTime: string;
  content?: string;
}

function createMockDriveFetch() {
  const files = new Map<string, MockDriveFile>();
  let nextId = 1;
  let forceTransientFailures = 0;

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (forceTransientFailures > 0) {
      forceTransientFailures--;
      return new Response(JSON.stringify({ error: { message: 'Temporary 503' } }), { status: 503 });
    }
    const urlStr = String(input);
    const url = new URL(urlStr);
    const method = (init?.method ?? 'GET').toUpperCase();

    // Multipart upload / patch
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const ct = (init?.headers as Record<string, string>)?.['Content-Type'] ?? '';
      const boundary = ct.split('boundary=')[1]?.trim() ?? '';
      const rawBody = String(init?.body ?? '');
      const parts = rawBody.split(`--${boundary}`).filter((p) => p.includes('\r\n\r\n'));
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim()) as {
        name: string;
        mimeType: string;
        parents?: string[];
        appProperties?: Record<string, string>;
      };
      const payloadText = parts[1].split('\r\n\r\n')[1].trim();
      const existingIdMatch = url.pathname.match(/\/upload\/drive\/v3\/files\/([^/]+)$/);
      const fileId = existingIdMatch ? existingIdMatch[1] : `file-${nextId++}`;
      const existing = files.get(fileId);
      const record: MockDriveFile = {
        id: fileId,
        name: meta.name,
        mimeType: meta.mimeType ?? 'application/json',
        parents: meta.parents ?? existing?.parents ?? [DRIVE_APPDATA_SPACE],
        appProperties: meta.appProperties ?? existing?.appProperties ?? {},
        modifiedTime: new Date().toISOString(),
        content: payloadText,
      };
      files.set(fileId, record);
      return new Response(JSON.stringify(record), { status: 200 });
    }

    // Create folder
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        name: string;
        mimeType: string;
        parents?: string[];
        appProperties?: Record<string, string>;
      };
      const id = `folder-${nextId++}`;
      const folder: MockDriveFile = {
        id,
        name: body.name,
        mimeType: body.mimeType,
        parents: body.parents ?? [DRIVE_APPDATA_SPACE],
        appProperties: body.appProperties ?? {},
        modifiedTime: new Date().toISOString(),
      };
      files.set(id, folder);
      return new Response(JSON.stringify(folder), { status: 200 });
    }

    // List files
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      if (url.searchParams.get('spaces') && url.searchParams.get('spaces') !== DRIVE_APPDATA_SPACE) {
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }
      const q = url.searchParams.get('q') ?? '';
      const list = Array.from(files.values()).filter((f) => {
        if (q.includes(`mimeType='${DRIVE_FOLDER_MIME}'`) && f.mimeType !== DRIVE_FOLDER_MIME) {
          return false;
        }
        const parentMatch = q.match(/'([^']+)' in parents/);
        if (parentMatch && !f.parents.includes(parentMatch[1])) return false;
        const propMatches = Array.from(
          q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g),
        );
        for (const m of propMatches) {
          if (f.appProperties[m[1]] !== m[2]) return false;
        }
        return true;
      });
      return new Response(JSON.stringify({ files: list }), { status: 200 });
    }

    // Get / delete specific file
    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const id = decodeURIComponent(fileMatch[1]);
      const found = files.get(id);
      if (!found) {
        return new Response(JSON.stringify({ error: { message: 'Not Found' } }), { status: 404 });
      }
      if (method === 'DELETE') {
        files.delete(id);
        return new Response(null, { status: 204 });
      }
      if (url.searchParams.get('alt') === 'media') {
        return new Response(found.content ?? '{}', { status: 200 });
      }
      return new Response(JSON.stringify(found), { status: 200 });
    }

    return new Response(JSON.stringify({ error: { message: `Unhandled URL ${urlStr}` } }), {
      status: 400,
    });
  };

  return {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    files,
    setTransientFailures: (n: number) => {
      forceTransientFailures = n;
    },
  };
}

function makeRaster(w = 64, h = 64) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 13) & 0xff;
  return { width: w, height: h, data };
}

describe('Google OAuth 2.0 Memory-Only Auth, Drive Folder Recovery & Encrypted Sync Engine', () => {
  const originalIdb = globalThis.indexedDB;
  let setBackend: (b: InMemoryIdbBackend) => void;

  beforeEach(async () => {
    const backend = new InMemoryIdbBackend();
    const idb = createInMemoryIndexedDb(backend);
    setBackend = idb.setBackend;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: idb.factory,
    });
    const db = await openChmDatabase();
    db.close();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
  });

  it('correctly classifies standalone loopback, insecure origins, and certified-handmade.com', () => {
    const standalone = checkGoogleDriveEnvironmentSupport({
      origin: 'http://127.0.0.1:43777',
    });
    expect(standalone.supported).toBe(false);
    expect(standalone.reason).toBe('standalone-loopback');

    const insecure = checkGoogleDriveEnvironmentSupport({
      origin: 'http://example.com',
    });
    expect(insecure.supported).toBe(false);
    expect(insecure.reason).toBe('insecure-origin');

    const prod = checkGoogleDriveEnvironmentSupport({
      origin: 'https://www.certified-handmade.com',
    });
    expect(prod.supported).toBe(true);
    expect(prod.reason).toBe('ok');
  });

  it('keeps access tokens in RAM only, lazy-loads GIS, handles failures/expiry/account switching', async () => {
    let gisLoadCalls = 0;
    let activeAccountId = 'perm-acct-a';
    let nextTokenOutcome: 'ok' | 'denied' | 'popup-closed' | 'missing-scope' = 'ok';

    const mockGis: GisOAuth2Global = {
      initTokenClient: (cfg) => ({
        requestAccessToken: () => {
          if (nextTokenOutcome === 'denied') {
            cfg.callback({ error: 'access_denied' });
          } else if (nextTokenOutcome === 'popup-closed') {
            cfg.error_callback?.({ type: 'popup_closed' });
          } else if (nextTokenOutcome === 'missing-scope') {
            cfg.callback({ access_token: 'tok-no-scope', expires_in: 3600, scope: 'email' });
          } else {
            cfg.callback({
              access_token: `mem-secret-token-${activeAccountId}`,
              expires_in: 3600,
              scope: GOOGLE_DRIVE_APPDATA_SCOPE,
            });
          }
        },
      }),
      hasGrantedAllScopes: (resp, scope) => (resp.scope ?? '').includes(scope),
      revoke: (_tok, done) => done?.(),
    };

    const auth = new InMemoryGoogleAuthManager({
      loadGisScript: async () => {
        gisLoadCalls++;
        return mockGis;
      },
      fetchAbout: async () => ({
        accountKey: activeAccountId,
        permissionId: activeAccountId,
        emailAddress: `${activeAccountId}@example.com`,
        displayName: `User ${activeAccountId}`,
      }),
    });

    // Lazy GIS loading invariant: 0 calls before user initiates connectInteractive
    expect(gisLoadCalls).toBe(0);
    expect(auth.getState().gisScriptLoaded).toBe(false);

    nextTokenOutcome = 'denied';
    await expect(
      auth.connectInteractive({ origin: 'https://www.certified-handmade.com' }),
    ).rejects.toThrow(/denied/i);

    nextTokenOutcome = 'popup-closed';
    await expect(
      auth.connectInteractive({ origin: 'https://www.certified-handmade.com' }),
    ).rejects.toThrow(/popup/i);

    nextTokenOutcome = 'missing-scope';
    await expect(
      auth.connectInteractive({ origin: 'https://www.certified-handmade.com' }),
    ).rejects.toThrow(/drive\.appdata/);

    nextTokenOutcome = 'ok';
    const sessionA = await auth.connectInteractive({ origin: 'https://www.certified-handmade.com' });
    expect(gisLoadCalls).toBe(4);
    expect(sessionA.connected).toBe(true);
    expect(sessionA.switchedAccount).toBe(false);
    // Serialization MUST NOT leak the RAM token
    expect(JSON.stringify(auth)).not.toContain('mem-secret-token');

    // Switch account -> flags switchedAccount = true
    activeAccountId = 'perm-acct-b';
    const sessionB = await auth.connectInteractive({ origin: 'https://www.certified-handmade.com' });
    expect(sessionB.switchedAccount).toBe(true);
    expect(sessionB.account?.accountKey).toBe('perm-acct-b');

    // Expired token rejected
    auth.invalidateExpiredToken();
    expect(() => auth.getAccessTokenOrThrow()).toThrow();

    await auth.disconnect({ revokeAuthorization: false });
    expect(auth.getState().connected).toBe(false);
  });

  it('recovers moved folder by appProperties and retries transient Drive 503 with exponential backoff', async () => {
    const drive = createMockDriveFetch();
    const sleeps: number[] = [];
    const client = new GoogleDriveClient({
      fetchImpl: drive.fetchImpl,
      sleepMs: async (ms) => {
        sleeps.push(ms);
      },
      maxRetries: 2,
      baseBackoffMs: 10,
    });

    const first = await client.ensureVaultRootFolder({ accessToken: 'tok' });
    expect(first.created).toBe(true);
    expect(first.folder.appProperties?.chmRole).toBe('root');

    // Simulate knownFolderId stale (404 / user renamed & moved) -> recovers existing folder via appProperties
    drive.setTransientFailures(1);
    const recovered = await client.ensureVaultRootFolder({
      accessToken: 'tok',
      knownFolderId: 'nonexistent-stale-id',
    });
    expect(recovered.created).toBe(false);
    expect(recovered.recovered).toBe(true);
    expect(recovered.folder.id).toBe(first.folder.id);
    expect(sleeps.length).toBe(1);
  });

  it('performs end-to-end encrypted bi-directional sync across two devices, detects conflicts & rollbacks, and never leaks plaintext/secrets', async () => {
    const drive = createMockDriveFetch();
    const client = new GoogleDriveClient({
      fetchImpl: drive.fetchImpl,
      sleepMs: async () => {},
    });

    const auth = new InMemoryGoogleAuthManager({
      fetchAbout: async () => ({
        accountKey: 'acct-1',
        permissionId: 'acct-1',
        emailAddress: 'artist@example.com',
        displayName: 'Artist',
      }),
    });
    auth._setTestSession({
      accessToken: 'ram-only-tok',
      expiresInSeconds: 3600,
      account: { accountKey: 'acct-1', emailAddress: 'artist@example.com', displayName: 'Artist' },
    });

    const providerA = new GoogleDriveStorageProvider({ authManager: auth, driveClient: client });
    const { record: key } = await createAuthorKey({ label: 'Main Ed25519 Key' });
    const signed = await createSignedArtworkPng({
      artworkRaster: makeRaster(),
      authorKey: key,
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 8,
      },
      artworkTitle: 'TopSecretCommissionTitle',
      authorName: 'HiddenPenName',
    });
    await saveProofToVault({ proofInput: signed.proofBytes });
    await saveAuthorProfile({
      id: 'profile-studio',
      profileName: 'Secret Studio Profile',
      displayName: 'HiddenPenName',
      website: 'https://artist.example.com',
      isDefault: true,
    });
    await savePolicyPreset({
      id: 'preset-custom',
      name: 'Secret Preset',
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
      isDefault: true,
    });
    await saveVaultSettings({ preferredQrMode: 'visible' });

    await providerA.unlockOrInitializeVault({
      vaultPassphrase: 'vault-e2e-passphrase-123',
      pbkdf2Iterations: 100_000,
    });
    const syncA = await providerA.sync();
    expect(syncA.ok).toBe(true);
    expect(syncA.uploadedCount).toBeGreaterThanOrEqual(4);

    // Inspect EVERY file stored on mock Google Drive: ZERO plaintext titles/names/tokens!
    for (const file of drive.files.values()) {
      if (file.mimeType === DRIVE_FOLDER_MIME) continue;
      expect(file.name).not.toContain('TopSecretCommissionTitle');
      expect(file.name).not.toContain('HiddenPenName');
      expect(file.content).toBeTruthy();
      expect(file.content).not.toContain('TopSecretCommissionTitle');
      expect(file.content).not.toContain('HiddenPenName');
      expect(file.content).not.toContain('ram-only-tok');
      const parsed = JSON.parse(file.content!);
      expect([VAULT_KEYRING_FORMAT, VAULT_CRYPTO_FORMAT]).toContain(parsed.format);
    }

    // Wrong passphrase on Device B MUST fail (Google OAuth alone cannot decrypt)
    const deviceBBackend = new InMemoryIdbBackend();
    setBackend(deviceBBackend);
    const dbB = await openChmDatabase();
    dbB.close();
    const providerB = new GoogleDriveStorageProvider({ authManager: auth, driveClient: client });
    await expect(
      providerB.unlockOrInitializeVault({
        vaultPassphrase: 'wrong-passphrase-on-device-b',
      }),
    ).rejects.toThrow();

    // Correct passphrase unlocks & pulls encrypted records onto Device B
    await providerB.unlockOrInitializeVault({
      vaultPassphrase: 'vault-e2e-passphrase-123',
    });
    const syncB = await providerB.sync();
    expect(syncB.ok).toBe(true);
    expect(syncB.downloadedCount).toBeGreaterThanOrEqual(3);
    const proofsOnB = await listAllVaultProofs();
    expect(proofsOnB).toHaveLength(1);
    expect(proofsOnB[0].artworkTitle).toBe('TopSecretCommissionTitle');

    // Rollback detection check: if local manifestSeq > remote manifestSeq, sync aborts & sets rollbackWarning
    const stateB = await providerB.getPersistedAccountState();
    expect(stateB).toBeTruthy();
    await saveDriveAccountState({ ...stateB!, lastManifestSeq: 99 });
    await expect(providerB.sync()).rejects.toThrow(/Rollback/i);
    const afterRollback = await providerB.getPersistedAccountState();
    expect(afterRollback?.rollbackWarning).toContain('Rollback');

    // Restore valid seq & simulate concurrent edit conflict resolution (keep-both preserves both variants)
    await saveDriveAccountState({ ...stateB!, rollbackWarning: undefined });
    await saveAuthorProfile({
      id: 'profile-studio',
      profileName: 'Device B Conflict Edit',
      displayName: 'HiddenPenName',
      website: 'https://device-b.example.com',
      isDefault: true,
    });
    const statePreConflict = await providerB.getPersistedAccountState();
    await saveDriveAccountState({
      ...statePreConflict!,
      syncedEntityHashes: {
        ...statePreConflict!.syncedEntityHashes,
        'profile:profile-studio': 'stale-base-hash',
      },
    });
    const conflictSync = await providerB.sync();
    expect(conflictSync.conflictCount).toBe(1);
    const conflictedState = await providerB.getPersistedAccountState();
    expect(conflictedState?.conflicts).toHaveLength(1);
    await providerB.resolveConflict({
      conflictId: conflictedState!.conflicts[0].id,
      resolution: 'keep-both',
    });
    const profilesAfterKeepBoth = await listAuthorProfiles();
    expect(profilesAfterKeepBoth.length).toBeGreaterThanOrEqual(2);

    // Forbidden secret guard
    expect(() => assertNoForbiddenSyncSecrets({ accessToken: 'leak' })).toThrow();
    expect(() => assertNoForbiddenSyncSecrets({ pixels: [1, 2, 3] })).toThrow();
    expect(() => assertNoForbiddenSyncSecrets({ privateKey: 'secret' })).toThrow();
    expect(() => assertNoForbiddenSyncSecrets({ pngBytes: new Uint8Array([1]) })).toThrow();

    // Disconnect preserves local proofs
    const spy = vi.spyOn(auth, 'disconnect');
    await providerB.disconnect({ revokeAuthorization: false });
    expect(spy).toHaveBeenCalled();
    expect(await listAllVaultProofs()).toHaveLength(1);
  });

  it('stores Vault files inside appDataFolder and supports explicit opt-in encrypted key recovery', async () => {
    const drive = createMockDriveFetch();
    const client = new GoogleDriveClient({
      fetchImpl: drive.fetchImpl,
      sleepMs: async () => {},
    });
    const auth = new InMemoryGoogleAuthManager({
      fetchAbout: async () => ({
        accountKey: 'acct-recovery',
        permissionId: 'acct-recovery',
        emailAddress: 'artist@example.com',
        displayName: 'Artist',
      }),
    });
    auth._setTestSession({
      accessToken: 'ram-only-tok-recovery',
      expiresInSeconds: 3600,
      account: { accountKey: 'acct-recovery', emailAddress: 'artist@example.com', displayName: 'Artist' },
    });

    const providerA = new GoogleDriveStorageProvider({ authManager: auth, driveClient: client });
    const { record: authorKey } = await createAuthorKey({
      label: 'Artist Studio Key',
      backupPassphrase: 'key-backup-strong-pass',
    });
    const { keyring: keyringA } = await providerA.unlockOrInitializeVault({
      vaultPassphrase: 'vault-passphrase-abc123',
      pbkdf2Iterations: 100_000,
    });
    await providerA.sync();

    // Sync writes exclusively inside appDataFolder, and NEVER creates a recovery file automatically
    for (const file of drive.files.values()) {
      expect(file.appProperties.chmRole).not.toBe('recovery');
    }

    // Explicit opt-in: upload encrypted key recovery envelope
    const uploaded = await uploadEncryptedKeyRecoveryBackup({
      client,
      accessToken: auth.getAccessTokenOrThrow(),
      accountKey: 'acct-recovery',
      keyring: keyringA,
      authorKeyId: authorKey.id,
    });
    expect(uploaded.entries).toHaveLength(1);
    const recoveryDriveFile = Array.from(drive.files.values()).find(
      (f) => f.appProperties.chmRole === 'recovery',
    );
    expect(recoveryDriveFile).toBeDefined();
    expect(recoveryDriveFile?.content).not.toContain('key-backup-strong-pass');
    expect(recoveryDriveFile?.content).not.toContain('Artist Studio Key');

    // Fresh Device B unlocks Vault with Vault passphrase, then lists & restores key only with key passphrase
    const deviceBBackend = new InMemoryIdbBackend();
    setBackend(deviceBBackend);
    const dbB = await openChmDatabase();
    dbB.close();

    const providerB = new GoogleDriveStorageProvider({ authManager: auth, driveClient: client });
    const { keyring: keyringB } = await providerB.unlockOrInitializeVault({
      vaultPassphrase: 'vault-passphrase-abc123',
    });
    await providerB.sync();

    const entriesOnB = await listEncryptedKeyRecoveryBackups({
      client,
      accessToken: auth.getAccessTokenOrThrow(),
      accountKey: 'acct-recovery',
      keyring: keyringB,
    });
    expect(entriesOnB).toHaveLength(1);
    expect(entriesOnB[0].fingerprint).toBe(authorKey.fingerprintHex);

    await expect(
      restoreAuthorKeyFromDriveRecovery({
        client,
        accessToken: auth.getAccessTokenOrThrow(),
        accountKey: 'acct-recovery',
        keyring: keyringB,
        publicKey: entriesOnB[0].publicKey,
        backupPassphrase: 'wrong-key-passphrase',
      }),
    ).rejects.toThrow();

    await restoreAuthorKeyFromDriveRecovery({
      client,
      accessToken: auth.getAccessTokenOrThrow(),
      accountKey: 'acct-recovery',
      keyring: keyringB,
      publicKey: entriesOnB[0].publicKey,
      backupPassphrase: 'key-backup-strong-pass',
    });

    const restoredKeys = await listAuthorKeys();
    expect(restoredKeys.some((k) => k.fingerprintHex === authorKey.fingerprintHex)).toBe(true);
  });
});
