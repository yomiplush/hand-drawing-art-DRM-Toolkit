export const PROTOCOL_VERSION = 1 as const;
export const PROTOCOL_VERSION_MASKED = 2 as const;
export const DOMAIN_SEPARATION_PREFIX = new Uint8Array([0x43, 0x48, 0x4d, 0x31, 0x00]); // "CHM1\0"
export const DEFAULT_VERIFY_BASE_URL = 'https://certified-handmade.com/verify';

export const MAX_AUTHOR_UTF8_BYTES = 48;
export const MAX_TITLE_UTF8_BYTES = 64;
export const MAX_ATTRIBUTION_UTF8_BYTES = 48;
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
}

export type ArtworkRegion = readonly [x: number, y: number, width: number, height: number];

export interface UnsignedManifest {
  version: typeof PROTOCOL_VERSION | typeof PROTOCOL_VERSION_MASKED;
  artworkId: Uint8Array;
  publicKey: Uint8Array;
  sha256: Uint8Array;
  region: ArtworkRegion;
  qrMask?: ArtworkRegion;
  issuedAt: number;
  license: LicenseDeclaration;
  authorName?: string;
  artworkTitle?: string;
}

export interface SignedManifest extends UnsignedManifest {
  artworkIdHex: string;
  signature: Uint8Array;
}

export type SignatureStatus = 'valid' | 'invalid' | 'unsupported';
export type ArtworkIntegrityStatus = 'matched' | 'mismatched' | 'not-checked';
export type AuthorIdentityStatus = 'locally-trusted' | 'unknown';
export type HumanMadeAssessmentStatus =
  | 'not-assessed'
  | 'experimental-available'
  | 'inconclusive';

export type ContainerFormat = 'png' | 'jpeg' | 'webp' | 'other' | 'unknown';

export type AssessmentSignalOutcome =
  | 'no-image'
  | 'insufficient-visual-signal'
  | 'ai-metadata-detected'
  | 'local-signals-clean';

export interface HumanMadeAssessmentMetrics {
  artworkWidth: number;
  artworkHeight: number;
  containerFormat: ContainerFormat;
  isCertifiedHandmadeOutput: boolean;
  hasC2paContainer: boolean;
  aiMetadataSignals: string[];
  creativeToolHints: string[];
  opaqueRatio: number;
  transparentRatio: number;
  semiTransparentRatio: number;
  edgeDensity: number;
  meanGradient: number;
  flatRegionRatio: number;
  sampledColorBuckets: number;
}

export interface HumanMadeAssessmentResult {
  status: HumanMadeAssessmentStatus;
  modelId: string | null;
  summaryKey: AssessmentSignalOutcome;
  metrics: HumanMadeAssessmentMetrics | null;
  notes: string[];
}

export interface VerificationResult {
  protocolVersion: number | null;
  signatureStatus: SignatureStatus;
  integrityStatus: ArtworkIntegrityStatus;
  identityStatus: AuthorIdentityStatus;
  assessmentStatus: HumanMadeAssessmentStatus;
  assessment?: HumanMadeAssessmentResult;
  manifest: SignedManifest | null;
  publicKeyFingerprintHex: string | null;
  publicKeyFingerprintShort: string | null;
  trustedKeyLabel: string | null;
  matchedMode: 'embedded-region' | 'full-artwork' | 'in-image-masked' | null;
  computedArtworkSha256Hex: string | null;
  proofBytesLength: number | null;
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
