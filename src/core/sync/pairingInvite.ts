import {
  assertAllowedIntegerMapKeys,
  assertExactBytes,
  assertSafeIntegerInRange,
  assertStrictEd25519PublicKey,
  base64UrlDecode,
  base64UrlEncode,
  buildDomainSeparatedMessage,
  computePublicKeyFingerprintSync,
  decodeCanonicalCbor,
  encodeCanonicalCbor,
  formatUuidHex,
  parsePairingQrInput,
  verifyStrictEd25519Signature,
} from '@yomiplush/chm-exchange/core';
import type { SignedEnrollmentCertificate, SignedPairingRequest } from '@yomiplush/chm-exchange/core';
import { bytesToHex, constantTimeEqual, hexToBytes, sha256Sync } from '../crypto/sha256';
import type { NostrEvent } from '../nostr/nip01';
import { buildChmSyncRumor, unwrapGiftWrapEvent, wrapRumorForRecipient } from '../nostr/nip59';
import {
  assertValidNostrPubkeyHex,
  assertValidNostrSecretKeyBytes,
  deriveNostrPublicKeyHex,
  generateNostrKeypair,
  isValidLowercaseHex64,
  wipeBytes,
} from '../nostr/secp256k1';
import { validateRelayUrl } from './relayManager';
import { isAllowLocalWsRelayForTests } from './syncStore';
import { CURATED_DEFAULT_RELAY_PRESETS, type RelayConfig } from './types';

export const CHM_PAIR_INVITE_PROTOCOL_ID = 'CHM-PAIR-INVITE-v1' as const;
export const PAIRING_INVITE_TOKEN_PREFIX = 'chm-pair-invite:' as const;
export const CHM_PAIRING_INVITE_REQ_RUMOR_KIND = 30080;
export const CHM_PAIRING_INVITE_CERT_RUMOR_KIND = 30081;

export const DEFAULT_INVITE_TTL_SECONDS = 300;
export const MAX_INVITE_TTL_SECONDS = 3600;
export const INVITE_CLOCK_SKEW_SECONDS = 120;
export const MAX_INVITE_CBOR_BYTES = 2048;
export const MAX_INVITE_RELAYS = 4;

const PAIRING_INVITE_DOMAIN_PREFIX = new TextEncoder().encode('CHM-PAIR-INVITE-v1:INVITE\0');
const PAIRING_INVITE_PROOF_PREFIX = new TextEncoder().encode('CHM-PAIR-INVITE-v1:PROOF\0');
const PAIRING_INVITE_ACK_PREFIX = new TextEncoder().encode('CHM-PAIR-INVITE-v1:ACK\0');

const INVITE_ALLOWED_KEYS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

export interface DecodedPairingInvite {
  version: 1;
  protocol: typeof CHM_PAIR_INVITE_PROTOCOL_ID;
  inviteIdBytes: Uint8Array;
  inviteIdHex: string;
  inviteSecretBytes: Uint8Array;
  ownerPublicKey: Uint8Array;
  ownerPublicKeyBase64Url: string;
  ownerFingerprintHex: string;
  ownerFingerprintShort: string;
  ownerDisplayName: string;
  ownerNostrPubkeyHex: string;
  relays: string[];
  issuedAt: number;
  expiresAt: number;
  signature: Uint8Array;
  token: string;
}

export interface CreatedPairingInviteSession {
  invite: DecodedPairingInvite;
  token: string;
  qrUrl: string;
  inviteNostrPubkeyHex: string;
  inviteNostrSecretKey: Uint8Array;
  relays: RelayConfig[];
  wipeSecrets: () => void;
}

export interface DecodedInvitePairingRequestMessage {
  inviteIdHex: string;
  request: SignedPairingRequest;
  requestToken: string;
  replyNostrPubkeyHex: string;
  syncBindingToken?: string;
}

