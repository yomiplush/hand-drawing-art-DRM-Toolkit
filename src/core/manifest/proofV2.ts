import { bytesToHex, hexToBytes, sha256 } from '../crypto/sha256';
import { signWithSeed, verifyEd25519Signature } from '../crypto/ed25519';
import { base64UrlDecode, base64UrlEncode } from '@yomiplush/chm-exchange/core';

export const PROOF_SCHEMA_VERSION_V1 = '1' as const;
export const PROOF_SCHEMA_VERSION_V2 = '2' as const;

export type NativeProjectFormat =
  | 'PSD'
  | 'PSB'
  | 'CLIP'
  | 'PROCREATE'
  | 'KRA'
  | 'ORA'
  | 'SAI'
  | 'SAI2'
  | 'MDP'
  | 'AFDESIGN'
  | 'AFPHOTO'
  | 'XCF';

export type MergeMethod = 'full-layer-render' | 'structural-composite-extract';

export interface LayerMetrics {
  layer_count: number;
  visible_layer_count: number;
  canvas_width: number;
  canvas_height: number;
  has_multi_layer_structure: boolean;
}

export interface ProvenanceMetadataV2 {
  project_format: NativeProjectFormat;
  merge_method: MergeMethod;
  layer_metrics: LayerMetrics;
  timelapse_detected: boolean;
  software_signature: string;
  timestamp: string;
  source_file_size_bytes: number;
}

export interface ChmProofV2Payload {
  schema_version: typeof PROOF_SCHEMA_VERSION_V2;
  proof_id: string;
  merged_image_sha256: string;
  source_project_sha256: string;
  provenance_metadata: ProvenanceMetadataV2;
  artist_public_key: string;
  artwork_title?: string;
  author_name?: string;
}

export interface SignedChmProofV2 {
  payload: ChmProofV2Payload;
  signature_ed25519: string;
}

/** Legacy v1 JSON proof shape kept for backward-compatible verification. */
export interface SignedChmProofV1 {
  schema_version?: typeof PROOF_SCHEMA_VERSION_V1;
  artwork_sha256: string;
  artist_public_key: string;
  issued_at: string;
  signature_ed25519: string;
  artwork_title?: string;
  author_name?: string;
}

export type AnyChmJsonProof = SignedChmProofV2 | SignedChmProofV1;

export interface ProofV2VerificationResult {
  valid: boolean;
  schemaVersion: '1' | '2' | 'unknown';
  signatureValid: boolean;
  mergedImageHashMatches: boolean | null;
  sourceProjectHashMatches: boolean | null;
  nativeProjectCertified: boolean;
  errors: string[];
  warnings: string[];
  payload?: ChmProofV2Payload;
}

const DOMAIN_PREFIX_V2 = 'CHM-PROOF-V2\0';

