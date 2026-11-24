import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  createSignedPairingRequest,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import { derivePublicKeyFromSeed, signWithSeed } from '../../src/core/crypto/ed25519';
import { generateNostrKeypair } from '../../src/core/nostr';
import {
  approvePairingRequestAsOwner,
  exportSignedDeviceRegistry,
  importDeviceRevocationNotice,
  importSignedDeviceRegistry,
  inspectPairingRequestForApproval,
  loadDevicePairingState,
  removePairedDeviceEntry,
  revokePairedDevice,
} from '../../src/core/storage/devicePairingStore';
import { createAuthorKey } from '../../src/core/storage/keyStore';
import {
  createSignedBindingAttestation,
  enqueueSyncOutboxItems,
  listSyncOutbox,
  listVerifiedPeerBindings,
  upsertVerifiedPeerBinding,
} from '../../src/core/sync';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

const DEV1_ID = hexToBytes('11111111222243338444555555555555');
const DEV1_ID_HEX = '11111111-2222-4333-8444-555555555555';
const DEV1_SEED = hexToBytes('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb');
const DEV1_PUB = derivePublicKeyFromSeed(DEV1_SEED);

const DEV2_ID = hexToBytes('22222222333344448555666666666666');
const DEV2_ID_HEX = '22222222-3333-4444-8555-666666666666';
const DEV2_SEED = hexToBytes('c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7');
const DEV2_PUB = derivePublicKeyFromSeed(DEV2_SEED);

