export interface Nip11Limitations {
  maxMessageLength?: number;
  maxSubscriptions?: number;
  maxLimit?: number;
  maxSubidLength?: number;
  maxEventTags?: number;
  maxContentLength?: number;
  minPowDifficulty?: number;
  authRequired?: boolean;
  paymentRequired?: boolean;
  restrictedWrites?: boolean;
  createdAtLowerLimit?: number;
  createdAtUpperLimit?: number;
  defaultLimit?: number;
}

export interface Nip11RelayInfo {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supportedNips: number[];
  software?: string;
  version?: string;
  termsOfService?: string;
  paymentsUrl?: string;
  hasFeesObject: boolean;
  limitation: Nip11Limitations;
  checkedAt: string;
}

export type RelayZeroCostPolicyDecision =
  | 'free-usable'
  | 'payment-required'
  | 'write-restricted'
  | 'pow-required'
  | 'unsupported-nips';

export interface RelayFreePolicyEvaluation {
  usableForZeroCost: boolean;
  decision: RelayZeroCostPolicyDecision;
  paymentRequired: boolean;
  writeRestricted: boolean;
  maxMessageBytes?: number;
  reason?: string;
}

export const DEFAULT_NIP11_TIMEOUT_MS = 4500;
export const MAX_NIP11_RESPONSE_BYTES = 65_536; // 64 KiB cap

export function relayUrlToNip11HttpUrl(
  relayUrl: string,
  options?: { allowInsecureLocalWsForTest?: boolean },
): string {
  const trimmed = relayUrl.trim();
  const parsed = new URL(trimmed);
  if (parsed.username || parsed.password) {
    throw new Error('Relay URL must not include embedded credentials');
  }
  const proto = parsed.protocol.toLowerCase();
  const isLoopback =
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '[::1]';

  let httpProto: string;
  if (proto === 'wss:') {
    httpProto = 'https:';
  } else if (proto === 'ws:' && options?.allowInsecureLocalWsForTest && isLoopback) {
    httpProto = 'http:';
  } else {
    throw new Error('Only wss:// relays can be queried over HTTPS for NIP-11 metadata');
  }

  const host = parsed.hostname.toLowerCase();
  const port = parsed.port ? `:${parsed.port}` : '';
  const path = parsed.pathname || '/';
  return `${httpProto}//${host}${port}${path}${parsed.search}`;
}

function asPositiveInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && Number.isSafeInteger(v)
    ? v
    : undefined;
}

function asSafeString(v: unknown, maxLen = 512): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
}

function hasNonZeroFeeSchedule(rawFees: unknown): boolean {
  if (!rawFees || typeof rawFees !== 'object' || Array.isArray(rawFees)) return false;
  const fees = rawFees as Record<string, unknown>;
  for (const bucket of ['admission', 'subscription', 'publication']) {
    const arr = fees[bucket];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && typeof item === 'object' && 'amount' in item) {
        const amt = (item as { amount?: unknown }).amount;
        if (typeof amt === 'number' && amt > 0) return true;
      }
    }
  }
  return false;
}

