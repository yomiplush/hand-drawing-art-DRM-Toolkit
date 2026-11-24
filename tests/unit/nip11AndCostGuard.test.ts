// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createNip09DeletionRequestEvent,
  createNip65RelayListEvent,
  evaluateNip11FreeRelayPolicy,
  fetchNip11RelayInfo,
  generateNostrKeypair,
  parseNip11RelayInfoDocument,
  parseNip65RelayListEvent,
  verifyNip09DeletionRequest,
} from '../../src/core/nostr';
import {
  NostrSyncTransport,
  classifyRelayRejection,
  setAllowLocalWsRelayForTests,
} from '../../src/core/sync';
import { MockNostrRelay } from '../helpers/mockNostrRelay';

describe('NIP-11 Free Relay Policy, NIP-65, NIP-09 & Runtime Cost Guard', () => {
  beforeEach(() => {
    setAllowLocalWsRelayForTests(true);
  });

  afterEach(() => {
    setAllowLocalWsRelayForTests(false);
  });

  it('evaluates NIP-11 relay documents and rejects paid or fee-bearing relays', () => {
    const freeDoc = parseNip11RelayInfoDocument({
      name: 'Community Free Relay',
      supported_nips: [1, 11, 42, 59],
      limitation: {
        payment_required: false,
        restricted_writes: false,
        max_message_length: 131072,
      },
    });
    const freeEval = evaluateNip11FreeRelayPolicy(freeDoc);
    expect(freeEval.usableForZeroCost).toBe(true);
    expect(freeEval.decision).toBe('free-usable');

    const paidDoc = parseNip11RelayInfoDocument({
      name: 'Paid Relay',
      payments_url: 'https://relay.example.com/pay',
      fees: { admission: [{ amount: 5000, unit: 'msats' }] },
      limitation: { payment_required: true },
    });
    const paidEval = evaluateNip11FreeRelayPolicy(paidDoc);
    expect(paidEval.usableForZeroCost).toBe(false);
    expect(paidEval.decision).toBe('payment-required');
    expect(paidEval.paymentRequired).toBe(true);

    const restrictedEval = evaluateNip11FreeRelayPolicy(
      parseNip11RelayInfoDocument({
        limitation: { restricted_writes: true },
      }),
    );
    expect(restrictedEval.decision).toBe('write-restricted');

    const powEval = evaluateNip11FreeRelayPolicy(
      parseNip11RelayInfoDocument({
        limitation: { min_pow_difficulty: 20 },
      }),
    );
    expect(powEval.decision).toBe('pow-required');
  });

  it('fetches NIP-11 metadata over loopback HTTP against MockNostrRelay', async () => {
    const mockFree = new MockNostrRelay();
    const freeUrl = await mockFree.start();
    const mockPaid = new MockNostrRelay({
      nip11Document: {
        name: 'Paid Test Relay',
        payments_url: 'https://example.com/pay',
        limitation: { payment_required: true },
      },
    });
    const paidUrl = await mockPaid.start();

    try {
      const infoFree = await fetchNip11RelayInfo({
        relayUrl: freeUrl,
        allowInsecureLocalWsForTest: true,
      });
      expect(evaluateNip11FreeRelayPolicy(infoFree).usableForZeroCost).toBe(true);

      const transport = new NostrSyncTransport({ allowInsecureLocalWsForTest: true });
      const probePaid = await transport.probeRelay({ relayUrl: paidUrl });
      expect(probePaid.state).toBe('error');
      expect(probePaid.paymentRequired).toBe(true);
      expect(probePaid.policyStatus).toBe('payment-required');
    } finally {
      await mockFree.stop();
      await mockPaid.stop();
    }
  });

  it('builds and verifies NIP-65 relay lists (kind 10002) and NIP-09 deletions (kind 5)', () => {
    const { secretKey: sk } = generateNostrKeypair();

    const nip65 = createNip65RelayListEvent({
      secretKey: sk,
      relays: [
        { url: 'wss://relay.damus.io', read: true, write: true },
        { url: 'wss://nos.lol', read: true, write: false },
      ],
    });
    expect(nip65.kind).toBe(10002);
    const parsedRelays = parseNip65RelayListEvent(nip65);
    expect(parsedRelays.valid).toBe(true);
    expect(parsedRelays.relays).toHaveLength(2);
    expect(parsedRelays.relays[1]).toEqual({ url: 'wss://nos.lol', read: true, write: false });

    const fakeEventId = 'a'.repeat(64);
    const nip09 = createNip09DeletionRequestEvent({
      secretKey: sk,
      eventIds: [fakeEventId],
      reason: 'Prune stale sync wrap',
    });
    expect(nip09.kind).toBe(5);
    const verifiedDel = verifyNip09DeletionRequest(nip09);
    expect(verifiedDel.valid).toBe(true);
    expect(verifiedDel.referencedEventIds).toEqual([fakeEventId]);
  });

  it('classifies relay runtime rejection reasons accurately', () => {
    expect(classifyRelayRejection('auth-required: sign NIP-42')).toBe('auth-required');
    expect(classifyRelayRejection('payment-required: 1000 sats invoice needed')).toBe(
      'payment-required',
    );
    expect(classifyRelayRejection('quota-exceeded: relay storage full')).toBe('quota-exceeded');
    expect(classifyRelayRejection('restricted: not on pubkey whitelist')).toBe('write-restricted');
    expect(classifyRelayRejection('unknown error')).toBe('other');
  });
});
