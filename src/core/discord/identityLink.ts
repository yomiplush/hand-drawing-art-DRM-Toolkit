import { verifyEd25519Signature } from '../crypto/ed25519';
import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import { signWithAuthorKey } from '../storage/keyStore';
import type { AuthorKeyRecord } from '../storage/keyStore';

const DISCORD_PROFILES_STORAGE_KEY = 'chm_discord_profiles_v1';
const CLAIM_FORMAT = 'chm-discord-profile-v1';

export interface SignedDiscordProfileClaim {
  format: typeof CLAIM_FORMAT;
  publicKey: string;
  fingerprint: string;
  label: string;
  discordUsername: string;
  issuedAt: string;
  signature: string;
}

export interface StoredDiscordBinding {
  publicKeyBase64Url: string;
  fingerprintHex: string;
  label: string;
  discordUsername: string;
  issuedAt: string;
  signedClaimJson: string;
  verifiedAt: string;
}

export function normalizeDiscordUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  // Discord usernames: 2-32 chars, alphanumeric, underscore, period, or legacy #0000
  if (!/^[A-Za-z0-9_.]{2,32}(?:#\d{4})?$/.test(withoutAt)) {
    return null;
  }
  return `@${withoutAt}`;
}

function buildCanonicalClaimMessage(payload: Omit<SignedDiscordProfileClaim, 'signature'>): Uint8Array {
  const canonical = [
    CLAIM_FORMAT,
    payload.publicKey,
    payload.fingerprint,
    payload.label,
    payload.discordUsername,
    payload.issuedAt,
  ].join('\n');
  return new TextEncoder().encode(canonical);
}

export async function createSignedDiscordProfileClaim(params: {
  authorKey: AuthorKeyRecord;
  discordUsername: string;
  passphrase?: string;
}): Promise<SignedDiscordProfileClaim> {
  const normalized = normalizeDiscordUsername(params.discordUsername);
  if (!normalized) {
    throw new Error('INVALID_DISCORD_USERNAME');
  }
  const unsignedPayload: Omit<SignedDiscordProfileClaim, 'signature'> = {
    format: CLAIM_FORMAT,
    publicKey: params.authorKey.publicKeyBase64Url,
    fingerprint: params.authorKey.fingerprintHex,
    label: params.authorKey.label,
    discordUsername: normalized,
    issuedAt: new Date().toISOString(),
  };
  const message = buildCanonicalClaimMessage(unsignedPayload);
  const sigBytes = await signWithAuthorKey(params.authorKey, message, params.passphrase);
  return {
    ...unsignedPayload,
    signature: base64UrlEncode(sigBytes),
  };
}

export function encodeDiscordProfileShareParam(claim: SignedDiscordProfileClaim): string {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(claim));
  return base64UrlEncode(jsonBytes);
}

export function parseDiscordProfileInput(rawInput: string): SignedDiscordProfileClaim {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('INVALID_CLAIM');
  }
  let jsonText = trimmed;
  if (trimmed.includes('discordProfile=')) {
    try {
      const url = new URL(trimmed);
      const param = url.searchParams.get('discordProfile');
      if (param) {
        jsonText = new TextDecoder().decode(base64UrlDecode(param));
      }
    } catch {
      const match = trimmed.match(/discordProfile=([A-Za-z0-9_-]+)/);
      if (match?.[1]) {
        jsonText = new TextDecoder().decode(base64UrlDecode(match[1]));
      }
    }
  } else if (!trimmed.startsWith('{')) {
    try {
      jsonText = new TextDecoder().decode(base64UrlDecode(trimmed));
    } catch {
      throw new Error('INVALID_CLAIM');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('INVALID_CLAIM');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as SignedDiscordProfileClaim).format !== CLAIM_FORMAT ||
    typeof (parsed as SignedDiscordProfileClaim).publicKey !== 'string' ||
    typeof (parsed as SignedDiscordProfileClaim).fingerprint !== 'string' ||
    typeof (parsed as SignedDiscordProfileClaim).label !== 'string' ||
    typeof (parsed as SignedDiscordProfileClaim).discordUsername !== 'string' ||
    typeof (parsed as SignedDiscordProfileClaim).issuedAt !== 'string' ||
    typeof (parsed as SignedDiscordProfileClaim).signature !== 'string'
  ) {
    throw new Error('INVALID_CLAIM');
  }

  return parsed as SignedDiscordProfileClaim;
}

export async function verifySignedDiscordProfileClaim(
  claim: SignedDiscordProfileClaim,
): Promise<boolean> {
  try {
    const normalized = normalizeDiscordUsername(claim.discordUsername);
    if (!normalized) return false;
    const pubKeyBytes = base64UrlDecode(claim.publicKey);
    const sigBytes = base64UrlDecode(claim.signature);
    if (pubKeyBytes.length !== 32 || sigBytes.length !== 64) return false;
    const message = buildCanonicalClaimMessage({
      format: claim.format,
      publicKey: claim.publicKey,
      fingerprint: claim.fingerprint,
      label: claim.label,
      discordUsername: claim.discordUsername,
      issuedAt: claim.issuedAt,
    });
    return await verifyEd25519Signature(pubKeyBytes, message, sigBytes);
  } catch {
    return false;
  }
}

export function listStoredDiscordBindings(): StoredDiscordBinding[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISCORD_PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, StoredDiscordBinding>;
    return Object.values(parsed).sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  } catch {
    return [];
  }
}

export function getStoredDiscordBinding(
  publicKeyBase64Url: string,
): StoredDiscordBinding | null {
  if (typeof window === 'undefined' || !publicKeyBase64Url) return null;
  try {
    const raw = window.localStorage.getItem(DISCORD_PROFILES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, StoredDiscordBinding>;
    return parsed[publicKeyBase64Url] ?? null;
  } catch {
    return null;
  }
}

export function saveVerifiedDiscordBinding(
  claim: SignedDiscordProfileClaim,
): StoredDiscordBinding {
  const record: StoredDiscordBinding = {
    publicKeyBase64Url: claim.publicKey,
    fingerprintHex: claim.fingerprint,
    label: claim.label,
    discordUsername: claim.discordUsername,
    issuedAt: claim.issuedAt,
    signedClaimJson: JSON.stringify(claim, null, 2),
    verifiedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    let map: Record<string, StoredDiscordBinding> = {};
    try {
      const raw = window.localStorage.getItem(DISCORD_PROFILES_STORAGE_KEY);
      if (raw) map = JSON.parse(raw) as Record<string, StoredDiscordBinding>;
    } catch {
      map = {};
    }
    map[claim.publicKey] = record;
    window.localStorage.setItem(DISCORD_PROFILES_STORAGE_KEY, JSON.stringify(map));
  }
  return record;
}

export function removeStoredDiscordBinding(publicKeyBase64Url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(DISCORD_PROFILES_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, StoredDiscordBinding>;
    delete map[publicKeyBase64Url];
    window.localStorage.setItem(DISCORD_PROFILES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
