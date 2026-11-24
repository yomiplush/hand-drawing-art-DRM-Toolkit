import {
  STORE_SYNC_OP_LOG,
  STORE_SYNC_OUTBOX,
  STORE_SYNC_PEER_BINDINGS,
  STORE_SYNC_SETTINGS,
  withChmStore,
} from '../storage/keyStore';
import { validateRelayUrl } from './relayManager';
import {
  DEFAULT_ONLINE_SYNC_BUDGET_BYTES,
  SYNC_BUDGET_WINDOW_MS,
  createDefaultSyncSettings,
  type RelayConfig,
  type RelayPolicyStatus,
  type SyncOpLogRecord,
  type SyncOutboxRecord,
  type SyncPriority,
  type SyncSettings,
  type VerifiedPeerBinding,
} from './types';

let allowLocalWsRelayForTests = false;

/**
 * Test-only hook allowing loopback ws://127.0.0.1 relay URLs to persist in
 * syncSettings during automated integration tests against MockNostrRelay.
 * Production builds always enforce encrypted wss:// URLs.
 */
export function setAllowLocalWsRelayForTests(enabled: boolean): void {
  allowLocalWsRelayForTests = enabled;
}

export function isAllowLocalWsRelayForTests(): boolean {
  return allowLocalWsRelayForTests;
}

const VALID_POLICY_STATUSES = new Set<RelayPolicyStatus>([
  'unknown',
  'free-usable',
  'payment-required',
  'write-restricted',
  'quota-exceeded',
  'pow-required',
  'unreachable',
]);

function sanitizeRelays(rawRelays: unknown): RelayConfig[] {
  if (!Array.isArray(rawRelays)) return [];
  const dedup = new Map<string, RelayConfig>();
  for (const r of rawRelays) {
    if (!r || typeof r !== 'object') continue;
    const item = r as Partial<RelayConfig>;
    if (typeof item.url !== 'string') continue;
    try {
      const normalized = validateRelayUrl(item.url, {
        allowInsecureLocalWsForTest: allowLocalWsRelayForTests,
      });
      const policyStatus =
        typeof item.policyStatus === 'string' && VALID_POLICY_STATUSES.has(item.policyStatus)
          ? item.policyStatus
          : undefined;
      dedup.set(normalized, {
        url: normalized,
        enabled: item.enabled !== false && policyStatus !== 'payment-required',
        read: item.read !== false,
        write: item.write !== false,
        label: typeof item.label === 'string' ? item.label.slice(0, 80) : undefined,
        isDefaultPreset: Boolean(item.isDefaultPreset),
        policyStatus,
        policyReason:
          typeof item.policyReason === 'string' ? item.policyReason.slice(0, 200) : undefined,
        maxMessageBytes:
          typeof item.maxMessageBytes === 'number' &&
          Number.isInteger(item.maxMessageBytes) &&
          item.maxMessageBytes > 0
            ? item.maxMessageBytes
            : undefined,
        lastNip11CheckedAt:
          typeof item.lastNip11CheckedAt === 'string' ? item.lastNip11CheckedAt : undefined,
      });
    } catch {
      // Ignore invalid or non-wss relay URLs
    }
  }
  return Array.from(dedup.values());
}

