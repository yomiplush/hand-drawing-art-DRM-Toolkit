// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import {
  buildChmSyncRumor,
  createGiftWrapEvent,
  createSignedNostrEvent,
  encryptNip44,
  generateNostrKeypair,
  getNip44ConversationKey,
} from '../../src/core/nostr';
import { NIP59_KIND_SEAL, wrapRumorForRecipient } from '../../src/core/nostr/nip59';
import {
  approvePairingRequestAsOwner,
  completeDevicePairingWithCertificate,
  createOrReplaceLocalDeviceIdentity,
  loadDevicePairingState,
  revokePairedDevice,
  startDevicePairingRequestSession,
} from '../../src/core/storage/devicePairingStore';
import { createAuthorKey } from '../../src/core/storage/keyStore';
import {
  NostrSyncTransport,
  announceLocalBindingToKnownPeers,
  attachSyncBindingToPairingUrl,
  enableDecentralizedSync,
  extractSyncBindFromPairingUrl,
  getSyncStatusSummary,
  importPeerSyncBindingInput,
  listSyncOutbox,
  recordAndBroadcastOwnerSyncMutation,
  runDecentralizedSyncCycle,
  setAllowLocalWsRelayForTests,
  setSyncTransport,
  updateSyncOutboxRecord,
} from '../../src/core/sync';
import type { RelayConfig } from '../../src/core/sync';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';
import { MockNostrRelay } from '../helpers/mockNostrRelay';

