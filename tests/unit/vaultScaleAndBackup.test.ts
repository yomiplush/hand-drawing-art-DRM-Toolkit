// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computePublicKeyFingerprint } from '../../src/core/crypto/ed25519';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import { createSignedNostrEvent, generateNostrKeypair } from '../../src/core/nostr';
import { createAuthorKey, openChmDatabase } from '../../src/core/storage/keyStore';
import {
  CHM_PUBLIC_PROOF_EVENT_KIND,
  CHM_PUBLIC_PROOF_PROTOCOL_ID,
  CHM_PUBLIC_PROOF_TAG,
  buildCompactVaultRecordFromDecodedProof,
  buildPublicProofIndexEvent,
  computeVaultStats,
  exportEncryptedVaultBackup,
  exportVaultBackupBundle,
  importVaultBackupJson,
  parseAndVerifyPublicProofEvent,
  queryVaultProofs,
  saveProofToVault,
  saveVaultProofBatch,
  setVaultProofSyncSelected,
} from '../../src/core/vault';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

function makeMinimalRaster(w = 64, h = 64) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i * 19) & 0xff;
    data[i * 4 + 1] = (i * 7) & 0xff;
    data[i * 4 + 2] = (i * 23) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('CHM Vault Storage, Scale (1,000–10,000 Proofs) & Portable Zero-Cost Backups', () => {
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

  it('stores compact proofs (~1 KiB each, zero pixels/keys), scales cleanly to 10,000 entries, and verifies backup restores', async () => {
    const { record: author } = await createAuthorKey({ label: 'Vault Artist' });
    const fp = await computePublicKeyFingerprint(author.publicKey);
    const raster = makeMinimalRaster(64, 64);

    const signed = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: author,
      authorName: 'Vault Artist',
      artworkTitle: 'Original Sketch #1',
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
      issuedAt: 1795352800,
    });

    const saved = await saveProofToVault({
      proofInput: signed.proofBytes,
      creationMethod: 'hand-drawn-no-ai',
      syncSelected: true,
    });

    expect(saved.artworkTitle).toBe('Original Sketch #1');
    expect(saved.syncSelected).toBe(true);
    expect(JSON.stringify(saved).length).toBeLessThan(2048);

    // Export plain + AES-256-GCM encrypted backup
    const plainBundle = await exportVaultBackupBundle();
    expect(plainBundle.containsPrivateKeys).toBe(false);
    expect(plainBundle.proofs).toHaveLength(1);
    const encBundle = await exportEncryptedVaultBackup({
      passphrase: 'vault-zero-cost-pass-123',
      iterations: 1000,
    });

    // Tamper proof test: corrupt proof byte in plain backup and restore into clean backend
    setBackend(new InMemoryIdbBackend());
    const tamperedBundle = {
      ...plainBundle,
      proofs: [
        ...plainBundle.proofs,
        {
          proofBase64Url: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      ],
    };
    const restorePlain = await importVaultBackupJson({
      rawJson: JSON.stringify(tamperedBundle),
    });
    expect(restorePlain.importedProofs).toBe(1);
    expect(restorePlain.rejectedProofs).toBe(1);

    setBackend(new InMemoryIdbBackend());
    const restoreEnc = await importVaultBackupJson({
      rawJson: JSON.stringify(encBundle),
      passphraseIfEncrypted: 'vault-zero-cost-pass-123',
    });
    expect(restoreEnc.importedProofs).toBe(1);

    // Public index publishing over Nostr is disabled; legacy archived event reader verifies inner Ed25519 proof
    const { secretKey: sk } = generateNostrKeypair();
    expect(() =>
      buildPublicProofIndexEvent({ proofRecord: saved, secretKey: sk }),
    ).toThrow(/disabled/i);

    const archivedLegacyEv = createSignedNostrEvent(
      {
        kind: CHM_PUBLIC_PROOF_EVENT_KIND,
        tags: [
          ['d', saved.id],
          ['t', CHM_PUBLIC_PROOF_TAG],
        ],
        content: JSON.stringify({
          protocol: CHM_PUBLIC_PROOF_PROTOCOL_ID,
          proofBase64Url: saved.proofBase64Url,
          authorFingerprintHex: saved.authorFingerprintHex,
          creationMethod: saved.creationMethod,
        }),
      },
      sk,
    );
    const verifiedPub = await parseAndVerifyPublicProofEvent(archivedLegacyEv);
    expect(verifiedPub.record.id).toBe(saved.id);

    // Scale test: 10,000 records batch insert & search query
    const templateRec = buildCompactVaultRecordFromDecodedProof({
      proofBytes: signed.proofBytes,
      authorFingerprintHex: fp.fullHex,
      authorFingerprintShort: fp.shortDisplay,
    });
    const batch = [];
    for (let i = 0; i < 10_000; i++) {
      batch.push({
        ...templateRec,
        id: `batch-${i.toString(16).padStart(8, '0')}`,
        artworkTitle: i === 7777 ? 'Target Needle Artwork' : `Sketch #${i}`,
        issuedAt: 1795000000 + i,
        syncSelected: i < 5,
      });
    }
    const inserted = await saveVaultProofBatch(batch);
    expect(inserted).toBe(10_000);

    const searchRes = await queryVaultProofs({ query: 'Target Needle', limit: 20 });
    expect(searchRes.totalCount).toBe(1);
    expect(searchRes.items[0].id).toBe(`batch-${(7777).toString(16).padStart(8, '0')}`);

    const stats = await computeVaultStats();
    expect(stats.totalProofs).toBeGreaterThanOrEqual(10_000);
    expect(stats.avgBytesPerProof).toBeLessThan(1200);

    await setVaultProofSyncSelected(saved.id, false);
    const updatedStats = await computeVaultStats();
    expect(updatedStats.syncSelectedCount).toBe(5);
  }, 30_000);
});