/**
 * Deterministic canonical JSON serialization (recursively sorted object keys)
 * so Ed25519 signatures are identical across runtimes.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalizeJson(v)}`).join(',')}}`;
}

function buildSigningBytesV2(payload: ChmProofV2Payload): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`${DOMAIN_PREFIX_V2}${canonicalizeJson(payload)}`);
}

export function isSignedChmProofV2(input: unknown): input is SignedChmProofV2 {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  if (!obj.payload || typeof obj.payload !== 'object') return false;
  if (typeof obj.signature_ed25519 !== 'string') return false;
  const payload = obj.payload as Record<string, unknown>;
  return (
    payload.schema_version === PROOF_SCHEMA_VERSION_V2 &&
    typeof payload.merged_image_sha256 === 'string' &&
    typeof payload.source_project_sha256 === 'string' &&
    typeof payload.artist_public_key === 'string' &&
    typeof payload.provenance_metadata === 'object' &&
    payload.provenance_metadata !== null
  );
}

export function isSignedChmProofV1(input: unknown): input is SignedChmProofV1 {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return (
    (obj.schema_version === undefined || obj.schema_version === PROOF_SCHEMA_VERSION_V1) &&
    typeof obj.artwork_sha256 === 'string' &&
    typeof obj.artist_public_key === 'string' &&
    typeof obj.signature_ed25519 === 'string'
  );
}

export async function signChmProofV2(params: {
  payload: ChmProofV2Payload;
  privateKey: Uint8Array;
}): Promise<SignedChmProofV2> {
  const { payload, privateKey } = params;
  if (!/^[0-9a-f]{64}$/i.test(payload.merged_image_sha256)) {
    throw new Error('merged_image_sha256 must be a 64-character hex SHA-256 digest');
  }
  if (!/^[0-9a-f]{64}$/i.test(payload.source_project_sha256)) {
    throw new Error('source_project_sha256 must be a 64-character hex SHA-256 digest');
  }
  if (payload.provenance_metadata.layer_metrics.layer_count < 1) {
    throw new Error('v2 proof requires a verified native project structure (at least 1 layer)');
  }

  const signingBytes = buildSigningBytesV2(payload);
  const signature = signWithSeed(privateKey, signingBytes);
  return {
    payload,
    signature_ed25519: base64UrlEncode(signature),
  };
}

export async function verifyChmProofAny(params: {
  proof: unknown;
  mergedImageBytes?: Uint8Array;
  sourceProjectSha256Hex?: string;
}): Promise<ProofV2VerificationResult> {
  const { proof, mergedImageBytes, sourceProjectSha256Hex } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isSignedChmProofV2(proof)) {
    let signatureValid = false;
    try {
      const publicKey = base64UrlDecode(proof.payload.artist_public_key);
      const signature = base64UrlDecode(proof.signature_ed25519);
      const signingBytes = buildSigningBytesV2(proof.payload);
      signatureValid = await verifyEd25519Signature(publicKey, signingBytes, signature);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Failed to decode v2 signature/public key');
    }

    if (!signatureValid) {
      errors.push('Ed25519 signature verification failed for v2 proof.');
    }

    let mergedImageHashMatches: boolean | null = null;
    if (mergedImageBytes) {
      const computed = bytesToHex(await sha256(mergedImageBytes));
      mergedImageHashMatches =
        computed.toLowerCase() === proof.payload.merged_image_sha256.toLowerCase();
      if (!mergedImageHashMatches) {
        errors.push('Merged PNG SHA-256 does not match signed merged_image_sha256.');
      }
    }

    let sourceProjectHashMatches: boolean | null = null;
    if (sourceProjectSha256Hex) {
      sourceProjectHashMatches =
        sourceProjectSha256Hex.toLowerCase() === proof.payload.source_project_sha256.toLowerCase();
      if (!sourceProjectHashMatches) {
        errors.push('Source project SHA-256 does not match signed source_project_sha256.');
      }
    }

    const nativeProjectCertified =
      Boolean(proof.payload.source_project_sha256) &&
      proof.payload.provenance_metadata.layer_metrics.layer_count >= 1;

    if (!nativeProjectCertified) {
      errors.push('Proof does not attest a valid multi-layer native project file.');
    }

    const valid =
      signatureValid &&
      nativeProjectCertified &&
      mergedImageHashMatches !== false &&
      sourceProjectHashMatches !== false;

    return {
      valid,
      schemaVersion: '2',
      signatureValid,
      mergedImageHashMatches,
      sourceProjectHashMatches,
      nativeProjectCertified,
      errors,
      warnings,
      payload: proof.payload,
    };
  }

  if (isSignedChmProofV1(proof)) {
    warnings.push(
      'Legacy v1 proof verified for backward compatibility. New GalleryDeck submissions require v2 native project proofs.',
    );
    let signatureValid = false;
    try {
      const publicKey = base64UrlDecode(proof.artist_public_key);
      const signature = base64UrlDecode(proof.signature_ed25519);
      const message = new TextEncoder().encode(
        `${proof.artwork_sha256}:${proof.issued_at}:${proof.artist_public_key}`,
      );
      signatureValid = await verifyEd25519Signature(publicKey, message, signature);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Failed to verify legacy v1 signature');
    }

    let mergedImageHashMatches: boolean | null = null;
    if (mergedImageBytes) {
      const computed = bytesToHex(await sha256(mergedImageBytes));
      mergedImageHashMatches = computed.toLowerCase() === proof.artwork_sha256.toLowerCase();
      if (!mergedImageHashMatches) {
        errors.push('Image SHA-256 does not match legacy v1 artwork_sha256.');
      }
    }

    return {
      valid: signatureValid && mergedImageHashMatches !== false,
      schemaVersion: '1',
      signatureValid,
      mergedImageHashMatches,
      sourceProjectHashMatches: null,
      nativeProjectCertified: false,
      errors,
      warnings,
    };
  }

  return {
    valid: false,
    schemaVersion: 'unknown',
    signatureValid: false,
    mergedImageHashMatches: null,
    sourceProjectHashMatches: null,
    nativeProjectCertified: false,
    errors: ['Unsupported or malformed CHM proof JSON schema.'],
    warnings,
  };
}

/**
 * Generates a 16-byte random hex proof ID.
 */
export function createProofIdV2(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  }
  return bytesToHex(bytes);
}

/**
 * Helper to validate hex digest format.
 */
export function isValidSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value) && hexToBytes(value).byteLength === 32;
}
