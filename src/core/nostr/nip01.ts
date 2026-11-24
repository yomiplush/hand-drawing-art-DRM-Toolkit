import { bytesToHex, hexToBytes, sha256Sync } from '../crypto/sha256';
import {
  assertValidNostrPubkeyHex,
  assertValidNostrSecretKeyBytes,
  deriveNostrPublicKeyHex,
  isValidLowercaseHex128,
  isValidLowercaseHex64,
  signSchnorrDigestHex,
  verifySchnorrDigestHex,
} from './secp256k1';

export interface UnsignedNostrEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface NostrRumor extends UnsignedNostrEvent {
  id: string;
}

export interface NostrEvent extends UnsignedNostrEvent {
  id: string;
  sig: string;
}

export interface VerifyNostrEventOptions {
  maxJsonBytes?: number;
  maxTags?: number;
  maxTagElements?: number;
  maxTagValueChars?: number;
  maxContentChars?: number;
  expectedKind?: number;
  allowKinds?: number[];
}

export const DEFAULT_MAX_EVENT_JSON_BYTES = 131_072; // 128 KiB hard ceiling
export const DEFAULT_MAX_TAGS = 64;
export const DEFAULT_MAX_TAG_ELEMENTS = 16;
export const DEFAULT_MAX_TAG_VALUE_CHARS = 512;
export const DEFAULT_MAX_CONTENT_CHARS = 128_000;

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Escapes a string strictly following NIP-01 canonical serialization rules.
 */
export function escapeNip01JsonString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    if (ch === '\n') {
      out += '\\n';
    } else if (ch === '"') {
      out += '\\"';
    } else if (ch === '\\') {
      out += '\\\\';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
    } else if (ch === '\b') {
      out += '\\b';
    } else if (ch === '\f') {
      out += '\\f';
    } else if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  out += '"';
  return out;
}

export function validateEventTags(
  tags: unknown,
  maxTags = DEFAULT_MAX_TAGS,
  maxElements = DEFAULT_MAX_TAG_ELEMENTS,
  maxChars = DEFAULT_MAX_TAG_VALUE_CHARS,
): tags is string[][] {
  if (!Array.isArray(tags) || tags.length > maxTags) return false;
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length === 0 || tag.length > maxElements) return false;
    for (const item of tag) {
      if (typeof item !== 'string' || item.length > maxChars) return false;
    }
  }
  return true;
}

/**
 * NIP-01 canonical commitment string:
 * `[0,<pubkey>,<created_at>,<kind>,<tags>,<content>]`
 */
export function serializeEventForId(event: UnsignedNostrEvent): string {
  const pubkey = assertValidNostrPubkeyHex(event.pubkey);
  if (!Number.isInteger(event.created_at) || event.created_at < 0 || !Number.isSafeInteger(event.created_at)) {
    throw new Error('Invalid Nostr event created_at timestamp');
  }
  if (!Number.isInteger(event.kind) || event.kind < 0 || event.kind > 65535) {
    throw new Error('Invalid Nostr event kind (must be integer 0..65535)');
  }
  if (!validateEventTags(event.tags, 1024, 64, 4096)) {
    throw new Error('Invalid Nostr event tags array');
  }
  if (typeof event.content !== 'string') {
    throw new Error('Invalid Nostr event content string');
  }

  const serializedTags =
    '[' +
    event.tags.map((tag) => '[' + tag.map((el) => escapeNip01JsonString(el)).join(',') + ']').join(',') +
    ']';

  return `[0,${escapeNip01JsonString(pubkey)},${event.created_at},${event.kind},${serializedTags},${escapeNip01JsonString(event.content)}]`;
}

export function computeEventIdBytes(event: UnsignedNostrEvent): Uint8Array {
  const canonical = serializeEventForId(event);
  return sha256Sync(new TextEncoder().encode(canonical));
}

export function computeEventIdHex(event: UnsignedNostrEvent): string {
  return bytesToHex(computeEventIdBytes(event));
}

export function createUnsignedRumor(params: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): NostrRumor {
  const unsigned: UnsignedNostrEvent = {
    pubkey: assertValidNostrPubkeyHex(params.pubkey),
    created_at: params.created_at,
    kind: params.kind,
    tags: params.tags.map((t) => [...t]),
    content: params.content,
  };
  return {
    ...unsigned,
    id: computeEventIdHex(unsigned),
  };
}

