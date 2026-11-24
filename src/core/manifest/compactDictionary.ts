import type { CreationMethod, EvidenceCategory, LicenseDeclaration, PolicySignal } from './types';

export const V3_URL_PREFIX_DICT: Readonly<Record<number, string>> = {
  1: 'https://',
  2: 'http://',
  3: 'https://x.com/',
  4: 'https://bsky.app/profile/',
  5: 'https://www.pixiv.net/users/',
  6: 'https://skeb.jp/@',
  7: 'https://vgen.co/',
  8: 'https://mastodon.social/@',
  9: 'https://misskey.io/@',
  10: 'https://njump.me/',
  11: 'https://www.furaffinity.net/user/',
  12: 'https://www.deviantart.com/',
  13: 'https://www.instagram.com/',
  14: 'https://www.youtube.com/@',
  15: 'https://github.com/',
};

export const V3_SNS_PLATFORM_TO_CODE: Readonly<Record<string, number>> = {
  custom: 0,
  x: 1,
  bluesky: 2,
  mastodon: 3,
  misskey: 4,
  nostr: 5,
  pixiv: 6,
  skeb: 7,
  booth: 8,
  vgen: 9,
  furaffinity: 10,
  deviantart: 11,
  tumblr: 12,
  instagram: 13,
  youtube: 14,
  github: 15,
};

export const V3_CODE_TO_SNS_PLATFORM: Readonly<Record<number, string>> = {
  0: 'custom',
  1: 'x',
  2: 'bluesky',
  3: 'mastodon',
  4: 'misskey',
  5: 'nostr',
  6: 'pixiv',
  7: 'skeb',
  8: 'booth',
  9: 'vgen',
  10: 'furaffinity',
  11: 'deviantart',
  12: 'tumblr',
  13: 'instagram',
  14: 'youtube',
  15: 'github',
};

export const V3_CREATION_METHOD_TO_CODE: Readonly<Record<CreationMethod, number>> = {
  'hand-drawn-no-ai': 1,
  'hand-drawn-ai-assisted': 2,
  'ai-generated': 3,
  other: 4,
  'prefer-not-to-disclose': 5,
};

export const V3_CODE_TO_CREATION_METHOD: Readonly<Record<number, CreationMethod>> = {
  1: 'hand-drawn-no-ai',
  2: 'hand-drawn-ai-assisted',
  3: 'ai-generated',
  4: 'other',
  5: 'prefer-not-to-disclose',
};

export const V3_EVIDENCE_CATEGORY_TO_CODE: Readonly<Record<EvidenceCategory, number>> = {
  sketch: 1,
  wip: 2,
  intermediate: 3,
  timelapse: 4,
  'project-file': 5,
  other: 6,
};

export const V3_CODE_TO_EVIDENCE_CATEGORY: Readonly<Record<number, EvidenceCategory>> = {
  1: 'sketch',
  2: 'wip',
  3: 'intermediate',
  4: 'timelapse',
  5: 'project-file',
  6: 'other',
};

const POLICY_TO_CODE: Record<PolicySignal, number> = {
  unspecified: 0,
  allow: 1,
  disallow: 2,
};

const CODE_TO_POLICY: Record<number, PolicySignal> = {
  0: 'unspecified',
  1: 'allow',
  2: 'disallow',
};

const textEncoder = new TextEncoder();

export function utf8Bytes(str: string): number {
  return textEncoder.encode(str).length;
}

export function hasDisallowedV3CodeUnit(code: number, allowMultiline: boolean): boolean {
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code >= 0x2066 && code <= 0x2069) return true;
  if (code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true;
  if (code < 0x20) {
    if (allowMultiline && (code === 0x09 || code === 0x0a)) return false;
    return true;
  }
  return false;
}