export function parseNip11RelayInfoDocument(rawJson: unknown): Nip11RelayInfo {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    throw new Error('NIP-11 document must be a JSON object');
  }
  const obj = rawJson as Record<string, unknown>;
  const rawLim =
    obj.limitation && typeof obj.limitation === 'object' && !Array.isArray(obj.limitation)
      ? (obj.limitation as Record<string, unknown>)
      : {};

  const supportedNips = Array.isArray(obj.supported_nips)
    ? Array.from(
        new Set(
          obj.supported_nips.filter(
            (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0,
          ),
        ),
      ).sort((a, b) => a - b)
    : [];

  return {
    name: asSafeString(obj.name, 80),
    description: asSafeString(obj.description, 512),
    pubkey: asSafeString(obj.pubkey, 64),
    contact: asSafeString(obj.contact, 160),
    supportedNips,
    software: asSafeString(obj.software, 200),
    version: asSafeString(obj.version, 64),
    termsOfService: asSafeString(obj.terms_of_service, 300),
    paymentsUrl: asSafeString(obj.payments_url, 300),
    hasFeesObject: hasNonZeroFeeSchedule(obj.fees),
    limitation: {
      maxMessageLength: asPositiveInt(rawLim.max_message_length),
      maxSubscriptions: asPositiveInt(rawLim.max_subscriptions),
      maxLimit: asPositiveInt(rawLim.max_limit),
      maxSubidLength: asPositiveInt(rawLim.max_subid_length),
      maxEventTags: asPositiveInt(rawLim.max_event_tags),
      maxContentLength: asPositiveInt(rawLim.max_content_length),
      minPowDifficulty: asPositiveInt(rawLim.min_pow_difficulty),
      authRequired: rawLim.auth_required === true,
      paymentRequired: rawLim.payment_required === true,
      restrictedWrites: rawLim.restricted_writes === true,
      createdAtLowerLimit: asPositiveInt(rawLim.created_at_lower_limit),
      createdAtUpperLimit: asPositiveInt(rawLim.created_at_upper_limit),
      defaultLimit: asPositiveInt(rawLim.default_limit),
    },
    checkedAt: new Date().toISOString(),
  };
}

export function evaluateNip11FreeRelayPolicy(info: Nip11RelayInfo): RelayFreePolicyEvaluation {
  const maxMessageBytes = info.limitation.maxMessageLength;

  if (info.limitation.paymentRequired || info.hasFeesObject || Boolean(info.paymentsUrl)) {
    return {
      usableForZeroCost: false,
      decision: 'payment-required',
      paymentRequired: true,
      writeRestricted: Boolean(info.limitation.restrictedWrites),
      maxMessageBytes,
      reason: 'Relay advertises required payment, admission fees, or paid subscription terms.',
    };
  }

  if (info.limitation.restrictedWrites) {
    return {
      usableForZeroCost: false,
      decision: 'write-restricted',
      paymentRequired: false,
      writeRestricted: true,
      maxMessageBytes,
      reason: 'Relay advertises restricted_writes policy (whitelist or special admission required).',
    };
  }

  if ((info.limitation.minPowDifficulty ?? 0) > 16) {
    return {
      usableForZeroCost: false,
      decision: 'pow-required',
      paymentRequired: false,
      writeRestricted: false,
      maxMessageBytes,
      reason: `Relay requires high NIP-13 PoW difficulty (${info.limitation.minPowDifficulty}).`,
    };
  }

  return {
    usableForZeroCost: true,
    decision: 'free-usable',
    paymentRequired: false,
    writeRestricted: false,
    maxMessageBytes,
  };
}

export type Nip11FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export async function fetchNip11RelayInfo(params: {
  relayUrl: string;
  timeoutMs?: number;
  allowInsecureLocalWsForTest?: boolean;
  fetchImpl?: Nip11FetchLike;
}): Promise<Nip11RelayInfo> {
  const httpUrl = relayUrlToNip11HttpUrl(params.relayUrl, {
    allowInsecureLocalWsForTest: params.allowInsecureLocalWsForTest,
  });

  const fetchFn =
    params.fetchImpl ??
    (typeof globalThis.fetch === 'function' ? (globalThis.fetch.bind(globalThis) as Nip11FetchLike) : null);
  if (!fetchFn) {
    throw new Error('Fetch API is unavailable in this environment');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? DEFAULT_NIP11_TIMEOUT_MS,
  );

  try {
    const res = await fetchFn(httpUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/nostr+json',
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`NIP-11 HTTP ${res.status}`);
    }
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > MAX_NIP11_RESPONSE_BYTES) {
      throw new Error(`NIP-11 document exceeds ${MAX_NIP11_RESPONSE_BYTES} byte limit`);
    }
    const parsed = JSON.parse(text) as unknown;
    return parseNip11RelayInfoDocument(parsed);
  } finally {
    clearTimeout(timeout);
  }
}