export interface DecodedInviteEnrollmentCertMessage {
  inviteIdHex: string;
  certificate: SignedEnrollmentCertificate;
  certificateToken: string;
  syncBindingToken?: string;
}

function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function randomUuidV4Bytes(): Uint8Array {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function sanitizeDisplayName(raw: string, fallback = 'CHM Owner'): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const encoder = new TextEncoder();
  let out = cleaned || fallback;
  while (encoder.encode(out).length > 64) {
    out = out.slice(0, -1);
  }
  return out || fallback;
}

export function suggestLocalDeviceName(): string {
  if (typeof navigator === 'undefined') return 'My Device';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  if (/iPad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) {
    return 'iPad';
  }
  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  }
  if (/Android/i.test(ua)) {
    return 'Android';
  }
  return 'My Device';
}

export function resolvePairingInviteRelays(
  configuredRelays?: RelayConfig[],
  allowLocalWs = isAllowLocalWsRelayForTests(),
): RelayConfig[] {
  const candidates =
    configuredRelays && configuredRelays.length > 0
      ? configuredRelays
      : [...CURATED_DEFAULT_RELAY_PRESETS];

  const valid: RelayConfig[] = [];
  const seen = new Set<string>();

  for (const r of candidates) {
    if (!r.enabled || !r.read || !r.write || r.policyStatus === 'payment-required') continue;
    try {
      const normalized = validateRelayUrl(r.url, { allowInsecureLocalWsForTest: allowLocalWs });
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      valid.push({
        ...r,
        url: normalized,
      });
      if (valid.length >= MAX_INVITE_RELAYS) break;
    } catch {
      // Ignore invalid relay URLs
    }
  }

  if (valid.length > 0) return valid;

  // Fallback to curated free presets if user had no usable relays in configured list
  for (const r of CURATED_DEFAULT_RELAY_PRESETS) {
    if (!r.enabled || !r.read || !r.write) continue;
    try {
      const normalized = validateRelayUrl(r.url, { allowInsecureLocalWsForTest: allowLocalWs });
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      valid.push({ ...r, url: normalized });
      if (valid.length >= MAX_INVITE_RELAYS) break;
    } catch {
      // ignore
    }
  }
  return valid;
}

export function toRelayConfigsFromUrls(
  urls: string[],
  allowLocalWs = isAllowLocalWsRelayForTests(),
): RelayConfig[] {
  const out: RelayConfig[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const normalized = validateRelayUrl(raw, { allowInsecureLocalWsForTest: allowLocalWs });
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({
      url: normalized,
      enabled: true,
      read: true,
      write: true,
      policyStatus: 'unknown',
    });
  }
  return out;
}

export function isPairingInviteInput(rawInput: string): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(PAIRING_INVITE_TOKEN_PREFIX)) return true;
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const params = new URLSearchParams(trimmed.slice(hashIdx + 1));
    if (params.has('pair-invite')) return true;
  }
  return false;
}

function extractInviteToken(rawInput: string): string {
  if (typeof rawInput !== 'string') {
    throw new Error('Pairing invitation input must be a string.');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Pairing invitation input is empty.');
  }
  if (trimmed.startsWith(PAIRING_INVITE_TOKEN_PREFIX)) {
    return trimmed;
  }
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const params = new URLSearchParams(trimmed.slice(hashIdx + 1));
    const val = params.get('pair-invite');
    if (val && val.trim().startsWith(PAIRING_INVITE_TOKEN_PREFIX)) {
      return val.trim();
    }
  }
  throw new Error('Expected a CHM-PAIR-INVITE-v1 invitation QR or token.');
}

