// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SYNC_RELAYS,
  loadSyncSettings,
  migrateLegacyNostrToAuthOnly,
  saveSyncSettings,
  syncSelectedVaultProofs,
} from '../../src/core/sync';
import {
  NOSTR_PUBLIC_PROOF_PUBLISHING_DISABLED,
  buildPublicProofIndexEvent,
} from '../../src/core/vault';
import {
  STORE_SYNC_OUTBOX,
  STORE_SYNC_SETTINGS,
  openChmDatabase,
  withChmStore,
} from '../../src/core/storage/keyStore';
import type { VaultProofRecord } from '../../src/core/vault/types';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

describe('Strict Separation of Nostr to Device Authentication & Revocation Only', () => {
  const originalIdb = globalThis.indexedDB;

  beforeEach(async () => {
    const backend = new InMemoryIdbBackend();
    const idb = createInMemoryIndexedDb(backend);
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

  it('permanently disables Public Proof Index publishing and Nostr Vault proof syncing', async () => {
    expect(NOSTR_PUBLIC_PROOF_PUBLISHING_DISABLED).toBe(true);

    expect(() =>
      buildPublicProofIndexEvent({
        proofRecord: {} as VaultProofRecord,
        secretKey: new Uint8Array(32),
      }),
    ).toThrow(/disabled/i);

    const res = await syncSelectedVaultProofs({
      proofIds: ['any-proof-id'],
      includeProfile: true,
      includeTrustedArtists: true,
    });
    expect(res).toEqual({
      queued: 0,
      publishedRelays: 0,
      syncedProofCount: 0,
      skippedDueToBudget: false,
      disabledOverNostr: true,
    });
  });

  it('migrates legacy Nostr syncVaultProofs settings & prunes low-priority proof outbox entries while keeping Priority 0 revocations', async () => {
    // Seed legacy record with syncVaultProofs: true
    await withChmStore(STORE_SYNC_SETTINGS, 'readwrite', (s) =>
      s.put({
        id: 'default',
        enabled: true,
        consentAccepted: true,
        relays: DEFAULT_SYNC_RELAYS,
        autoSync: true,
        syncVaultProofs: true,
        onlineSyncBudgetBytes: 512 * 1024,
        syncWindowBytesUsed: 0,
        syncWindowStartedAt: new Date().toISOString(),
      }),
    );

    // Seed Priority 0 revocation (must be kept) and Priority 2 proof outbox (must be pruned)
    await withChmStore(STORE_SYNC_OUTBOX, 'readwrite', (s) =>
      s.put({
        id: 'revocation-op-1',
        ownerFingerprintHex: 'aa'.repeat(32),
        priority: 0,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      }),
    );
    await withChmStore(STORE_SYNC_OUTBOX, 'readwrite', (s) =>
      s.put({
        id: 'legacy-vault-proof-op',
        ownerFingerprintHex: 'aa'.repeat(32),
        priority: 2,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      }),
    );

    const mig = await migrateLegacyNostrToAuthOnly();
    expect(mig.settingsUpdated).toBe(true);
    expect(mig.prunedLegacyOutboxCount).toBe(1);

    const afterSettings = await loadSyncSettings();
    expect(afterSettings.syncVaultProofs).toBe(false);
    expect(afterSettings.migratedAuthOnlyAt).toBeTruthy();

    // Ensure saving settings never re-enables syncVaultProofs
    const saved = await saveSyncSettings({ ...afterSettings, syncVaultProofs: true });
    expect(saved.syncVaultProofs).toBe(false);

    const remainingOutbox = await withChmStore<Array<{ id: string }>>(
      STORE_SYNC_OUTBOX,
      'readonly',
      (s) => s.getAll(),
    );
    expect(remainingOutbox.map((r) => r.id)).toEqual(['revocation-op-1']);
  });
});
