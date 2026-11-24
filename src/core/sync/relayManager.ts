import {
  evaluateNip11FreeRelayPolicy,
  fetchNip11RelayInfo,
  type Nip11FetchLike,
  type Nip11RelayInfo,
  type RelayFreePolicyEvaluation,
} from '../nostr/nip11';
import { createNip42AuthEvent } from '../nostr/nip42';
import { NIP59_KIND_EPHEMERAL_GIFT_WRAP, NIP59_KIND_GIFT_WRAP } from '../nostr/nip59';
import type {
  RelayConfig,
  RelayPolicyStatus,
  RelayRejectionCategory,
  RelayRuntimeStatus,
  SyncOutboundEnvelope,
  SyncTransport,
  TransportFetchParams,
  TransportFetchResult,
  TransportFetchedEvent,
  TransportPublishItemResult,
  TransportPublishResult,
} from './types';

export const DEFAULT_RELAY_CONNECT_TIMEOUT_MS = 5000;
export const DEFAULT_RELAY_REQUEST_TIMEOUT_MS = 6000;
export const DEFAULT_RELAY_PUBLISH_TIMEOUT_MS = 5000;
export const MAX_RELAY_FRAME_BYTES = 131_072; // 128 KiB per incoming WebSocket frame
export const MAX_FETCH_LIMIT = 200;
export const MAX_RECONNECT_BACKOFF_MS = 5 * 60 * 1000;
export const PAID_RELAY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const NIP11_CACHE_TTL_MS = 15 * 60 * 1000;

const utf8Encoder = new TextEncoder();

export function measureUtf8Bytes(text: string): number {
  return utf8Encoder.encode(text).byteLength;
}

export function classifyRelayRejection(reason: string): RelayRejectionCategory {
  const lower = reason.trim().toLowerCase();
  if (!lower) return 'other';
  if (lower.startsWith('auth-required:')) return 'auth-required';
  if (
    lower.includes('payment') ||
    lower.includes('paid') ||
    lower.includes('paywall') ||
    lower.includes('invoice') ||
    lower.includes('subscription') ||
    lower.includes('admission') ||
    lower.includes('sats')
  ) {
    return 'payment-required';
  }
  if (
    lower.includes('quota') ||
    lower.includes('storage') ||
    lower.includes('too large') ||
    lower.includes('max_message_length') ||
    lower.includes('rate-limit') ||
    lower.includes('rate limit')
  ) {
    return 'quota-exceeded';
  }
  if (
    lower.startsWith('restricted:') ||
    lower.includes('whitelist') ||
    lower.includes('pow') ||
    lower.includes('blocked')
  ) {
    return 'write-restricted';
  }
  return 'other';
}

export function validateRelayUrl(
  rawUrl: string,
  options?: { allowInsecureLocalWsForTest?: boolean },
): string {
  if (typeof rawUrl !== 'string') {
    throw new Error('Relay URL must be a string');
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 512) {
    throw new Error('Relay URL must be between 1 and 512 characters');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid relay URL format');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Relay URL must not include embedded credentials');
  }
  const proto = parsed.protocol.toLowerCase();
  const isLoopback =
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '[::1]';

  if (proto === 'wss:') {
    // Allowed
  } else if (proto === 'ws:' && options?.allowInsecureLocalWsForTest && isLoopback) {
    // Strictly restricted to explicit local test harness only
  } else {
    throw new Error('Only encrypted wss:// relay URLs are permitted');
  }

  if (!parsed.hostname) {
    throw new Error('Relay URL is missing a hostname');
  }

  const host = parsed.hostname.toLowerCase();
  const port = parsed.port ? `:${parsed.port}` : '';
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  const search = parsed.search || '';
  return `${proto}//${host}${port}${path}${search}`;
}

export function computeBackoffMs(consecutiveFailures: number, baseMs = 1500): number {
  const exp = Math.min(8, Math.max(0, consecutiveFailures - 1));
  const raw = Math.min(MAX_RECONNECT_BACKOFF_MS, baseMs * 2 ** exp);
  const jitter = Math.floor(raw * 0.2 * Math.random());
  return Math.min(MAX_RECONNECT_BACKOFF_MS, raw + jitter);
}