export async function loadSyncSettings(): Promise<SyncSettings> {
  try {
    const raw = await withChmStore<unknown>(STORE_SYNC_SETTINGS, 'readonly', (s) => s.get('default'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return createDefaultSyncSettings();
    }
    const r = raw as Partial<SyncSettings>;
    const consentAccepted = r.consentAccepted === true;
    const nowMs = Date.now();
    const rawStartMs =
      typeof r.syncWindowStartedAt === 'string' ? Date.parse(r.syncWindowStartedAt) : NaN;
    const windowExpired = !Number.isFinite(rawStartMs) || nowMs - rawStartMs >= SYNC_BUDGET_WINDOW_MS;

    return {
      id: 'default',
      enabled: consentAccepted && r.enabled === true,
      consentAccepted,
      consentAcceptedAt: typeof r.consentAcceptedAt === 'string' ? r.consentAcceptedAt : undefined,
      autoSync: r.autoSync !== false,
      activeAuthorKeyId: typeof r.activeAuthorKeyId === 'string' ? r.activeAuthorKeyId : undefined,
      relays: sanitizeRelays(r.relays),
      autoRejectPaidRelays: r.autoRejectPaidRelays !== false,
      onlineSyncBudgetBytes:
        typeof r.onlineSyncBudgetBytes === 'number' &&
        Number.isFinite(r.onlineSyncBudgetBytes) &&
        r.onlineSyncBudgetBytes >= 65_536
          ? Math.floor(r.onlineSyncBudgetBytes)
          : DEFAULT_ONLINE_SYNC_BUDGET_BYTES,
      syncWindowBytesUsed: windowExpired
        ? 0
        : typeof r.syncWindowBytesUsed === 'number' &&
            Number.isFinite(r.syncWindowBytesUsed) &&
            r.syncWindowBytesUsed >= 0
          ? Math.floor(r.syncWindowBytesUsed)
          : 0,
      syncWindowStartedAt: windowExpired
        ? new Date(nowMs).toISOString()
        : (r.syncWindowStartedAt as string),
      // Nostr vault sync is permanently disabled
      syncVaultProofs: false,
      migratedAuthOnlyAt:
        typeof r.migratedAuthOnlyAt === 'string' ? r.migratedAuthOnlyAt : undefined,
      lastSyncAttemptAt: typeof r.lastSyncAttemptAt === 'string' ? r.lastSyncAttemptAt : undefined,
      lastSuccessfulSyncAt:
        typeof r.lastSuccessfulSyncAt === 'string' ? r.lastSuccessfulSyncAt : undefined,
    };
  } catch {
    return createDefaultSyncSettings();
  }
}

export async function saveSyncSettings(settings: SyncSettings): Promise<SyncSettings> {
  const clean: SyncSettings = {
    id: 'default',
    enabled: Boolean(settings.consentAccepted && settings.enabled),
    consentAccepted: Boolean(settings.consentAccepted),
    consentAcceptedAt: settings.consentAcceptedAt,
    autoSync: settings.autoSync !== false,
    activeAuthorKeyId: settings.activeAuthorKeyId,
    relays: sanitizeRelays(settings.relays),
    autoRejectPaidRelays: settings.autoRejectPaidRelays !== false,
    onlineSyncBudgetBytes:
      typeof settings.onlineSyncBudgetBytes === 'number' &&
      Number.isFinite(settings.onlineSyncBudgetBytes) &&
      settings.onlineSyncBudgetBytes >= 65_536
        ? Math.floor(settings.onlineSyncBudgetBytes)
        : DEFAULT_ONLINE_SYNC_BUDGET_BYTES,
    syncWindowBytesUsed:
      typeof settings.syncWindowBytesUsed === 'number' &&
      Number.isFinite(settings.syncWindowBytesUsed) &&
      settings.syncWindowBytesUsed >= 0
        ? Math.floor(settings.syncWindowBytesUsed)
        : 0,
    syncWindowStartedAt: settings.syncWindowStartedAt ?? new Date().toISOString(),
    syncVaultProofs: false,
    migratedAuthOnlyAt: settings.migratedAuthOnlyAt,
    lastSyncAttemptAt: settings.lastSyncAttemptAt,
    lastSuccessfulSyncAt: settings.lastSuccessfulSyncAt,
  };
  await withChmStore(STORE_SYNC_SETTINGS, 'readwrite', (s) => s.put(clean));
  return clean;
}

/**
 * Safely migrates legacy Nostr sync settings & outbox records:
 * - Disables `syncVaultProofs` in persisted settings without altering device identities or Nostr keys
 * - Removes any stale low-priority (`priority >= 2`) vault-proof outbox entries while keeping
 *   Priority 0 revocations and Priority 1 device-auth ops intact.
 */
export async function migrateLegacyNostrToAuthOnly(): Promise<{
  settingsUpdated: boolean;
  prunedLegacyOutboxCount: number;
}> {
  let settingsUpdated = false;
  let prunedLegacyOutboxCount = 0;

  try {
    const raw = await withChmStore<unknown>(STORE_SYNC_SETTINGS, 'readonly', (s) => s.get('default'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const r = raw as Partial<SyncSettings>;
      if (r.syncVaultProofs === true || !r.migratedAuthOnlyAt) {
        const current = await loadSyncSettings();
        await saveSyncSettings({
          ...current,
          syncVaultProofs: false,
          migratedAuthOnlyAt: current.migratedAuthOnlyAt ?? new Date().toISOString(),
        });
        settingsUpdated = true;
      }
    }
  } catch {
    // Ignore if IDB unavailable
  }

  try {
    const outbox = await listSyncOutbox();
    const staleIds = outbox.filter((item) => (item.priority ?? 1) >= 2).map((item) => item.id);
    if (staleIds.length > 0) {
      await removeSyncOutboxItems(staleIds);
      prunedLegacyOutboxCount = staleIds.length;
    }
  } catch {
    // Ignore
  }

  return { settingsUpdated, prunedLegacyOutboxCount };
}

export async function listSyncOpLog(ownerFingerprintHex?: string): Promise<SyncOpLogRecord[]> {
  try {
    const rows = await withChmStore<SyncOpLogRecord[]>(STORE_SYNC_OP_LOG, 'readonly', (s) =>
      s.getAll(),
    );
    const filtered = (rows ?? []).filter(
      (r) =>
        r &&
        typeof r.opHashHex === 'string' &&
        typeof r.sequence === 'number' &&
        (!ownerFingerprintHex || r.ownerFingerprintHex === ownerFingerprintHex),
    );
    return filtered.sort((a, b) => a.sequence - b.sequence || a.opHashHex.localeCompare(b.opHashHex));
  } catch {
    return [];
  }
}

export async function saveSyncOpRecords(records: SyncOpLogRecord[]): Promise<void> {
  for (const rec of records) {
    await withChmStore(STORE_SYNC_OP_LOG, 'readwrite', (s) => s.put(rec));
  }
}

export async function listVerifiedPeerBindings(
  ownerFingerprintHex?: string,
): Promise<VerifiedPeerBinding[]> {
  try {
    const rows = await withChmStore<VerifiedPeerBinding[]>(
      STORE_SYNC_PEER_BINDINGS,
      'readonly',
      (s) => s.getAll(),
    );
    return (rows ?? []).filter(
      (b) =>
        b &&
        typeof b.nostrPubkeyHex === 'string' &&
        (!ownerFingerprintHex || b.ownerFingerprintHex === ownerFingerprintHex),
    );
  } catch {
    return [];
  }
}

export async function upsertVerifiedPeerBinding(binding: VerifiedPeerBinding): Promise<void> {
  await withChmStore(STORE_SYNC_PEER_BINDINGS, 'readwrite', (s) => s.put(binding));
}

function normalizePriority(p?: SyncPriority): number {
  return typeof p === 'number' && p >= 0 && p <= 3 ? p : 1;
}

export async function listSyncOutbox(ownerFingerprintHex?: string): Promise<SyncOutboxRecord[]> {
  try {
    const rows = await withChmStore<SyncOutboxRecord[]>(STORE_SYNC_OUTBOX, 'readonly', (s) =>
      s.getAll(),
    );
    return (rows ?? [])
      .filter(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          (!ownerFingerprintHex || r.ownerFingerprintHex === ownerFingerprintHex),
      )
      .sort(
        (a, b) =>
          normalizePriority(a.priority) - normalizePriority(b.priority) ||
          a.createdAt.localeCompare(b.createdAt),
      );
  } catch {
    return [];
  }
}

export async function enqueueSyncOutboxItems(items: SyncOutboxRecord[]): Promise<void> {
  for (const item of items) {
    await withChmStore(STORE_SYNC_OUTBOX, 'readwrite', (s) => s.put(item));
  }
}

export async function removeSyncOutboxItems(ids: string[]): Promise<void> {
  for (const id of ids) {
    await withChmStore(STORE_SYNC_OUTBOX, 'readwrite', (s) => s.delete(id));
  }
}

export async function updateSyncOutboxRecord(record: SyncOutboxRecord): Promise<void> {
  await withChmStore(STORE_SYNC_OUTBOX, 'readwrite', (s) => s.put(record));
}
