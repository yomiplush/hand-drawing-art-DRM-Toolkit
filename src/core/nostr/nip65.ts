import { createSignedNostrEvent, verifyNostrEvent } from './nip01';
import type { NostrEvent } from './nip01';

export const NIP65_KIND_RELAY_LIST = 10002;
export const MAX_RECOMMENDED_NIP65_RELAYS = 8;

export interface Nip65RelayEntry {
  url: string;
  read: boolean;
  write: boolean;
}

function normalizeRelayUrlStrict(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol.toLowerCase() !== 'wss:') return null;
    if (!parsed.hostname) return null;
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : '';
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `wss://${host}${port}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

export function createNip65RelayListEvent(params: {
  relays: Nip65RelayEntry[];
  secretKey: Uint8Array;
  createdAt?: number;
}): NostrEvent {
  const dedup = new Map<string, Nip65RelayEntry>();
  for (const r of params.relays) {
    const norm = normalizeRelayUrlStrict(r.url);
    if (!norm) continue;
    if (!r.read && !r.write) continue;
    dedup.set(norm, { url: norm, read: Boolean(r.read), write: Boolean(r.write) });
    if (dedup.size >= MAX_RECOMMENDED_NIP65_RELAYS) break;
  }

  const tags: string[][] = [];
  for (const r of dedup.values()) {
    if (r.read && r.write) {
      tags.push(['r', r.url]);
    } else if (r.read) {
      tags.push(['r', r.url, 'read']);
    } else if (r.write) {
      tags.push(['r', r.url, 'write']);
    }
  }

  return createSignedNostrEvent(
    {
      kind: NIP65_KIND_RELAY_LIST,
      created_at: params.createdAt ?? Math.floor(Date.now() / 1000),
      tags,
      content: '',
    },
    params.secretKey,
  );
}

export function parseNip65RelayListEvent(rawEvent: unknown): {
  valid: boolean;
  relays: Nip65RelayEntry[];
  pubkeyHex?: string;
  createdAt?: number;
  error?: string;
} {
  const check = verifyNostrEvent(rawEvent, { expectedKind: NIP65_KIND_RELAY_LIST });
  if (!check.valid) {
    return { valid: false, relays: [], error: check.error };
  }

  const dedup = new Map<string, Nip65RelayEntry>();
  for (const tag of check.event.tags) {
    if (tag[0] !== 'r' || typeof tag[1] !== 'string') continue;
    const norm = normalizeRelayUrlStrict(tag[1]);
    if (!norm) continue;
    const marker = tag[2]?.toLowerCase();
    const read = !marker || marker === 'read';
    const write = !marker || marker === 'write';
    dedup.set(norm, { url: norm, read, write });
    if (dedup.size >= MAX_RECOMMENDED_NIP65_RELAYS) break;
  }

  return {
    valid: true,
    relays: Array.from(dedup.values()),
    pubkeyHex: check.event.pubkey,
    createdAt: check.event.created_at,
  };
}