function generateSubId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  }
  return `chm-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const defaultWebSocketFactory: WebSocketFactory = (url) => {
  if (typeof globalThis.WebSocket !== 'function') {
    throw new Error('WebSocket API is unavailable in this environment');
  }
  return new globalThis.WebSocket(url) as unknown as WebSocketLike;
};

export interface NostrSyncTransportOptions {
  webSocketFactory?: WebSocketFactory;
  fetchImpl?: Nip11FetchLike;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  publishTimeoutMs?: number;
  allowInsecureLocalWsForTest?: boolean;
}

interface Nip11CacheEntry {
  fetchedAtMs: number;
  info: Nip11RelayInfo;
  policy: RelayFreePolicyEvaluation;
}

export class NostrSyncTransport implements SyncTransport {
  readonly transportId = 'nostr-nip59-v1';
  private readonly wsFactory: WebSocketFactory;
  private readonly fetchImpl?: Nip11FetchLike;
  private readonly connectTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly publishTimeoutMs: number;
  private readonly allowInsecureLocalWsForTest: boolean;
  private readonly statusMap = new Map<string, RelayRuntimeStatus>();
  private readonly nip11Cache = new Map<string, Nip11CacheEntry>();

  constructor(options?: NostrSyncTransportOptions) {
    this.wsFactory = options?.webSocketFactory ?? defaultWebSocketFactory;
    this.fetchImpl = options?.fetchImpl;
    this.connectTimeoutMs = options?.connectTimeoutMs ?? DEFAULT_RELAY_CONNECT_TIMEOUT_MS;
    this.requestTimeoutMs = options?.requestTimeoutMs ?? DEFAULT_RELAY_REQUEST_TIMEOUT_MS;
    this.publishTimeoutMs = options?.publishTimeoutMs ?? DEFAULT_RELAY_PUBLISH_TIMEOUT_MS;
    this.allowInsecureLocalWsForTest = Boolean(options?.allowInsecureLocalWsForTest);
  }

  getRelayStatuses(): RelayRuntimeStatus[] {
    return Array.from(this.statusMap.values());
  }

  private getOrInitStatus(url: string): RelayRuntimeStatus {
    const existing = this.statusMap.get(url);
    if (existing) return existing;
    const init: RelayRuntimeStatus = {
      url,
      state: 'idle',
      consecutiveFailures: 0,
      nextRetryAtMs: 0,
      policyStatus: 'unknown',
      bytesSent: 0,
      bytesReceived: 0,
    };
    this.statusMap.set(url, init);
    return init;
  }

  private markSuccess(
    url: string,
    delta?: { bytesSent?: number; bytesReceived?: number },
  ): RelayRuntimeStatus {
    const prev = this.getOrInitStatus(url);
    const status: RelayRuntimeStatus = {
      ...prev,
      url,
      state: 'connected',
      lastConnectedAt: new Date().toISOString(),
      consecutiveFailures: 0,
      nextRetryAtMs: 0,
      bytesSent: (prev.bytesSent ?? 0) + (delta?.bytesSent ?? 0),
      bytesReceived: (prev.bytesReceived ?? 0) + (delta?.bytesReceived ?? 0),
    };
    this.statusMap.set(url, status);
    return status;
  }

  private markFailure(
    url: string,
    errorMessage: string,
    policyOverride?: {
      policyStatus?: RelayPolicyStatus;
      paymentRequired?: boolean;
      writeRestricted?: boolean;
      quotaExceeded?: boolean;
      cooldownMs?: number;
    },
  ): RelayRuntimeStatus {
    const prev = this.getOrInitStatus(url);
    const failures = prev.consecutiveFailures + 1;
    const backoff = policyOverride?.cooldownMs ?? computeBackoffMs(failures);
    const status: RelayRuntimeStatus = {
      ...prev,
      state: 'error',
      lastError: errorMessage,
      consecutiveFailures: failures,
      nextRetryAtMs: Date.now() + backoff,
      policyStatus: policyOverride?.policyStatus ?? prev.policyStatus ?? 'unreachable',
      paymentRequired: policyOverride?.paymentRequired ?? prev.paymentRequired,
      writeRestricted: policyOverride?.writeRestricted ?? prev.writeRestricted,
      quotaExceeded: policyOverride?.quotaExceeded ?? prev.quotaExceeded,
    };
    this.statusMap.set(url, status);
    return status;
  }

  private parseMessageFrame(rawData: unknown): unknown[] | null {
    if (typeof rawData !== 'string') return null;
    if (rawData.length > MAX_RELAY_FRAME_BYTES) return null;
    try {
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed) || parsed.length < 2) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async openRelayConnection(
    relayUrl: string,
    signal?: AbortSignal,
  ): Promise<{ ws: WebSocketLike; consumeEarlyMessages: () => unknown[] }> {
    const validUrl = validateRelayUrl(relayUrl, {
      allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
    });

    if (signal?.aborted) {
      throw new Error('Sync operation aborted');
    }

    return new Promise<{ ws: WebSocketLike; consumeEarlyMessages: () => unknown[] }>(
      (resolve, reject) => {
        let settled = false;
        let ws: WebSocketLike;
        try {
          ws = this.wsFactory(validUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to open relay WebSocket'));
          return;
        }

        const earlyQueue: unknown[] = [];
        let earlyActive = true;
        const onEarlyMsg = (evt: unknown) => {
          if (earlyActive) {
            earlyQueue.push((evt as { data?: unknown })?.data);
          }
        };
        ws.addEventListener('message', onEarlyMsg);

        const consumeEarlyMessages = () => {
          earlyActive = false;
          ws.removeEventListener('message', onEarlyMsg);
          return earlyQueue.splice(0, earlyQueue.length);
        };

        const cleanupEarly = () => {
          earlyActive = false;
          ws.removeEventListener('message', onEarlyMsg);
        };

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanupEarly();
            try {
              ws.close();
            } catch {
              // ignore
            }
            reject(new Error(`Connection timed out (${this.connectTimeoutMs}ms)`));
          }
        }, this.connectTimeoutMs);

        const onAbort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            cleanupEarly();
            try {
              ws.close();
            } catch {
              // ignore
            }
            reject(new Error('Sync connection aborted'));
          }
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        const onOpen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          ws.removeEventListener('open', onOpen);
          ws.removeEventListener('error', onError);
          ws.removeEventListener('close', onClose);
          resolve({ ws, consumeEarlyMessages });
        };

        const onError = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanupEarly();
          signal?.removeEventListener('abort', onAbort);
          reject(new Error(`WebSocket connection failed to ${validUrl}`));
        };

        const onClose = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanupEarly();
          signal?.removeEventListener('abort', onAbort);
          reject(new Error(`WebSocket closed before opening (${validUrl})`));
        };

        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', onClose);
      },
    );
  }

  async inspectNip11Policy(params: {
    relayUrl: string;
    forceRefresh?: boolean;
    timeoutMs?: number;
  }): Promise<{ info?: Nip11RelayInfo; policy?: RelayFreePolicyEvaluation; error?: string }> {
    const normalized = validateRelayUrl(params.relayUrl, {
      allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
    });
    const cached = this.nip11Cache.get(normalized);
    if (
      cached &&
      !params.forceRefresh &&
      Date.now() - cached.fetchedAtMs < NIP11_CACHE_TTL_MS
    ) {
      return { info: cached.info, policy: cached.policy };
    }

    try {
      const info = await fetchNip11RelayInfo({
        relayUrl: normalized,
        timeoutMs: params.timeoutMs,
        allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
        fetchImpl: this.fetchImpl,
      });
      const policy = evaluateNip11FreeRelayPolicy(info);
      this.nip11Cache.set(normalized, {
        fetchedAtMs: Date.now(),
        info,
        policy,
      });

      const prev = this.getOrInitStatus(normalized);
      this.statusMap.set(normalized, {
        ...prev,
        policyStatus: policy.decision === 'unsupported-nips' ? 'unknown' : policy.decision,
        paymentRequired: policy.paymentRequired,
        writeRestricted: policy.writeRestricted,
        maxMessageBytes: policy.maxMessageBytes,
        lastError: policy.reason ?? prev.lastError,
      });
      return { info, policy };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'NIP-11 metadata unavailable',
      };
    }
  }

  async probeRelay(params: {
    relayUrl: string;
    localNostrSecretKey?: Uint8Array;
    timeoutMs?: number;
  }): Promise<RelayRuntimeStatus> {
    const normalized = validateRelayUrl(params.relayUrl, {
      allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
    });

    const nip11 = await this.inspectNip11Policy({
      relayUrl: normalized,
      forceRefresh: true,
      timeoutMs: params.timeoutMs,
    });
    if (nip11.policy && nip11.policy.paymentRequired) {
      return this.markFailure(normalized, nip11.policy.reason ?? 'Payment required', {
        policyStatus: 'payment-required',
        paymentRequired: true,
        writeRestricted: nip11.policy.writeRestricted,
        cooldownMs: PAID_RELAY_COOLDOWN_MS,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? this.connectTimeoutMs,
    );
    let ws: WebSocketLike | undefined;
    try {
      const opened = await this.openRelayConnection(normalized, controller.signal);
      ws = opened.ws;
      opened.consumeEarlyMessages();
      const updated = this.markSuccess(normalized);
      if (nip11.policy) {
        const enriched: RelayRuntimeStatus = {
          ...updated,
          policyStatus: nip11.policy.decision === 'unsupported-nips' ? 'unknown' : nip11.policy.decision,
          writeRestricted: nip11.policy.writeRestricted,
          maxMessageBytes: nip11.policy.maxMessageBytes,
        };
        this.statusMap.set(normalized, enriched);
        return enriched;
      }
      return updated;
    } catch (err) {
      return this.markFailure(
        normalized,
        err instanceof Error ? err.message : 'Relay unreachable',
      );
    } finally {
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    }
  }

  async publishEnvelopes(params: {
    envelopes: SyncOutboundEnvelope[];
    relays: RelayConfig[];
    localNostrSecretKey?: Uint8Array;
    signal?: AbortSignal;
  }): Promise<TransportPublishResult> {
    if (params.envelopes.length === 0) {
      return {
        attemptedRelays: 0,
        succeededRelays: 0,
        failedEnvelopeIds: [],
        details: [],
        bytesSent: 0,
      };
    }

    const writeRelays = params.relays.filter(
      (r) => r.enabled && r.write && r.policyStatus !== 'payment-required',
    );
    const parsedEnvelopes = params.envelopes.map((env) => {
      const parsed = JSON.parse(env.nostrEventJson) as { id?: string };
      return {
        envelope: env,
        eventObj: parsed,
        eventId: typeof parsed.id === 'string' ? parsed.id : env.id,
        frameJson: JSON.stringify(['EVENT', parsed]),
      };
    });

    const details: TransportPublishItemResult[] = [];
    const ackedByEnvelopeId = new Set<string>();
    const paymentRejectedRelays = new Set<string>();
    const quotaRejectedRelays = new Set<string>();
    const writeRestrictedRelays = new Set<string>();
    let succeededRelays = 0;
    let totalBytesSent = 0;

    await Promise.allSettled(
      writeRelays.map(async (relay) => {
        let validUrl: string;
        try {
          validUrl = validateRelayUrl(relay.url, {
            allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
          });
        } catch (err) {
          this.markFailure(relay.url, err instanceof Error ? err.message : 'Invalid relay URL');
          return;
        }

        const runtimePrev = this.statusMap.get(validUrl);
        if (runtimePrev?.paymentRequired) {
          paymentRejectedRelays.add(validUrl);
          return;
        }

        const effectiveMaxFrameBytes = Math.min(
          MAX_RELAY_FRAME_BYTES,
          relay.maxMessageBytes ?? runtimePrev?.maxMessageBytes ?? MAX_RELAY_FRAME_BYTES,
        );

        const eligibleForRelay = parsedEnvelopes.filter((item) => {
          const byteLen = measureUtf8Bytes(item.frameJson);
          if (byteLen > effectiveMaxFrameBytes) {
            details.push({
              envelopeId: item.envelope.id,
              relayUrl: validUrl,
              accepted: false,
              message: `Payload (${byteLen} bytes) exceeds relay max frame limit (${effectiveMaxFrameBytes} bytes)`,
              rejectionCategory: 'quota-exceeded',
            });
            return false;
          }
          return true;
        });

        if (eligibleForRelay.length === 0) {
          quotaRejectedRelays.add(validUrl);
          return;
        }

        let ws: WebSocketLike | undefined;
        try {
          const opened = await this.openRelayConnection(validUrl, params.signal);
          ws = opened.ws;
          let relayBytesSent = 0;

          const relayAcked = await new Promise<Set<string>>((resolve) => {
            const pending = new Map<string, string>(
              eligibleForRelay.map((p) => [p.eventId, p.envelope.id]),
            );
            const acceptedIds = new Set<string>();
            const retriedAfterAuth = new Set<string>();
            let authedOnce = false;
            let pendingAuthEventId: string | null = null;
            let authConfirmed = false;

            const finish = () => {
              clearTimeout(timer);
              ws?.removeEventListener('message', onMessage);
              ws?.removeEventListener('close', onClose);
              ws?.removeEventListener('error', onClose);
              resolve(acceptedIds);
            };

            const timer = setTimeout(finish, this.publishTimeoutMs);

            const sendFrame = (frame: string) => {
              relayBytesSent += measureUtf8Bytes(frame);
              ws?.send(frame);
            };

            const sendAllPending = () => {
              for (const item of eligibleForRelay) {
                if (pending.has(item.eventId)) {
                  sendFrame(item.frameJson);
                }
              }
            };

            const onClose = () => finish();

            const onMessage = (evt: unknown) => {
              const data = (evt as { data?: unknown })?.data;
              const msg = this.parseMessageFrame(data);
              if (!msg) return;

              if (msg[0] === 'AUTH' && typeof msg[1] === 'string' && !authedOnce) {
                if (params.localNostrSecretKey) {
                  authedOnce = true;
                  const authEv = createNip42AuthEvent({
                    relayUrl: validUrl,
                    challenge: msg[1],
                    secretKey: params.localNostrSecretKey,
                  });
                  pendingAuthEventId = authEv.id;
                  sendFrame(JSON.stringify(['AUTH', authEv]));
                }
                return;
              }

              if (msg[0] === 'OK' && typeof msg[1] === 'string' && typeof msg[2] === 'boolean') {
                const evId = msg[1];
                const ok = msg[2];
                const reason = typeof msg[3] === 'string' ? msg[3] : '';

                if (pendingAuthEventId && evId === pendingAuthEventId) {
                  pendingAuthEventId = null;
                  if (ok) {
                    authConfirmed = true;
                    sendAllPending();
                  } else {
                    const cat = classifyRelayRejection(reason);
                    if (cat === 'payment-required') {
                      paymentRejectedRelays.add(validUrl);
                      this.markFailure(validUrl, reason || 'Payment required', {
                        policyStatus: 'payment-required',
                        paymentRequired: true,
                        cooldownMs: PAID_RELAY_COOLDOWN_MS,
                      });
                    }
                    finish();
                  }
                  return;
                }

                const envelopeId = pending.get(evId);
                if (!envelopeId) return;

                if (
                  !ok &&
                  reason.startsWith('auth-required:') &&
                  params.localNostrSecretKey &&
                  !authConfirmed &&
                  !retriedAfterAuth.has(evId)
                ) {
                  retriedAfterAuth.add(evId);
                  return;
                }

                const rejectionCategory = ok ? undefined : classifyRelayRejection(reason);
                if (!ok) {
                  if (rejectionCategory === 'payment-required') {
                    paymentRejectedRelays.add(validUrl);
                    this.markFailure(validUrl, reason || 'Payment required', {
                      policyStatus: 'payment-required',
                      paymentRequired: true,
                      cooldownMs: PAID_RELAY_COOLDOWN_MS,
                    });
                  } else if (rejectionCategory === 'quota-exceeded') {
                    quotaRejectedRelays.add(validUrl);
                    this.markFailure(validUrl, reason || 'Relay quota or size limit exceeded', {
                      policyStatus: 'quota-exceeded',
                      quotaExceeded: true,
                    });
                  } else if (rejectionCategory === 'write-restricted') {
                    writeRestrictedRelays.add(validUrl);
                    this.markFailure(validUrl, reason || 'Relay writes restricted', {
                      policyStatus: 'write-restricted',
                      writeRestricted: true,
                    });
                  }
                }

                pending.delete(evId);
                details.push({
                  envelopeId,
                  relayUrl: validUrl,
                  accepted: ok,
                  message: reason || undefined,
                  rejectionCategory,
                });
                if (ok) {
                  acceptedIds.add(envelopeId);
                }
                if (pending.size === 0 || rejectionCategory === 'payment-required') {
                  finish();
                }
              }
            };

            ws?.addEventListener('message', onMessage);
            ws?.addEventListener('close', onClose);
            ws?.addEventListener('error', onClose);

            for (const data of opened.consumeEarlyMessages()) {
              onMessage({ data });
            }

            if (!pendingAuthEventId) {
              sendAllPending();
            }
          });

          totalBytesSent += relayBytesSent;
          if (!paymentRejectedRelays.has(validUrl) && !quotaRejectedRelays.has(validUrl)) {
            this.markSuccess(validUrl, { bytesSent: relayBytesSent });
          }

          if (relayAcked.size > 0) {
            succeededRelays++;
            for (const id of relayAcked) {
              ackedByEnvelopeId.add(id);
            }
          }
        } catch (err) {
          this.markFailure(validUrl, err instanceof Error ? err.message : 'Relay publish failed');
        } finally {
          try {
            ws?.close();
          } catch {
            // ignore
          }
        }
      }),
    );

    const failedEnvelopeIds = params.envelopes
      .filter((e) => !ackedByEnvelopeId.has(e.id))
      .map((e) => e.id);

    return {
      attemptedRelays: writeRelays.length,
      succeededRelays,
      failedEnvelopeIds,
      details,
      bytesSent: totalBytesSent,
      paymentRejectedRelays: Array.from(paymentRejectedRelays),
      quotaRejectedRelays: Array.from(quotaRejectedRelays),
      writeRestrictedRelays: Array.from(writeRestrictedRelays),
    };
  }

  async fetchEnvelopesForRecipient(params: TransportFetchParams): Promise<TransportFetchResult> {
    const readRelays = params.relays.filter(
      (r) => r.enabled && r.read && r.policyStatus !== 'payment-required',
    );
    const limit = Math.min(MAX_FETCH_LIMIT, Math.max(1, params.limit ?? 100));
    const seenIds = new Set<string>();
    const events: TransportFetchedEvent[] = [];
    const relayStatuses: RelayRuntimeStatus[] = [];
    const paymentRejectedRelays = new Set<string>();
    let reachableRelayCount = 0;
    let totalBytesReceived = 0;

    await Promise.allSettled(
      readRelays.map(async (relay) => {
        let validUrl: string;
        try {
          validUrl = validateRelayUrl(relay.url, {
            allowInsecureLocalWsForTest: this.allowInsecureLocalWsForTest,
          });
        } catch (err) {
          relayStatuses.push(
            this.markFailure(relay.url, err instanceof Error ? err.message : 'Invalid relay URL'),
          );
          return;
        }

        const prevStatus = this.statusMap.get(validUrl);
        if (prevStatus?.paymentRequired) {
          paymentRejectedRelays.add(validUrl);
          relayStatuses.push(prevStatus);
          return;
        }

        let ws: WebSocketLike | undefined;
        const subId = generateSubId();
        try {
          const opened = await this.openRelayConnection(validUrl, params.signal);
          ws = opened.ws;
          const relayEvents: unknown[] = [];
          let relayBytesReceived = 0;
          let receivedEose = false;
          let authRejected = false;
          let closeReason = '';
          let authedOnce = false;
          let pendingAuthEventId: string | null = null;
          let authConfirmed = false;
          let retriedReqAfterAuth = false;

          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(timer);
              ws?.removeEventListener('message', onMessage);
              ws?.removeEventListener('close', onClose);
              ws?.removeEventListener('error', onClose);
              resolve();
            };

            const timer = setTimeout(finish, this.requestTimeoutMs);

            const sendReq = () => {
              const filter: Record<string, unknown> = {
                kinds: [NIP59_KIND_GIFT_WRAP, NIP59_KIND_EPHEMERAL_GIFT_WRAP],
                '#p': [params.recipientPubkeyHex],
                limit,
              };
              if (typeof params.sinceUnix === 'number' && params.sinceUnix > 0) {
                filter.since = params.sinceUnix;
              }
              ws?.send(JSON.stringify(['REQ', subId, filter]));
            };

            const onClose = () => finish();

            const onMessage = (evt: unknown) => {
              const data = (evt as { data?: unknown })?.data;
              if (typeof data === 'string') {
                relayBytesReceived += measureUtf8Bytes(data);
              }
              const msg = this.parseMessageFrame(data);
              if (!msg) return;

              if (msg[0] === 'AUTH' && typeof msg[1] === 'string' && !authedOnce) {
                if (params.localNostrSecretKey) {
                  authedOnce = true;
                  const authEv = createNip42AuthEvent({
                    relayUrl: validUrl,
                    challenge: msg[1],
                    secretKey: params.localNostrSecretKey,
                  });
                  pendingAuthEventId = authEv.id;
                  ws?.send(JSON.stringify(['AUTH', authEv]));
                }
                return;
              }

              if (msg[0] === 'OK' && typeof msg[1] === 'string' && typeof msg[2] === 'boolean') {
                if (pendingAuthEventId && msg[1] === pendingAuthEventId) {
                  pendingAuthEventId = null;
                  if (msg[2]) {
                    authConfirmed = true;
                    sendReq();
                  } else {
                    authRejected = true;
                    closeReason = typeof msg[3] === 'string' ? msg[3] : '';
                    finish();
                  }
                }
                return;
              }

              if (msg[0] === 'EVENT' && msg[1] === subId && msg[2] && typeof msg[2] === 'object') {
                if (relayEvents.length < MAX_FETCH_LIMIT) {
                  relayEvents.push(msg[2]);
                }
                return;
              }

              if (msg[0] === 'EOSE' && msg[1] === subId) {
                receivedEose = true;
                try {
                  ws?.send(JSON.stringify(['CLOSE', subId]));
                } catch {
                  // ignore
                }
                finish();
                return;
              }

              if (msg[0] === 'CLOSED' && msg[1] === subId) {
                const reason = typeof msg[2] === 'string' ? msg[2] : '';
                if (
                  reason.startsWith('auth-required:') &&
                  params.localNostrSecretKey &&
                  !authConfirmed &&
                  !retriedReqAfterAuth
                ) {
                  retriedReqAfterAuth = true;
                  return;
                }
                closeReason = reason;
                authRejected = true;
                finish();
              }
            };

            ws?.addEventListener('message', onMessage);
            ws?.addEventListener('close', onClose);
            ws?.addEventListener('error', onClose);

            for (const data of opened.consumeEarlyMessages()) {
              onMessage({ data });
            }

            if (!pendingAuthEventId) {
              sendReq();
            }
          });

          totalBytesReceived += relayBytesReceived;
          for (const rawEv of relayEvents) {
            const evId = (rawEv as { id?: unknown })?.id;
            if (typeof evId === 'string') {
              if (seenIds.has(evId)) continue;
              seenIds.add(evId);
            }
            events.push({ relayUrl: validUrl, rawEvent: rawEv });
          }

          if (receivedEose && !authRejected) {
            reachableRelayCount++;
            relayStatuses.push(this.markSuccess(validUrl, { bytesReceived: relayBytesReceived }));
          } else {
            const cat = classifyRelayRejection(closeReason);
            if (cat === 'payment-required') {
              paymentRejectedRelays.add(validUrl);
              relayStatuses.push(
                this.markFailure(validUrl, closeReason || 'Payment required', {
                  policyStatus: 'payment-required',
                  paymentRequired: true,
                  cooldownMs: PAID_RELAY_COOLDOWN_MS,
                }),
              );
            } else {
              relayStatuses.push(
                this.markFailure(
                  validUrl,
                  authRejected
                    ? closeReason || 'Relay closed subscription (auth required or rejected)'
                    : 'Relay did not return EOSE before timeout',
                ),
              );
            }
          }
        } catch (err) {
          relayStatuses.push(
            this.markFailure(validUrl, err instanceof Error ? err.message : 'Relay fetch failed'),
          );
        } finally {
          try {
            ws?.close();
          } catch {
            // ignore
          }
        }
      }),
    );

    return {
      events,
      relayStatuses,
      reachableRelayCount,
      totalEnabledRelayCount: readRelays.length,
      bytesReceived: totalBytesReceived,
      paymentRejectedRelays: Array.from(paymentRejectedRelays),
    };
  }
}
