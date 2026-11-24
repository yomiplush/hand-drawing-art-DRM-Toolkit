import { createSignedNostrEvent, verifyNostrEvent } from './nip01';
import type { NostrEvent } from './nip01';
import { isValidLowercaseHex64 } from './secp256k1';

export const NIP09_KIND_EVENT_DELETION = 5;

export function createNip09DeletionRequestEvent(params: {
  eventIds: string[];
  deletedKinds?: number[];
  reason?: string;
  secretKey: Uint8Array;
  createdAt?: number;
}): NostrEvent {
  const validIds = Array.from(new Set(params.eventIds.filter((id) => isValidLowercaseHex64(id))));
  if (validIds.length === 0) {
    throw new Error('NIP-09 deletion request requires at least one valid 64-hex event ID');
  }
  if (validIds.length > 50) {
    throw new Error('NIP-09 deletion request is capped at 50 event IDs per batch');
  }

  const tags: string[][] = validIds.map((id) => ['e', id]);
  const kinds = Array.from(
    new Set(
      (params.deletedKinds ?? []).filter(
        (k) => Number.isInteger(k) && k >= 0 && k <= 65535,
      ),
    ),
  );
  for (const k of kinds) {
    tags.push(['k', String(k)]);
  }

  return createSignedNostrEvent(
    {
      kind: NIP09_KIND_EVENT_DELETION,
      created_at: params.createdAt ?? Math.floor(Date.now() / 1000),
      tags,
      content: (params.reason ?? '').slice(0, 280),
    },
    params.secretKey,
  );
}

export function verifyNip09DeletionRequest(
  rawEvent: unknown,
  expectedAuthorPubkeyHex?: string,
): {
  valid: boolean;
  referencedEventIds: string[];
  authorPubkeyHex?: string;
  error?: string;
} {
  const check = verifyNostrEvent(rawEvent, { expectedKind: NIP09_KIND_EVENT_DELETION });
  if (!check.valid) {
    return { valid: false, referencedEventIds: [], error: check.error };
  }
  if (expectedAuthorPubkeyHex && check.event.pubkey !== expectedAuthorPubkeyHex) {
    return {
      valid: false,
      referencedEventIds: [],
      error: 'NIP-09 deletion pubkey does not match target event author pubkey',
    };
  }
  const referencedEventIds = Array.from(
    new Set(
      check.event.tags
        .filter((t) => t[0] === 'e' && typeof t[1] === 'string' && isValidLowercaseHex64(t[1]))
        .map((t) => t[1]),
    ),
  );
  return {
    valid: referencedEventIds.length > 0,
    referencedEventIds,
    authorPubkeyHex: check.event.pubkey,
    error: referencedEventIds.length > 0 ? undefined : 'No valid e-tags in NIP-09 deletion event',
  };
}
