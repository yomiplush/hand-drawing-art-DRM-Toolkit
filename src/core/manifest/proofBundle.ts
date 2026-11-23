import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import { buildProofUrl } from './proofUrl';
import { DEFAULT_VERIFY_BASE_URL, MAX_PROOF_BYTES } from './types';

export const PROOF_BUNDLE_FORMAT = 'certified-handmade-proof-bundle' as const;
export const PROOF_BUNDLE_VERSION = 1 as const;

export interface PortableProofBundle {
  format: typeof PROOF_BUNDLE_FORMAT;
  version: typeof PROOF_BUNDLE_VERSION;
  protocolVersion: 1 | 2;
  artworkId: string;
  publicKeyFingerprint: string;
  proofBase64Url: string;
  verifyUrl: string;
  createdAt: string;
}

const MAX_PROOF_TOKEN_CHARS = Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 16;

export function createPortableProofBundle(params: {
  protocolVersion: 1 | 2;
  artworkId: string;
  publicKeyFingerprint: string;
  proofBytes: Uint8Array;
  verifyBaseUrl?: string;
  createdAt?: string;
}): PortableProofBundle {
  const proofBase64Url = base64UrlEncode(params.proofBytes);
  return {
    format: PROOF_BUNDLE_FORMAT,
    version: PROOF_BUNDLE_VERSION,
    protocolVersion: params.protocolVersion,
    artworkId: params.artworkId,
    publicKeyFingerprint: params.publicKeyFingerprint,
    proofBase64Url,
    verifyUrl: buildProofUrl(params.proofBytes, params.verifyBaseUrl ?? DEFAULT_VERIFY_BASE_URL),
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

export function parsePortableProofBundle(raw: unknown): {
  bundle: PortableProofBundle;
  proofBytes: Uint8Array;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid proof bundle JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== PROOF_BUNDLE_FORMAT) {
    throw new Error('Unsupported proof bundle format');
  }
  if (obj.version !== PROOF_BUNDLE_VERSION) {
    throw new Error(`Unsupported proof bundle version: ${String(obj.version)}`);
  }
  if (
    typeof obj.proofBase64Url !== 'string' ||
    obj.proofBase64Url.length === 0 ||
    obj.proofBase64Url.length > MAX_PROOF_TOKEN_CHARS ||
    !/^[A-Za-z0-9_-]+$/.test(obj.proofBase64Url)
  ) {
    throw new Error('Proof bundle contains invalid proofBase64Url payload');
  }
  const proofBytes = base64UrlDecode(obj.proofBase64Url);
  if (proofBytes.length === 0 || proofBytes.length > MAX_PROOF_BYTES) {
    throw new Error('Proof bundle payload bytes out of bounds');
  }

  return {
    bundle: {
      format: PROOF_BUNDLE_FORMAT,
      version: PROOF_BUNDLE_VERSION,
      protocolVersion: obj.protocolVersion === 2 ? 2 : 1,
      artworkId: typeof obj.artworkId === 'string' ? obj.artworkId : '',
      publicKeyFingerprint:
        typeof obj.publicKeyFingerprint === 'string' ? obj.publicKeyFingerprint : '',
      proofBase64Url: obj.proofBase64Url,
      verifyUrl: typeof obj.verifyUrl === 'string' ? obj.verifyUrl : '',
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
    },
    proofBytes,
  };
}
