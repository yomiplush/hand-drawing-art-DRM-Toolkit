export type SyncHealthStatus =
  | 'disabled'
  | 'offline'
  | 'syncing'
  | 'synced-observable'
  | 'partial-relays'
  | 'error-unreachable';

export type RelayConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'auth-required'
  | 'disconnected'
  | 'error';

export type RelayPolicyStatus =
  | 'unknown'
  | 'free-usable'
  | 'payment-required'
  | 'write-restricted'
  | 'quota-exceeded'
  | 'pow-required'
  | 'unreachable';

export type GracefulFallbackReason =
  | 'none'
  | 'offline'
  | 'budget-limit'
  | 'payment-required'
  | 'quota-exceeded'
  | 'relays-unreachable';

export type SyncPriority = 0 | 1 | 2 | 3;

export const DEFAULT_ONLINE_SYNC_BUDGET_BYTES = 1_048_576; // 1 MiB soft rolling 30-day online sync budget
export const SYNC_BUDGET_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface RelayConfig {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
  label?: string;
  isDefaultPreset?: boolean;
  policyStatus?: RelayPolicyStatus;
  policyReason?: string;
  maxMessageBytes?: number;
  lastNip11CheckedAt?: string;
}

export interface RelayRuntimeStatus {
  url: string;
  state: RelayConnectionState;
  lastConnectedAt?: string;
  lastError?: string;
  consecutiveFailures: number;
  nextRetryAtMs: number;
  policyStatus?: RelayPolicyStatus;
  paymentRequired?: boolean;
  writeRestricted?: boolean;
  quotaExceeded?: boolean;
  maxMessageBytes?: number;
  bytesSent?: number;
  bytesReceived?: number;
}

/**
 * Optional public community Nostr relay presets.
 * - Never enabled or contacted until the user explicitly consents to Decentralized Sync.
 * - No uptime SLA, retention guarantee, or CHM authority is assumed.
 */
