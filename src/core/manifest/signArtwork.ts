import { computePublicKeyFingerprint } from '../crypto/ed25519';
import { hashCanonicalRaster, hashMaskedArtworkRegion } from '../image/canonicalRaster';
import { clampInImageQrOptions, overlayQrIntoArtwork } from '../image/inImageQr';
import type { ClampedInImageQrOptions, InImageQrOptions } from '../image/inImageQr';
import { assertArtworkInputBounds, encodeCanonicalRgba8ToPng } from '../image/pngCodec';
import type { CanonicalRaster } from '../image/pngCodec';
import { burnQrIntoRaster, computeBurnLayout } from '../image/qrBurner';
import type { BurnLayout, QrBurnOptions } from '../image/qrBurner';
import { decodeQrFromRegion } from '../qr/qrDecoder';
import { generateQrMatrix } from '../qr/qrGenerator';
import { signWithAuthorKey } from '../storage/keyStore';
import type { AuthorKeyRecord } from '../storage/keyStore';
import {
  buildSigningMessage,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
  formatUuidHex,
  generateArtworkId,
} from './cborCodec';
import { buildCompactBase45ProofUrl, buildProofUrl } from './proofUrl';
import {
  DEFAULT_VERIFY_BASE_URL,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_COMPACT,
  PROTOCOL_VERSION_MASKED,
} from './types';
import type {
  ArtworkRegion,
  CompactSnsLink,
  CreationEnvironmentData,
  CreationMethod,
  CreatorProfileLink,
  EvidenceHashRecord,
  LicenseDeclaration,
  SignedManifest,
  UnsignedManifest,
} from './types';

export interface CompactPublicMetadataParams {
  protocolVersion?: 1 | 2 | 3;
  description?: string;
  website?: string;
  snsLinks?: CompactSnsLink[];
  portfolioLinks?: CreatorProfileLink[];
  creationMethod?: CreationMethod;
  creationEnvironment?: CreationEnvironmentData;
  evidenceHashes?: EvidenceHashRecord[];
  policyNote?: string;
}

export interface SignedArtworkResult {
  pngBytes: Uint8Array;
  raster: CanonicalRaster;
  layout: BurnLayout;
  manifest: SignedManifest;
  proofBytes: Uint8Array;
  proofUrl: string;
  qrVersion: number;
  qrModules: number;
  qrVerifiedReadable: boolean;
}

export interface InImageSignedArtworkResult {
  pngBytes: Uint8Array;
  raster: CanonicalRaster;
  qrMask: ArtworkRegion;
  clampedOptions: ClampedInImageQrOptions;
  manifest: SignedManifest;
  proofBytes: Uint8Array;
  proofUrl: string;
  qrVersion: number;
  qrModules: number;
  qrVerifiedReadable: boolean;
}

function shouldUseV3(
  params: CompactPublicMetadataParams & { license: LicenseDeclaration },
): boolean {
  if (params.protocolVersion === PROTOCOL_VERSION_COMPACT) return true;
  if (
    params.description !== undefined ||
    params.website !== undefined ||
    (params.snsLinks && params.snsLinks.length > 0) ||
    (params.portfolioLinks && params.portfolioLinks.length > 0) ||
    params.creationMethod !== undefined ||
    params.creationEnvironment !== undefined ||
    (params.evidenceHashes && params.evidenceHashes.length > 0) ||
    params.policyNote !== undefined ||
    params.license.allowsDerivatives !== undefined ||
    params.license.allowsModifications !== undefined ||
    params.license.requiresAttribution !== undefined
  ) {
    return true;
  }
  return false;
}