export async function createSignedPairingInvite(params: {
  ownerPublicKey: Uint8Array;
  ownerDisplayName: string;
  signWithOwnerKey: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  relays?: RelayConfig[];
  baseUrl?: string;
  ttlSeconds?: number;
  nowUnix?: number;
}): Promise<CreatedPairingInviteSession> {
  const ownerPub = assertStrictEd25519PublicKey(params.ownerPublicKey, 'ownerPublicKey');
  const displayName = sanitizeDisplayName(params.ownerDisplayName);
  const relayConfigs = resolvePairingInviteRelays(params.relays);
  if (relayConfigs.length === 0) {
    throw new Error('At least one valid free wss:// relay is required for invitation pairing.');
  }
  const relayUrls = relayConfigs.map((r) => r.url);

  const ttl = Math.min(
    MAX_INVITE_TTL_SECONDS,
    Math.max(30, Math.floor(params.ttlSeconds ?? DEFAULT_INVITE_TTL_SECONDS)),
  );
  const issuedAt = params.nowUnix ?? Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttl;

  const inviteIdBytes = randomUuidV4Bytes();
  const inviteSecretBytes = randomBytes(16);
  const nostrKeys = generateNostrKeypair([ownerPub]);
  const ownerNostrPubkeyBytes = hexToBytes(nostrKeys.publicKeyHex);

  const map = new Map<number, unknown>([
    [0, 1],
    [1, CHM_PAIR_INVITE_PROTOCOL_ID],
    [2, inviteIdBytes],
    [3, inviteSecretBytes],
    [4, ownerPub],
    [5, displayName],
    [6, ownerNostrPubkeyBytes],
    [7, relayUrls],
    [8, issuedAt],
    [9, expiresAt],
  ]);

  const payloadBytes = encodeCanonicalCbor(map);
  const digestMsg = buildDomainSeparatedMessage(PAIRING_INVITE_DOMAIN_PREFIX, payloadBytes);
  const sig = assertExactBytes(await params.signWithOwnerKey(digestMsg), 64, 'ownerSignature');
  if (!verifyStrictEd25519Signature(ownerPub, digestMsg, sig)) {
    wipeBytes(nostrKeys.secretKey);
    throw new Error('Produced pairing invitation signature failed self-verification.');
  }

  const envelopeBytes = encodeCanonicalCbor([payloadBytes, sig]);
  if (envelopeBytes.byteLength > MAX_INVITE_CBOR_BYTES) {
    wipeBytes(nostrKeys.secretKey);
    throw new Error(`Pairing invitation exceeds ${MAX_INVITE_CBOR_BYTES} bytes.`);
  }

  const token = `${PAIRING_INVITE_TOKEN_PREFIX}${base64UrlEncode(envelopeBytes)}`;
  const decoded = parseAndVerifyPairingInvite(token, { nowUnix: issuedAt });
  if (decoded.expired) {
    wipeBytes(nostrKeys.secretKey);
    throw new Error('Newly generated pairing invitation expired immediately.');
  }

  const baseUrl =
    params.baseUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/devices`
      : 'https://www.certified-handmade.com/devices');
  const qrUrl = `${baseUrl}#pair-invite=${token}`;

  return {
    invite: decoded.invite,
    token,
    qrUrl,
    inviteNostrPubkeyHex: nostrKeys.publicKeyHex,
    inviteNostrSecretKey: nostrKeys.secretKey,
    relays: relayConfigs,
    wipeSecrets: () => {
      wipeBytes(nostrKeys.secretKey);
      inviteSecretBytes.fill(0);
    },
  };
}