function makeTestRaster(w = 128, h = 128) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i * 13) & 0xff;
    data[i * 4 + 1] = (i * 7) & 0xff;
    data[i * 4 + 2] = (i * 29) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('Live Mock-Relay Multi-Device CHM Sync Integration', () => {
  const originalIdb = globalThis.indexedDB;
  let relay: MockNostrRelay;
  let relayUrl: string;
  let setBackend: (b: InMemoryIdbBackend) => void;
  let ownerBackend: InMemoryIdbBackend;
  let deviceBBackend: InMemoryIdbBackend;
  let deviceCBackend: InMemoryIdbBackend;
  let deviceDBackend: InMemoryIdbBackend;

  const ownerPass = 'owner-passphrase-test-99';
  const devPass = 'device-passphrase-test-99';

  function relayCfg(url = relayUrl): RelayConfig[] {
    return [{ url, enabled: true, read: true, write: true }];
  }

  beforeEach(async () => {
    relay = new MockNostrRelay({ requireAuth: true });
    relayUrl = await relay.start();

    ownerBackend = new InMemoryIdbBackend();
    deviceBBackend = new InMemoryIdbBackend();
    deviceCBackend = new InMemoryIdbBackend();
    deviceDBackend = new InMemoryIdbBackend();

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
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
    await relay.stop();
  });

  it('enforces opt-in consent, syncs enrollments & revocations with NIP-42 AUTH, excludes revoked recipients, detects causal gaps/malicious frames & keeps artwork signing offline-independent', async () => {
    // 1. Default sync OFF & explicit consent gate
    setBackend(ownerBackend);
    const { record: ownerAuthor } = await createAuthorKey({
      label: 'Artist Studio',
      backupPassphrase: ownerPass,
    });
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Owner Workstation',
      backupPassphrase: devPass,
    });

    const skippedReport = await runDecentralizedSyncCycle();
    expect(skippedReport.skipped).toBe(true);
    expect(relay.getStoredEvents()).toHaveLength(0);

    await expect(
      enableDecentralizedSync({
        acceptConsent: false,
        relays: relayCfg(),
        authorKeyId: ownerAuthor.id,
        ownerPassphrase: ownerPass,
        devicePassphrase: devPass,
        nostrPassphraseIfFallback: ownerPass,
        nip49LogN: 12,
      }),
    ).rejects.toThrow(/consent/i);

    const ownerSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: relayCfg(),
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: ownerPass,
      nip49LogN: 12,
    });
    expect(ownerSync.settings.enabled).toBe(true);
    expect(ownerSync.binding).toBeDefined();
    const ownerNostrPub = ownerSync.nostrKey.nostrPubkeyHex;

    // 2. Pair Device B via QR + attach owner &sync-bind= + sync multi-device via live MockRelay with NIP-42 AUTH
    setBackend(deviceBBackend);
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'iPad Pro',
      backupPassphrase: devPass,
    });
    const reqB = await startDevicePairingRequestSession({
      deviceName: 'iPad Pro',
      devicePassphrase: devPass,
    });

    setBackend(ownerBackend);
    const approveB = await approvePairingRequestAsOwner({
      rawRequestInput: reqB.qrUrl,
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
    });
    const certUrlWithBindB = attachSyncBindingToPairingUrl(approveB.qrUrl, ownerSync.binding!);
    const op1Res = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'enroll-device',
      enrollmentCertificate: approveB.certificate,
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(op1Res.op.sequence).toBe(1);

    // Complete pairing on Device B, import owner &sync-bind=, enable sync, and announce B's Nostr binding
    setBackend(deviceBBackend);
    await completeDevicePairingWithCertificate({
      rawCertificateInput: certUrlWithBindB,
      confirmOwnerTrust: true,
    });
    expect(extractSyncBindFromPairingUrl(certUrlWithBindB)).not.toBeNull();
    await importPeerSyncBindingInput(certUrlWithBindB);
    const bSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: relayCfg(),
      deviceName: 'iPad Pro',
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
      nip49LogN: 12,
    });
    const devBNostrPub = bSync.nostrKey.nostrPubkeyHex;
    const announceB = await announceLocalBindingToKnownPeers({
      ownerFingerprintHex: ownerAuthor.fingerprintHex,
      nostrPassphraseIfFallback: devPass,
    });
    expect(announceB.publishedRelays).toBe(1);

    // Assert NIP-42 AUTH actually succeeded against MockRelay
    expect(relay.getReceivedAuthEvents().length).toBeGreaterThanOrEqual(1);

    // Owner A syncs -> discovers Device B binding and automatically pushes historical op #1 to B
    setBackend(ownerBackend);
    const ownerCatchupSync = await runDecentralizedSyncCycle({
      ownerPassphrase: ownerPass,
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(ownerCatchupSync.importedBindingsCount).toBe(1);

    // Pair Device C as well
    setBackend(deviceCBackend);
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Travel Phone',
      backupPassphrase: devPass,
    });
    const reqC = await startDevicePairingRequestSession({
      deviceName: 'Travel Phone',
      devicePassphrase: devPass,
    });

    setBackend(ownerBackend);
    const approveC = await approvePairingRequestAsOwner({
      rawRequestInput: reqC.qrUrl,
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
    });
    const certUrlWithBindC = attachSyncBindingToPairingUrl(approveC.qrUrl, ownerSync.binding!);
    const op2Broadcast = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'enroll-device',
      enrollmentCertificate: approveC.certificate,
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(op2Broadcast.op.sequence).toBe(2);

    setBackend(deviceCBackend);
    await completeDevicePairingWithCertificate({
      rawCertificateInput: certUrlWithBindC,
      confirmOwnerTrust: true,
    });
    await importPeerSyncBindingInput(certUrlWithBindC);
    const cSync = await enableDecentralizedSync({
      acceptConsent: true,
      relays: relayCfg(),
      deviceName: 'Travel Phone',
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
      nip49LogN: 12,
    });
    const devCNostrPub = cSync.nostrKey.nostrPubkeyHex;
    await announceLocalBindingToKnownPeers({
      ownerFingerprintHex: ownerAuthor.fingerprintHex,
      nostrPassphraseIfFallback: devPass,
    });

    // Owner A discovers Device C binding too
    setBackend(ownerBackend);
    await runDecentralizedSyncCycle({
      ownerPassphrase: ownerPass,
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: ownerPass,
    });

    // Device B syncs -> learns both Device B & Device C enrollments
    setBackend(deviceBBackend);
    const bCycle = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(bCycle.importedOpsCount).toBeGreaterThanOrEqual(2);
    const bStateAfterEnroll = await loadDevicePairingState();
    expect(
      bStateAfterEnroll.pairedDevices.find((d) => d.deviceIdHex === approveC.pairedDevice.deviceIdHex)
        ?.localVerificationStatus,
    ).toBe('active-trusted');

    // 3. Owner A revokes Device C -> MUST exclude Device C's Nostr pubkey from ALL new relay events!
    setBackend(ownerBackend);
    const preRevokeRelayCount = relay.getStoredEvents().length;
    const revC = await revokePairedDevice({
      authorKeyId: ownerAuthor.id,
      deviceIdHex: approveC.pairedDevice.deviceIdHex,
      reason: 'lost-device',
      passphrase: ownerPass,
    });
    const revBroadcast = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'revoke-device',
      revocationNotice: revC.revocation,
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(revBroadcast.op.sequence).toBe(3);

    const postRevokeEvents = relay.getStoredEvents().slice(preRevokeRelayCount);
    expect(postRevokeEvents.length).toBeGreaterThanOrEqual(1);
    const targetedToC = postRevokeEvents.filter((ev) =>
      ev.tags.some((t) => t[0] === 'p' && t[1] === devCNostrPub),
    );
    expect(targetedToC).toHaveLength(0);
    const targetedToB = postRevokeEvents.filter((ev) =>
      ev.tags.some((t) => t[0] === 'p' && t[1] === devBNostrPub),
    );
    expect(targetedToB.length).toBeGreaterThanOrEqual(1);

    // Device B syncs -> marks Device C revoked deterministically
    setBackend(deviceBBackend);
    await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    const bStateAfterRevoke = await loadDevicePairingState();
    expect(
      bStateAfterRevoke.pairedDevices.find((d) => d.deviceIdHex === approveC.pairedDevice.deviceIdHex)
        ?.localVerificationStatus,
    ).toBe('revoked');

    // Verify stale enrollment cert replay cannot resurrect Device C on B
    await expect(
      completeDevicePairingWithCertificate({
        rawCertificateInput: approveC.certificate.token,
        confirmOwnerTrust: true,
      }),
    ).rejects.toThrow();

    // 4. Malicious relay attacks against Device B
    const attacker = generateNostrKeypair();
    const spoofedRumor = buildChmSyncRumor({
      senderPubkeyHex: ownerNostrPub,
      content: '{"protocol":"CHM-SYNC-v1","payloadKind":"sync-bundle","opsBase64Url":[],"bindingsBase64Url":[]}',
    });
    const attackerConv = getNip44ConversationKey(attacker.secretKey, devBNostrPub);
    const attackerSeal = createSignedNostrEvent(
      {
        kind: NIP59_KIND_SEAL,
        tags: [],
        content: encryptNip44(JSON.stringify(spoofedRumor), attackerConv),
      },
      attacker.secretKey,
    );
    const spoofWrap = createGiftWrapEvent({
      seal: attackerSeal,
      recipientPubkeyHex: devBNostrPub,
    });
    relay.injectEventDirect(spoofWrap);

    const legitFake = wrapRumorForRecipient({
      rumor: buildChmSyncRumor({ senderPubkeyHex: attacker.publicKeyHex, content: '{}' }),
      senderSecretKey: attacker.secretKey,
      recipientPubkeyHex: devBNostrPub,
    });
    relay.injectEventDirect({
      ...legitFake,
      sig: '00'.repeat(64),
    });

    relay.injectRawFramesOnReq.push(
      '{"not":"array"}',
      `["EVENT","__SUB_ID__",${JSON.stringify({ ...legitFake, content: 'x'.repeat(135_000) })}]`,
    );

    const bAttackRes = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(bAttackRes.rejectedEventCount).toBeGreaterThanOrEqual(2);
    relay.injectRawFramesOnReq = [];

    // Causal gap withholding test over live relay:
    // Emit op #4 and op #5 separately from Owner A, withhold op #4's relay event before B syncs -> B detects missing #4!
    setBackend(ownerBackend);
    const beforeOp4 = relay.getStoredEvents().length;
    const op4Checkpoint = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'checkpoint',
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(op4Checkpoint.op.sequence).toBe(4);
    const op4Events = relay.getStoredEvents().slice(beforeOp4);
    for (const ev of op4Events) {
      relay.withholdEventIds.add(ev.id);
    }

    const op5Checkpoint = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'checkpoint',
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(op5Checkpoint.op.sequence).toBe(5);

    setBackend(deviceBBackend);
    const gapReport = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(gapReport.status.hasCausalGap).toBe(true);
    expect(gapReport.status.missingSequences).toContain(4);

    // Release withheld op #4 -> gap self-heals on next sync
    relay.withholdEventIds.clear();
    const healedReport = await runDecentralizedSyncCycle({
      devicePassphrase: devPass,
      nostrPassphraseIfFallback: devPass,
    });
    expect(healedReport.status.hasCausalGap).toBe(false);
    expect(healedReport.status.missingSequences).toEqual([]);

    // 5. Offline resilience, outbox queue flush & Layer 1 complete independence when relay is completely down
    setBackend(deviceDBackend);
    await createOrReplaceLocalDeviceIdentity({
      deviceName: 'Backup Tablet',
      backupPassphrase: devPass,
    });
    const reqD = await startDevicePairingRequestSession({
      deviceName: 'Backup Tablet',
      devicePassphrase: devPass,
    });
    setBackend(ownerBackend);
    const approveD = await approvePairingRequestAsOwner({
      rawRequestInput: reqD.qrUrl,
      authorKeyId: ownerAuthor.id,
      passphrase: ownerPass,
    });
    void approveD;

    // Stop relay completely -> Layer 1 artwork signing & verification still work 100%
    await relay.stop();
    setBackend(ownerBackend);

    const signedArt = await createSignedArtworkPng({
      artworkRaster: makeTestRaster(128, 128),
      authorKey: ownerAuthor,
      passphraseIfEncrypted: ownerPass,
      authorName: 'Artist Studio',
      artworkTitle: 'Offline Artwork Proof',
      license: {
        licenseId: 'CC-BY-NC-SA-4.0',
        attributionName: 'Artist Studio',
        commercialUse: 'disallow',
        redistribution: 'allow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 16,
        showLabel: false,
      },
      issuedAt: 1795352800,
    });
    const verifiedArt = await verifyProofAndArtwork({
      proofInput: signedArt.proofUrl,
      artworkRaster: makeTestRaster(128, 128),
      lookupTrustedKey: async () => undefined,
    });
    expect(verifiedArt.signatureStatus).toBe('valid');

    // Queue op #6 offline while relay is stopped (Device B is active peer) -> outbox queues cleanly
    const offlineOp = await recordAndBroadcastOwnerSyncMutation({
      authorKeyId: ownerAuthor.id,
      ownerPassphrase: ownerPass,
      opKind: 'checkpoint',
      nostrPassphraseIfFallback: ownerPass,
    });
    expect(offlineOp.op.sequence).toBe(6);
    expect(offlineOp.queuedCount).toBeGreaterThanOrEqual(1);
    expect(offlineOp.publishedSucceededRelays).toBe(0);
    const offlineSummary = await getSyncStatusSummary();
    expect(offlineSummary.queuedOutboxCount).toBeGreaterThanOrEqual(1);

    // Clear retry backoff for immediate flush test, restart relay, and flush queued outbox cleanly
    for (const item of await listSyncOutbox()) {
      await updateSyncOutboxRecord({ ...item, nextRetryAtMs: 0 });
    }
    const freshRelay = new MockNostrRelay({ requireAuth: true });
    const freshUrl = await freshRelay.start();
    try {
      await enableDecentralizedSync({
        acceptConsent: true,
        relays: relayCfg(freshUrl),
        authorKeyId: ownerAuthor.id,
        ownerPassphrase: ownerPass,
        devicePassphrase: devPass,
        nostrPassphraseIfFallback: ownerPass,
        nip49LogN: 12,
      });
      const flushReport = await runDecentralizedSyncCycle({
        ownerPassphrase: ownerPass,
        devicePassphrase: devPass,
        nostrPassphraseIfFallback: ownerPass,
      });
      expect(flushReport.sentOutboxCount).toBeGreaterThanOrEqual(1);
      expect(flushReport.status.queuedOutboxCount).toBe(0);
      expect(freshRelay.getStoredEvents().length).toBeGreaterThanOrEqual(1);
    } finally {
      await freshRelay.stop();
    }
  }, 30_000);
});
