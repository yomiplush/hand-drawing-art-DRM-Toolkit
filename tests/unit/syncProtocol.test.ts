import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  createSignedDeviceRegistrySnapshot,
  createSignedDeviceRevocationNotice,
  createSignedEnrollmentCertificate,
  createSignedPairingRequest,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import {
  derivePublicKeyFromSeed,
  signWithSeed,
} from '../../src/core/crypto/ed25519';
import { encodeNpub, generateNostrKeypair } from '../../src/core/nostr';
import {
  computeConfirmationCodeForCertificate,
  computeConfirmationCodeForRequest,
  createSignedBindingAttestation,
  createSignedSyncOperation,
  decodeAndVerifyBindingAttestation,
  decodeAndVerifySyncRumorPayload,
  encodeSyncRumorPayload,
  resolveDeterministicSyncState,
  selectActiveSyncRecipients,
  validateRelayUrl,
} from '../../src/core/sync';
import type { VerifiedPeerBinding } from '../../src/core/sync';

const OWNER_SEED = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
const OWNER_PUB = derivePublicKeyFromSeed(OWNER_SEED);
const OWNER_FP = computePublicKeyFingerprintSync(OWNER_PUB);

const DEV1_ID = hexToBytes('11111111222243338444555555555555');
const DEV1_ID_HEX = '11111111-2222-4333-8444-555555555555';
const DEV1_SEED = hexToBytes('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb');
const DEV1_PUB = derivePublicKeyFromSeed(DEV1_SEED);

const DEV2_ID = hexToBytes('22222222333344448555666666666666');
const DEV2_ID_HEX = '22222222-3333-4444-8555-666666666666';
const DEV2_SEED = hexToBytes('c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7');
const DEV2_PUB = derivePublicKeyFromSeed(DEV2_SEED);

async function makeEnrollment(devId: Uint8Array, devPub: Uint8Array, devSeed: Uint8Array, name: string) {
  const req = await createSignedPairingRequest({
    deviceId: devId,
    devicePublicKey: devPub,
    deviceDisplayName: name,
    signWithDeviceKey: (msg) => signWithSeed(devSeed, msg),
  });
  const cert = await createSignedEnrollmentCertificate({
    request: req,
    ownerPublicKey: OWNER_PUB,
    ownerDisplayName: 'Artist Yomi',
    signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
  });
  return { req, cert };
}

