import { describe, expect, it } from 'vitest';
import { NOSTR_PROOF_RELAYS } from '../../src/core/nostr/proofRelay';
import {
  NostrSyncTransport,
  validateRelayUrl,
  type WebSocketFactory,
  type WebSocketLike,
} from '../../src/core/sync/relayManager';
import {
  CURATED_DEFAULT_RELAY_PRESETS,
  OPTIONAL_JAPAN_RELAY_PRESETS,
  createDefaultSyncSettings,
  type RelayConfig,
  type SyncOutboundEnvelope,
} from '../../src/core/sync/types';

const EXPECTED_GLOBAL_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
];

const EXPECTED_JAPAN_RELAYS = [
  'wss://relay.nostr.wirednet.jp',
  'wss://yabu.me',
  'wss://relay-jp.nostr.wirednet.jp',
];

class FakeWebSocket implements WebSocketLike {
  readyState = 1;
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(
    private readonly url: string,
    private readonly behavior: {
      failOpen?: boolean;
      onSend?: (data: string, emit: (type: string, payload?: unknown) => void) => void;
    },
  ) {
    queueMicrotask(() => {
      if (this.behavior.failOpen) {
        this.emit('error', {});
      } else {
        this.emit('open', {});
      }
    });
  }

  emit(type: string, payload?: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of Array.from(set)) {
      fn(payload);
    }
  }

  send(data: string): void {
    this.behavior.onSend?.(data, (type, payload) => this.emit(type, payload));
  }

  close(): void {
    this.readyState = 3;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
}

describe('Nostr Relay Presets, Validation & Best-Effort Resilience', () => {
  it('defines the 4 global standard relays as defaults across Sync and Proof Relay', () => {
    expect(CURATED_DEFAULT_RELAY_PRESETS.map((r) => r.url)).toEqual(EXPECTED_GLOBAL_RELAYS);
    expect(CURATED_DEFAULT_RELAY_PRESETS.every((r) => r.enabled && r.read && r.write)).toBe(true);
    expect([...NOSTR_PROOF_RELAYS]).toEqual(EXPECTED_GLOBAL_RELAYS);
  });

  it('keeps decentralized sync strictly OFF by default (opt-in)', () => {
    const defaults = createDefaultSyncSettings();
    expect(defaults.enabled).toBe(false);
    expect(defaults.consentAccepted).toBe(false);
    expect(defaults.relays).toEqual([]);
  });

  it('provides optional Japan presets separately from defaults with IP restriction metadata', () => {
    const jpUrls = OPTIONAL_JAPAN_RELAY_PRESETS.map((r) => r.url);
    expect(jpUrls).toEqual(EXPECTED_JAPAN_RELAYS);
    for (const url of jpUrls) {
      expect(EXPECTED_GLOBAL_RELAYS).not.toContain(url);
    }
    const wirednet = OPTIONAL_JAPAN_RELAY_PRESETS.find((r) => r.url === 'wss://relay.nostr.wirednet.jp');
    const yabu = OPTIONAL_JAPAN_RELAY_PRESETS.find((r) => r.url === 'wss://yabu.me');
    const wirednetJp = OPTIONAL_JAPAN_RELAY_PRESETS.find((r) => r.url === 'wss://relay-jp.nostr.wirednet.jp');
    expect(wirednet?.jpIpRestricted).toBe(false);
    expect(yabu?.jpIpRestricted).toBe(true);
    expect(wirednetJp?.jpIpRestricted).toBe(true);
  });

  it('validates and normalizes wss:// URLs while rejecting insecure or malformed URLs', () => {
    expect(validateRelayUrl('  WSS://Relay.Damus.IO/  ')).toBe('wss://relay.damus.io');
    expect(() => validateRelayUrl('ws://relay.damus.io')).toThrow(/wss:\/\//i);
    expect(() => validateRelayUrl('https://relay.damus.io')).toThrow(/wss:\/\//i);
    expect(() => validateRelayUrl('wss://user:pass@relay.damus.io')).toThrow(/credentials/i);
    expect(() => validateRelayUrl('ws://127.0.0.1:7777')).toThrow(/wss:\/\//i);
    expect(
      validateRelayUrl('ws://127.0.0.1:7777/', { allowInsecureLocalWsForTest: true }),
    ).toBe('ws://127.0.0.1:7777');
    expect(() =>
      validateRelayUrl('ws://example.com', { allowInsecureLocalWsForTest: true }),
    ).toThrow(/wss:\/\//i);
  });

  it('publishes best-effort: succeeds if at least 1 relay accepts even when others fail', async () => {
    const wsFactory: WebSocketFactory = (url) => {
      if (url === 'wss://relay.damus.io') {
        return new FakeWebSocket(url, { failOpen: true });
      }
      return new FakeWebSocket(url, {
        onSend: (data, emit) => {
          const parsed = JSON.parse(data) as unknown[];
          if (parsed[0] === 'EVENT') {
            const ev = parsed[1] as { id: string };
            queueMicrotask(() => {
              emit('message', { data: JSON.stringify(['OK', ev.id, true, '']) });
            });
          }
        },
      });
    };

    const transport = new NostrSyncTransport({
      webSocketFactory: wsFactory,
      connectTimeoutMs: 500,
      publishTimeoutMs: 500,
    });

    const relays: RelayConfig[] = [
      { url: 'wss://relay.damus.io', enabled: true, read: true, write: true },
      { url: 'wss://nos.lol', enabled: true, read: true, write: true },
    ];
    const envelope: SyncOutboundEnvelope = {
      id: 'env-1',
      ownerFingerprintHex: 'a'.repeat(64),
      recipientDeviceIdHex: 'b'.repeat(32),
      recipientNostrPubkeyHex: 'c'.repeat(64),
      opIdHex: 'd'.repeat(32),
      nostrEventJson: JSON.stringify({ id: 'e'.repeat(64), kind: 1059, content: 'cipher' }),
    };

    const result = await transport.publishEnvelopes({ envelopes: [envelope], relays });
    expect(result.attemptedRelays).toBe(2);
    expect(result.succeededRelays).toBe(1);
    expect(result.failedEnvelopeIds).toEqual([]);
  });

  it('fetches from all enabled relays and deduplicates events by event ID', async () => {
    const sharedEvent = { id: 'f'.repeat(64), kind: 1059, content: 'duplicate-payload' };
    const wsFactory: WebSocketFactory = (url) =>
      new FakeWebSocket(url, {
        onSend: (data, emit) => {
          const parsed = JSON.parse(data) as unknown[];
          if (parsed[0] === 'REQ') {
            const subId = parsed[1] as string;
            queueMicrotask(() => {
              emit('message', { data: JSON.stringify(['EVENT', subId, sharedEvent]) });
              emit('message', { data: JSON.stringify(['EOSE', subId]) });
            });
          }
        },
      });

    const transport = new NostrSyncTransport({
      webSocketFactory: wsFactory,
      connectTimeoutMs: 500,
      requestTimeoutMs: 500,
    });

    const relays: RelayConfig[] = [
      { url: 'wss://relay.damus.io', enabled: true, read: true, write: true },
      { url: 'wss://nos.lol', enabled: true, read: true, write: true },
    ];

    const result = await transport.fetchEnvelopesForRecipient({
      recipientPubkeyHex: 'c'.repeat(64),
      relays,
    });
    expect(result.reachableRelayCount).toBe(2);
    expect(result.events).toHaveLength(1);
    expect((result.events[0].rawEvent as { id: string }).id).toBe(sharedEvent.id);
  });
});
