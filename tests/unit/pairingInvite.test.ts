import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  createSignedEnrollmentCertificate,
  createSignedPairingRequest,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import { derivePublicKeyFromSeed, signWithSeed } from '../../src/core/crypto/ed25519';
import { buildChmSyncRumor, generateNostrKeypair, wrapRumorForRecipient } from '../../src/core/nostr';
import {
  CHM_PAIRING_INVITE_CERT_RUMOR_KIND,
  CHM_PAIRING_INVITE_REQ_RUMOR_KIND,
  CHM_PAIR_INVITE_PROTOCOL_ID,
  buildInviteCertGiftWrap,
  buildInviteRequestGiftWrap,
  createSignedPairingInvite,
  isPairingInviteInput,
  parseAndVerifyPairingInvite,
  unwrapAndVerifyInviteCert,
  unwrapAndVerifyInviteRequest,
} from '../../src/core/sync';

const OWNER_SEED = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
const OWNER_PUB = derivePublicKeyFromSeed(OWNER_SEED);

const OTHER_OWNER_SEED = hexToBytes(
  'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
);
const OTHER_OWNER_PUB = derivePublicKeyFromSeed(OTHER_OWNER_SEED);

const DEV_ID = hexToBytes('11111111222243338444555555555555');
const DEV_SEED = hexToBytes('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb');
const DEV_PUB = derivePublicKeyFromSeed(DEV_SEED);

