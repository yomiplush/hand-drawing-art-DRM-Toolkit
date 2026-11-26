/**
 * Free, zero-cost Nostr public relay distribution for ultra-compact QR codes.
 *
 * Publishes ONLY the Ed25519-signed CHM proof payload (~0.5–1 KB, zero image pixels)
 * to multiple free public Nostr relays as a NIP-01 kind 30078 event, returning an
 * ultra-short QR Alphanumeric URL:
 *   HTTPS://CERTIFIED-HANDMADE.COM/N/<64-CHAR-UPPERCASE-HEX-EVENT-ID>
 *
 * Because the URL is 100% QR Alphanumeric mode (~97 chars), it fits into
 * QR Version 4 (33x33 modules) — readable by smartphone cameras even at tiny stamp sizes.
 * Tamper resistance is 100% preserved because the fetched proof is verified locally
 * against the artist's Ed25519 signature.
 */

import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import { MAX_PROOF_BYTES } from '../manifest/types';
import { createSignedNostrEvent, verifyNostrEvent } from './nip01';
import type { NostrEvent } from './nip01';
import { generateNostrKeypair, wipeBytes } from './secp256k1';

export const NOSTR_PROOF_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nostr.band',
] as const;

export const NOSTR_PROOF_URL_PREFIX = 'HTTPS://CERTIFIED-HANDMADE.COM/N/';

const NOSTR_PROOF_EVENT_KIND = 30078;
const RELAY_TIMEOUT_MS = 4500;
const CUSTOM_RELAYS_STORAGE_KEY = 'chm_custom_nostr_proof_relays_v1';

/** Automatically skips relays that report payment-required, auth-required, or repeated failures. */
const rejectedRelays = new Set<string>();

export function getCustomNostrProofRelays(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_RELAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u): u is string => typeof u === 'string' && /^wss:\/\/.+/i.test(u.trim()))
      .map((u) => u.trim());
  } catch {
    return [];
  }
}

export function setCustomNostrProofRelays(relays: string[]): string[] {
  const cleaned = Array.from(
    new Set(
      relays
        .map((u) => u.trim())
        .filter((u) => /^wss:\/\/.+/i.test(u)),
    ),
  );
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CUSTOM_RELAYS_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // ignore storage quota errors
    }
  }
  return cleaned;
}

function isPaidOrRestrictedNotice(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes('paid') ||
    lower.includes('payment') ||
    lower.includes('auth-required') ||
    lower.includes('restricted') ||
    lower.includes('subscription') ||
    lower.includes('whitelist')
  );
}

function getActiveFreeRelays(relays: readonly string[]): string[] {
  const custom = getCustomNostrProofRelays();
  const freeActive = relays.filter((r) => !rejectedRelays.has(r));
  const combined = Array.from(new Set([...custom, ...(freeActive.length > 0 ? freeActive : relays)]));
  return combined;
}

function publishToSingleRelay(relayUrl: string, event: NostrEvent): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof WebSocket === 'undefined') {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl);
    } catch {
      resolve(false);
      return;
    }

    const timer = window.setTimeout(() => finish(false), RELAY_TIMEOUT_MS);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(['EVENT', event]));
      } catch {
        finish(false);
      }
    };

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data)) as unknown[];
        if (Array.isArray(parsed) && parsed[0] === 'OK' && parsed[1] === event.id) {
          const accepted = Boolean(parsed[2]);
          const reason = typeof parsed[3] === 'string' ? parsed[3] : '';
          if (!accepted && isPaidOrRestrictedNotice(reason)) {
            rejectedRelays.add(relayUrl);
          }
          finish(accepted);
        }
      } catch {
        // ignore malformed relay messages
      }
    };

    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}