export const CURATED_DEFAULT_RELAY_PRESETS: readonly RelayConfig[] = [
  {
    url: 'wss://relay.damus.io',
    enabled: true,
    read: true,
    write: true,
    label: 'Damus Public Relay (Free community relay)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
  {
    url: 'wss://nos.lol',
    enabled: true,
    read: true,
    write: true,
    label: 'nos.lol Public Relay (Free community relay)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
  {
    url: 'wss://relay.nostr.band',
    enabled: false,
    read: true,
    write: true,
    label: 'nostr.band Public Relay (Optional backup)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
] as const;

export interface SyncSettings {
  id: 'default';
  enabled: boolean;
  consentAccepted: boolean;
  consentAcceptedAt?: string;
  autoSync: boolean;
  activeAuthorKeyId?: string;
  relays: RelayConfig[];
  autoRejectPaidRelays: boolean;
  onlineSyncBudgetBytes: number;
  syncWindowBytesUsed: number;
  syncWindowStartedAt?: string;
  syncVaultProofs: boolean;
  lastSyncAttemptAt?: string;
  lastSuccessfulSyncAt?: string;
}

export function createDefaultSyncSettings(): SyncSettings {
  return {
    id: 'default',
    enabled: false,
    consentAccepted: false,
    autoSync: true,
    relays: [],
    autoRejectPaidRelays: true,
    onlineSyncBudgetBytes: DEFAULT_ONLINE_SYNC_BUDGET_BYTES,
    syncWindowBytesUsed: 0,
    syncWindowStartedAt: new Date().toISOString(),
    syncVaultProofs: false,
  };
}

export interface SyncOutboundEnvelope {
  id: string;
  ownerFingerprintHex: string;
  recipientDeviceIdHex: string;
  recipientNostrPubkeyHex: string;
  opIdHex: string;
  nostrEventJson: string;
  priority?: SyncPriority;
  payloadBytes?: number;
}

export interface SyncOutboxRecord {
  id: string;
  ownerFingerprintHex: string;
  recipientDeviceIdHex: string;
  recipientNostrPubkeyHex: string;
  opIdHex: string;
  nostrEventJson: string;
  priority?: SyncPriority;
  payloadBytes?: number;
  createdAt: string;
  attempts: number;
  nextRetryAtMs: number;
  lastError?: string;
}

export type RelayRejectionCategory =
  | 'payment-required'
  | 'quota-exceeded'
  | 'write-restricted'
  | 'auth-required'
  | 'other';

export interface TransportPublishItemResult {
  envelopeId: string;
  relayUrl: string;
  accepted: boolean;
  message?: string;
  rejectionCategory?: RelayRejectionCategory;
}

export interface TransportPublishResult {
  attemptedRelays: number;
  succeededRelays: number;
  failedEnvelopeIds: string[];
  details: TransportPublishItemResult[];
  bytesSent?: number;
  paymentRejectedRelays?: string[];
  quotaRejectedRelays?: string[];
  writeRestrictedRelays?: string[];
}

export interface TransportFetchParams {
  recipientPubkeyHex: string;
  sinceUnix?: number;
  limit?: number;
  relays: RelayConfig[];
  localNostrSecretKey?: Uint8Array;
  signal?: AbortSignal;
}

export interface TransportFetchedEvent {
  relayUrl: string;
  rawEvent: unknown;
}

export interface TransportFetchResult {
  events: TransportFetchedEvent[];
  relayStatuses: RelayRuntimeStatus[];
  reachableRelayCount: number;
  totalEnabledRelayCount: number;
  bytesReceived?: number;
  paymentRejectedRelays?: string[];
}

export interface SyncTransport {
  readonly transportId: string;
  publishEnvelopes(params: {
    envelopes: SyncOutboundEnvelope[];
    relays: RelayConfig[];
    localNostrSecretKey?: Uint8Array;
    signal?: AbortSignal;
  }): Promise<TransportPublishResult>;
  fetchEnvelopesForRecipient(params: TransportFetchParams): Promise<TransportFetchResult>;
  probeRelay?(params: {
    relayUrl: string;
    localNostrSecretKey?: Uint8Array;
    timeoutMs?: number;
  }): Promise<RelayRuntimeStatus>;
}

export type SyncOpKind =
  | 'enroll-device'
  | 'revoke-device'
  | 'authorize-sync-device'
  | 'checkpoint';

export interface VerifiedPeerBinding {
  key: string; // `${ownerFingerprintHex}:${deviceIdHex}:${nostrPubkeyHex}`
  bindingIdHex: string;
  ownerFingerprintHex: string;
  ownerPublicKeyBase64Url: string;
  deviceIdHex: string;
  devicePublicKeyBase64Url: string;
  nostrPubkeyHex: string;
  npub: string;
  signerRole: 'owner' | 'paired-device';
  issuedAt: number;
  expiresAt: number;
  bindingCborBase64Url: string;
  updatedAt: string;
}

export interface SyncOpLogRecord {
  key: string; // `${ownerFingerprintHex}:${opHashHex}`
  ownerFingerprintHex: string;
  ownerPublicKeyBase64Url: string;
  opIdHex: string;
  opHashHex: string;
  prevOpHashHex: string;
  sequence: number;
  opKind: SyncOpKind;
  issuedAt: number;
  envelopeBase64Url: string;
  recordedAt: string;
}

export interface SyncStatusSummary {
  health: SyncHealthStatus;
  enabled: boolean;
  consentAccepted: boolean;
  queuedOutboxCount: number;
  knownOpCount: number;
  missingSequences: number[];
  hasCausalGap: boolean;
  reachableRelays: number;
  totalEnabledRelays: number;
  relayStatuses: RelayRuntimeStatus[];
  onlineSyncBudgetBytes: number;
  syncWindowBytesUsed: number;
  budgetPaused: boolean;
  paidRelaysRejectedCount: number;
  gracefulFallbackReason: GracefulFallbackReason;
  lastSyncAttemptAt?: string;
  lastSuccessfulSyncAt?: string;
  lastError?: string;
}