function pickOptionalV3Fields(params: CompactPublicMetadataParams) {
  return {
    ...(params.description !== undefined ? { description: params.description } : {}),
    ...(params.website !== undefined ? { website: params.website } : {}),
    ...(params.snsLinks && params.snsLinks.length > 0 ? { snsLinks: params.snsLinks } : {}),
    ...(params.portfolioLinks && params.portfolioLinks.length > 0
      ? { portfolioLinks: params.portfolioLinks }
      : {}),
    ...(params.creationMethod !== undefined ? { creationMethod: params.creationMethod } : {}),
    ...(params.creationEnvironment !== undefined
      ? { creationEnvironment: params.creationEnvironment }
      : {}),
    ...(params.evidenceHashes && params.evidenceHashes.length > 0
      ? { evidenceHashes: params.evidenceHashes }
      : {}),
    ...(params.policyNote !== undefined ? { policyNote: params.policyNote } : {}),
  };
}

export async function createSignedArtworkPng(
  params: CompactPublicMetadataParams & {
    artworkRaster: CanonicalRaster;
    authorKey: AuthorKeyRecord;
    passphraseIfEncrypted?: string;
    authorName?: string;
    artworkTitle?: string;
    license: LicenseDeclaration;
    burnOptions: QrBurnOptions;
    verifyBaseUrl?: string;
    compactBase45Url?: boolean;
    issuedAt?: number;
  },
): Promise<SignedArtworkResult> {
  const {
    artworkRaster,
    authorKey,
    passphraseIfEncrypted,
    authorName,
    artworkTitle,
    license,
    burnOptions,
    verifyBaseUrl = DEFAULT_VERIFY_BASE_URL,
    compactBase45Url = false,
    issuedAt = Math.floor(Date.now() / 1000),
  } = params;

  assertArtworkInputBounds(artworkRaster);

  const effectiveVersion = shouldUseV3(params) ? PROTOCOL_VERSION_COMPACT : PROTOCOL_VERSION;
  const v3Fields = effectiveVersion === PROTOCOL_VERSION_COMPACT ? pickOptionalV3Fields(params) : {};

  const sha256 = await hashCanonicalRaster(artworkRaster);
  const artworkId = generateArtworkId();
  const artworkIdHex = formatUuidHex(artworkId);
  const dummySig = new Uint8Array(64);

  // Converge QR module size and artwork region coordinates (max 3 iterations)
  let currentRegion: ArtworkRegion = [
    burnOptions.marginPx,
    burnOptions.marginPx,
    artworkRaster.width,
    artworkRaster.height,
  ];
  let qrModules = 45;

  for (let pass = 0; pass < 3; pass++) {
    const prelimManifest: UnsignedManifest = {
      version: effectiveVersion,
      artworkId,
      publicKey: authorKey.publicKey,
      sha256,
      region: currentRegion,
      issuedAt,
      license,
      authorName,
      artworkTitle,
      ...v3Fields,
    };
    const prelimPayload = encodeUnsignedPayload(prelimManifest);
    const prelimProof = encodeSignedProofEnvelope(prelimPayload, dummySig, effectiveVersion);
    const prelimUrl = buildProofUrl(prelimProof, verifyBaseUrl);
    const prelimQr = generateQrMatrix(prelimUrl, 'M');
    const prelimLayout = computeBurnLayout(
      artworkRaster.width,
      artworkRaster.height,
      prelimQr.size,
      burnOptions,
    );

    const sameRegion =
      prelimLayout.artRegion[0] === currentRegion[0] &&
      prelimLayout.artRegion[1] === currentRegion[1] &&
      prelimLayout.artRegion[2] === currentRegion[2] &&
      prelimLayout.artRegion[3] === currentRegion[3];

    qrModules = prelimQr.size;
    currentRegion = prelimLayout.artRegion;
    if (sameRegion && pass > 0) {
      break;
    }
  }

  const unsignedManifest: UnsignedManifest = {
    version: effectiveVersion,
    artworkId,
    publicKey: authorKey.publicKey,
    sha256,
    region: currentRegion,
    issuedAt,
    license,
    authorName,
    artworkTitle,
    ...v3Fields,
  };

  const payloadBytes = encodeUnsignedPayload(unsignedManifest);
  const signingMessage = buildSigningMessage(payloadBytes, effectiveVersion);
  const signature = await signWithAuthorKey(authorKey, signingMessage, passphraseIfEncrypted);
  const proofBytes = encodeSignedProofEnvelope(payloadBytes, signature, effectiveVersion);
  const proofUrl = compactBase45Url
    ? buildCompactBase45ProofUrl(proofBytes)
    : buildProofUrl(proofBytes, verifyBaseUrl);
  const qrMatrix = generateQrMatrix(proofUrl, 'M');

  // Verify layout matches converged module count
  const convergedLayout = computeBurnLayout(
    artworkRaster.width,
    artworkRaster.height,
    qrMatrix.size,
    burnOptions,
  );
  if (
    convergedLayout.artRegion[0] !== currentRegion[0] ||
    convergedLayout.artRegion[1] !== currentRegion[1] ||
    qrMatrix.size !== qrModules
  ) {
    // Re-sign once with exact converged region if boundary crossed
    unsignedManifest.region = convergedLayout.artRegion;
    const retryPayload = encodeUnsignedPayload(unsignedManifest);
    const retryMsg = buildSigningMessage(retryPayload, effectiveVersion);
    const retrySig = await signWithAuthorKey(authorKey, retryMsg, passphraseIfEncrypted);
    const retryProof = encodeSignedProofEnvelope(retryPayload, retrySig, effectiveVersion);
    const retryUrl = buildProofUrl(retryProof, verifyBaseUrl);
    const retryQr = generateQrMatrix(retryUrl, 'M');
    return finalizeSignedPng({
      artworkRaster,
      unsignedManifest,
      signature: retrySig,
      proofBytes: retryProof,
      proofUrl: retryUrl,
      qrMatrix: retryQr,
      artworkIdHex,
      burnOptions,
    });
  }

  return finalizeSignedPng({
    artworkRaster,
    unsignedManifest,
    signature,
    proofBytes,
    proofUrl,
    qrMatrix,
    artworkIdHex,
    burnOptions,
  });
}

