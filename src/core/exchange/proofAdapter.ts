import {
  PROOF_SCHEMA_VERSION_V2,
  isSignedChmProofV2,
  verifyChmProofAny,
  type SignedChmProofV2,
} from '../manifest/proofV2';

export const CHM_EXCHANGE_PACKAGE_VERSION = '2.0' as const;

export interface ChmExchangeGalleryDeckMetadata {
  title: string;
  authorName: string;
  description?: string;
  tags?: string[];
  licenseId?: string;
  createdAt: string;
}

export interface ChmExchangeArtworkPackage {
  exchange_schema_version: typeof CHM_EXCHANGE_PACKAGE_VERSION;
  package_type: 'chm-verified-artwork';
  proof: SignedChmProofV2;
  gallery_deck: ChmExchangeGalleryDeckMetadata;
  /** Optional base64-encoded certified PNG (never strips embedded proof chunks). */
  certified_png_base64?: string;
  exported_at: string;
}

/**
 * Builds a CHM-Exchange distribution package preserving the full v2 cryptographic proof
 * without stripping provenance metadata or Ed25519 signatures.
 */
export function createChmExchangeArtworkPackage(params: {
  proof: SignedChmProofV2;
  galleryDeck: ChmExchangeGalleryDeckMetadata;
  certifiedPngBase64?: string;
}): ChmExchangeArtworkPackage {
  if (!isSignedChmProofV2(params.proof)) {
    throw new Error('CHM-Exchange requires a valid signed v2 native project proof.');
  }
  if (!params.proof.payload.provenance_metadata.layer_metrics.has_multi_layer_structure) {
    throw new Error('Standalone unmerged raster images cannot be packaged for CHM-Exchange.');
  }

  return {
    exchange_schema_version: CHM_EXCHANGE_PACKAGE_VERSION,
    package_type: 'chm-verified-artwork',
    proof: params.proof,
    gallery_deck: {
      title: params.galleryDeck.title,
      authorName: params.galleryDeck.authorName,
      description: params.galleryDeck.description,
      tags: params.galleryDeck.tags ? [...params.galleryDeck.tags] : [],
      licenseId: params.galleryDeck.licenseId,
      createdAt: params.galleryDeck.createdAt,
    },
    certified_png_base64: params.certifiedPngBase64,
    exported_at: new Date().toISOString(),
  };
}

/**
 * Parses and cryptographically validates an incoming CHM-Exchange artwork package.
 */
export async function parseAndVerifyChmExchangePackage(
  rawJson: string | unknown,
  mergedImageBytes?: Uint8Array,
): Promise<{
  valid: boolean;
  pkg: ChmExchangeArtworkPackage | null;
  errors: string[];
}> {
  let parsed: unknown = rawJson;
  if (typeof rawJson === 'string') {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return { valid: false, pkg: null, errors: ['Invalid JSON in CHM-Exchange package.'] };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, pkg: null, errors: ['CHM-Exchange package must be an object.'] };
  }

  const obj = parsed as Record<string, unknown>;
  if (
    obj.exchange_schema_version !== CHM_EXCHANGE_PACKAGE_VERSION ||
    obj.package_type !== 'chm-verified-artwork'
  ) {
    return {
      valid: false,
      pkg: null,
      errors: ['Unsupported CHM-Exchange package schema version or type.'],
    };
  }

  if (!isSignedChmProofV2(obj.proof)) {
    return {
      valid: false,
      pkg: null,
      errors: ['CHM-Exchange package is missing a valid v2 cryptographic proof.'],
    };
  }

  if (obj.proof.payload.schema_version !== PROOF_SCHEMA_VERSION_V2) {
    return {
      valid: false,
      pkg: null,
      errors: ['CHM-Exchange package proof must be schema_version "2".'],
    };
  }

  const verification = await verifyChmProofAny({
    proof: obj.proof,
    mergedImageBytes,
  });

  if (!verification.valid) {
    return {
      valid: false,
      pkg: null,
      errors: verification.errors,
    };
  }

  return {
    valid: true,
    pkg: obj as unknown as ChmExchangeArtworkPackage,
    errors: [],
  };
}
