import {
  computeEventIdHex,
  createSignedNostrEvent,
  createUnsignedRumor,
  validateEventTags,
  verifyNostrEvent,
} from './nip01';
import type { NostrEvent, NostrRumor } from './nip01';
import { decryptNip44, encryptNip44, getNip44ConversationKey } from './nip44';
import {
  assertValidNostrPubkeyHex,
  assertValidNostrSecretKeyBytes,
  deriveNostrPublicKeyHex,
  generateNostrKeypair,
  isValidLowercaseHex64,
  wipeBytes,
} from './secp256k1';

export const NIP59_KIND_SEAL = 13;
export const NIP59_KIND_GIFT_WRAP = 1059;
export const NIP59_KIND_EPHEMERAL_GIFT_WRAP = 21059;
export const CHM_SYNC_RUMOR_KIND = 30079; // Unsigned inner CHM sync event inside NIP-59 seal

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/**
 * Generates a uniform random integer in [0, maxExclusive) using CSPRNG rejection sampling.
 */
function randomIntCSPRNG(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  while (true) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      return buf[0] % maxExclusive;
    }
  }
}

/**
 * Randomizes outer seal/gift-wrap timestamps up to 2 days in the past (per NIP-59 metadata obfuscation).
 */
export function jitterPastTimestamp(baseUnix?: number): number {
  const now = baseUnix ?? Math.floor(Date.now() / 1000);
  return Math.max(1, now - randomIntCSPRNG(TWO_DAYS_SECONDS));
}

export function buildChmSyncRumor(params: {
  senderPubkeyHex: string;
  content: string;
  createdAt?: number;
  tags?: string[][];
  kind?: number;
}): NostrRumor {
  return createUnsignedRumor({
    pubkey: params.senderPubkeyHex,
    created_at: params.createdAt ?? Math.floor(Date.now() / 1000),
    kind: params.kind ?? CHM_SYNC_RUMOR_KIND,
    tags: params.tags ?? [],
    content: params.content,
  });
}

export function createSealEvent(params: {
  rumor: NostrRumor;
  senderSecretKey: Uint8Array;
  recipientPubkeyHex: string;
  createdAt?: number;
  nonce?: Uint8Array;
}): NostrEvent {
  assertValidNostrSecretKeyBytes(params.senderSecretKey);
  const senderPub = deriveNostrPublicKeyHex(params.senderSecretKey);
  if (params.rumor.pubkey !== senderPub) {
    throw new Error('NIP-59 Seal violation: rumor.pubkey must match sender public key');
  }
  const recipientPub = assertValidNostrPubkeyHex(params.recipientPubkeyHex);
  const convKey = getNip44ConversationKey(params.senderSecretKey, recipientPub);
  try {
    const encryptedRumor = encryptNip44(JSON.stringify(params.rumor), convKey, {
      nonce: params.nonce,
    });
    return createSignedNostrEvent(
      {
        kind: NIP59_KIND_SEAL,
        created_at: params.createdAt ?? jitterPastTimestamp(),
        tags: [], // NIP-59: tags MUST always be empty in kind:13 seal
        content: encryptedRumor,
      },
      params.senderSecretKey,
    );
  } finally {
    convKey.fill(0);
  }
}

export function createGiftWrapEvent(params: {
  seal: NostrEvent;
  recipientPubkeyHex: string;
  ephemeralSecretKey?: Uint8Array;
  createdAt?: number;
  nonce?: Uint8Array;
  ephemeralKind?: boolean;
}): NostrEvent {
  if (params.seal.kind !== NIP59_KIND_SEAL) {
    throw new Error('Gift wrap must encapsulate a kind:13 seal event');
  }
  const recipientPub = assertValidNostrPubkeyHex(params.recipientPubkeyHex);
  const ephemeral = params.ephemeralSecretKey
    ? { secretKey: params.ephemeralSecretKey, owned: false }
    : { secretKey: generateNostrKeypair().secretKey, owned: true };

  const convKey = getNip44ConversationKey(ephemeral.secretKey, recipientPub);
  try {
    const encryptedSeal = encryptNip44(JSON.stringify(params.seal), convKey, {
      nonce: params.nonce,
    });
    return createSignedNostrEvent(
      {
        kind: params.ephemeralKind ? NIP59_KIND_EPHEMERAL_GIFT_WRAP : NIP59_KIND_GIFT_WRAP,
        created_at: params.createdAt ?? jitterPastTimestamp(),
        tags: [['p', recipientPub]],
        content: encryptedSeal,
      },
      ephemeral.secretKey,
    );
  } finally {
    convKey.fill(0);
    if (ephemeral.owned) {
      wipeBytes(ephemeral.secretKey);
    }
  }
}

export function wrapRumorForRecipient(params: {
  rumor: NostrRumor;
  senderSecretKey: Uint8Array;
  recipientPubkeyHex: string;
  sealCreatedAt?: number;
  wrapCreatedAt?: number;
}): NostrEvent {
  const seal = createSealEvent({
    rumor: params.rumor,
    senderSecretKey: params.senderSecretKey,
    recipientPubkeyHex: params.recipientPubkeyHex,
    createdAt: params.sealCreatedAt,
  });
  return createGiftWrapEvent({
    seal,
    recipientPubkeyHex: params.recipientPubkeyHex,
    createdAt: params.wrapCreatedAt,
  });
}