async function finalizeSignedPng(params: {
  artworkRaster: CanonicalRaster;
  unsignedManifest: UnsignedManifest;
  signature: Uint8Array;
  proofBytes: Uint8Array;
  proofUrl: string;
  qrMatrix: ReturnType<typeof generateQrMatrix>;
  artworkIdHex: string;
  burnOptions: QrBurnOptions;
}): Promise<SignedArtworkResult> {
  const {
    artworkRaster,
    unsignedManifest,
    signature,
    proofBytes,
    proofUrl,
    qrMatrix,
    artworkIdHex,
    burnOptions,
  } = params;

  const fp = await computePublicKeyFingerprint(unsignedManifest.publicKey);
  const titleLine = unsignedManifest.artworkTitle
    ? unsignedManifest.artworkTitle
    : unsignedManifest.authorName
      ? `By ${unsignedManifest.authorName}`
      : `Artwork ${artworkIdHex.slice(0, 8).toUpperCase()}`;

  const labelLines = burnOptions.labelLines ?? [
    'CERTIFIED HANDMADE · PROVENANCE',
    titleLine,
    `KEY ${fp.shortDisplay}`,
    `LIC ${unsignedManifest.license.licenseId} · ID ${artworkIdHex.slice(0, 13)}`,
  ];

  const { raster, layout } = burnQrIntoRaster(artworkRaster, qrMatrix, {
    ...burnOptions,
    labelLines,
  });

  const decodedCheck = decodeQrFromRegion(
    raster,
    [layout.qrBox.x, layout.qrBox.y, layout.qrBox.size, layout.qrBox.size],
    4,
  );
  const qrVerifiedReadable = decodedCheck !== null && decodedCheck.rawText === proofUrl;

  const pngBytes = encodeCanonicalRgba8ToPng(raster, {
    Software: `Certified Handmade v${unsignedManifest.version}`,
    'CHM-Protocol': String(unsignedManifest.version),
    'CHM-Artwork-ID': artworkIdHex,
  });

  return {
    pngBytes,
    raster,
    layout,
    manifest: {
      ...unsignedManifest,
      artworkIdHex,
      signature,
    },
    proofBytes,
    proofUrl,
    qrVersion: qrMatrix.version,
    qrModules: qrMatrix.size,
    qrVerifiedReadable,
  };
}