function fetchFromSingleRelay(relayUrl: string, eventIdHex: string): Promise<NostrEvent | null> {
  return new Promise((resolve) => {
    if (typeof WebSocket === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const subId = `chm_${Math.random().toString(36).slice(2, 10)}`;
    const finish = (ev: NostrEvent | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
        }
        ws.close();
      } catch {
        // ignore
      }
      resolve(ev);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl);
    } catch {
      resolve(null);
      return;
    }

    const timer = window.setTimeout(() => finish(null), RELAY_TIMEOUT_MS);

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify([
            'REQ',
            subId,
            { ids: [eventIdHex.toLowerCase()], limit: 1 },
          ]),
        );
      } catch {
        finish(null);
      }
    };

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data)) as unknown[];
        if (!Array.isArray(parsed)) return;
        if (parsed[0] === 'EVENT' && parsed[1] === subId && parsed[2]) {
          const candidate = parsed[2] as NostrEvent;
          if (
            candidate.id?.toLowerCase() === eventIdHex.toLowerCase() &&
            verifyNostrEvent(candidate)
          ) {
            finish(candidate);
          }
        } else if (parsed[0] === 'EOSE' && parsed[1] === subId) {
          finish(null);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => finish(null);
    ws.onclose = () => finish(null);
  });
}

/**
 * Publishes signed proofBytes to free public Nostr relays in parallel.
 * Returns the ultra-compact `/N/<EVENT_ID>` URL if at least 1 relay accepts it,
 * or `null` if offline / all relays fail (caller falls back to offline Base45 URL).
 */
export async function publishProofToNostrRelays(
  proofBytes: Uint8Array,
  relays: readonly string[] = NOSTR_PROOF_RELAYS,
): Promise<{ eventId: string; proofUrl: string } | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const keypair = generateNostrKeypair();
  let event: NostrEvent;
  try {
    const content = base64UrlEncode(proofBytes);
    event = createSignedNostrEvent(
      {
        kind: NOSTR_PROOF_EVENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `chm-${Date.now().toString(36)}`],
          ['t', 'certified-handmade'],
        ],
        content,
      },
      keypair.secretKey,
    );
  } finally {
    wipeBytes(keypair.secretKey);
  }

  const activeRelays = getActiveFreeRelays(relays);
  const results = await Promise.all(activeRelays.map((url) => publishToSingleRelay(url, event)));
  const okCount = results.filter(Boolean).length;
  if (okCount === 0) {
    return null;
  }

  return {
    eventId: event.id,
    proofUrl: `${NOSTR_PROOF_URL_PREFIX}${event.id.toUpperCase()}`,
  };
}

/**
 * Fetches and verifies a Nostr-hosted CHM proof event by its 64-char hex ID.
 * Implements automatic read-repair (anti-purge self-healing): whenever a valid
 * signed event is retrieved from any surviving relay, it is silently re-broadcast
 * in the background to all other relays in the pool so purged copies heal automatically.
 */
export async function fetchProofFromNostrRelays(
  eventIdHex: string,
  relays: readonly string[] = NOSTR_PROOF_RELAYS,
): Promise<Uint8Array> {
  const cleanId = eventIdHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleanId)) {
    throw new Error('Invalid Nostr proof event ID');
  }

  const activeRelays = getActiveFreeRelays(relays);
  let winningRelay: string | null = null;
  const event = await new Promise<NostrEvent | null>((resolve) => {
    let remaining = activeRelays.length;
    let done = false;
    if (remaining === 0) {
      resolve(null);
      return;
    }
    for (const relayUrl of activeRelays) {
      void fetchFromSingleRelay(relayUrl, cleanId).then((ev) => {
        if (done) return;
        if (ev) {
          done = true;
          winningRelay = relayUrl;
          resolve(ev);
          return;
        }
        remaining -= 1;
        if (remaining === 0) {
          done = true;
          resolve(null);
        }
      });
    }
  });

  if (!event || !event.content) {
    throw new Error('Proof event not found on Nostr relays');
  }

  // Anti-purge self-healing: silently re-broadcast the immutable signed event to peer relays
  const peerRelays = relays.filter((r) => r !== winningRelay);
  if (peerRelays.length > 0) {
    void Promise.allSettled(peerRelays.map((r) => publishToSingleRelay(r, event)));
  }

  const bytes = base64UrlDecode(event.content.trim());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROOF_BYTES) {
    throw new Error('Fetched Nostr proof payload is invalid or exceeds maximum size');
  }
  return bytes;
}
