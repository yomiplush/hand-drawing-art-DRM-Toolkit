export const PROTOCOL_VERSION = 1 as const;
export const PROTOCOL_VERSION_MASKED = 2 as const;
export const PROTOCOL_VERSION_COMPACT = 3 as const;
export const DOMAIN_SEPARATION_PREFIX = new Uint8Array([0x43, 0x48, 0x4d, 0x31, 0x00]); // "CHM1\0"
export const DOMAIN_SEPARATION_PREFIX_V3 = new Uint8Array([0x43, 0x48, 0x4d, 0x33, 0x00]); // "CHM3\0"
export const DEFAULT_VERIFY_BASE_URL = 'https://www.certified-handmade.com/verify';

export const MAX_AUTHOR_UTF8_BYTES = 48;
export const MAX_TITLE_UTF8_BYTES = 64;
export const MAX_ATTRIBUTION_UTF8_BYTES = 48;
export const MAX_V3_AUTHOR_UTF8_BYTES = 64;
export const MAX_V3_TITLE_UTF8_BYTES = 128;
export const MAX_V3_DESCRIPTION_UTF8_BYTES = 600;
export const MAX_V3_POLICY_NOTE_UTF8_BYTES = 240;
export const MAX_V3_SNS_LINKS = 12;
export const MAX_V3_PORTFOLIO_LINKS = 8;
export const MAX_V3_EVIDENCE_HASHES = 8;
export const MAX_V3_DECOMPRESSED_BYTES = 8192;
export const MAX_PROOF_BYTES = 2048;
export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_OUTPUT_DIMENSION = 10240;

export const LICENSE_DEFINITIONS = [
  {
    code: 0,
    id: 'ARR',
    shortLabel: 'All Rights Reserved',
    isCreativeCommons: false,
    allowsCommercialDefault: 'disallow',
    allowsRedistributionDefault: 'disallow',
    allowsDerivatives: false,
    requiresAttribution: true,
    requiresShareAlike: false,
  },
  {
    code: 1,
    id: 'CC0-1.0',
    shortLabel: 'CC0 1.0 Universal (Public Domain Dedication)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'allow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: true,
    requiresAttribution: false,
    requiresShareAlike: false,
  },
  {
    code: 2,
    id: 'CC-BY-4.0',
    shortLabel: 'CC BY 4.0 (Attribution)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'allow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: true,
    requiresAttribution: true,
    requiresShareAlike: false,
  },
  {
    code: 3,
    id: 'CC-BY-SA-4.0',
    shortLabel: 'CC BY-SA 4.0 (Attribution-ShareAlike)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'allow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: true,
    requiresAttribution: true,
    requiresShareAlike: true,
  },
  {
    code: 4,
    id: 'CC-BY-NC-4.0',
    shortLabel: 'CC BY-NC 4.0 (Attribution-NonCommercial)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'disallow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: true,
    requiresAttribution: true,
    requiresShareAlike: false,
  },
  {
    code: 5,
    id: 'CC-BY-NC-SA-4.0',
    shortLabel: 'CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'disallow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: true,
    requiresAttribution: true,
    requiresShareAlike: true,
  },
  {
    code: 6,
    id: 'CC-BY-ND-4.0',
    shortLabel: 'CC BY-ND 4.0 (Attribution-NoDerivatives)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'allow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: false,
    requiresAttribution: true,
    requiresShareAlike: false,
  },
  {
    code: 7,
    id: 'CC-BY-NC-ND-4.0',
    shortLabel: 'CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivatives)',
    isCreativeCommons: true,
    allowsCommercialDefault: 'disallow',
    allowsRedistributionDefault: 'allow',
    allowsDerivatives: false,
    requiresAttribution: true,
    requiresShareAlike: false,
  },
] as const;

export type LicenseId = (typeof LICENSE_DEFINITIONS)[number]['id'];
export type LicenseCode = (typeof LICENSE_DEFINITIONS)[number]['code'];

export type PolicySignal = 'unspecified' | 'allow' | 'disallow';

export interface LicenseDeclaration {
  licenseId: LicenseId;
  attributionName?: string;
  commercialUse: PolicySignal;
  redistribution: PolicySignal;
  aiTraining: PolicySignal;
  /** Optional extended policy flags supported by Protocol v3 */
  allowsDerivatives?: PolicySignal;
  allowsModifications?: PolicySignal;
  requiresAttribution?: boolean;
}

export interface CompactSnsLink {
  url: string;
  platform?: string;
  label?: string;
}

export type QrSizeTier = 'compact' | 'standard' | 'large' | 'capacity-exceeded';

export interface QrSizingMetrics {
  uncompressedPayloadBytes: number;
  compressedPayloadBytes: number;
  usedDeflate: boolean;
  proofBytesLength: number;
  proofUrlChars: number;
  qrVersion: number | null;
  qrModules: number | null;
  eccLevel: 'L' | 'M' | 'Q' | 'H';
  tier: QrSizeTier;
  savingsBytes: number;
  savingsPct: number;
}

export type ArtworkRegion = readonly [x: number, y: number, width: number, height: number];

export interface UnsignedManifest {
  version:
    | typeof PROTOCOL_VERSION
    | typeof PROTOCOL_VERSION_MASKED
    | typeof PROTOCOL_VERSION_COMPACT;
  artworkId: Uint8Array;
  publicKey: Uint8Array;
  sha256: Uint8Array;
  region: ArtworkRegion;
  qrMask?: ArtworkRegion;
  issuedAt: number;
  license: LicenseDeclaration;
  authorName?: string;
  artworkTitle?: string;
  // Protocol v3 self-contained public metadata (offline QR readable)
  description?: string;
  tags?: string[];
  website?: string;
  snsLinks?: CompactSnsLink[];
  portfolioLinks?: CreatorProfileLink[];
  creationMethod?: CreationMethod;
  creationEnvironment?: CreationEnvironmentData;
  evidenceHashes?: EvidenceHashRecord[];
  policyNote?: string;
}