export function parseAndVerifyPairingInvite(
  rawInput: string,
  options?: { nowUnix?: number; allowLocalWsRelay?: boolean },
): { invite: DecodedPairingInvite; expired: boolean; token: string } {
  const token = extractInviteToken(rawInput);
  const b64 = token.slice(PAIRING_INVITE_TOKEN_PREFIX.length).trim();
  const envelopeBytes = base64UrlDecode(b64);
  if (envelopeBytes.byteLength === 0 || envelopeBytes.byteLength > MAX_INVITE_CBOR_BYTES) {
    throw new Error('Pairing invitation envelope size is invalid.');
  }

  const outer = decodeCanonicalCbor(envelopeBytes, 'PairingInviteEnvelope');
  if (!Array.isArray(outer) || outer.length !== 2) {
    throw new Error('Malformed pairing invitation outer envelope.');
  }
  const [rawPayloadBytes, rawSig] = outer;
  if (!(rawPayloadBytes instanceof Uint8Array)) {
    throw new Error('Pairing invitation payload must be bytes.');
  }
  const signature = assertExactBytes(rawSig, 64, 'ownerSignature');

  const decodedPayload = decodeCanonicalCbor(rawPayloadBytes, 'PairingInvitePayload');
  const map = assertAllowedIntegerMapKeys(decodedPayload, INVITE_ALLOWED_KEYS, 'PairingInvite');

  const version = assertSafeIntegerInRange(map.get(0), 1, 1, 'version');
  if (version !== 1 || map.get(1) !== CHM_PAIR_INVITE_PROTOCOL_ID) {
    throw new Error('Unsupported CHM pairing invitation protocol or version.');
  }

  const inviteIdBytes = assertExactBytes(map.get(2), 16, 'inviteId');
  const inviteSecretBytes = assertExactBytes(map.get(3), 16, 'inviteSecret');
  const ownerPublicKey = assertStrictEd25519PublicKey(
    assertExactBytes(map.get(4), 32, 'ownerPublicKey'),
    'ownerPublicKey',
  );
  const rawDisplay = map.get(5);
  if (typeof rawDisplay !== 'string' || rawDisplay.trim().length === 0) {
    throw new Error('Pairing invitation is missing owner display name.');
  }
  const ownerDisplayName = sanitizeDisplayName(rawDisplay);

  const ownerNostrPubBytes = assertExactBytes(map.get(6), 32, 'ownerNostrPubkey');
  const ownerNostrPubkeyHex = assertValidNostrPubkeyHex(
    bytesToHex(ownerNostrPubBytes),
    'ownerNostrPubkey',
  );
  if (constantTimeEqual(ownerNostrPubBytes, ownerPublicKey)) {
    throw new Error('Key separation violation inside pairing invitation.');
  }

  const rawRelays = map.get(7);
  if (!Array.isArray(rawRelays) || rawRelays.length === 0 || rawRelays.length > MAX_INVITE_RELAYS) {
    throw new Error('Pairing invitation must specify 1 to 4 valid Nostr relays.');
  }
  const allowLocalWs = options?.allowLocalWsRelay ?? isAllowLocalWsRelayForTests();
  const relays: string[] = [];
  const seenRelays = new Set<string>();
  for (const r of rawRelays) {
    if (typeof r !== 'string') {
      throw new Error('Pairing invitation relay entry must be a string.');
    }
    const normalized = validateRelayUrl(r, { allowInsecureLocalWsForTest: allowLocalWs });
    if (!seenRelays.has(normalized)) {
      seenRelays.add(normalized);
      relays.push(normalized);
    }
  }

  const issuedAt = assertSafeIntegerInRange(map.get(8), 1, Number.MAX_SAFE_INTEGER, 'issuedAt');
  const expiresAt = assertSafeIntegerInRange(map.get(9), 1, Number.MAX_SAFE_INTEGER, 'expiresAt');
  if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_INVITE_TTL_SECONDS) {
    throw new Error('Pairing invitation expiration window is invalid.');
  }

  const digestMsg = buildDomainSeparatedMessage(PAIRING_INVITE_DOMAIN_PREFIX, rawPayloadBytes);
  if (!verifyStrictEd25519Signature(ownerPublicKey, digestMsg, signature)) {
    throw new Error('Invalid Owner Ed25519 signature on pairing invitation QR.');
  }

  const nowUnix = options?.nowUnix ?? Math.floor(Date.now() / 1000);
  const expired = nowUnix > expiresAt + INVITE_CLOCK_SKEW_SECONDS;
  const fp = computePublicKeyFingerprintSync(ownerPublicKey);

  return {
    expired,
    token,
    invite: {
      version: 1,
      protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
      inviteIdBytes,
      inviteIdHex: formatUuidHex(inviteIdBytes),
      inviteSecretBytes,
      ownerPublicKey,
      ownerPublicKeyBase64Url: base64UrlEncode(ownerPublicKey),
      ownerFingerprintHex: fp.fullHex,
      ownerFingerprintShort: fp.shortDisplay,
      ownerDisplayName,
      ownerNostrPubkeyHex,
      relays,
      issuedAt,
      expiresAt,
      signature,
      token,
    },
  };
}