describe('removePairedDeviceEntry & monotonic anti-resurrection', () => {
  const originalIdb = globalThis.indexedDB;
  let backend: InMemoryIdbBackend;

  beforeEach(() => {
    backend = new InMemoryIdbBackend();
    const { factory } = createInMemoryIndexedDb(backend);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: factory,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
  });

  it('removes paired device + its sync bindings/outbox while preserving cryptographic revocations monotonically', async () => {
    const ownerPass = 'unit-owner-pass-1234';
    const { record: owner } = await createAuthorKey({
      label: 'Artist Yomi',
      backupPassphrase: ownerPass,
    });

    const req1 = await createSignedPairingRequest({
      deviceId: DEV1_ID,
      devicePublicKey: DEV1_PUB,
      deviceDisplayName: 'Old Phone',
      signWithDeviceKey: (m) => signWithSeed(DEV1_SEED, m),
    });
    const req2 = await createSignedPairingRequest({
      deviceId: DEV2_ID,
      devicePublicKey: DEV2_PUB,
      deviceDisplayName: 'Studio Tablet',
      signWithDeviceKey: (m) => signWithSeed(DEV2_SEED, m),
    });

    const app1 = await approvePairingRequestAsOwner({
      rawRequestInput: req1.token,
      authorKeyId: owner.id,
      passphrase: ownerPass,
    });
    const app2 = await approvePairingRequestAsOwner({
      rawRequestInput: req2.token,
      authorKeyId: owner.id,
      passphrase: ownerPass,
    });

    // Attach peer sync bindings and outbox messages for both devices
    const nostr1 = generateNostrKeypair();
    const nostr2 = generateNostrKeypair();
    const bind1 = await createSignedBindingAttestation({
      ownerPublicKey: owner.publicKey,
      deviceIdBytes: DEV1_ID,
      devicePublicKey: DEV1_PUB,
      signerRole: 'paired-device',
      signWithChmKey: (m) => signWithSeed(DEV1_SEED, m),
      nostrSecretKey: nostr1.secretKey,
    });
    const bind2 = await createSignedBindingAttestation({
      ownerPublicKey: owner.publicKey,
      deviceIdBytes: DEV2_ID,
      devicePublicKey: DEV2_PUB,
      signerRole: 'paired-device',
      signWithChmKey: (m) => signWithSeed(DEV2_SEED, m),
      nostrSecretKey: nostr2.secretKey,
    });

    await upsertVerifiedPeerBinding({
      key: `${owner.fingerprintHex}:${DEV1_ID_HEX}:${nostr1.publicKeyHex}`,
      bindingIdHex: bind1.bindingIdHex,
      ownerFingerprintHex: owner.fingerprintHex,
      ownerPublicKeyBase64Url: owner.publicKeyBase64Url,
      deviceIdHex: DEV1_ID_HEX,
      devicePublicKeyBase64Url: base64UrlEncode(DEV1_PUB),
      nostrPubkeyHex: nostr1.publicKeyHex,
      npub: nostr1.npub,
      signerRole: 'paired-device',
      issuedAt: bind1.issuedAt,
      expiresAt: bind1.expiresAt,
      bindingCborBase64Url: base64UrlEncode(bind1.envelopeBytes),
      updatedAt: new Date().toISOString(),
    });
    await upsertVerifiedPeerBinding({
      key: `${owner.fingerprintHex}:${DEV2_ID_HEX}:${nostr2.publicKeyHex}`,
      bindingIdHex: bind2.bindingIdHex,
      ownerFingerprintHex: owner.fingerprintHex,
      ownerPublicKeyBase64Url: owner.publicKeyBase64Url,
      deviceIdHex: DEV2_ID_HEX,
      devicePublicKeyBase64Url: base64UrlEncode(DEV2_PUB),
      nostrPubkeyHex: nostr2.publicKeyHex,
      npub: nostr2.npub,
      signerRole: 'paired-device',
      issuedAt: bind2.issuedAt,
      expiresAt: bind2.expiresAt,
      bindingCborBase64Url: base64UrlEncode(bind2.envelopeBytes),
      updatedAt: new Date().toISOString(),
    });

    await enqueueSyncOutboxItems([
      {
        id: `op-1:${DEV1_ID_HEX}`,
        ownerFingerprintHex: owner.fingerprintHex,
        recipientDeviceIdHex: DEV1_ID_HEX,
        recipientNostrPubkeyHex: nostr1.publicKeyHex,
        opIdHex: 'aaaa',
        nostrEventJson: '{}',
        createdAt: new Date().toISOString(),
        attempts: 0,
        nextRetryAtMs: 0,
      },
      {
        id: `op-1:${DEV2_ID_HEX}`,
        ownerFingerprintHex: owner.fingerprintHex,
        recipientDeviceIdHex: DEV2_ID_HEX,
        recipientNostrPubkeyHex: nostr2.publicKeyHex,
        opIdHex: 'aaaa',
        nostrEventJson: '{}',
        createdAt: new Date().toISOString(),
        attempts: 0,
        nextRetryAtMs: 0,
      },
    ]);

    // Export pre-revocation snapshot before revoking DEV1
    const staleBackup = await exportSignedDeviceRegistry({
      authorKeyId: owner.id,
      passphrase: ownerPass,
    });

    // Revoke DEV1, then remove it from the visible list
    const revRes = await revokePairedDevice({
      authorKeyId: owner.id,
      deviceIdHex: DEV1_ID_HEX,
      reason: 'retired',
      passphrase: ownerPass,
    });

    const removeRes = await removePairedDeviceEntry(app1.pairedDevice.key);
    expect(removeRes.removed).toBe(true);
    expect(removeRes.removedBindingsCount).toBe(1);
    expect(removeRes.removedOutboxCount).toBe(1);
    expect(removeRes.preservedRevocation).toBe(true);

    // Visible pairedDevices only contains DEV2; revocations still holds DEV1
    const stateAfterRemove = await loadDevicePairingState();
    expect(stateAfterRemove.pairedDevices.map((d) => d.key)).toEqual([app2.pairedDevice.key]);
    expect(stateAfterRemove.revocations).toHaveLength(1);
    expect(stateAfterRemove.revocations[0].key).toBe(app1.pairedDevice.key);
    expect(stateAfterRemove.revocations[0].dismissedFromList).toBe(true);

    // DEV2 binding and outbox item stay untouched; DEV1's are gone
    const bindingsNow = await listVerifiedPeerBindings();
    expect(bindingsNow.map((b) => b.deviceIdHex)).toEqual([DEV2_ID_HEX]);
    const outboxNow = await listSyncOutbox();
    expect(outboxNow.map((o) => o.recipientDeviceIdHex)).toEqual([DEV2_ID_HEX]);

    // Exporting backup AFTER removal still embeds DEV1's revocation for other devices
    const postRemoveBackup = await exportSignedDeviceRegistry({
      authorKeyId: owner.id,
      passphrase: ownerPass,
    });
    expect(postRemoveBackup.snapshot.payload.revocations).toHaveLength(1);
    expect(postRemoveBackup.snapshot.payload.revocations[0].payload.deviceIdHex).toBe(DEV1_ID_HEX);

    // Re-importing stale pre-revocation snapshot MUST NOT resurrect DEV1!
    const reconcile = await importSignedDeviceRegistry(staleBackup.jsonString);
    expect(reconcile.preservedLocalRevocations).toBeGreaterThanOrEqual(1);
    const stateAfterStale = await loadDevicePairingState();
    expect(stateAfterStale.pairedDevices.map((d) => d.key)).toEqual([app2.pairedDevice.key]);

    // Re-importing revocation token MUST NOT put a "Revoked Device" card back in pairedDevices
    await importDeviceRevocationNotice(revRes.revocation.token);
    const stateAfterRevImport = await loadDevicePairingState();
    expect(stateAfterRevImport.pairedDevices.map((d) => d.key)).toEqual([app2.pairedDevice.key]);

    // Re-pairing DEV1's key is still blocked because revocation record persists
    const freshReq1 = await createSignedPairingRequest({
      deviceId: DEV1_ID,
      devicePublicKey: DEV1_PUB,
      deviceDisplayName: 'Old Phone Retry',
      signWithDeviceKey: (m) => signWithSeed(DEV1_SEED, m),
    });
    const inspectRetry = await inspectPairingRequestForApproval({
      rawInput: freshReq1.token,
      ownerPublicKeyBase64Url: owner.publicKeyBase64Url,
      ownerFingerprintHex: owner.fingerprintHex,
    });
    expect(inspectRetry.deviceRevoked).toBe(true);

    // Removing DEV2 directly (e.g. non-revoked local cleanup) removes it cleanly without creating fake revocations
    const removeDev2 = await removePairedDeviceEntry(app2.pairedDevice.key);
    expect(removeDev2.removed).toBe(true);
    expect(removeDev2.removedBindingsCount).toBe(1);
    expect(removeDev2.removedOutboxCount).toBe(1);
    expect(removeDev2.preservedRevocation).toBe(false);

    const finalState = await loadDevicePairingState();
    expect(finalState.pairedDevices).toHaveLength(0);
    expect(finalState.revocations).toHaveLength(1);
    expect(await listVerifiedPeerBindings()).toHaveLength(0);
    expect(await listSyncOutbox()).toHaveLength(0);

    // Removing non-existent key is a safe no-op
    const missing = await removePairedDeviceEntry('missing:key');
    expect(missing.removed).toBe(false);

    // Sanity check fingerprint helper import
    expect(computePublicKeyFingerprintSync(DEV1_PUB).fullHex).toHaveLength(64);
  });
});
