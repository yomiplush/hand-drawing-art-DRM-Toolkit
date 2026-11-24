import { createSignedNostrEvent, verifyNostrEvent } from './nip01';
import type { NostrEvent } from './nip01';

export const NIP42_KIND_AUTH = 22242;
export const NIP42_MAX_TIME_DRIFT_SECONDS = 600;

export function normalizeRelayUrlForAuth(relayUrl: string): string {
  const parsed = new URL(relayUrl.trim());
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port ? `:${parsed.port}` : '';
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.protocol}//${host}${port}${path}`;
}

export function createNip42AuthEvent(params: {
  relayUrl: string;
  challenge: string;
  secretKey: Uint8Array;
  createdAt?: number;
}): NostrEvent {
  const challenge = params.challenge.trim();
  if (!challenge || challenge.length > 256) {
    throw new Error('Invalid NIP-42 AUTH challenge');
  }
  const normalizedRelay = normalizeRelayUrlForAuth(params.relayUrl);
  return createSignedNostrEvent(
    {
      kind: NIP42_KIND_AUTH,
      created_at: params.createdAt ?? Math.floor(Date.now() / 1000),
      tags: [
        ['relay', normalizedRelay],
        ['challenge', challenge],
      ],
      content: '',
    },
    params.secretKey,
  );
}

export function verifyNip42AuthEvent(params: {
  rawEvent: unknown;
  expectedRelayUrl: string;
  expectedChallenge: string;
  nowUnix?: number;
}): { valid: true; event: NostrEvent } | { valid: false; error: string } {
  const check = verifyNostrEvent(params.rawEvent, { expectedKind: NIP42_KIND_AUTH });
  if (!check.valid) return check;
  const ev = check.event;
  const now = params.nowUnix ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ev.created_at) > NIP42_MAX_TIME_DRIFT_SECONDS) {
    return { valid: false, error: 'NIP-42 AUTH event created_at outside 10-minute window' };
  }
  const challengeTag = ev.tags.find((t) => t[0] === 'challenge')?.[1];
  if (challengeTag !== params.expectedChallenge) {
    return { valid: false, error: 'NIP-42 AUTH challenge mismatch' };
  }
  const relayTag = ev.tags.find((t) => t[0] === 'relay')?.[1];
  if (!relayTag) {
    return { valid: false, error: 'Missing relay tag in NIP-42 AUTH event' };
  }
  try {
    const normalizedTag = normalizeRelayUrlForAuth(relayTag);
    const normalizedExpected = normalizeRelayUrlForAuth(params.expectedRelayUrl);
    if (normalizedTag !== normalizedExpected) {
      return { valid: false, error: 'NIP-42 AUTH relay URL mismatch' };
    }
  } catch {
    return { valid: false, error: 'Invalid relay URL in NIP-42 AUTH event' };
  }
  return { valid: true, event: ev };
}
