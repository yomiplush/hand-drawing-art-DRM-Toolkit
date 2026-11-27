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

/**
 * 256 KiB rolling 30-day soft budget sized for compact device registration,
 * binding, checkpoint, and revocation messages only.
 * Priority 0 revocations and critical Priority 1 device auth ops are never
 * blocked by this soft cap.
 */
export const DEFAULT_ONLINE_SYNC_BUDGET_BYTES = 262_144;
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
 * Default global public community Nostr relay presets used strictly for multi-device
 * authentication, binding, and revocation messages (CHM-SYNC-v1 / NIP-59 kind: 1059).
 * - Never enabled or contacted until the user explicitly consents to Device Auth Sync.
 * - Artwork details, proofs, profiles, SNS links, and policy presets are never sent here.
 * - Selected for global availability (no geo-blocks) and high NIP-59 uptime.
 */
export const CURATED_DEFAULT_RELAY_PRESETS: readonly RelayConfig[] = [
  {
    url: 'wss://relay.damus.io',
    enabled: true,
    read: true,
    write: true,
    label: 'Damus Public Relay (Global)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
  {
    url: 'wss://nos.lol',
    enabled: true,
    read: true,
    write: true,
    label: 'nos.lol Public Relay (Global)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
  {
    url: 'wss://relay.primal.net',
    enabled: true,
    read: true,
    write: true,
    label: 'Primal Public Relay (Global)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
  {
    url: 'wss://relay.snort.social',
    enabled: true,
    read: true,
    write: true,
    label: 'Snort Public Relay (Global)',
    isDefaultPreset: true,
    policyStatus: 'unknown',
  },
] as const;

export interface OptionalRelayPreset extends RelayConfig {
  /** Whether writing to this relay is restricted to Japan IP addresses (may fail via VPN/overseas IP). */
  jpIpRestricted?: boolean;
  /** Short regional note for UI display. */
  regionNoteJa: string;
  regionNoteEn: string;
}

/**
 * Optional Japan-region public Nostr relay presets for manual one-click addition.
 * NOT included in default relays to avoid geo-block write failures for global/VPN users.
 */
export const OPTIONAL_JAPAN_RELAY_PRESETS: readonly OptionalRelayPreset[] = [
  {
    url: 'wss://relay.nostr.wirednet.jp',
    enabled: true,
    read: true,
    write: true,
    label: 'wirednet.jp (Global IP OK)',
    isDefaultPreset: false,
    policyStatus: 'unknown',
    jpIpRestricted: false,
    regionNoteJa: 'IP制限なし',
    regionNoteEn: 'No IP restriction',
  },
  {
    url: 'wss://yabu.me',
    enabled: true,
    read: true,
    write: true,
    label: 'yabu.me (JP write / Global read)',
    isDefaultPreset: false,
    policyStatus: 'unknown',
    jpIpRestricted: true,
    regionNoteJa: '書き込みは日本IP限定・読み取りはグローバル可',
    regionNoteEn: 'Write: Japan IP only · Read: Global',
  },
  {
    url: 'wss://relay-jp.nostr.wirednet.jp',
    enabled: true,
    read: true,
    write: true,
    label: 'relay-jp.wirednet.jp (JP IP only)',
    isDefaultPreset: false,
    policyStatus: 'unknown',
    jpIpRestricted: true,
    regionNoteJa: '日本IP限定',
    regionNoteEn: 'Japan IP only',
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
  /** @deprecated Vault proof sync over Nostr is permanently disabled; kept only for schema migration. */
  syncVaultProofs: boolean;
  migratedAuthOnlyAt?: string;
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