export function computeInviteRequestProofHex(params: {
  inviteSecretBytes: Uint8Array;
  inviteIdBytes: Uint8Array;
  requestHash: Uint8Array;
}): string {
  const secret = assertExactBytes(params.inviteSecretBytes, 16, 'inviteSecret');
  const id = assertExactBytes(params.inviteIdBytes, 16, 'inviteId');
  const reqHash = assertExactBytes(params.requestHash, 32, 'requestHash');
  return bytesToHex(sha256Sync(concatBytes(PAIRING_INVITE_PROOF_PREFIX, secret, id, reqHash)));
}

export function computeInviteCertAckProofHex(params: {
  inviteSecretBytes: Uint8Array;
  inviteIdBytes: Uint8Array;
  certIdBytes: Uint8Array;
  requestHash: Uint8Array;
}): string {
  const secret = assertExactBytes(params.inviteSecretBytes, 16, 'inviteSecret');
  const id = assertExactBytes(params.inviteIdBytes, 16, 'inviteId');
  const certId = assertExactBytes(params.certIdBytes, 16, 'certId');
  const reqHash = assertExactBytes(params.requestHash, 32, 'requestHash');
  return bytesToHex(sha256Sync(concatBytes(PAIRING_INVITE_ACK_PREFIX, secret, id, certId, reqHash)));
}

export function buildInviteRequestGiftWrap(params: {
  invite: DecodedPairingInvite;
  request: SignedPairingRequest;
  replyNostrSecretKey: Uint8Array;
  syncBindingToken?: string;
}): NostrEvent {
  assertValidNostrSecretKeyBytes(params.replyNostrSecretKey);
  const replyPubHex = deriveNostrPublicKeyHex(params.replyNostrSecretKey);
  const inviteProofHex = computeInviteRequestProofHex({
    inviteSecretBytes: params.invite.inviteSecretBytes,
    inviteIdBytes: params.invite.inviteIdBytes,
    requestHash: params.request.requestHash,
  });

  const payload: Record<string, unknown> = {
    protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
    kind: 'pairing-invite-request',
    inviteIdHex: params.invite.inviteIdHex,
    inviteProofHex,
    requestToken: params.request.token,
    replyNostrPubkeyHex: replyPubHex,
  };
  if (params.syncBindingToken) {
    payload.syncBindingToken = params.syncBindingToken;
  }

  const rumor = buildChmSyncRumor({
    senderPubkeyHex: replyPubHex,
    kind: CHM_PAIRING_INVITE_REQ_RUMOR_KIND,
    content: JSON.stringify(payload),
  });

  return wrapRumorForRecipient({
    rumor,
    senderSecretKey: params.replyNostrSecretKey,
    recipientPubkeyHex: params.invite.ownerNostrPubkeyHex,
  });
}

function parseSafeRumorJson(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Malformed JSON in pairing invite rumor.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Pairing invite rumor must be a JSON object.');
  }
  if (
    Object.prototype.hasOwnProperty.call(parsed, '__proto__') ||
    Object.prototype.hasOwnProperty.call(parsed, 'constructor')
  ) {
    throw new Error('Forbidden prototype key in pairing invite rumor.');
  }
  return parsed as Record<string, unknown>;
}

