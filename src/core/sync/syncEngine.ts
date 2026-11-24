import {
  base64UrlDecode,
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import type {
  SignedDeviceRegistrySnapshot,
  SignedDeviceRevocationNotice,
  SignedEnrollmentCertificate,
} from '@yomiplush/chm-exchange/core';
import { bytesToHex, constantTimeEqual } from '../crypto/sha256';
import type { RelayFreePolicyEvaluation } from '../nostr/nip11';
import {
  getDeviceNostrKeyRecord,
  getOrCreateDeviceNostrKey,
  withUnlockedDeviceNostrSecret,
} from '../nostr/nostrKeyStore';
import { buildChmSyncRumor, unwrapGiftWrapEvent, wrapRumorForRecipient } from '../nostr/nip59';
import type { NostrDeviceKeyRecord } from '../nostr/nostrKeyStore';
import {
  STORE_DEVICE_IDENTITIES,
  STORE_DEVICE_REVOCATIONS,
  STORE_PAIRED_DEVICES,
  getAuthorKey,
  idbReqToPromise,
  listAuthorKeys,
  runChmTransaction,
  signWithAuthorKey,
} from '../storage/keyStore';
import {
  type DeviceIdentityRecord,
  type DeviceRevocationRecord,
  type PairedDeviceRecord,
  createOrReplaceLocalDeviceIdentity,
  exportSignedDeviceRegistry,
  getAllTrustedOwnerKeysSet,
  loadDevicePairingState,
  signWithLocalDeviceIdentity,
} from '../storage/devicePairingStore';
import {
  NostrSyncTransport,
  computeBackoffMs,
  measureUtf8Bytes,
  validateRelayUrl,
} from './relayManager';
import {
  type DecodedBindingAttestation,
  type DecodedSyncOperation,
  ZERO_HASH_BYTES_32,
  bindingToRecord,
  createSignedBindingAttestation,
  createSignedSyncOperation,
  decodeAndVerifyBindingAttestation,
  decodeAndVerifySyncOperation,
  decodeAndVerifySyncRumorPayload,
  encodeSyncRumorPayload,
  parseBindingAttestationInput,
  resolveDeterministicSyncState,
  selectActiveSyncRecipients,
} from './syncProtocol';
import {
  enqueueSyncOutboxItems,
  isAllowLocalWsRelayForTests,
  listSyncOpLog,
  listSyncOutbox,
  listVerifiedPeerBindings,
  loadSyncSettings,
  migrateLegacyNostrToAuthOnly,
  removeSyncOutboxItems,
  saveSyncOpRecords,
  saveSyncSettings,
  updateSyncOutboxRecord,
  upsertVerifiedPeerBinding,
} from './syncStore';
import {
  CURATED_DEFAULT_RELAY_PRESETS,
  type GracefulFallbackReason,
  type RelayConfig,
  type RelayPolicyStatus,
  type RelayRuntimeStatus,
  type SyncHealthStatus,
  type SyncOpKind,
  type SyncOpLogRecord,
  type SyncOutboxRecord,
  type SyncPriority,
  type SyncSettings,
  type SyncStatusSummary,
  type SyncTransport,
  type VerifiedPeerBinding,
} from './types';

let activeSyncTransport: SyncTransport = new NostrSyncTransport();
let syncSettingsLockChain: Promise<void> = Promise.resolve();

async function withSyncSettingsLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = syncSettingsLockChain;
  syncSettingsLockChain = prev.then(() => next, () => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function mutateSyncSettings(
  updater: (current: SyncSettings) => SyncSettings | null | Promise<SyncSettings | null>,
): Promise<SyncSettings> {
  return withSyncSettingsLock(async () => {
    const current = await loadSyncSettings();
    const updated = await updater(current);
    if (!updated) return current;
    return saveSyncSettings(updated);
  });
}

export function setSyncTransport(transport: SyncTransport): void {
  activeSyncTransport = transport;
}

export function getSyncTransport(): SyncTransport {
  return activeSyncTransport;
}

function generateIdHex(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function hexUuidToBytes(uuidHex: string): Uint8Array {
  const clean = uuidHex.replace(/-/g, '').toLowerCase();
  return hexToBytes(clean);
}

async function resolveOwnerBindingContext(params: {
  authorKeyId?: string;
  localDevice: DeviceIdentityRecord;
  pairedDevices: PairedDeviceRecord[];
}): Promise<{
  ownerPublicKey: Uint8Array;
  ownerFingerprintHex: string;
  signerRole: 'owner' | 'paired-device';
  authorKeyId?: string;
} | null> {
  if (params.authorKeyId) {
    const author = await getAuthorKey(params.authorKeyId);
    if (author) {
      return {
        ownerPublicKey: author.publicKey,
        ownerFingerprintHex: author.fingerprintHex,
        signerRole: 'owner',
        authorKeyId: author.id,
      };
    }
  }
  const authors = await listAuthorKeys();
  if (authors.length > 0) {
    return {
      ownerPublicKey: authors[0].publicKey,
      ownerFingerprintHex: authors[0].fingerprintHex,
      signerRole: 'owner',
      authorKeyId: authors[0].id,
    };
  }
  const activePaired = params.pairedDevices.find(
    (d) =>
      d.deviceIdHex === params.localDevice.deviceIdHex &&
      d.localVerificationStatus !== 'revoked' &&
      d.localVerificationStatus !== 'conflict-revoked',
  );
  if (activePaired) {
    const ownerPub = base64UrlDecode(activePaired.ownerPublicKeyBase64Url);
    return {
      ownerPublicKey: ownerPub,
      ownerFingerprintHex: activePaired.ownerFingerprintHex,
      signerRole: 'paired-device',
    };
  }
  return null;
}

export async function ensureLocalBindingAttestation(params: {
  deviceName?: string;
  authorKeyId?: string;
  ownerPassphrase?: string;
  devicePassphrase?: string;
  nostrPassphraseIfFallback?: string;
  nip49LogN?: number;
}): Promise<{
  localDevice: DeviceIdentityRecord;
  nostrKey: NostrDeviceKeyRecord;
  binding?: DecodedBindingAttestation;
}> {
  const pairingState = await loadDevicePairingState();
  const localDevice =
    pairingState.localDevice ??
    (await createOrReplaceLocalDeviceIdentity({
      deviceName: params.deviceName || 'My Device',
      backupPassphrase: params.devicePassphrase,
    }));

  if (localDevice.revokedLocally) {
    throw new Error('Cannot initialize Nostr sync for a revoked device identity.');
  }

  const nostrKey = await getOrCreateDeviceNostrKey({
    deviceIdHex: localDevice.deviceIdHex,
    passphraseIfFallback: params.nostrPassphraseIfFallback,
    disallowedEd25519Bytes: [localDevice.publicKey],
    nip49LogN: params.nip49LogN,
  });

  if (constantTimeEqual(hexToBytes(nostrKey.nostrPubkeyHex), localDevice.publicKey)) {
    throw new Error('Key separation invariant failed');
  }

  const ctx = await resolveOwnerBindingContext({
    authorKeyId: params.authorKeyId,
    localDevice,
    pairedDevices: pairingState.pairedDevices,
  });
  if (!ctx) {
    return { localDevice, nostrKey };
  }

  const existingBindings = await listVerifiedPeerBindings(ctx.ownerFingerprintHex);
  const alreadyBound = existingBindings.find(
    (b) =>
      b.deviceIdHex === localDevice.deviceIdHex &&
      b.nostrPubkeyHex === nostrKey.nostrPubkeyHex &&
      b.devicePublicKeyBase64Url === localDevice.publicKeyBase64Url,
  );
  if (alreadyBound) {
    return {
      localDevice,
      nostrKey,
      binding: decodeAndVerifyBindingAttestation(base64UrlDecode(alreadyBound.bindingCborBase64Url)),
    };
  }

  const author = ctx.authorKeyId ? await getAuthorKey(ctx.authorKeyId) : undefined;
  const binding = await withUnlockedDeviceNostrSecret(
    {
      deviceIdHex: localDevice.deviceIdHex,
      passphraseIfFallback: params.nostrPassphraseIfFallback,
    },
    async (nostrSecretKey) =>
      createSignedBindingAttestation({
        ownerPublicKey: ctx.ownerPublicKey,
        deviceIdBytes: localDevice.deviceIdBytes,
        devicePublicKey: localDevice.publicKey,
        signerRole: ctx.signerRole,
        signWithChmKey:
          ctx.signerRole === 'owner' && author
            ? (msg) => signWithAuthorKey(author, msg, params.ownerPassphrase)
            : (msg) => signWithLocalDeviceIdentity(localDevice, msg, params.devicePassphrase),
        nostrSecretKey,
      }),
  );

  await upsertVerifiedPeerBinding(bindingToRecord(binding));
  return { localDevice, nostrKey, binding };
}

export async function enableDecentralizedSync(params: {
  acceptConsent: boolean;
  relays?: RelayConfig[];
  useDefaultPresets?: boolean;
  authorKeyId?: string;
  deviceName?: string;
  ownerPassphrase?: string;
  devicePassphrase?: string;
  nostrPassphraseIfFallback?: string;
  nip49LogN?: number;
}): Promise<{
  settings: SyncSettings;
  nostrKey: NostrDeviceKeyRecord;
  binding?: DecodedBindingAttestation;
}> {
  if (!params.acceptConsent) {
    throw new Error('Explicit user consent is required before enabling decentralized sync.');
  }

  const initialSnapshot = await loadSyncSettings();
  const { nostrKey, binding } = await ensureLocalBindingAttestation({
    deviceName: params.deviceName,
    authorKeyId: params.authorKeyId ?? initialSnapshot.activeAuthorKeyId,
    ownerPassphrase: params.ownerPassphrase,
    devicePassphrase: params.devicePassphrase,
    nostrPassphraseIfFallback: params.nostrPassphraseIfFallback,
    nip49LogN: params.nip49LogN,
  });

  const saved = await mutateSyncSettings((current) => {
    const initialRelays =
      params.relays && params.relays.length > 0
        ? params.relays
        : current.relays.length > 0
          ? current.relays
          : params.useDefaultPresets !== false
            ? [...CURATED_DEFAULT_RELAY_PRESETS]
            : [];
    return {
      ...current,
      enabled: true,
      consentAccepted: true,
      consentAcceptedAt: current.consentAcceptedAt ?? new Date().toISOString(),
      activeAuthorKeyId: params.authorKeyId ?? current.activeAuthorKeyId,
      relays: initialRelays,
    };
  });

  return { settings: saved, nostrKey, binding };
}

export async function disableDecentralizedSync(): Promise<SyncSettings> {
  return mutateSyncSettings((current) => ({
    ...current,
    enabled: false,
  }));
}

function toRelayPolicyStatus(decision: RelayFreePolicyEvaluation['decision']): RelayPolicyStatus {
  if (decision === 'unsupported-nips') return 'unknown';
  return decision;
}

async function persistRelayFeedbackAndUsage(params: {
  paymentRejectedRelays?: string[];
  quotaRejectedRelays?: string[];
  writeRestrictedRelays?: string[];
  bytesDelta?: number;
}): Promise<SyncSettings> {
  const paySet = new Set(params.paymentRejectedRelays ?? []);
  const quotaSet = new Set(params.quotaRejectedRelays ?? []);
  const writeSet = new Set(params.writeRestrictedRelays ?? []);
  const delta = Math.max(0, Math.floor(params.bytesDelta ?? 0));

  return mutateSyncSettings((current) => {
    if (paySet.size === 0 && quotaSet.size === 0 && writeSet.size === 0 && delta === 0) {
      return null;
    }

    const nextRelays = current.relays.map((r) => {
      if (paySet.has(r.url)) {
        return {
          ...r,
          enabled: current.autoRejectPaidRelays ? false : r.enabled,
          policyStatus: 'payment-required' as const,
          policyReason: 'Relay required payment or admission fee at runtime and was auto-paused.',
        };
      }
      if (quotaSet.has(r.url)) {
        return {
          ...r,
          policyStatus: 'quota-exceeded' as const,
          policyReason: 'Relay rejected payload due to storage, quota, or message size limits.',
        };
      }
      if (writeSet.has(r.url)) {
        return {
          ...r,
          policyStatus: 'write-restricted' as const,
          policyReason: 'Relay restricts writes (whitelist or PoW policy).',
        };
      }
      return r;
    });

    return {
      ...current,
      relays: nextRelays,
      syncWindowBytesUsed: current.syncWindowBytesUsed + delta,
    };
  });
}

export async function probeAndSaveRelayPolicy(rawUrl: string): Promise<{
  url: string;
  policy?: RelayFreePolicyEvaluation;
  error?: string;
  settings: SyncSettings;
}> {
  const validUrl = validateRelayUrl(rawUrl, {
    allowInsecureLocalWsForTest: isAllowLocalWsRelayForTests(),
  });
  let policy: RelayFreePolicyEvaluation | undefined;
  let error: string | undefined;

  if (activeSyncTransport instanceof NostrSyncTransport) {
    const inspected = await activeSyncTransport.inspectNip11Policy({
      relayUrl: validUrl,
      forceRefresh: true,
    });
    policy = inspected.policy;
    error = inspected.error;
  } else {
    error = 'Active sync transport does not support NIP-11 inspection';
  }

  const saved = await mutateSyncSettings((current) => {
    const nowIso = new Date().toISOString();
    const nextRelays = current.relays.map((r) => {
      if (r.url !== validUrl) return r;
      if (!policy) {
        return {
          ...r,
          lastNip11CheckedAt: nowIso,
        };
      }
      const status = toRelayPolicyStatus(policy.decision);
      return {
        ...r,
        enabled: current.autoRejectPaidRelays && policy.paymentRequired ? false : r.enabled,
        policyStatus: status,
        policyReason: policy.reason,
        maxMessageBytes: policy.maxMessageBytes,
        lastNip11CheckedAt: nowIso,
      };
    });
    return { ...current, relays: nextRelays };
  });
  return { url: validUrl, policy, error, settings: saved };
}

export async function addRelayConfig(
  rawUrl: string,
  options?: { skipNip11Check?: boolean },
): Promise<SyncSettings> {
  const validUrl = validateRelayUrl(rawUrl, {
    allowInsecureLocalWsForTest: isAllowLocalWsRelayForTests(),
  });
  const initialSnapshot = await loadSyncSettings();

  let policyStatus: RelayPolicyStatus = 'unknown';
  let policyReason: string | undefined;
  let maxMessageBytes: number | undefined;
  let lastNip11CheckedAt: string | undefined;
  let paymentRequired = false;

  if (!options?.skipNip11Check && activeSyncTransport instanceof NostrSyncTransport) {
    const inspected = await activeSyncTransport.inspectNip11Policy({
      relayUrl: validUrl,
      forceRefresh: true,
      timeoutMs: 3500,
    });
    if (inspected.policy) {
      lastNip11CheckedAt = new Date().toISOString();
      policyStatus = toRelayPolicyStatus(inspected.policy.decision);
      policyReason = inspected.policy.reason;
      maxMessageBytes = inspected.policy.maxMessageBytes;
      paymentRequired = Boolean(inspected.policy.paymentRequired);
      if (initialSnapshot.autoRejectPaidRelays && paymentRequired) {
        throw new Error(
          inspected.policy.reason ||
            'Relay requires payment or admission fees and was rejected to preserve ¥0 operation.',
        );
      }
    }
  }

  return mutateSyncSettings((current) => {
    if (current.autoRejectPaidRelays && paymentRequired) {
      throw new Error(
        policyReason ||
          'Relay requires payment or admission fees and was rejected to preserve ¥0 operation.',
      );
    }
    const filtered = current.relays.filter((r) => r.url !== validUrl);
    filtered.push({
      url: validUrl,
      enabled: true,
      read: true,
      write: true,
      policyStatus,
      policyReason,
      maxMessageBytes,
      lastNip11CheckedAt,
    });
    return { ...current, relays: filtered };
  });
}

export async function removeRelayConfig(url: string): Promise<SyncSettings> {
  return mutateSyncSettings((current) => ({
    ...current,
    relays: current.relays.filter((r) => r.url !== url),
  }));
}

export async function toggleRelayConfig(url: string, enabled: boolean): Promise<SyncSettings> {
  return mutateSyncSettings((current) => ({
    ...current,
    relays: current.relays.map((r) => (r.url === url ? { ...r, enabled } : r)),
  }));
}

export async function importPeerSyncBindingInput(rawInput: string | Uint8Array): Promise<{
  binding: DecodedBindingAttestation;
  accepted: boolean;
  reason?: string;
}> {
  const binding = parseBindingAttestationInput(rawInput);
  const state = await loadDevicePairingState();
  const key = `${binding.ownerFingerprintHex}:${binding.deviceIdHex}`;
  const isRevoked =
    state.revocations.some(
      (r) =>
        r.key === key || r.devicePublicKeyBase64Url === binding.devicePublicKeyBase64Url,
    ) ||
    state.pairedDevices.some(
      (d) =>
        d.key === key &&
        (d.localVerificationStatus === 'revoked' ||
          d.localVerificationStatus === 'conflict-revoked'),
    );

  if (isRevoked) {
    return {
      binding,
      accepted: false,
      reason: 'Target device is revoked and cannot be added as a sync recipient.',
    };
  }

  const existingDevice = state.pairedDevices.find((d) => d.key === key);
  if (existingDevice && existingDevice.devicePublicKeyBase64Url !== binding.devicePublicKeyBase64Url) {
    return {
      binding,
      accepted: false,
      reason: 'Device public key mismatch detected; refusing binding import.',
    };
  }

  await upsertVerifiedPeerBinding(bindingToRecord(binding));
  return { binding, accepted: true };
}

export async function recordAndBroadcastOwnerSyncMutation(params: {
  authorKeyId: string;
  ownerPassphrase?: string;
  opKind: SyncOpKind;
  enrollmentCertificate?: SignedEnrollmentCertificate;
  revocationNotice?: SignedDeviceRevocationNotice;
  bindingAttestation?: DecodedBindingAttestation;
  registrySnapshot?: SignedDeviceRegistrySnapshot;
  nostrPassphraseIfFallback?: string;
}): Promise<{
  op: DecodedSyncOperation;
  queuedCount: number;
  publishedSucceededRelays: number;
}> {
  const ownerKey = await getAuthorKey(params.authorKeyId);
  if (!ownerKey) {
    throw new Error('Selected Owner CHM Identity was not found.');
  }

  const existingOps = await listSyncOpLog(ownerKey.fingerprintHex);
  const lastOp = existingOps.length > 0 ? existingOps[existingOps.length - 1] : undefined;
  const nextSeq = (lastOp?.sequence ?? 0) + 1;
  const prevOpHashBytes = lastOp ? hexToBytes(lastOp.opHashHex) : ZERO_HASH_BYTES_32;

  let registrySnapshotBytes = params.registrySnapshot?.envelopeBytes;
  if (params.opKind === 'checkpoint' && !registrySnapshotBytes) {
    const exported = await exportSignedDeviceRegistry({
      authorKeyId: ownerKey.id,
      passphrase: params.ownerPassphrase,
      sequence: nextSeq,
    });
    registrySnapshotBytes = exported.cborBytes;
  }

  const op = await createSignedSyncOperation({
    ownerPublicKey: ownerKey.publicKey,
    signWithOwnerKey: (msg) => signWithAuthorKey(ownerKey, msg, params.ownerPassphrase),
    sequence: nextSeq,
    prevOpHashBytes,
    opKind: params.opKind,
    enrollmentCertBytes: params.enrollmentCertificate?.envelopeBytes,
    revocationBytes: params.revocationNotice?.envelopeBytes,
    bindingBytes: params.bindingAttestation?.envelopeBytes,
    registrySnapshotBytes,
  });

  const opRecord: SyncOpLogRecord = {
    key: `${op.ownerFingerprintHex}:${op.opHashHex}`,
    ownerFingerprintHex: op.ownerFingerprintHex,
    ownerPublicKeyBase64Url: op.ownerPublicKeyBase64Url,
    opIdHex: op.opIdHex,
    opHashHex: op.opHashHex,
    prevOpHashHex: op.prevOpHashHex,
    sequence: op.sequence,
    opKind: op.opKind,
    issuedAt: op.issuedAt,
    envelopeBase64Url: base64UrlEncode(op.envelopeBytes),
    recordedAt: new Date().toISOString(),
  };
  await saveSyncOpRecords([opRecord]);

  const settings = await loadSyncSettings();
  if (!settings.enabled || !settings.consentAccepted) {
    return { op, queuedCount: 0, publishedSucceededRelays: 0 };
  }

  const queuedCount = await queueBundleForActivePeers({
    ownerFingerprintHex: ownerKey.fingerprintHex,
    ops: [op],
    priority: params.opKind === 'revoke-device' ? 0 : 1,
    nostrPassphraseIfFallback: params.nostrPassphraseIfFallback,
  });

  if (queuedCount === 0 || settings.relays.filter((r) => r.enabled && r.write).length === 0) {
    return { op, queuedCount, publishedSucceededRelays: 0 };
  }

  const flushRes = await flushOutbox(settings, params.nostrPassphraseIfFallback);
  return {
    op,
    queuedCount,
    publishedSucceededRelays: flushRes.succeededRelays,
  };
}

async function queueBundleForActivePeers(params: {
  ownerFingerprintHex: string;
  ops: DecodedSyncOperation[];
  bindings?: DecodedBindingAttestation[];
  priority?: SyncPriority;
  excludeDeviceIdHex?: string;
  targetDeviceIdHex?: string;
  nostrPassphraseIfFallback?: string;
}): Promise<number> {
  const pairing = await loadDevicePairingState();
  const localDev = pairing.localDevice;
  if (!localDev || localDev.revokedLocally) return 0;

  const localNostr = await getDeviceNostrKeyRecord(localDev.deviceIdHex);
  if (!localNostr) return 0;

  const [peerBindings, localBindings] = await Promise.all([
    listVerifiedPeerBindings(params.ownerFingerprintHex),
    Promise.resolve(params.bindings ?? []),
  ]);

  let recipients = selectActiveSyncRecipients({
    ownerFingerprintHex: params.ownerFingerprintHex,
    bindings: peerBindings,
    pairedDevices: pairing.pairedDevices,
    revocations: pairing.revocations,
    excludeDeviceIdHex: params.excludeDeviceIdHex ?? localDev.deviceIdHex,
  });

  if (params.targetDeviceIdHex) {
    recipients = recipients.filter((r) => r.deviceIdHex === params.targetDeviceIdHex);
  }
  if (recipients.length === 0) return 0;

  const selfBindingRow = peerBindings.find(
    (b) =>
      b.deviceIdHex === localDev.deviceIdHex && b.nostrPubkeyHex === localNostr.nostrPubkeyHex,
  );
  const allBindings = [...localBindings];
  if (selfBindingRow) {
    allBindings.push(
      decodeAndVerifyBindingAttestation(base64UrlDecode(selfBindingRow.bindingCborBase64Url)),
    );
  }

  const content = encodeSyncRumorPayload({
    ops: params.ops,
    bindings: allBindings,
  });
  const effectivePriority: SyncPriority =
    params.priority ??
    (params.ops.some((o) => o.opKind === 'revoke-device')
      ? 0
      : params.ops.length > 0 || allBindings.length > 0
        ? 1
        : 2);

  const opIdHex = params.ops[0]?.opIdHex ?? allBindings[0]?.bindingIdHex ?? generateIdHex();
  const outboxItems: SyncOutboxRecord[] = [];

  await withUnlockedDeviceNostrSecret(
    {
      deviceIdHex: localDev.deviceIdHex,
      passphraseIfFallback: params.nostrPassphraseIfFallback,
    },
    async (senderSecret) => {
      const rumor = buildChmSyncRumor({
        senderPubkeyHex: localNostr.nostrPubkeyHex,
        content,
      });

      for (const rec of recipients) {
        const giftWrap = wrapRumorForRecipient({
          rumor,
          senderSecretKey: senderSecret,
          recipientPubkeyHex: rec.nostrPubkeyHex,
        });
        const nostrEventJson = JSON.stringify(giftWrap);
        outboxItems.push({
          id: `${opIdHex}:${rec.deviceIdHex}:${giftWrap.id}`,
          ownerFingerprintHex: params.ownerFingerprintHex,
          recipientDeviceIdHex: rec.deviceIdHex,
          recipientNostrPubkeyHex: rec.nostrPubkeyHex,
          opIdHex,
          nostrEventJson,
          priority: effectivePriority,
          payloadBytes: measureUtf8Bytes(nostrEventJson),
          createdAt: new Date().toISOString(),
          attempts: 0,
          nextRetryAtMs: 0,
        });
      }
    },
  );

  await enqueueSyncOutboxItems(outboxItems);
  return outboxItems.length;
}

async function flushOutbox(
  settings: SyncSettings,
  nostrPassphraseIfFallback?: string,
): Promise<{
  succeededRelays: number;
  sentCount: number;
  droppedRevokedCount: number;
  budgetDeferredCount: number;
}> {
  if (!settings.enabled || !settings.consentAccepted) {
    return { succeededRelays: 0, sentCount: 0, droppedRevokedCount: 0, budgetDeferredCount: 0 };
  }

  const [outbox, pairing] = await Promise.all([listSyncOutbox(), loadDevicePairingState()]);
  if (outbox.length === 0) {
    return { succeededRelays: 0, sentCount: 0, droppedRevokedCount: 0, budgetDeferredCount: 0 };
  }

  // Filter out any queued envelopes addressed to devices revoked since queueing!
  const revokedKeys = new Set<string>();
  for (const r of pairing.revocations) {
    revokedKeys.add(`${r.ownerFingerprintHex}:${r.deviceIdHex}`);
  }
  for (const d of pairing.pairedDevices) {
    if (d.localVerificationStatus === 'revoked' || d.localVerificationStatus === 'conflict-revoked') {
      revokedKeys.add(d.key);
    }
  }

  const revokedIds: string[] = [];
  const activeToSend: SyncOutboxRecord[] = [];
  let budgetDeferredCount = 0;
  let projectedBytes = settings.syncWindowBytesUsed;
  const budgetCap = settings.onlineSyncBudgetBytes;
  const now = Date.now();

  for (const item of outbox) {
    const key = `${item.ownerFingerprintHex}:${item.recipientDeviceIdHex}`;
    if (revokedKeys.has(key)) {
      revokedIds.push(item.id);
      continue;
    }
    if (item.nextRetryAtMs > now) {
      continue;
    }
    const prio = item.priority ?? 1;
    const estBytes = item.payloadBytes ?? measureUtf8Bytes(item.nostrEventJson);
    // Security-critical revocations (priority 0) and core device identity ops (priority 1)
    // are never blocked by the soft monthly vault-sync data budget.
    if (prio >= 2 && projectedBytes + estBytes > budgetCap) {
      budgetDeferredCount++;
      continue;
    }
    projectedBytes += estBytes;
    activeToSend.push(item);
  }

  if (revokedIds.length > 0) {
    await removeSyncOutboxItems(revokedIds);
  }
  if (activeToSend.length === 0) {
    return {
      succeededRelays: 0,
      sentCount: 0,
      droppedRevokedCount: revokedIds.length,
      budgetDeferredCount,
    };
  }

  let localNostrSecretKey: Uint8Array | undefined;
  const runPublish = async (secret?: Uint8Array) =>
    activeSyncTransport.publishEnvelopes({
      envelopes: activeToSend,
      relays: settings.relays,
      localNostrSecretKey: secret,
    });

  let pubResult;
  if (pairing.localDevice && !pairing.localDevice.revokedLocally) {
    const hasKey = await getDeviceNostrKeyRecord(pairing.localDevice.deviceIdHex);
    if (hasKey) {
      pubResult = await withUnlockedDeviceNostrSecret(
        {
          deviceIdHex: pairing.localDevice.deviceIdHex,
          passphraseIfFallback: nostrPassphraseIfFallback,
        },
        async (sec) => {
          localNostrSecretKey = sec;
          return runPublish(localNostrSecretKey);
        },
      );
    } else {
      pubResult = await runPublish();
    }
  } else {
    pubResult = await runPublish();
  }

  await persistRelayFeedbackAndUsage({
    paymentRejectedRelays: pubResult.paymentRejectedRelays,
    quotaRejectedRelays: pubResult.quotaRejectedRelays,
    writeRestrictedRelays: pubResult.writeRestrictedRelays,
    bytesDelta: pubResult.bytesSent ?? 0,
  });

  const failedSet = new Set(pubResult.failedEnvelopeIds);
  const succeededIds = activeToSend.filter((i) => !failedSet.has(i.id)).map((i) => i.id);
  if (succeededIds.length > 0) {
    await removeSyncOutboxItems(succeededIds);
  }

  for (const item of activeToSend) {
    if (failedSet.has(item.id)) {
      const attempts = item.attempts + 1;
      await updateSyncOutboxRecord({
        ...item,
        attempts,
        nextRetryAtMs: Date.now() + computeBackoffMs(attempts),
        lastError: 'Relay publish failed or timed out',
      });
    }
  }

  return {
    succeededRelays: pubResult.succeededRelays,
    sentCount: succeededIds.length,
    droppedRevokedCount: revokedIds.length,
    budgetDeferredCount,
  };
}

export interface SyncCycleReport {
  skipped: boolean;
  skipReason?: string;
  importedOpsCount: number;
  importedBindingsCount: number;
  importedVaultProofsCount: number;
  rejectedEventCount: number;
  sentOutboxCount: number;
  droppedRevokedOutboxCount: number;
  budgetDeferredOutboxCount: number;
  status: SyncStatusSummary;
}

export async function runDecentralizedSyncCycle(params?: {
  ownerPassphrase?: string;
  devicePassphrase?: string;
  nostrPassphraseIfFallback?: string;
}): Promise<SyncCycleReport> {
  await migrateLegacyNostrToAuthOnly();
  const settings = await loadSyncSettings();
  if (!settings.enabled || !settings.consentAccepted) {
    return {
      skipped: true,
      skipReason: 'Decentralized sync is disabled or consent has not been accepted.',
      importedOpsCount: 0,
      importedBindingsCount: 0,
      importedVaultProofsCount: 0,
      rejectedEventCount: 0,
      sentOutboxCount: 0,
      droppedRevokedOutboxCount: 0,
      budgetDeferredOutboxCount: 0,
      status: await getSyncStatusSummary(),
    };
  }

  const pairing = await loadDevicePairingState();
  const localDev = pairing.localDevice;
  if (!localDev) {
    return {
      skipped: true,
      skipReason: 'No local Device Identity exists.',
      importedOpsCount: 0,
      importedBindingsCount: 0,
      importedVaultProofsCount: 0,
      rejectedEventCount: 0,
      sentOutboxCount: 0,
      droppedRevokedOutboxCount: 0,
      budgetDeferredOutboxCount: 0,
      status: await getSyncStatusSummary(),
    };
  }
  if (localDev.revokedLocally) {
    return {
      skipped: true,
      skipReason: 'Local Device Identity is revoked and cannot synchronize.',
      importedOpsCount: 0,
      importedBindingsCount: 0,
      importedVaultProofsCount: 0,
      rejectedEventCount: 0,
      sentOutboxCount: 0,
      droppedRevokedOutboxCount: 0,
      budgetDeferredOutboxCount: 0,
      status: await getSyncStatusSummary(),
    };
  }

  const nostrKey = await getDeviceNostrKeyRecord(localDev.deviceIdHex);
  if (!nostrKey) {
    return {
      skipped: true,
      skipReason: 'No Nostr sync key exists for this device.',
      importedOpsCount: 0,
      importedBindingsCount: 0,
      importedVaultProofsCount: 0,
      rejectedEventCount: 0,
      sentOutboxCount: 0,
      droppedRevokedOutboxCount: 0,
      budgetDeferredOutboxCount: 0,
      status: await getSyncStatusSummary(),
    };
  }

  await mutateSyncSettings((current) => ({
    ...current,
    lastSyncAttemptAt: new Date().toISOString(),
  }));

  // 1. Announce our own binding to any known active peers if not yet announced or catch up
  const ctx = await resolveOwnerBindingContext({
    authorKeyId: settings.activeAuthorKeyId,
    localDevice: localDev,
    pairedDevices: pairing.pairedDevices,
  });

  // 2. Flush any queued outbound wraps first (skipping any newly revoked devices)
  const flushRes = await flushOutbox(settings, params?.nostrPassphraseIfFallback);

  // 3. Fetch NIP-59 wraps addressed to local device Nostr pubkey
  const fetchRes = await withUnlockedDeviceNostrSecret(
    {
      deviceIdHex: localDev.deviceIdHex,
      passphraseIfFallback: params?.nostrPassphraseIfFallback,
    },
    (secretKey) =>
      activeSyncTransport.fetchEnvelopesForRecipient({
        recipientPubkeyHex: nostrKey.nostrPubkeyHex,
        relays: settings.relays,
        localNostrSecretKey: secretKey,
      }),
  );

  await persistRelayFeedbackAndUsage({
    paymentRejectedRelays: fetchRes.paymentRejectedRelays,
    bytesDelta: fetchRes.bytesReceived ?? 0,
  });

  // 4. Decrypt & strictly validate device auth ops and bindings (vault/profile payloads are disallowed over Nostr)
  const verifiedOps: DecodedSyncOperation[] = [];
  const verifiedBindings: DecodedBindingAttestation[] = [];
  let rejectedEventCount = 0;

  const existingBindingsAll = await listVerifiedPeerBindings();
  const knownSenderBindingsByNostrPub = new Map<string, VerifiedPeerBinding[]>();
  for (const b of existingBindingsAll) {
    const arr = knownSenderBindingsByNostrPub.get(b.nostrPubkeyHex) ?? [];
    arr.push(b);
    knownSenderBindingsByNostrPub.set(b.nostrPubkeyHex, arr);
  }

  await withUnlockedDeviceNostrSecret(
    {
      deviceIdHex: localDev.deviceIdHex,
      passphraseIfFallback: params?.nostrPassphraseIfFallback,
    },
    async (recipientSecret) => {
      for (const item of fetchRes.events) {
        try {
          const unwrapped = unwrapGiftWrapEvent(item.rawEvent, recipientSecret);
          const bundle = decodeAndVerifySyncRumorPayload(unwrapped.rumor.content);

          const bundledMatchingBindings = bundle.bindings.filter(
            (b) => b.nostrPubkeyHex === unwrapped.senderNostrPubkeyHex,
          );
          const knownMatchingBindings =
            knownSenderBindingsByNostrPub.get(unwrapped.senderNostrPubkeyHex) ?? [];

          if (bundledMatchingBindings.length === 0 && knownMatchingBindings.length === 0) {
            throw new Error(
              'Sender Nostr pubkey is not cryptographically bound to any verified CHM identity',
            );
          }

          verifiedOps.push(...bundle.ops);
          verifiedBindings.push(...bundle.bindings);
        } catch {
          rejectedEventCount++;
        }
      }
    },
  );

  const importedVaultProofsCount = 0;

  // 5. Determine all owner fingerprints touched by local state + verified incoming ops
  const ownerSet = new Set<string>();
  if (ctx) ownerSet.add(ctx.ownerFingerprintHex);
  for (const d of pairing.pairedDevices) ownerSet.add(d.ownerFingerprintHex);
  for (const r of pairing.revocations) ownerSet.add(r.ownerFingerprintHex);
  for (const op of verifiedOps) ownerSet.add(op.ownerFingerprintHex);
  for (const b of verifiedBindings) ownerSet.add(b.ownerFingerprintHex);

  const [existingOpRecords, trustedOwners] = await Promise.all([
    listSyncOpLog(),
    getAllTrustedOwnerKeysSet(),
  ]);
  const decodedExistingOps: DecodedSyncOperation[] = [];
  for (const rec of existingOpRecords) {
    try {
      decodedExistingOps.push(decodeAndVerifySyncOperation(base64UrlDecode(rec.envelopeBase64Url)));
    } catch {
      // Ignore corrupt op entry
    }
  }
  const allOps = [...decodedExistingOps, ...verifiedOps];

  const existingOpHashSet = new Set(existingOpRecords.map((r) => r.opHashHex));
  const newlyDiscoveredOps = verifiedOps.filter((o) => !existingOpHashSet.has(o.opHashHex));

  const existingBindingKeySet = new Set(existingBindingsAll.map((b) => b.key));
  const newPeerBindings: DecodedBindingAttestation[] = [];

  for (const ownerFp of ownerSet) {
    const resolved = resolveDeterministicSyncState({
      ownerFingerprintHex: ownerFp,
      existingPairedDevices: pairing.pairedDevices,
      existingRevocations: pairing.revocations,
      existingBindings: existingBindingsAll,
      operations: allOps,
      candidateBindings: verifiedBindings,
      trustedOwnerKeys: trustedOwners,
    });

    // Persist revocations, pairedDevices, and local revokedLocally flag atomically
    await runChmTransaction(
      [STORE_DEVICE_REVOCATIONS, STORE_PAIRED_DEVICES, STORE_DEVICE_IDENTITIES],
      'readwrite',
      async (tx) => {
        const revStore = tx.objectStore(STORE_DEVICE_REVOCATIONS);
        const devStore = tx.objectStore(STORE_PAIRED_DEVICES);
        const idStore = tx.objectStore(STORE_DEVICE_IDENTITIES);

        const dismissedKeys = new Set<string>();
        for (const rev of resolved.revocations) {
          const prev = (await idbReqToPromise(revStore.get(rev.key))) as
            | DeviceRevocationRecord
            | undefined;
          const dismissedFromList =
            prev?.dismissedFromList || rev.dismissedFromList ? true : undefined;
          if (dismissedFromList) {
            dismissedKeys.add(rev.key);
          }
          if (!prev || rev.sequence >= prev.sequence) {
            revStore.put({ ...rev, dismissedFromList });
          } else if (dismissedFromList && !prev.dismissedFromList) {
            revStore.put({ ...prev, dismissedFromList: true });
          }
        }
        for (const dev of resolved.pairedDevices) {
          if (dismissedKeys.has(dev.key) && dev.localVerificationStatus !== 'conflict-revoked') {
            continue;
          }
          devStore.put(dev);
        }

        const locals = (await idbReqToPromise(idStore.getAll())) as DeviceIdentityRecord[];
        for (const local of locals ?? []) {
          const revokedMatch = resolved.revocations.some(
            (r) =>
              r.devicePublicKeyBase64Url === local.publicKeyBase64Url ||
              r.deviceIdHex === local.deviceIdHex,
          );
          if (revokedMatch && !local.revokedLocally) {
            idStore.put({ ...local, revokedLocally: true } satisfies DeviceIdentityRecord);
          }
        }
      },
    );

    const opRecordsToSave: SyncOpLogRecord[] = resolved.orderedOps
      .filter((o) => !existingOpHashSet.has(o.opHashHex))
      .map((o) => ({
        key: `${o.ownerFingerprintHex}:${o.opHashHex}`,
        ownerFingerprintHex: o.ownerFingerprintHex,
        ownerPublicKeyBase64Url: o.ownerPublicKeyBase64Url,
        opIdHex: o.opIdHex,
        opHashHex: o.opHashHex,
        prevOpHashHex: o.prevOpHashHex,
        sequence: o.sequence,
        opKind: o.opKind,
        issuedAt: o.issuedAt,
        envelopeBase64Url: base64UrlEncode(o.envelopeBytes),
        recordedAt: new Date().toISOString(),
      }));
    if (opRecordsToSave.length > 0) {
      await saveSyncOpRecords(opRecordsToSave);
    }

    for (const b of resolved.activeBindings) {
      await upsertVerifiedPeerBinding(b);
      if (!existingBindingKeySet.has(b.key) && b.deviceIdHex !== localDev.deviceIdHex) {
        newPeerBindings.push(
          decodeAndVerifyBindingAttestation(base64UrlDecode(b.bindingCborBase64Url)),
        );
      }
    }
  }

  // 6. If Owner discovered a newly bound active peer device, push historical sync ops / current state to it!
  if (ctx && ctx.signerRole === 'owner' && newPeerBindings.length > 0) {
    const ownerOpsNow = (await listSyncOpLog(ctx.ownerFingerprintHex)).map((r) =>
      decodeAndVerifySyncOperation(base64UrlDecode(r.envelopeBase64Url)),
    );
    if (ownerOpsNow.length > 0) {
      for (const peer of newPeerBindings) {
        await queueBundleForActivePeers({
          ownerFingerprintHex: ctx.ownerFingerprintHex,
          ops: ownerOpsNow.slice(0, 32),
          targetDeviceIdHex: peer.deviceIdHex,
          nostrPassphraseIfFallback: params?.nostrPassphraseIfFallback,
        });
      }
      await flushOutbox(settings, params?.nostrPassphraseIfFallback);
    }
  }

  if (fetchRes.reachableRelayCount > 0 || flushRes.succeededRelays > 0) {
    await mutateSyncSettings((latest) => ({
      ...latest,
      lastSuccessfulSyncAt: new Date().toISOString(),
    }));
  }

  const status = await getSyncStatusSummary(fetchRes.relayStatuses, fetchRes.reachableRelayCount);
  return {
    skipped: false,
    importedOpsCount: newlyDiscoveredOps.length,
    importedBindingsCount: newPeerBindings.length,
    importedVaultProofsCount,
    rejectedEventCount,
    sentOutboxCount: flushRes.sentCount,
    droppedRevokedOutboxCount: flushRes.droppedRevokedCount,
    budgetDeferredOutboxCount: flushRes.budgetDeferredCount,
    status,
  };
}

export async function announceLocalBindingToKnownPeers(params?: {
  ownerFingerprintHex?: string;
  nostrPassphraseIfFallback?: string;
}): Promise<{ queued: number; publishedRelays: number }> {
  const settings = await loadSyncSettings();
  if (!settings.enabled || !settings.consentAccepted) {
    return { queued: 0, publishedRelays: 0 };
  }
  const ensured = await ensureLocalBindingAttestation({
    authorKeyId: settings.activeAuthorKeyId,
    nostrPassphraseIfFallback: params?.nostrPassphraseIfFallback,
  });
  if (!ensured.binding) {
    return { queued: 0, publishedRelays: 0 };
  }
  const ownerFp = params?.ownerFingerprintHex ?? ensured.binding.ownerFingerprintHex;
  const queued = await queueBundleForActivePeers({
    ownerFingerprintHex: ownerFp,
    ops: [],
    bindings: [ensured.binding],
    nostrPassphraseIfFallback: params?.nostrPassphraseIfFallback,
  });
  if (queued === 0) return { queued: 0, publishedRelays: 0 };
  const flush = await flushOutbox(settings, params?.nostrPassphraseIfFallback);
  return { queued, publishedRelays: flush.succeededRelays };
}

export async function getSyncStatusSummary(
  overrideRelayStatuses?: RelayRuntimeStatus[],
  overrideReachable?: number,
): Promise<SyncStatusSummary> {
  const [settings, outbox, ops, pairing, bindings] = await Promise.all([
    loadSyncSettings(),
    listSyncOutbox(),
    listSyncOpLog(),
    loadDevicePairingState(),
    listVerifiedPeerBindings(),
  ]);

  const enabledRelays = settings.relays.filter((r) => r.enabled);
  const relayStatuses =
    overrideRelayStatuses ??
    enabledRelays.map((r) => {
      const live =
        activeSyncTransport instanceof NostrSyncTransport
          ? activeSyncTransport.getRelayStatuses().find((s) => s.url === r.url)
          : undefined;
      return (
        live ?? {
          url: r.url,
          state: 'idle',
          consecutiveFailures: 0,
          nextRetryAtMs: 0,
        }
      );
    });

  const reachableRelays =
    overrideReachable ?? relayStatuses.filter((s) => s.state === 'connected').length;

  // Check causal gaps across known owners
  const missingSet = new Set<number>();
  const ownerFps = new Set<string>(ops.map((o) => o.ownerFingerprintHex));
  const trustedOwners = await getAllTrustedOwnerKeysSet();
  for (const ownerFp of ownerFps) {
    const decoded = ops
      .filter((o) => o.ownerFingerprintHex === ownerFp)
      .map((o) => {
        try {
          return decodeAndVerifySyncOperation(base64UrlDecode(o.envelopeBase64Url));
        } catch {
          return null;
        }
      })
      .filter((o): o is DecodedSyncOperation => o !== null);

    const resolved = resolveDeterministicSyncState({
      ownerFingerprintHex: ownerFp,
      existingPairedDevices: pairing.pairedDevices,
      existingRevocations: pairing.revocations,
      existingBindings: bindings,
      operations: decoded,
      trustedOwnerKeys: trustedOwners,
    });
    for (const seq of resolved.missingSequences) {
      missingSet.add(seq);
    }
  }

  const paidRelaysRejectedCount = settings.relays.filter(
    (r) => r.policyStatus === 'payment-required',
  ).length;
  const budgetPaused = settings.syncWindowBytesUsed >= settings.onlineSyncBudgetBytes;

  let health: SyncHealthStatus = 'disabled';
  let gracefulFallbackReason: GracefulFallbackReason = 'none';

  if (settings.enabled && settings.consentAccepted) {
    const isBrowserOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isBrowserOffline) {
      health = 'offline';
      gracefulFallbackReason = 'offline';
    } else if (enabledRelays.length === 0) {
      health = 'error-unreachable';
      gracefulFallbackReason =
        paidRelaysRejectedCount > 0 ? 'payment-required' : 'relays-unreachable';
    } else if (reachableRelays === 0) {
      health = overrideRelayStatuses ? 'error-unreachable' : 'offline';
      if (relayStatuses.some((s) => s.paymentRequired)) {
        gracefulFallbackReason = 'payment-required';
      } else if (relayStatuses.some((s) => s.quotaExceeded)) {
        gracefulFallbackReason = 'quota-exceeded';
      } else if (overrideRelayStatuses) {
        gracefulFallbackReason = 'relays-unreachable';
      }
    } else if (reachableRelays < enabledRelays.length) {
      health = 'partial-relays';
    } else {
      health = 'synced-observable';
    }

    if (budgetPaused && gracefulFallbackReason === 'none') {
      gracefulFallbackReason = 'budget-limit';
    }
  }

  return {
    health,
    enabled: settings.enabled,
    consentAccepted: settings.consentAccepted,
    queuedOutboxCount: outbox.length,
    knownOpCount: ops.length,
    missingSequences: Array.from(missingSet).sort((a, b) => a - b),
    hasCausalGap: missingSet.size > 0,
    reachableRelays,
    totalEnabledRelays: enabledRelays.length,
    relayStatuses,
    onlineSyncBudgetBytes: settings.onlineSyncBudgetBytes,
    syncWindowBytesUsed: settings.syncWindowBytesUsed,
    budgetPaused,
    paidRelaysRejectedCount,
    gracefulFallbackReason,
    lastSyncAttemptAt: settings.lastSyncAttemptAt,
    lastSuccessfulSyncAt: settings.lastSuccessfulSyncAt,
  };
}

/**
 * @deprecated Syncing artwork proof vaults, profiles, SNS links, or policies over Nostr
 * is permanently disabled. Nostr is strictly restricted to device registration, bindings,
 * checkpoints, and revocations. Use Local Storage, Portable Encrypted Files, or Google Drive.
 */
export async function syncSelectedVaultProofs(_params?: {
  proofIds?: string[];
  includeProfile?: boolean;
  includeTrustedArtists?: boolean;
  nostrPassphraseIfFallback?: string;
}): Promise<{
  queued: number;
  publishedRelays: number;
  syncedProofCount: number;
  skippedDueToBudget: boolean;
  disabledOverNostr: boolean;
}> {
  void _params;
  await migrateLegacyNostrToAuthOnly();
  return {
    queued: 0,
    publishedRelays: 0,
    syncedProofCount: 0,
    skippedDueToBudget: false,
    disabledOverNostr: true,
  };
}

export function attachSyncBindingToPairingUrl(
  baseQrUrl: string,
  binding: DecodedBindingAttestation,
): string {
  const b64 = base64UrlEncode(binding.envelopeBytes);
  const sep = baseQrUrl.includes('#') ? '&' : '#';
  const joined = `${baseQrUrl}${sep}sync-bind=${b64}`;
  // Stay strictly below MAX_PAIRING_QR_URL_CHARS (4096) for QR scan reliability
  return joined.length <= 3800 ? joined : baseQrUrl;
}

export function formatOwnerFpFromKey(publicKey32: Uint8Array): string {
  return computePublicKeyFingerprintSync(publicKey32).fullHex;
}

export { hexUuidToBytes };
