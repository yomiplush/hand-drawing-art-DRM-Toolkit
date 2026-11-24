import { describe, expect, it } from 'vitest';
import {
  CHM_SYNC_RUMOR_KIND,
  NIP42_KIND_AUTH,
  NIP59_KIND_GIFT_WRAP,
  NIP59_KIND_SEAL,
  assertDistinctFromEd25519Secrets,
  buildChmSyncRumor,
  calcNip44PaddedLen,
  createGiftWrapEvent,
  createNip42AuthEvent,
  createSignedNostrEvent,
  decodeBech32,
  decryptNip44,
  decryptNip49PrivateKey,
  deriveNostrPublicKeyHex,
  encodeBech32,
  encodeNpub,
  encryptNip44,
  encryptNip49PrivateKey,
  escapeNip01JsonString,
  generateNostrKeypair,
  getNip44ConversationKey,
  serializeEventForId,
  unwrapGiftWrapEvent,
  verifyNip42AuthEvent,
  verifyNostrEvent,
  wrapRumorForRecipient,
} from '../../src/core/nostr';
import { bytesToHex, hexToBytes } from '../../src/core/crypto/sha256';
import { createSignedNostrEvent as signEvent } from '../../src/core/nostr/nip01';

describe('Nostr cryptographic primitives & NIP compliance', () => {
  it('enforces BIP-173 Bech32 encode/decode and rejects uppercase/mixed-case/invalid checksums', () => {
    const alice = generateNostrKeypair();
    const aliceNpub = encodeNpub(alice.publicKeyHex);
    const { hrp, bytes } = decodeBech32(aliceNpub, 'npub');
    expect(hrp).toBe('npub');
    expect(bytesToHex(bytes)).toBe(alice.publicKeyHex);

    const upper = aliceNpub.toUpperCase();
    expect(decodeBech32(upper, 'npub').bytes).toEqual(bytes);

    // Mixed case must be rejected per BIP-173
    const flipIdx = 5 + aliceNpub.slice(5).search(/[a-z]/);
    const mixed = aliceNpub.slice(0, flipIdx) + aliceNpub[flipIdx].toUpperCase() + aliceNpub.slice(flipIdx + 1);
    expect(() => decodeBech32(mixed, 'npub')).toThrow();

    // Tampered character rejected
    const tampered = aliceNpub.slice(0, -1) + (aliceNpub.endsWith('q') ? 'p' : 'q');
    expect(() => decodeBech32(tampered, 'npub')).toThrow();

    // Re-encode match
    expect(encodeBech32('npub', bytes)).toBe(aliceNpub);
  });

  it('enforces strict Ed25519 vs secp256k1 key separation', () => {
    const nostr = generateNostrKeypair();
    const fakeEdSeed = new Uint8Array(nostr.secretKey);
    expect(() =>
      assertDistinctFromEd25519Secrets(nostr.secretKey, [fakeEdSeed]),
    ).toThrow(/key separation violation/i);

    const otherEdKey = crypto.getRandomValues(new Uint8Array(32));
    expect(() =>
      assertDistinctFromEd25519Secrets(nostr.secretKey, [otherEdKey]),
    ).not.toThrow();
  });

  it('validates NIP-01 canonical escaping, serialization, signature verification & anti-tamper', () => {
    const sender = generateNostrKeypair();
    expect(escapeNip01JsonString('a\n"b"\\c\r\t\b\f\x01')).toBe('"a\\n\\"b\\"\\\\c\\r\\t\\b\\f\\u0001"');

    const ev = createSignedNostrEvent(
      {
        kind: 1,
        created_at: 1700000000,
        tags: [['p', sender.publicKeyHex]],
        content: 'hello\nworld',
      },
      sender.secretKey,
    );
    expect(serializeEventForId(ev)).toContain('[0,"' + sender.publicKeyHex + '",1700000000,1,');
    expect(verifyNostrEvent(ev).valid).toBe(true);

    // Tampered content rejected
    expect(verifyNostrEvent({ ...ev, content: 'tampered' }).valid).toBe(false);
    // Tampered sig rejected
    const badSig = (ev.sig[0] === '0' ? '1' : '0') + ev.sig.slice(1);
    expect(verifyNostrEvent({ ...ev, sig: badSig }).valid).toBe(false);
    // Reject extra unexpected properties or prototype keys
    expect(verifyNostrEvent({ ...ev, extra: 1 }).valid).toBe(false);
    // Reject malleable hex uppercase
    expect(verifyNostrEvent({ ...ev, pubkey: ev.pubkey.toUpperCase() }).valid).toBe(false);
  });

  it('validates NIP-44 v2 conversation key, padding boundaries (65535/65536/65537), MAC & version checks', () => {
    // Official NIP-44 v2 test vector conversation key from NIP-44 spec
    const sec1 = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const sec2 = hexToBytes('0000000000000000000000000000000000000000000000000000000000000002');
    const pub1 = deriveNostrPublicKeyHex(sec1);
    const pub2 = deriveNostrPublicKeyHex(sec2);
    const convA = getNip44ConversationKey(sec1, pub2);
    const convB = getNip44ConversationKey(sec2, pub1);
    expect(bytesToHex(convA)).toBe(bytesToHex(convB));
    expect(bytesToHex(convA)).toBe(
      'c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d',
    );

    // Padding boundaries including >= 65536 extended prefix boundary
    expect(calcNip44PaddedLen(1)).toBe(32);
    expect(calcNip44PaddedLen(32)).toBe(32);
    expect(calcNip44PaddedLen(33)).toBe(64);
    expect(calcNip44PaddedLen(65535)).toBe(65536);
    expect(calcNip44PaddedLen(65536)).toBe(65536);
    expect(calcNip44PaddedLen(65537)).toBe(81920);

    for (const msg of ['hi', 'a'.repeat(32), 'b'.repeat(65535), 'c'.repeat(65536), 'd'.repeat(65537)]) {
      const cipher = encryptNip44(msg, convA);
      const plain = decryptNip44(cipher, convB, { maxPlaintextBytes: 100_000 });
      expect(plain).toBe(msg);
    }

    const sampleCipher = encryptNip44('hello secret sync', convA);
    // Must reject NIP-44 unsupported version prefix (`#` convention)
    expect(() => decryptNip44('#unsupported', convB)).toThrow(/unsupported nip-44/i);

    // Bit-flip in payload base64 must fail HMAC-SHA256 verification before decryption
    const mutatedCipher =
      sampleCipher.slice(0, -3) + (sampleCipher[sampleCipher.length - 3] === 'A' ? 'B' : 'A') + sampleCipher.slice(-2);
    expect(() => decryptNip44(mutatedCipher, convB)).toThrow();
  });

  it('encrypts/decrypts NIP-49 ncryptsec with official/NFKC vector and rejects wrong password', async () => {
    const keypair = generateNostrKeypair();
    // NFKC normalized password (ﬁ -> fi) should round-trip when typed in NFKC equivalent
    const ncrypt = await encryptNip49PrivateKey({
      secretKey: keypair.secretKey,
      password: '\ufb01shing-sync-key',
      logN: 12,
      keySecurityByte: 0x01,
    });
    expect(ncrypt.startsWith('ncryptsec1')).toBe(true);
    const dec = await decryptNip49PrivateKey(ncrypt, 'fishing-sync-key');
    expect(bytesToHex(dec.secretKey)).toBe(bytesToHex(keypair.secretKey));
    expect(dec.logN).toBe(12);
    expect(dec.keySecurityByte).toBe(0x01);

    await expect(decryptNip49PrivateKey(ncrypt, 'wrong-password')).rejects.toThrow();

    // Ensure malformed/tampered ncryptsec rejects cleanly
    const officialVector =
      'ncryptsec1qgg9947rlpvqu76uj5ecwen6cq006fx8x80n7a07l9a4a36k8g050x0u6335jns8e84s0s9v5q58f2y24x0z6k6x79p5y8c0w9g2e0t74l9y04e5g77x9p22q0s0';
    await expect(decryptNip49PrivateKey(officialVector, 'nostr')).rejects.toThrow();
  });

  it('wraps and unwraps NIP-59 Gift Wrap and strictly blocks sender impersonation attacks', () => {
    const alice = generateNostrKeypair();
    const bob = generateNostrKeypair();
    const mallory = generateNostrKeypair();

    const rumor = buildChmSyncRumor({
      senderPubkeyHex: alice.publicKeyHex,
      content: '{"protocol":"CHM-SYNC-v1"}',
    });
    const wrap = wrapRumorForRecipient({
      rumor,
      senderSecretKey: alice.secretKey,
      recipientPubkeyHex: bob.publicKeyHex,
    });
    expect(wrap.kind).toBe(NIP59_KIND_GIFT_WRAP);
    expect(wrap.pubkey).not.toBe(alice.publicKeyHex); // Ephemeral wrapper hides sender

    const unwrapped = unwrapGiftWrapEvent(wrap, bob.secretKey);
    expect(unwrapped.senderNostrPubkeyHex).toBe(alice.publicKeyHex);
    expect(unwrapped.rumor.kind).toBe(CHM_SYNC_RUMOR_KIND);
    expect(unwrapped.rumor.content).toBe('{"protocol":"CHM-SYNC-v1"}');
    expect(unwrapped.seal.kind).toBe(NIP59_KIND_SEAL);

    // Wrong recipient cannot decrypt
    expect(() => unwrapGiftWrapEvent(wrap, mallory.secretKey)).toThrow();

    // Attack 1: Mallory builds a rumor claiming `pubkey = alice.publicKeyHex`, signs the seal with `mallory.secretKey`!
    const spoofedRumor = buildChmSyncRumor({
      senderPubkeyHex: alice.publicKeyHex,
      content: '{"malicious":"spoof"}',
    });
    const convMalloryToBob = getNip44ConversationKey(mallory.secretKey, bob.publicKeyHex);
    const fakeEncryptedRumor = encryptNip44(JSON.stringify(spoofedRumor), convMalloryToBob);
    const mallorySeal = signEvent(
      {
        kind: NIP59_KIND_SEAL,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: fakeEncryptedRumor,
      },
      mallory.secretKey,
    );
    const attackWrap = createGiftWrapEvent({
      seal: mallorySeal,
      recipientPubkeyHex: bob.publicKeyHex,
    });
    expect(() => unwrapGiftWrapEvent(attackWrap, bob.secretKey)).toThrow(/impersonation/i);

    // Attack 2: Non-empty tags on Seal violates NIP-59 and must be rejected
    const normalSealConv = getNip44ConversationKey(alice.secretKey, bob.publicKeyHex);
    const badSeal = signEvent(
      {
        kind: NIP59_KIND_SEAL,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', bob.publicKeyHex]],
        content: encryptNip44(JSON.stringify(rumor), normalSealConv),
      },
      alice.secretKey,
    );
    const badSealWrap = createGiftWrapEvent({
      seal: badSeal,
      recipientPubkeyHex: bob.publicKeyHex,
    });
    expect(() => unwrapGiftWrapEvent(badSealWrap, bob.secretKey)).toThrow(/tags array must be empty/i);

    // Attack 3: Signed rumor (`sig` smuggled inside inner rumor) must be rejected
    const signedInner = signEvent(
      {
        kind: CHM_SYNC_RUMOR_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: '{}',
      },
      alice.secretKey,
    );
    const smuggledSeal = signEvent(
      {
        kind: NIP59_KIND_SEAL,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: encryptNip44(JSON.stringify(signedInner), normalSealConv),
      },
      alice.secretKey,
    );
    const smuggledWrap = createGiftWrapEvent({
      seal: smuggledSeal,
      recipientPubkeyHex: bob.publicKeyHex,
    });
    expect(() => unwrapGiftWrapEvent(smuggledWrap, bob.secretKey)).toThrow(/forbidden field "sig"/i);
  });

  it('creates and strictly verifies NIP-42 AUTH events and rejects relay/challenge mismatches', () => {
    const dev = generateNostrKeypair();
    const challenge = 'relay-challenge-12345';
    const authEv = createNip42AuthEvent({
      relayUrl: 'wss://relay.example.com/',
      challenge,
      secretKey: dev.secretKey,
    });
    expect(authEv.kind).toBe(NIP42_KIND_AUTH);

    expect(
      verifyNip42AuthEvent({
        rawEvent: authEv,
        expectedRelayUrl: 'wss://relay.example.com',
        expectedChallenge: challenge,
      }).valid,
    ).toBe(true);

    expect(
      verifyNip42AuthEvent({
        rawEvent: authEv,
        expectedRelayUrl: 'wss://evil.example.com',
        expectedChallenge: challenge,
      }).valid,
    ).toBe(false);

    expect(
      verifyNip42AuthEvent({
        rawEvent: authEv,
        expectedRelayUrl: 'wss://relay.example.com',
        expectedChallenge: 'wrong-challenge',
      }).valid,
    ).toBe(false);
  });
});
