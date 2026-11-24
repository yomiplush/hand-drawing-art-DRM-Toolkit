import { base64UrlEncode } from '../crypto/sha256';
import {
  STORE_POLICY_PRESETS,
  STORE_VAULT_TOMBSTONES,
  runChmTransaction,
  withChmStore,
} from '../storage/keyStore';
import {
  computePolicyPresetHash,
  normalizePolicySignal,
  validatePolicyPreset,
} from './policyValidator';
import type { PolicyPreset, PolicyPresetInput } from './types';

export interface VaultTombstoneRecord {
  id: string; // `${entityType}:${entityId}`
  entityType: 'proof' | 'profile' | 'policy-preset' | 'setting';
  entityId: string;
  deletedAt: string;
  version?: number;
}

export const BUILT_IN_POLICY_PRESETS: ReadonlyArray<PolicyPresetInput> = [
  {
    id: 'preset-arr-no-ai',
    name: 'All Rights Reserved (No AI Training)',
    description: 'Full copyright protection; commercial reuse, redistribution, and AI training disallowed.',
    licenseId: 'ARR',
    commercialUse: 'disallow',
    redistribution: 'disallow',
    aiTraining: 'disallow',
    allowsDerivatives: 'disallow',
    allowsModifications: 'disallow',
    requiresAttribution: true,
    isDefault: true,
  },
  {
    id: 'preset-cc-by-nc-nd',
    name: 'Portfolio Share (CC BY-NC-ND, No AI)',
    description: 'Share non-commercially with attribution and no modifications; AI training disallowed.',
    licenseId: 'CC-BY-NC-ND-4.0',
    commercialUse: 'disallow',
    redistribution: 'allow',
    aiTraining: 'disallow',
    allowsDerivatives: 'disallow',
    allowsModifications: 'disallow',
    requiresAttribution: true,
  },
  {
    id: 'preset-cc-by-open',
    name: 'Open Attribution (CC BY 4.0)',
    description: 'Permissive sharing and commercial use with credit; AI training unspecified.',
    licenseId: 'CC-BY-4.0',
    commercialUse: 'allow',
    redistribution: 'allow',
    aiTraining: 'unspecified',
    allowsDerivatives: 'allow',
    allowsModifications: 'allow',
    requiresAttribution: true,
  },
];

function generatePresetId(): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return `preset-${base64UrlEncode(bytes)}`;
}

function normalizePresetRecord(
  input: PolicyPresetInput,
  existing?: PolicyPreset,
): PolicyPreset {
  const validation = validatePolicyPreset(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }
  const now = new Date().toISOString();
  const id = input.id?.trim() || existing?.id || generatePresetId();
  const normalizedInput: PolicyPresetInput = {
    id,
    name: input.name.trim().slice(0, 64),
    description: input.description?.trim().slice(0, 240) || undefined,
    licenseId: input.licenseId,
    commercialUse: normalizePolicySignal(input.commercialUse),
    redistribution: normalizePolicySignal(input.redistribution),
    aiTraining: normalizePolicySignal(input.aiTraining),
    allowsDerivatives: normalizePolicySignal(input.allowsDerivatives),
    allowsModifications: normalizePolicySignal(input.allowsModifications),
    requiresAttribution: input.requiresAttribution ?? input.licenseId !== 'CC0-1.0',
    customNote: input.customNote?.trim().slice(0, 240) || undefined,
    isDefault: Boolean(input.isDefault),
  };

  const contentHash = computePolicyPresetHash(normalizedInput);
  const nextVersion = existing
    ? existing.contentHash === contentHash && Boolean(existing.isDefault) === Boolean(normalizedInput.isDefault)
      ? existing.version
      : existing.version + 1
    : 1;

  return {
    ...normalizedInput,
    id,
    schemaVersion: 1,
    version: nextVersion,
    contentHash,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function listPolicyPresets(): Promise<PolicyPreset[]> {
  try {
    const rows = await withChmStore<PolicyPreset[]>(STORE_POLICY_PRESETS, 'readonly', (s) =>
      s.getAll(),
    );
    return (rows ?? [])
      .filter((r) => r && typeof r.id === 'string' && typeof r.licenseId === 'string')
      .sort((a, b) => {
        if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

export async function ensureDefaultPolicyPresets(): Promise<PolicyPreset[]> {
  const existing = await listPolicyPresets();
  if (existing.length > 0) {
    return existing;
  }
  const seeded = BUILT_IN_POLICY_PRESETS.map((p) => normalizePresetRecord(p));
  try {
    await runChmTransaction([STORE_POLICY_PRESETS], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_POLICY_PRESETS);
      for (const item of seeded) {
        store.put(item);
      }
    });
  } catch {
    // IndexedDB unavailable in SSR/Node unit context
  }
  return seeded;
}

export async function getPolicyPreset(id: string): Promise<PolicyPreset | undefined> {
  try {
    return await withChmStore<PolicyPreset | undefined>(STORE_POLICY_PRESETS, 'readonly', (s) =>
      s.get(id),
    );
  } catch {
    return undefined;
  }
}

export async function savePolicyPreset(input: PolicyPresetInput): Promise<PolicyPreset> {
  const existing = input.id ? await getPolicyPreset(input.id) : undefined;
  const record = normalizePresetRecord(input, existing);
  const all = await listPolicyPresets();

  await runChmTransaction([STORE_POLICY_PRESETS, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_POLICY_PRESETS);
    const tombStore = tx.objectStore(STORE_VAULT_TOMBSTONES);
    if (record.isDefault) {
      for (const other of all) {
        if (other.id !== record.id && other.isDefault) {
          store.put({
            ...other,
            isDefault: false,
            version: other.version + 1,
            updatedAt: record.updatedAt,
          });
        }
      }
    }
    store.put(record);
    tombStore.delete(`policy-preset:${record.id}`);
  });

  return record;
}

export async function deletePolicyPreset(id: string): Promise<void> {
  const existing = await getPolicyPreset(id);
  const deletedAt = new Date().toISOString();
  await runChmTransaction([STORE_POLICY_PRESETS, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    tx.objectStore(STORE_POLICY_PRESETS).delete(id);
    const tombstone: VaultTombstoneRecord = {
      id: `policy-preset:${id}`,
      entityType: 'policy-preset',
      entityId: id,
      deletedAt,
      version: (existing?.version ?? 0) + 1,
    };
    tx.objectStore(STORE_VAULT_TOMBSTONES).put(tombstone);
  });
}

export async function upsertPolicyPresetsBatch(presets: PolicyPreset[]): Promise<void> {
  if (presets.length === 0) return;
  await runChmTransaction([STORE_POLICY_PRESETS], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_POLICY_PRESETS);
    for (const p of presets) {
      store.put(p);
    }
  });
}