export function sanitizeV3SingleLine(
  value: string | undefined,
  maxBytes: number,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    if (hasDisallowedV3CodeUnit(trimmed.charCodeAt(i), false)) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (utf8Bytes(trimmed) > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return trimmed;
}

export function sanitizeV3Multiline(
  value: string | undefined,
  maxBytes: number,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) return undefined;
  for (let i = 0; i < normalized.length; i++) {
    if (hasDisallowedV3CodeUnit(normalized.charCodeAt(i), true)) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (utf8Bytes(normalized) > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return normalized;
}

export function sanitizeV3Url(rawUrl: string | undefined, fieldName: string): string | undefined {
  if (rawUrl === undefined) return undefined;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    if (hasDisallowedV3CodeUnit(trimmed.charCodeAt(i), false) || /\s/.test(trimmed[i])) {
      throw new Error(`${fieldName} contains disallowed whitespace or control characters`);
    }
  }
  if (utf8Bytes(trimmed) > 512) {
    throw new Error(`${fieldName} exceeds maximum 512 UTF-8 bytes`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be a valid https:// or http:// URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${fieldName} must use https:// or http://`);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`${fieldName} must not contain credentials`);
  }
  if (!parsed.hostname) {
    throw new Error(`${fieldName} must include a valid hostname`);
  }
  return trimmed;
}

export function bestCompactUrlCode(url: string): number {
  let bestCode = 0;
  let bestLen = 0;
  for (const [rawCode, prefix] of Object.entries(V3_URL_PREFIX_DICT)) {
    const code = Number(rawCode);
    if (url.startsWith(prefix) && prefix.length > bestLen) {
      bestLen = prefix.length;
      bestCode = code;
    }
  }
  return bestCode;
}

export function encodeCompactUrl(url: string, fieldName: string): [number, string] {
  const clean = sanitizeV3Url(url, fieldName);
  if (!clean) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  const code = bestCompactUrlCode(clean);
  if (code < 1) {
    throw new Error(`${fieldName} must use https:// or http://`);
  }
  const prefix = V3_URL_PREFIX_DICT[code];
  return [code, clean.slice(prefix.length)];
}

export function decodeCompactUrl(raw: unknown, fieldName: string): string {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error(`${fieldName} compact URL must be a 2-element array`);
  }
  const [code, suffix] = raw;
  if (
    typeof code !== 'number' ||
    !Number.isSafeInteger(code) ||
    !(code in V3_URL_PREFIX_DICT)
  ) {
    throw new Error(`${fieldName} uses unknown URL prefix code: ${String(code)}`);
  }
  if (typeof suffix !== 'string') {
    throw new Error(`${fieldName} URL suffix must be a string`);
  }
  const full = `${V3_URL_PREFIX_DICT[code]}${suffix}`;
  const clean = sanitizeV3Url(full, fieldName);
  if (!clean || clean !== full) {
    throw new Error(`${fieldName} is non-canonical`);
  }
  if (bestCompactUrlCode(clean) !== code) {
    throw new Error(`${fieldName} does not use the canonical longest URL prefix code`);
  }
  return clean;
}

export function packV3PolicyFlags(license: LicenseDeclaration): number {
  const c = POLICY_TO_CODE[license.commercialUse];
  const r = POLICY_TO_CODE[license.redistribution];
  const a = POLICY_TO_CODE[license.aiTraining];
  const d = POLICY_TO_CODE[license.allowsDerivatives ?? 'unspecified'];
  const m = POLICY_TO_CODE[license.allowsModifications ?? 'unspecified'];
  if (c === undefined || r === undefined || a === undefined || d === undefined || m === undefined) {
    throw new Error('Invalid policy signal in license declaration');
  }
  const hasAttrFlag = license.requiresAttribution !== undefined ? 1 : 0;
  const attrValFlag = license.requiresAttribution === true ? 1 : 0;
  return (
    c |
    (r << 2) |
    (a << 4) |
    (d << 6) |
    (m << 8) |
    (hasAttrFlag << 10) |
    (attrValFlag << 11)
  );
}

export function unpackV3PolicyFlags(flags: number): {
  commercialUse: PolicySignal;
  redistribution: PolicySignal;
  aiTraining: PolicySignal;
  allowsDerivatives?: PolicySignal;
  allowsModifications?: PolicySignal;
  requiresAttribution?: boolean;
} {
  if (!Number.isSafeInteger(flags) || flags < 0 || flags > 0xfff) {
    throw new Error('v3 policyFlags contains reserved or out-of-range bits');
  }
  const c = CODE_TO_POLICY[flags & 0x3];
  const r = CODE_TO_POLICY[(flags >>> 2) & 0x3];
  const a = CODE_TO_POLICY[(flags >>> 4) & 0x3];
  const dCode = (flags >>> 6) & 0x3;
  const mCode = (flags >>> 8) & 0x3;
  const d = CODE_TO_POLICY[dCode];
  const m = CODE_TO_POLICY[mCode];
  if (!c || !r || !a || !d || !m) {
    throw new Error('v3 policyFlags contains invalid 2-bit policy code');
  }
  const hasAttr = (flags & 0x400) !== 0;
  const attrVal = (flags & 0x800) !== 0;
  if (!hasAttr && attrVal) {
    throw new Error('v3 policyFlags has attribution value bit set without presence bit');
  }
  return {
    commercialUse: c,
    redistribution: r,
    aiTraining: a,
    ...(d !== 'unspecified' ? { allowsDerivatives: d } : {}),
    ...(m !== 'unspecified' ? { allowsModifications: m } : {}),
    ...(hasAttr ? { requiresAttribution: attrVal } : {}),
  };
}