/**
 * Signs an artwork using Protocol v2 (`qrMask`) or v3 (`qrMask` + compact public details)
 * and embeds a semi-transparent or styled QR code directly inside the illustration at the
 * user's manually chosen coordinates.
 * Every pixel outside `qrMask` is hashed into the signed SHA-256 digest and preserved untouched.
 */
export async function createInImageSignedArtworkPng(
  params: CompactPublicMetadataParams & {
    artworkRaster: CanonicalRaster;
    authorKey: AuthorKeyRecord;
    passphraseIfEncrypted?: string;
    authorName?: string;
    artworkTitle?: string;
    license: LicenseDeclaration;
    qrOptions: InImageQrOptions;
    verifyBaseUrl?: string;
    compactBase45Url?: boolean;
    issuedAt?: number;
  },
): Promise<InImageSignedArtworkResult> {
  const {
    artworkRaster,
    authorKey,
    passphraseIfEncrypted,
    authorName,
    artworkTitle,
    license,
    qrOptions,
    verifyBaseUrl = DEFAULT_VERIFY_BASE_URL,
    compactBase45Url = false,
    issuedAt = Math.floor(Date.now() / 1000),
  } = params;

  assertArtworkInputBounds(artworkRaster);

  const effectiveVersion = shouldUseV3(params)
    ? PROTOCOL_VERSION_COMPACT
    : PROTOCOL_VERSION_MASKED;
  const v3Fields = effectiveVersion === PROTOCOL_VERSION_COMPACT ? pickOptionalV3Fields(params) : {};

  const clamped = clampInImageQrOptions(artworkRaster.width, artworkRaster.height, qrOptions);
  const region: ArtworkRegion = [0, 0, artworkRaster.width, artworkRaster.height];
  const qrMask: ArtworkRegion = [clamped.x, clamped.y, clamped.boxSize, clamped.boxSize];

  const { digest: sha256 } = await hashMaskedArtworkRegion(artworkRaster, region, qrMask);
  const artworkId = generateArtworkId();
  const artworkIdHex = formatUuidHex(artworkId);

  const unsignedManifest: UnsignedManifest = {
    version: effectiveVersion,
    artworkId,
    publicKey: authorKey.publicKey,
    sha256,
    region,
    qrMask,
    issuedAt,
    license,
    authorName,
    artworkTitle,
    ...v3Fields,
  };

  const payloadBytes = encodeUnsignedPayload(unsignedManifest);
  const signingMessage = buildSigningMessage(payloadBytes, effectiveVersion);
  const signature = await signWithAuthorKey(authorKey, signingMessage, passphraseIfEncrypted);
  const proofBytes = encodeSignedProofEnvelope(payloadBytes, signature, effectiveVersion);
  const proofUrl = compactBase45Url
    ? buildCompactBase45ProofUrl(proofBytes)
    : buildProofUrl(proofBytes, verifyBaseUrl);
  const qrMatrix = generateQrMatrix(proofUrl, clamped.eccLevel);

  const { raster, clamped: finalClamped } = overlayQrIntoArtwork(
    artworkRaster,
    qrMatrix,
    clamped,
  );

  const decodedCheck = decodeQrFromRegion(raster, qrMask, 8);
  const qrVerifiedReadable = decodedCheck !== null && decodedCheck.rawText === proofUrl;

  const pngBytes = encodeCanonicalRgba8ToPng(raster, {
    Software: `Certified Handmade v${effectiveVersion}`,
    'CHM-Protocol': String(effectiveVersion),
    'CHM-Artwork-ID': artworkIdHex,
  });

  return {
    pngBytes,
    raster,
    qrMask,
    clampedOptions: finalClamped,
    manifest: {
      ...unsignedManifest,
      artworkIdHex,
      signature,
    },
    proofBytes,
    proofUrl,
    qrVersion: qrMatrix.version,
    qrModules: qrMatrix.size,
    qrVerifiedReadable,
  };
}