export function unwrapAndVerifyInviteRequest(params: {
  rawEvent: unknown;
  expectedInvite: DecodedPairingInvite;
  inviteNostrSecretKey: Uint8Array;
}): DecodedInvitePairingRequestMessage {
  const unwrapped = unwrapGiftWrapEvent(params.rawEvent, params.inviteNostrSecretKey);
  if (unwrapped.rumor.kind !== CHM_PAIRING_INVITE_REQ_RUMOR_KIND) {
    throw new Error(`Unexpected rumor kind: ${unwrapped.rumor.kind}`);
  }
  const body = parseSafeRumorJson(unwrapped.rumor.content);
  if (body.protocol !== CHM_PAIR_INVITE_PROTOCOL_ID || body.kind !== 'pairing-invite-request') {
    throw new Error('Unexpected pairing invite request message format.');
  }
  if (body.inviteIdHex !== params.expectedInvite.inviteIdHex) {
    throw new Error('Pairing invite ID mismatch.');
  }
  if (
    typeof body.replyNostrPubkeyHex !== 'string' ||
    !isValidLowercaseHex64(body.replyNostrPubkeyHex) ||
    body.replyNostrPubkeyHex !== unwrapped.senderNostrPubkeyHex
  ) {
    throw new Error('Sender Nostr key does not match reply pubkey.');
  }
  if (typeof body.requestToken !== 'string' || body.requestToken.length > 4096) {
    throw new Error('Missing or invalid pairing request token.');
  }
  if (typeof body.inviteProofHex !== 'string' || !isValidLowercaseHex64(body.inviteProofHex)) {
    throw new Error('Missing or invalid invite proof.');
  }

  const parsedReq = parsePairingQrInput(body.requestToken);
  if (parsedReq.kind !== 'pairing-request') {
    throw new Error('Expected a pairing-request token inside invitation response.');
  }
  const request = parsedReq.request;

  if (
    request.payload.ownerTarget.kind !== 'pinned-public-key' ||
    !constantTimeEqual(request.payload.ownerTarget.ownerPublicKey, params.expectedInvite.ownerPublicKey)
  ) {
    throw new Error('Pairing request is not pinned to the inviting CHM Owner key.');
  }

  const expectedProofHex = computeInviteRequestProofHex({
    inviteSecretBytes: params.expectedInvite.inviteSecretBytes,
    inviteIdBytes: params.expectedInvite.inviteIdBytes,
    requestHash: request.requestHash,
  });
  if (!constantTimeEqual(hexToBytes(body.inviteProofHex), hexToBytes(expectedProofHex))) {
    throw new Error('Invite optical secret proof mismatch.');
  }

  const syncBindingToken =
    typeof body.syncBindingToken === 'string' && body.syncBindingToken.length <= 4096
      ? body.syncBindingToken
      : undefined;

  return {
    inviteIdHex: params.expectedInvite.inviteIdHex,
    request,
    requestToken: body.requestToken,
    replyNostrPubkeyHex: body.replyNostrPubkeyHex,
    syncBindingToken,
  };
}