export interface SignedManifest extends UnsignedManifest {
  artworkIdHex: string;
  signature: Uint8Array;
}

export type SignatureStatus = 'valid' | 'invalid' | 'unsupported';
export type ArtworkIntegrityStatus = 'matched' | 'mismatched' | 'not-checked';
export type AuthorIdentityStatus = 'locally-trusted' | 'unknown';
export type LocalKeyNoticeStatus = 'none-local' | 'revocation-notice' | 'rotation-notice';

export interface VerificationKeyNoticeSummary {
  id: string;
  noticeType: 'revocation' | 'rotation';
  reason: 'key-compromise' | 'key-superseded' | 'retired' | 'other';
  subjectFingerprintShort: string;
  replacementFingerprintShort?: string;
  replacementPublicKeyBase64Url?: string;
  noticeIssuedAt: number;
  verifiedAt: number;
  note?: string;
}

export interface VerificationResult {
  protocolVersion: number | null;
  signatureStatus: SignatureStatus;
  integrityStatus: ArtworkIntegrityStatus;
  identityStatus: AuthorIdentityStatus;
  manifest: SignedManifest | null;
  proofBytes?: Uint8Array | null;
  publicKeyFingerprintHex: string | null;
  publicKeyFingerprintShort: string | null;
  trustedKeyLabel: string | null;
  trustedKeyUnconfirmed?: boolean;
  keyNoticeStatus?: LocalKeyNoticeStatus;
  keyNotices?: VerificationKeyNoticeSummary[];
  qrMaskCoveragePct?: number | null;
  qrMaskCoverageTier?: 'ok' | 'caution' | 'high' | null;
  matchedMode: 'embedded-region' | 'full-artwork' | 'in-image-masked' | null;
  computedArtworkSha256Hex: string | null;
  proofBytesLength: number | null;
  errors: string[];
  warnings: string[];
}

export type CreationMethod =
  | 'hand-drawn-no-ai'
  | 'hand-drawn-ai-assisted'
  | 'ai-generated'
  | 'other'
  | 'prefer-not-to-disclose';

export type EvidenceCategory =
  | 'sketch'
  | 'wip'
  | 'intermediate'
  | 'timelapse'
  | 'project-file'
  | 'other';

export interface ExtendedArtworkMetadata {
  title?: string;
  artistName?: string;
  description?: string;
}

export interface CreatorProfileLink {
  url: string;
  label?: string;
}

export interface CreatorProfileData {
  displayName?: string;
  website?: string;
  links?: CreatorProfileLink[];
}

export interface CreationEnvironmentData {
  software?: string;
  hardware?: string;
  inputDevice?: string;
  notes?: string;
}

export interface EvidenceHashRecord {
  sha256: Uint8Array;
  byteLength: number;
  label?: string;
  category?: EvidenceCategory;
  mimeType?: string;
}

export interface UnsignedEvidenceExtension {
  version: 1;
  evidenceId: Uint8Array;
  publicKey: Uint8Array;
  proofSha256: Uint8Array;
  artworkId: Uint8Array;
  artworkSha256: Uint8Array;
  issuedAt: number;
  artworkMetadata?: ExtendedArtworkMetadata;
  creatorProfile?: CreatorProfileData;
  creationMethod?: CreationMethod;
  creationEnvironment?: CreationEnvironmentData;
  evidenceRecords?: EvidenceHashRecord[];
}

export interface SignedEvidenceExtension extends UnsignedEvidenceExtension {
  evidenceIdHex: string;
  artworkIdHex: string;
  proofSha256Hex: string;
  artworkSha256Hex: string;
  signature: Uint8Array;
}

export type EvidenceExtensionStatus =
  | 'none'
  | 'valid'
  | 'invalid'
  | 'binding-mismatch'
  | 'unsupported'
  | 'missing-primary-proof';

export type EvidenceRecordVerificationState = 'verified' | 'unavailable';

export interface EvidenceRecordCheckResult {
  index: number;
  sha256Hex: string;
  byteLength: number;
  label?: string;
  category?: EvidenceCategory;
  mimeType?: string;
  status: EvidenceRecordVerificationState;
  matchedFileName?: string;
}

export interface MismatchedSuppliedEvidenceFile {
  fileName: string;
  byteLength: number;
  computedSha256Hex: string;
}

export interface EvidenceVerificationSummary {
  status: EvidenceExtensionStatus;
  signatureValid: boolean;
  proofBindingValid: boolean;
  publicKeyMatchesProof: boolean;
  artworkIdMatchesProof: boolean;
  artworkSha256MatchesProof: boolean;
  proofSha256MatchesProof: boolean;
  extension: SignedEvidenceExtension | null;
  evidenceBytesLength: number | null;
  recordChecks: EvidenceRecordCheckResult[];
  verifiedRecordCount: number;
  unavailableRecordCount: number;
  mismatchedSuppliedFiles: MismatchedSuppliedEvidenceFile[];
  errors: string[];
  warnings: string[];
}

export function getLicenseByCode(code: number): (typeof LICENSE_DEFINITIONS)[number] | undefined {
  return LICENSE_DEFINITIONS.find((d) => d.code === code);
}

export function getLicenseById(id: LicenseId): (typeof LICENSE_DEFINITIONS)[number] {
  const found = LICENSE_DEFINITIONS.find((d) => d.id === id);
  if (!found) {
    throw new Error(`Unknown license id: ${id}`);
  }
  return found;
}