function parseJsonObjectSafely(rawJson: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(`Invalid JSON inside ${label}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must decode to a JSON object`);
  }
  if (
    Object.prototype.hasOwnProperty.call(parsed, '__proto__') ||
    Object.prototype.hasOwnProperty.call(parsed, 'constructor')
  ) {
    throw new Error(`Forbidden prototype key inside ${label}`);
  }
  return parsed as Record<string, unknown>;
}

const ALLOWED_RUMOR_KEYS = new Set(['id', 'pubkey', 'created_at', 'kind', 'tags', 'content']);

export interface UnwrappedGiftResult {
  wrap: NostrEvent;
  seal: NostrEvent;
  rumor: NostrRumor;
  senderNostrPubkeyHex: string;
}

/**
 * Cryptographically unwraps and validates a NIP-59 Gift Wrap:
 * 1. Verifies outer kind:1059 / 21059 NIP-01 ID and Schnorr signature BEFORE decrypting.
 * 2. Decrypts NIP-44 seal using recipient key and outer wrapper pubkey.
 * 3. Verifies kind:13 Seal ID, Schnorr signature, and empty `tags: []` BEFORE decrypting rumor.
 * 4. Decrypts NIP-44 rumor using recipient key and seal pubkey.
 * 5. Enforces rumor schema, ID match, no smuggled `sig`, and CRITICAL `rumor.pubkey === seal.pubkey` anti-impersonation check.
 */
export function unwrapGiftWrapEvent(
  rawWrap: unknown,
  recipientSecretKey: Uint8Array,
): UnwrappedGiftResult {
  assertValidNostrSecretKeyBytes(recipientSecretKey);

  // 1. Verify outer Gift Wrap
  const wrapCheck = verifyNostrEvent(rawWrap, {
    allowKinds: [NIP59_KIND_GIFT_WRAP, NIP59_KIND_EPHEMERAL_GIFT_WRAP],
  });
  if (!wrapCheck.valid) {
    throw new Error(`Invalid NIP-59 Gift Wrap: ${wrapCheck.error}`);
  }
  const wrap = wrapCheck.event;

  // 2. Decrypt Seal
  const outerConvKey = getNip44ConversationKey(recipientSecretKey, wrap.pubkey);
  let sealRaw: Record<string, unknown>;
  try {
    const sealJson = decryptNip44(wrap.content, outerConvKey);
    sealRaw = parseJsonObjectSafely(sealJson, 'NIP-59 seal');
  } finally {
    outerConvKey.fill(0);
  }

  // 3. Verify Seal strictly (must be kind 13 with empty tags)
  const sealCheck = verifyNostrEvent(sealRaw, { expectedKind: NIP59_KIND_SEAL });
  if (!sealCheck.valid) {
    throw new Error(`Invalid NIP-59 Seal: ${sealCheck.error}`);
  }
  const seal = sealCheck.event;
  if (seal.tags.length !== 0) {
    throw new Error('Invalid NIP-59 Seal: tags array must be empty');
  }

  // 4. Decrypt Rumor
  const innerConvKey = getNip44ConversationKey(recipientSecretKey, seal.pubkey);
  let rumorRaw: Record<string, unknown>;
  try {
    const rumorJson = decryptNip44(seal.content, innerConvKey);
    rumorRaw = parseJsonObjectSafely(rumorJson, 'NIP-59 rumor');
  } finally {
    innerConvKey.fill(0);
  }

  // 5. Validate Rumor schema & CRITICAL anti-impersonation check (rumor.pubkey === seal.pubkey)
  for (const key of Object.keys(rumorRaw)) {
    if (!ALLOWED_RUMOR_KEYS.has(key)) {
      throw new Error(`Unexpected or forbidden field "${key}" in NIP-59 rumor`);
    }
  }
  if (
    !isValidLowercaseHex64(rumorRaw.id) ||
    !isValidLowercaseHex64(rumorRaw.pubkey) ||
    typeof rumorRaw.created_at !== 'number' ||
    !Number.isInteger(rumorRaw.created_at) ||
    rumorRaw.created_at < 0 ||
    typeof rumorRaw.kind !== 'number' ||
    !Number.isInteger(rumorRaw.kind) ||
    rumorRaw.kind < 0 ||
    rumorRaw.kind > 65535 ||
    !validateEventTags(rumorRaw.tags) ||
    typeof rumorRaw.content !== 'string'
  ) {
    throw new Error('Malformed NIP-59 rumor payload');
  }

  if (rumorRaw.pubkey !== seal.pubkey) {
    throw new Error(
      'NIP-59 impersonation blocked: inner rumor.pubkey does not match outer seal.pubkey',
    );
  }

  const rumor: NostrRumor = {
    id: rumorRaw.id,
    pubkey: rumorRaw.pubkey,
    created_at: rumorRaw.created_at,
    kind: rumorRaw.kind,
    tags: rumorRaw.tags.map((t) => [...t]),
    content: rumorRaw.content,
  };
  const expectedId = computeEventIdHex(rumor);
  if (expectedId !== rumor.id) {
    throw new Error('Invalid NIP-59 rumor event ID');
  }

  return {
    wrap,
    seal,
    rumor,
    senderNostrPubkeyHex: seal.pubkey,
  };
}