export function createSignedNostrEvent(
  params: {
    created_at?: number;
    kind: number;
    tags: string[][];
    content: string;
  },
  secretKey: Uint8Array,
): NostrEvent {
  assertValidNostrSecretKeyBytes(secretKey);
  const pubkey = deriveNostrPublicKeyHex(secretKey);
  const created_at = params.created_at ?? Math.floor(Date.now() / 1000);
  const unsigned: UnsignedNostrEvent = {
    pubkey,
    created_at,
    kind: params.kind,
    tags: params.tags.map((t) => [...t]),
    content: params.content,
  };
  const idBytes = computeEventIdBytes(unsigned);
  const id = bytesToHex(idBytes);
  const sig = signSchnorrDigestHex(idBytes, secretKey);
  return {
    ...unsigned,
    id,
    sig,
  };
}

const ALLOWED_EVENT_KEYS = new Set(['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig']);

export function verifyNostrEvent(
  raw: unknown,
  options: VerifyNostrEventOptions = {},
): { valid: true; event: NostrEvent } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Event must be a JSON object' };
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_EVENT_KEYS.has(key)) {
      return { valid: false, error: `Unexpected field "${key}" on Nostr event` };
    }
  }
  for (const req of ALLOWED_EVENT_KEYS) {
    if (!hasOwn(raw, req)) {
      return { valid: false, error: `Missing required Nostr event field "${req}"` };
    }
  }

  const candidate = raw as Record<string, unknown>;
  if (!isValidLowercaseHex64(candidate.id)) {
    return { valid: false, error: 'Invalid event id hex' };
  }
  if (!isValidLowercaseHex64(candidate.pubkey)) {
    return { valid: false, error: 'Invalid event pubkey hex' };
  }
  if (!isValidLowercaseHex128(candidate.sig)) {
    return { valid: false, error: 'Invalid event signature hex' };
  }
  if (
    typeof candidate.created_at !== 'number' ||
    !Number.isInteger(candidate.created_at) ||
    candidate.created_at < 0 ||
    !Number.isSafeInteger(candidate.created_at)
  ) {
    return { valid: false, error: 'Invalid event created_at' };
  }
  if (
    typeof candidate.kind !== 'number' ||
    !Number.isInteger(candidate.kind) ||
    candidate.kind < 0 ||
    candidate.kind > 65535
  ) {
    return { valid: false, error: 'Invalid event kind' };
  }
  if (options.expectedKind !== undefined && candidate.kind !== options.expectedKind) {
    return { valid: false, error: `Unexpected event kind ${candidate.kind}` };
  }
  if (options.allowKinds && !options.allowKinds.includes(candidate.kind)) {
    return { valid: false, error: `Disallowed event kind ${candidate.kind}` };
  }

  const maxTags = options.maxTags ?? DEFAULT_MAX_TAGS;
  const maxTagElements = options.maxTagElements ?? DEFAULT_MAX_TAG_ELEMENTS;
  const maxTagValueChars = options.maxTagValueChars ?? DEFAULT_MAX_TAG_VALUE_CHARS;
  const maxContentChars = options.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS;
  const maxJsonBytes = options.maxJsonBytes ?? DEFAULT_MAX_EVENT_JSON_BYTES;

  if (!validateEventTags(candidate.tags, maxTags, maxTagElements, maxTagValueChars)) {
    return { valid: false, error: 'Invalid or oversized Nostr event tags' };
  }
  if (typeof candidate.content !== 'string' || candidate.content.length > maxContentChars) {
    return { valid: false, error: 'Invalid or oversized Nostr event content' };
  }

  const event: NostrEvent = {
    id: candidate.id,
    pubkey: candidate.pubkey,
    created_at: candidate.created_at,
    kind: candidate.kind,
    tags: candidate.tags.map((t) => [...t]),
    content: candidate.content,
    sig: candidate.sig,
  };

  try {
    const serialized = serializeEventForId(event);
    const serializedBytes = new TextEncoder().encode(serialized);
    if (serializedBytes.length > maxJsonBytes) {
      return { valid: false, error: `Event exceeds max size (${maxJsonBytes} bytes)` };
    }
    const expectedIdBytes = sha256Sync(serializedBytes);
    const expectedIdHex = bytesToHex(expectedIdBytes);
    if (expectedIdHex !== event.id) {
      return { valid: false, error: 'Event ID mismatch' };
    }
    if (!verifySchnorrDigestHex(hexToBytes(event.id), event.sig, event.pubkey)) {
      return { valid: false, error: 'Event BIP-340 Schnorr signature verification failed' };
    }
    return { valid: true, event };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Event verification failed',
    };
  }
}
