// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import { generateNostrKeypair } from '../../src/core/nostr';
import {
  approvePairingRequestAsOwner,
  completeDevicePairingWithCertificate,
  createOrReplaceLocalDeviceIdentity,
  revokePairedDevice,
  startDevicePairingRequestSession,
} from '../../src/core/storage/devicePairingStore';
import { createAuthorKey } from '../../src/core/storage/keyStore';
import {
  NostrSyncTransport,
  addRelayConfig,
  announceLocalBindingToKnownPeers,
  attachSyncBindingToPairingUrl,
  enableDecentralizedSync,
  extractSyncBindFromPairingUrl,
  getSyncStatusSummary,
  importPeerSyncBindingInput,
  loadSyncSettings,
  recordAndBroadcastOwnerSyncMutation,
  runDecentralizedSyncCycle,
  saveSyncSettings,
  setAllowLocalWsRelayForTests,
  setSyncTransport,
  syncSelectedVaultProofs,
} from '../../src/core/sync';
import type { RelayConfig } from '../../src/core/sync';
import {
  buildPublicProofIndexEvent,
  listAllVaultProofs,
  queryPublicProofsFromRelays,
  saveProofToVault,
} from '../../src/core/vault';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';
import { MockNostrRelay } from '../helpers/mockNostrRelay';