export function buildInviteCertGiftWrap(params: {
  invite: DecodedPairingInvite;
  certificate: SignedEnrollmentCertificate;
  inviteNostrSecretKey: Uint8Array;
  replyNostrPubkeyHex: string;
  syncBindingToken?: string;
}): NostrEvent {
  assertValidNostrSecretKeyBytes(params.inviteNostrSecretKey);
  const senderPubHex = deriveNostrPublicKeyHex(params.inviteNostrSecretKey);
  if (senderPubHex !== params.invite.ownerNostrPubkeyHex) {
    throw new Error('Invite Nostr key mismatch when building certificate response.');
  }
  const replyPubHex = assertValidNostrPubkeyHex(params.replyNostrPubkeyHex, 'replyNostrPubkeyHex');
  const inviteAckProofHex = computeInviteCertAckProofHex({
    inviteSecretBytes: params.invite.inviteSecretBytes,
    inviteIdBytes: params.invite.inviteIdBytes,
    certIdBytes: params.certificate.payload.certId,
    requestHash: params.certificate.payload.requestHash,
  });

  const payload: Record<string, unknown> = {
    protocol: CHM_PAIR_INVITE_PROTOCOL_ID,
    kind: 'pairing-invite-cert',
    inviteIdHex: params.invite.inviteIdHex,
    inviteAckProofHex,
    certificateToken: params.certificate.token,
  };
  if (params.syncBindingToken) {
    payload.syncBindingToken = params.syncBindingToken;
  }

  const rumor = buildChmSyncRumor({
    senderPubkeyHex: senderPubHex,
    kind: CHM_PAIRING_INVITE_CERT_RUMOR_KIND,
    content: JSON.stringify(payload),
  });

  return wrapRumorForRecipient({
    rumor,
    senderSecretKey: params.inviteNostrSecretKey,
    recipientPubkeyHex: replyPubHex,
  });
}

export function unwrapAndVerifyInviteCert(params: {
  rawEvent: unknown;
  expectedInvite: DecodedPairingInvite;
  expectedRequest: SignedPairingRequest;
  replyNostrSecretKey: Uint8Array;
}): DecodedInviteEnrollmentCertMessage {
  const unwrapped = unwrapGiftWrapEvent(params.rawEvent, params.replyNostrSecretKey);
  if (unwrapped.senderNostrPubkeyHex !== params.expectedInvite.ownerNostrPubkeyHex) {
    throw new Error('Certificate response sender does not match invitation Nostr key.');
  }
  if (unwrapped.rumor.kind !== CHM_PAIRING_INVITE_CERT_RUMOR_KIND) {
    throw new Error(`Unexpected rumor kind: ${unwrapped.rumor.kind}`);
  }
  const body = parseSafeRumorJson(unwrapped.rumor.content);
  if (body.protocol !== CHM_PAIR_INVITE_PROTOCOL_ID || body.kind !== 'pairing-invite-cert') {
    throw new Error('Unexpected pairing invite certificate message format.');
  }
  if (body.inviteIdHex !== params.expectedInvite.inviteIdHex) {
    throw new Error('Pairing invite ID mismatch on certificate response.');
  }
  if (typeof body.certificateToken !== 'string' || body.certificateToken.length > 4096) {
    throw new Error('Missing or invalid enrollment certificate token.');
  }
  if (typeof body.inviteAckProofHex !== 'string' || !isValidLowercaseHex64(body.inviteAckProofHex)) {
    throw new Error('Missing or invalid invite acknowledgment proof.');
  }

  const parsedCert = parsePairingQrInput(body.certificateToken);
  if (parsedCert.kind !== 'enrollment-certificate') {
    throw new Error('Expected an enrollment-certificate token inside invitation response.');
  }
  const certificate = parsedCert.certificate;

  const expectedAckHex = computeInviteCertAckProofHex({
    inviteSecretBytes: params.expectedInvite.inviteSecretBytes,
    inviteIdBytes: params.expectedInvite.inviteIdBytes,
    certIdBytes: certificate.payload.certId,
    requestHash: params.expectedRequest.requestHash,
  });
  if (!constantTimeEqual(hexToBytes(body.inviteAckProofHex), hexToBytes(expectedAckHex))) {
    throw new Error('Invite acknowledgment proof mismatch.');
  }

  const syncBindingToken =
    typeof body.syncBindingToken === 'string' && body.syncBindingToken.length <= 4096
      ? body.syncBindingToken
      : undefined;

  return {
    inviteIdHex: params.expectedInvite.inviteIdHex,
    certificate,
    certificateToken: body.certificateToken,
    syncBindingToken,
  };
}