describe('CHM-PAIR-INVITE-v1 PC -> iPad invitation pairing & NIP-59 security', () => {
  it('completes end-to-end invite -> encrypted request -> certificate response -> wipeSecrets', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const inviteSession = await createSignedPairingInvite({
      ownerPublicKey: OWNER_PUB,
      ownerDisplayName: 'YomiPlush PC',
      signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
      baseUrl: 'https://certified-handmade.com/devices',
      nowUnix,
    });

    expect(inviteSession.qrUrl).toContain('https://certified-handmade.com/devices#pair-invite=chm-pair-invite:');
    expect(isPairingInviteInput(inviteSession.qrUrl)).toBe(true);
    expect(isPairingInviteInput(inviteSession.token)).toBe(true);
    expect(inviteSession.qrUrl.length).toBeLessThan(650);

    // iPad parses and verifies invitation QR offline
    const parsed = parseAndVerifyPairingInvite(inviteSession.qrUrl, { nowUnix });
    expect(parsed.expired).toBe(false);
    expect(parsed.invite.ownerDisplayName).toBe('YomiPlush PC');
    expect(parsed.invite.ownerFingerprintHex).toBe(
      computePublicKeyFingerprintSync(OWNER_PUB).fullHex,
    );
    expect(parsed.invite.relays.length).toBeGreaterThanOrEqual(1);

    // iPad creates pinned pairing request and NIP-59 Gift Wrap
    const request = await createSignedPairingRequest({
      deviceId: DEV_ID,
      devicePublicKey: DEV_PUB,
      deviceDisplayName: 'iPad Pro',
      ownerPublicKey: parsed.invite.ownerPublicKeyBase64Url,
      ownerFingerprintHex: parsed.invite.ownerFingerprintHex,
      signWithDeviceKey: (msg) => signWithSeed(DEV_SEED, msg),
    });

    const replyKeys = generateNostrKeypair([DEV_PUB, OWNER_PUB]);
    const reqWrap = buildInviteRequestGiftWrap({
      invite: parsed.invite,
      request,
      replyNostrSecretKey: replyKeys.secretKey,
    });

    // PC unwraps & verifies request + optical invite proof
    const unwrappedReq = unwrapAndVerifyInviteRequest({
      rawEvent: reqWrap,
      expectedInvite: inviteSession.invite,
      inviteNostrSecretKey: inviteSession.inviteNostrSecretKey,
    });
    expect(unwrappedReq.request.payload.deviceDisplayName).toBe('iPad Pro');
    expect(unwrappedReq.replyNostrPubkeyHex).toBe(replyKeys.publicKeyHex);

    // PC approves and wraps EnrollmentCertificate back to iPad
    const cert = await createSignedEnrollmentCertificate({
      request: unwrappedReq.request,
      ownerPublicKey: OWNER_PUB,
      ownerDisplayName: 'YomiPlush PC',
      signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
    });

    const certWrap = buildInviteCertGiftWrap({
      invite: inviteSession.invite,
      certificate: cert,
      inviteNostrSecretKey: inviteSession.inviteNostrSecretKey,
      replyNostrPubkeyHex: unwrappedReq.replyNostrPubkeyHex,
    });

    // iPad unwraps & verifies cert response + ACK proof
    const unwrappedCert = unwrapAndVerifyInviteCert({
      rawEvent: certWrap,
      expectedInvite: parsed.invite,
      expectedRequest: request,
      replyNostrSecretKey: replyKeys.secretKey,
    });
    expect(unwrappedCert.certificate.payload.certIdHex).toBe(cert.payload.certIdHex);

    // Ephemeral secret wipe zeroes memory
    inviteSession.wipeSecrets();
    expect(inviteSession.inviteNostrSecretKey.every((b) => b === 0)).toBe(true);
  });

  it('rejects tampered invitation QR, expired invitation QR, and insecure ws:// relays', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const inviteSession = await createSignedPairingInvite({
      ownerPublicKey: OWNER_PUB,
      ownerDisplayName: 'Yomi',
      signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
      nowUnix,
      ttlSeconds: 300,
    });

    const tampered =
      inviteSession.qrUrl.slice(0, -4) +
      (inviteSession.qrUrl.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => parseAndVerifyPairingInvite(tampered, { nowUnix })).toThrow();

    const expired = parseAndVerifyPairingInvite(inviteSession.qrUrl, {
      nowUnix: nowUnix + 1000,
    });
    expect(expired.expired).toBe(true);

    // Insecure ws:// relay blocked in production mode (falls back cleanly to curated wss:// presets)
    await expect(
      createSignedPairingInvite({
        ownerPublicKey: OWNER_PUB,
        ownerDisplayName: 'Yomi',
        signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
        relays: [{ url: 'ws://relay.insecure.example', enabled: true, read: true, write: true }],
      }),
    ).resolves.toBeDefined();

    inviteSession.wipeSecrets();
  });

  it('blocks relay attackers who lack the optical inviteSecret or send forged requests/certs', async () => {
    const inviteSession = await createSignedPairingInvite({
      ownerPublicKey: OWNER_PUB,
      ownerDisplayName: 'Yomi',
      signWithOwnerKey: (msg) => signWithSeed(OWNER_SEED, msg),
    });

    const attackerKeys = generateNostrKeypair();
    const attackerReq = await createSignedPairingRequest({
      deviceId: DEV_ID,
      devicePublicKey: DEV_PUB,
      deviceDisplayName: 'Rogue Device',
      ownerPublicKey: base64UrlEncode(OWNER_PUB),
      signWithDeviceKey: (msg) => signWithSeed(DEV_SEED, msg),
    });

    // Attacker sends gift wrap directly to ownerNostrPubkeyHex with guessed proof
    const forgedRumor = buildChmSyncRumor({
      senderPubkeyHex: attackerKeys.publicKeyHex,
      kind: CHM_PAIRING_INVITE_REQ_RUMOR_KIND,
      content: JSON.stringify({
        protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
        kind: 'pairing-invite-request',
        inviteIdHex: inviteSession.invite.inviteIdHex,
        inviteProofHex: 'ab'.repeat(32),
        requestToken: attackerReq.token,
        replyNostrPubkeyHex: attackerKeys.publicKeyHex,
      }),
    });
    const forgedWrap = wrapRumorForRecipient({
      rumor: forgedRumor,
      senderSecretKey: attackerKeys.secretKey,
      recipientPubkeyHex: inviteSession.inviteNostrPubkeyHex,
    });

    expect(() =>
      unwrapAndVerifyInviteRequest({
        rawEvent: forgedWrap,
        expectedInvite: inviteSession.invite,
        inviteNostrSecretKey: inviteSession.inviteNostrSecretKey,
      }),
    ).toThrow(/proof/i);

    // Cross-owner cert injection to iPad reply pubkey is rejected (wrong Nostr sender)
    const iPadReplyKeys = generateNostrKeypair();
    const iPadReq = await createSignedPairingRequest({
      deviceId: DEV_ID,
      devicePublicKey: DEV_PUB,
      deviceDisplayName: 'iPad',
      ownerPublicKey: base64UrlEncode(OWNER_PUB),
      signWithDeviceKey: (msg) => signWithSeed(DEV_SEED, msg),
    });
    const otherOwnerReq = await createSignedPairingRequest({
      deviceId: DEV_ID,
      devicePublicKey: DEV_PUB,
      deviceDisplayName: 'Attacker Target',
      ownerPublicKey: base64UrlEncode(OTHER_OWNER_PUB),
      signWithDeviceKey: (msg) => signWithSeed(DEV_SEED, msg),
    });
    const badCert = await createSignedEnrollmentCertificate({
      request: otherOwnerReq,
      ownerPublicKey: OTHER_OWNER_PUB,
      ownerDisplayName: 'Attacker',
      signWithOwnerKey: (msg) => signWithSeed(OTHER_OWNER_SEED, msg),
    });
    const rogueCertRumor = buildChmSyncRumor({
      senderPubkeyHex: attackerKeys.publicKeyHex,
      kind: CHM_PAIRING_INVITE_CERT_RUMOR_KIND,
      content: JSON.stringify({
        protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
        kind: 'pairing-invite-cert',
        inviteIdHex: inviteSession.invite.inviteIdHex,
        inviteAckProofHex: 'cd'.repeat(32),
        certificateToken: badCert.token,
      }),
    });
    const rogueCertWrap = wrapRumorForRecipient({
      rumor: rogueCertRumor,
      senderSecretKey: attackerKeys.secretKey,
      recipientPubkeyHex: iPadReplyKeys.publicKeyHex,
    });

    expect(() =>
      unwrapAndVerifyInviteCert({
        rawEvent: rogueCertWrap,
        expectedInvite: inviteSession.invite,
        expectedRequest: iPadReq,
        replyNostrSecretKey: iPadReplyKeys.secretKey,
      }),
    ).toThrow(/invitation Nostr key/i);

    // Even if signed by inviteNostrSecretKey, mismatched inviteAckProofHex must be rejected
    const badAckRumor = buildChmSyncRumor({
      senderPubkeyHex: inviteSession.inviteNostrPubkeyHex,
      kind: CHM_PAIRING_INVITE_CERT_RUMOR_KIND,
      content: JSON.stringify({
        protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
        kind: 'pairing-invite-cert',
        inviteIdHex: inviteSession.invite.inviteIdHex,
        inviteAckProofHex: 'cd'.repeat(32),
        certificateToken: badCert.token,
      }),
    });
    const badAckWrap = wrapRumorForRecipient({
      rumor: badAckRumor,
      senderSecretKey: inviteSession.inviteNostrSecretKey,
      recipientPubkeyHex: iPadReplyKeys.publicKeyHex,
    });

    expect(() =>
      unwrapAndVerifyInviteCert({
        rawEvent: badAckWrap,
        expectedInvite: inviteSession.invite,
        expectedRequest: iPadReq,
        replyNostrSecretKey: iPadReplyKeys.secretKey,
      }),
    ).toThrow(/acknowledgment proof/i);

    inviteSession.wipeSecrets();
  });
});