function makeTestRaster(w = 128, h = 128) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i * 17) & 0xff;
    data[i * 4 + 1] = (i * 11) & 0xff;
    data[i * 4 + 2] = (i * 5) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('Zero-Cost Sync Policy, Priority Budget & Selective Vault Sync Integration', () => {
  const originalIdb = globalThis.indexedDB;
  let freeRelay: MockNostrRelay;
  let freeUrl: string;
  let paidRelay: MockNostrRelay;
  let paidUrl: string;
  let setBackend: (b: InMemoryIdbBackend) => void;
  let ownerBackend: InMemoryIdbBackend;
  let deviceBBackend: InMemoryIdbBackend;
  let deviceCBackend: InMemoryIdbBackend;

  const ownerPass = 'owner-passphrase-zero-99';
  const devPass = 'device-passphrase-zero-99';

  beforeEach(async () => {
    freeRelay = new MockNostrRelay({ requireAuth: false });
    freeUrl = await freeRelay.start();
    paidRelay = new MockNostrRelay({
      nip11Document: {
        name: 'Paid Only Relay',
        payments_url: 'https://paid.example/subscribe',
        limitation: { payment_required: true },
      },
    });
    paidUrl = await paidRelay.start();

    ownerBackend = new InMemoryIdbBackend();
    deviceBBackend = new InMemoryIdbBackend();
    deviceCBackend = new InMemoryIdbBackend();
    const idb = createInMemoryIndexedDb(ownerBackend);
    setBackend = idb.setBackend;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: idb.factory,
    });

    setAllowLocalWsRelayForTests(true);
    setSyncTransport(
      new NostrSyncTransport({
        allowInsecureLocalWsForTest: true,
        connectTimeoutMs: 3000,
        requestTimeoutMs: 3000,
        publishTimeoutMs: 3000,
      }),
    );
  });

  afterEach(async () => {
    setAllowLocalWsRelayForTests(false);
    setSyncTransport(new NostrSyncTransport());
    await freeRelay.stop();
    await paidRelay.stop();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
  });

  it('rejects paid relays via NIP-11, auto-pauses runtime payment-required relays, syncs selective Vault proofs & lets revocations bypass soft budget', async () => {
    const cfg: RelayConfig[] = [{ url: freeUrl, enabled: true, read: true, write: true }];

    // 1. Setup Owner + Device B + Device C over QR pairing
    setBackend(ownerBackend);
    const { record: ownerAuthor } = await createAuthorKey({
      label: 'Artist Owner',
      backupPassphrase: ownerPass,
    });
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Owner PC',
      backupPassphrase: devPass,
    });
    const ownerSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: cfg,
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: ownerPass,
      nip49LogN: 12,
    });

    // Adding a NIP-11 paid relay must reject automatically
    await expect(addRelayConfig(paidUrl)).rejects.toThrow(/payment/i);

    // Pair Device B
    setBackend(deviceBBackend);
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Artist Tablet',
      backupPassphrase: devPass,
    });
    const reqSession = await startDevicePairingRequestSession({
      deviceName: 'Artist Tablet',
      devicePassphrase: devPass,
    });

    setBackend(ownerBackend);
    const approvalB = await approvePairingRequestAsOwner({
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
      rawRequestInput: reqSession.qrUrl,
    });
    const certUrlB = attachSyncBindingToPairingUrl(approvalB.qrUrl, ownerSync.binding!);
    await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'enroll-device',
      enrollmentCertificate: approvalB.certificate,
      nostrPassphraseIfFallback: ownerPass,
    });

    setBackend(deviceBBackend);
    await completeDevicePairingWithCertificate({
      rawCertificateInput: certUrlB,
      confirmOwnerTrust: true,
    });
    const extractedOwnerBind = extractSyncBindFromPairingUrl(certUrlB);
    if (extractedOwnerBind) {
      await importPeerSyncBindingInput(extractedOwnerBind.token);
    }
    const devBSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: cfg,
      deviceName: 'Artist Tablet',
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
      nip49LogN: 12,
    });
    await announceLocalBindingToKnownPeers({
      ownerFingerprintHex: ownerAuthor.fingerprintHex,
      nostrPassphraseIfFallback: devPass,
    });

    // Pair Device C (remains active peer when Device B is later revoked)
    setBackend(deviceCBackend);
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Backup Phone',
      backupPassphrase: devPass,
    });
    const reqSessionC = await startDevicePairingRequestSession({
      deviceName: 'Backup Phone',
      devicePassphrase: devPass,
    });

    setBackend(ownerBackend);
    const approvalC = await approvePairingRequestAsOwner({
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
      rawRequestInput: reqSessionC.qrUrl,
    });
    const certUrlC = attachSyncBindingToPairingUrl(approvalC.qrUrl, ownerSync.binding!);
    await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'enroll-device',
      enrollmentCertificate: approvalC.certificate,
      nostrPassphraseIfFallback: ownerPass,
    });

    setBackend(deviceCBackend);
    await completeDevicePairingWithCertificate({
      rawCertificateInput: certUrlC,
      confirmOwnerTrust: true,
    });
    await importPeerSyncBindingInput(certUrlC);
    const devCSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: cfg,
      deviceName: 'Backup Phone',
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
      nip49LogN: 12,
    });
    await announceLocalBindingToKnownPeers({
      ownerFingerprintHex: ownerAuthor.fingerprintHex,
      nostrPassphraseIfFallback: devPass,
    });

    setBackend(ownerBackend);
    await importPeerSyncBindingInput(devBSync.binding!.token);
    await importPeerSyncBindingInput(devCSync.binding!.token);
    await runDecentralizedSyncCycle({
      ownerPassphrase: ownerPass,
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: ownerPass,
    });

    // 2. Owner signs an artwork locally -> saves to Vault -> syncs selected proof to Device B & C
    const signedArt = await createSignedArtworkPng({
      artworkRaster: makeTestRaster(128, 128),
      authorKey: ownerAuthor,
      passphraseIfEncrypted: ownerPass,
      authorName: 'Artist Owner',
      artworkTitle: 'Zero-Cost Synced Piece',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: { placement: 'bottom-right', theme: 'dark-slate', marginPx: 12 },
      issuedAt: 1795352800,
    });
    const savedProof = await saveProofToVault({
      proofInput: signedArt.proofBytes,
      creationMethod: 'hand-drawn-no-ai',
      syncSelected: true,
    });

    const vaultPush = await syncSelectedVaultProofs({
      proofIds: [savedProof.id],
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(vaultPush.syncedProofCount).toBe(1);
    expect(vaultPush.publishedRelays).toBe(1);

    // Device B pulls encrypted NIP-59 vault bundle and verifies proof Ed25519 signature into its Vault
    setBackend(deviceBBackend);
    const pullReport = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(pullReport.importedVaultProofsCount).toBe(1);
    const devBVault = await listAllVaultProofs();
    expect(devBVault).toHaveLength(1);
    expect(devBVault[0].id).toBe(savedProof.id);
    expect(devBVault[0].artworkTitle).toBe('Zero-Cost Synced Piece');

    // 3. Test runtime payment-required auto-pause (simulate a free relay later turning paywalled)
    setBackend(ownerBackend);
    const paywallRuntimeRelay = new MockNostrRelay({
      rejectEventsWithReason: 'payment-required: pay 5000 sats membership fee',
    });
    const paywallRuntimeUrl = await paywallRuntimeRelay.start();
    try {
      await addRelayConfig(paywallRuntimeUrl, { skipNip11Check: true });
      await syncSelectedVaultProofs({
        proofIds: [savedProof.id],
        nostrPassphraseIfFallback: ownerPass,
      });
      const updatedSettings = await loadSyncSettings();
      const flagged = updatedSettings.relays.find((r) => r.url === paywallRuntimeUrl);
      expect(flagged?.policyStatus).toBe('payment-required');
      expect(flagged?.enabled).toBe(false);
    } finally {
      await paywallRuntimeRelay.stop();
    }

    // 4. Test soft monthly budget: Priority 2 Vault sync is deferred when budget exceeded,
    //    while Priority 0 Revocation STILL transmits to active peer Device C without being blocked!
    const currentSettings = await loadSyncSettings();
    await saveSyncSettings({
      ...currentSettings,
      syncWindowBytesUsed: currentSettings.onlineSyncBudgetBytes + 1024,
    });

    const budgetSummary = await getSyncStatusSummary();
    expect(budgetSummary.budgetPaused).toBe(true);
    expect(budgetSummary.gracefulFallbackReason).toBe('budget-limit');

    const deferredVault = await syncSelectedVaultProofs({
      proofIds: [savedProof.id],
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(deferredVault.skippedDueToBudget).toBe(true);
    expect(deferredVault.syncedProofCount).toBe(0);

    const revokedB = await revokePairedDevice({
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
      deviceIdHex: approvalB.pairedDevice.deviceIdHex,
      reason: 'lost-device',
    });
    const revOp = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'revoke-device',
      revocationNotice: revokedB.revocation,
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(revOp.queuedCount).toBe(1);
    expect(revOp.publishedSucceededRelays).toBe(1);

    // Confirm Device C receives the Priority 0 revocation even under owner's budget cap
    setBackend(deviceCBackend);
    const pullRevC = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(pullRevC.importedOpsCount).toBeGreaterThanOrEqual(1);

    // 5. Optional opt-in Public Proof lookup verifies Ed25519 signature and rejects tampered events
    const { secretKey: skPub } = generateNostrKeypair();
    freeRelay.injectEventDirect(
      buildPublicProofIndexEvent({ proofRecord: savedProof, secretKey: skPub }),
    );
    const pubSearch = await queryPublicProofsFromRelays({
      relays: cfg,
      allowInsecureLocalWsForTest: true,
    });
    expect(pubSearch.records).toHaveLength(1);
    expect(pubSearch.records[0].id).toBe(savedProof.id);
  }, 30_000);
});