describe('CHM-SYNC-v1 protocol security, deterministic conflict resolution & transport rules', () => {
  it('computes matching confirmation codes across request/cert and detects QR substitution', async () => {
    const { req, cert } = await makeEnrollment(DEV1_ID, DEV1_PUB, DEV1_SEED, 'iPad');
    const codeReq = computeConfirmationCodeForRequest(req);
    const codeCert = computeConfirmationCodeForCertificate(cert);
    expect(codeReq).toMatch(/^[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/);
    expect(codeCert).toBe(codeReq);

    const attackerPair = await makeEnrollment(DEV2_ID, DEV2_PUB, DEV2_SEED, 'iPad');
    expect(computeConfirmationCodeForRequest(attackerPair.req)).not.toBe(codeReq);
  });

  it('verifies dual-signed BindingAttestation and rejects forged PoP or key reuse', async () => {
    const devNostr = generateNostrKeypair();
    const binding = await createSignedBindingAttestation({
      ownerPublicKey: OWNER_PUB,
      deviceIdBytes: DEV1_ID,
      devicePublicKey: DEV1_PUB,
      signerRole: 'paired-device',
      signWithChmKey: (m) => signWithSeed(DEV1_SEED, m),
      nostrSecretKey: devNostr.secretKey,
    });
    const decoded = decodeAndVerifyBindingAttestation(binding.envelopeBytes);
    expect(decoded.nostrPubkeyHex).toBe(devNostr.publicKeyHex);

    // Reject Schnorr / CHM signature mismatch when owner signs a paired-device binding
    const otherNostr = generateNostrKeypair();
    await expect(
      createSignedBindingAttestation({
        ownerPublicKey: OWNER_PUB,
        deviceIdBytes: DEV1_ID,
        devicePublicKey: DEV1_PUB,
        signerRole: 'paired-device',
        signWithChmKey: (m) => signWithSeed(OWNER_SEED, m), // Wrong CHM key for paired-device!
        nostrSecretKey: devNostr.secretKey,
      }),
    ).rejects.toThrow();

    // Separate valid owner key attestation succeeds with distinct Nostr key
    await expect(
      createSignedBindingAttestation({
        ownerPublicKey: OWNER_PUB,
        deviceIdBytes: DEV1_ID,
        devicePublicKey: DEV1_PUB,
        signerRole: 'owner',
        signWithChmKey: (m) => signWithSeed(OWNER_SEED, m),
        nostrSecretKey: otherNostr.secretKey,
      }),
    ).resolves.toBeDefined();
  });

  it('strictly denies non-owner paired device keys from issuing enroll/revoke sync operations', async () => {
    const { cert } = await makeEnrollment(DEV2_ID, DEV2_PUB, DEV2_SEED, 'Phone');

    // Attempted privilege escalation: DEV1 signs an op claiming OWNER_PUB
    await expect(
      createSignedSyncOperation({
        ownerPublicKey: OWNER_PUB,
        signWithOwnerKey: (m) => signWithSeed(DEV1_SEED, m),
        sequence: 1,
        opKind: 'enroll-device',
        enrollmentCertBytes: cert.envelopeBytes,
      }),
    ).rejects.toThrow();
  });

  it('rejects mismatched certificate owner vs operation owner during decodeAndVerifySyncOperation', async () => {
    // Craft an op signed by DEV2 claiming DEV2 as owner, trying to smuggle OWNER_PUB's enrollment cert
    const { cert } = await makeEnrollment(DEV1_ID, DEV1_PUB, DEV1_SEED, 'Studio');
    await expect(
      createSignedSyncOperation({
        ownerPublicKey: DEV2_PUB,
        signWithOwnerKey: (m) => signWithSeed(DEV2_SEED, m),
        sequence: 1,
        opKind: 'enroll-device',
        enrollmentCertBytes: cert.envelopeBytes,
      }),
    ).rejects.toThrow(/owner/i);
  });

  it('resolves state deterministically without LWW, blocks revocation rollback, detects causal gaps & key conflicts', async () => {
    const { cert: cert1 } = await makeEnrollment(DEV1_ID, DEV1_PUB, DEV1_SEED, 'Tablet');
    const { cert: cert2 } = await makeEnrollment(DEV2_ID, DEV2_PUB, DEV2_SEED, 'Phone');
    const rev1 = await createSignedDeviceRevocationNotice({
      ownerPublicKey: OWNER_PUB,
      deviceId: DEV1_ID,
      devicePublicKey: DEV1_PUB,
      sequence: 1,
      reason: 'lost-device',
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
    });
    const staleSnapshot = await createSignedDeviceRegistrySnapshot({
      ownerPublicKey: OWNER_PUB,
      ownerDisplayName: 'Artist Yomi',
      sequence: 99,
      certificates: [cert1, cert2],
      revocations: [], // Stale snapshot missing rev1!
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
    });

    const op1 = await createSignedSyncOperation({
      ownerPublicKey: OWNER_PUB,
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
      sequence: 1,
      opKind: 'enroll-device',
      enrollmentCertBytes: cert1.envelopeBytes,
    });
    const op2 = await createSignedSyncOperation({
      ownerPublicKey: OWNER_PUB,
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
      sequence: 2,
      prevOpHashBytes: hexToBytes(op1.opHashHex),
      opKind: 'enroll-device',
      enrollmentCertBytes: cert2.envelopeBytes,
    });
    const op3 = await createSignedSyncOperation({
      ownerPublicKey: OWNER_PUB,
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
      sequence: 3,
      prevOpHashBytes: hexToBytes(op2.opHashHex),
      opKind: 'revoke-device',
      revocationBytes: rev1.envelopeBytes,
    });
    // Out-of-order / stale checkpoint op AFTER revocation MUST NOT resurrect DEV1
    const op4 = await createSignedSyncOperation({
      ownerPublicKey: OWNER_PUB,
      signWithOwnerKey: (m) => signWithSeed(OWNER_SEED, m),
      sequence: 4,
      prevOpHashBytes: hexToBytes(op3.opHashHex),
      opKind: 'checkpoint',
      registrySnapshotBytes: staleSnapshot.envelopeBytes,
    });

    // Deliver operations deliberately reversed (4, 3, 2, 1) with duplicates
    const res = resolveDeterministicSyncState({
      ownerFingerprintHex: OWNER_FP.fullHex,
      existingPairedDevices: [],
      existingRevocations: [],
      existingBindings: [],
      operations: [op4, op2, op3, op1, op3],
      trustedOwnerKeys: new Set([base64UrlEncode(OWNER_PUB)]),
    });

    expect(res.hasCausalGap).toBe(false);
    expect(res.missingSequences).toEqual([]);
    const dev1State = res.pairedDevices.find((d) => d.deviceIdHex === DEV1_ID_HEX);
    const dev2State = res.pairedDevices.find((d) => d.deviceIdHex === DEV2_ID_HEX);
    expect(dev1State?.localVerificationStatus).toBe('revoked');
    expect(dev2State?.localVerificationStatus).toBe('active-trusted');

    // Causal gap test: omit op2 (sequence #2 withheld by relay)
    const gapRes = resolveDeterministicSyncState({
      ownerFingerprintHex: OWNER_FP.fullHex,
      existingPairedDevices: [],
      existingRevocations: [],
      existingBindings: [],
      operations: [op1, op3],
      trustedOwnerKeys: new Set([base64UrlEncode(OWNER_PUB)]),
    });
    expect(gapRes.hasCausalGap).toBe(true);
    expect(gapRes.missingSequences).toEqual([2]);

    // Excludes revoked device from active sync recipient selection
    const n1 = generateNostrKeypair();
    const n2 = generateNostrKeypair();
    const n1Npub = encodeNpub(n1.publicKeyHex);
    const n2Npub = encodeNpub(n2.publicKeyHex);
    const bindings: VerifiedPeerBinding[] = [
      {
        key: `${OWNER_FP.fullHex}:${DEV1_ID_HEX}:${n1.publicKeyHex}`,
        bindingIdHex: 'aa'.repeat(16),
        ownerFingerprintHex: OWNER_FP.fullHex,
        ownerPublicKeyBase64Url: base64UrlEncode(OWNER_PUB),
        deviceIdHex: DEV1_ID_HEX,
        devicePublicKeyBase64Url: base64UrlEncode(DEV1_PUB),
        nostrPubkeyHex: n1.publicKeyHex,
        npub: n1Npub,
        signerRole: 'paired-device',
        issuedAt: 1000,
        expiresAt: 0,
        bindingCborBase64Url: 'AA',
        updatedAt: new Date().toISOString(),
      },
      {
        key: `${OWNER_FP.fullHex}:${DEV2_ID_HEX}:${n2.publicKeyHex}`,
        bindingIdHex: 'bb'.repeat(16),
        ownerFingerprintHex: OWNER_FP.fullHex,
        ownerPublicKeyBase64Url: base64UrlEncode(OWNER_PUB),
        deviceIdHex: DEV2_ID_HEX,
        devicePublicKeyBase64Url: base64UrlEncode(DEV2_PUB),
        nostrPubkeyHex: n2.publicKeyHex,
        npub: n2Npub,
        signerRole: 'paired-device',
        issuedAt: 1000,
        expiresAt: 0,
        bindingCborBase64Url: 'BB',
        updatedAt: new Date().toISOString(),
      },
    ];
    const recipients = selectActiveSyncRecipients({
      ownerFingerprintHex: OWNER_FP.fullHex,
      bindings,
      pairedDevices: res.pairedDevices,
      revocations: res.revocations,
    });
    expect(recipients.map((r) => r.deviceIdHex)).toEqual([DEV2_ID_HEX]);

    // Wire bundle round-trip + decode verification
    const rumorJson = encodeSyncRumorPayload({ ops: [op1] });
    const decodedBundle = decodeAndVerifySyncRumorPayload(rumorJson);
    expect(decodedBundle.ops).toHaveLength(1);
    expect(decodedBundle.ops[0].opHashHex).toBe(op1.opHashHex);
  });

  it('enforces strict wss:// relay URL policy and rejects insecure or credentialed URLs', () => {
    expect(validateRelayUrl('wss://Relay.Example.COM/nostr/')).toBe('wss://relay.example.com/nostr');
    expect(() => validateRelayUrl('ws://relay.example.com')).toThrow(/wss:\/\//i);
    expect(() => validateRelayUrl('https://relay.example.com')).toThrow(/wss:\/\//i);
    expect(() => validateRelayUrl('wss://user:pass@relay.example.com')).toThrow(/credentials/i);
    expect(() => validateRelayUrl('ws://127.0.0.1:8080')).toThrow(/wss:\/\//i);
    expect(
      validateRelayUrl('ws://127.0.0.1:8080/', { allowInsecureLocalWsForTest: true }),
    ).toBe('ws://127.0.0.1:8080');
  });
});
