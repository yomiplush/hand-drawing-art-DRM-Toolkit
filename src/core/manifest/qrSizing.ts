import { base64UrlEncode } from '../crypto/sha256';
import { generateQrMatrix, type QrErrorCorrectionLevel } from '../qr/qrGenerator';
import { cborEncodeShim } from './qrSizingShim';
import { encodeUnsignedPayload } from './cborCodec';
import { deflateRawFixed } from './deflateRaw';
import { sanitizeVerifyBaseUrl } from './proofUrl';
import {
  DEFAULT_VERIFY_BASE_URL,
  MAX_PROOF_BYTES,
  PROTOCOL_VERSION_COMPACT,
  type QrSizeTier,
  type QrSizingMetrics,
  type UnsignedManifest,
} from './types';

/**
 * Classifies QR symbol density into human-friendly scanning guidance tiers.
 * Compact: QR <= 15 (77x77 modules) — effortless scanning even at small sizes.
 * Standard: QR <= 25 (117x117 modules) — reliable phone camera scanning.
 * Large: QR <= 40 — dense; recommend high-resolution PNG or shorter fields.
 */
export function classifyQrSizeTier(
  proofBytesLength: number,
  qrVersion: number | null,
): QrSizeTier {
  if (proofBytesLength > MAX_PROOF_BYTES || qrVersion === null) {
    return 'capacity-exceeded';
  }
  if (qrVersion <= 15) return 'compact';
  if (qrVersion <= 25) return 'standard';
  return 'large';
}

/**
 * Synchronous real-time QR sizing & URL preview helper for the `/create` UI.
 * Works before signing by substituting deterministic placeholder hashes & signature.
 */
export function measureUnsignedQrSizing(params: {
  manifestWithoutCrypto?: Partial<UnsignedManifest>;
  manifest?: UnsignedManifest;
  verifyBaseUrl?: string;
  eccLevel?: QrErrorCorrectionLevel;
}): QrSizingMetrics & { previewUrl: string | null } {
  const eccLevel = params.eccLevel ?? 'M';
  const manifest: UnsignedManifest = params.manifest ?? {
    version: PROTOCOL_VERSION_COMPACT,
    artworkId: params.manifestWithoutCrypto?.artworkId ?? new Uint8Array(16).fill(0x11),
    publicKey: params.manifestWithoutCrypto?.publicKey ?? new Uint8Array(32).fill(0x22),
    sha256: params.manifestWithoutCrypto?.sha256 ?? new Uint8Array(32).fill(0x33),
    region: params.manifestWithoutCrypto?.region ?? [0, 0, 1200, 1200],
    qrMask: params.manifestWithoutCrypto?.qrMask,
    issuedAt: params.manifestWithoutCrypto?.issuedAt ?? Math.floor(Date.now() / 1000),
    license: params.manifestWithoutCrypto?.license ?? {
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
    },
    authorName: params.manifestWithoutCrypto?.authorName,
    artworkTitle: params.manifestWithoutCrypto?.artworkTitle,
    description: params.manifestWithoutCrypto?.description,
    tags: params.manifestWithoutCrypto?.tags,
    website: params.manifestWithoutCrypto?.website,
    snsLinks: params.manifestWithoutCrypto?.snsLinks,
    portfolioLinks: params.manifestWithoutCrypto?.portfolioLinks,
    creationMethod: params.manifestWithoutCrypto?.creationMethod,
    creationEnvironment: params.manifestWithoutCrypto?.creationEnvironment,
    evidenceHashes: params.manifestWithoutCrypto?.evidenceHashes,
    policyNote: params.manifestWithoutCrypto?.policyNote,
  };

  const payloadBytes = encodeUnsignedPayload(manifest);
  const deflated =
    manifest.version === PROTOCOL_VERSION_COMPACT ? deflateRawFixed(payloadBytes) : null;
  const usedDeflate = deflated !== null && deflated.length < payloadBytes.length;
  const compressedPayloadBytes = usedDeflate ? deflated.length : payloadBytes.length;
  const dummySig = new Uint8Array(64).fill(0x55);

  const envelopeBytes = cborEncodeShim(
    manifest.version === PROTOCOL_VERSION_COMPACT
      ? [
          PROTOCOL_VERSION_COMPACT,
          usedDeflate ? 1 : 0,
          usedDeflate ? deflated : payloadBytes,
          dummySig,
        ]
      : [manifest.version, payloadBytes, dummySig],
  );

  const cleanBase = sanitizeVerifyBaseUrl(params.verifyBaseUrl ?? DEFAULT_VERIFY_BASE_URL);
  const previewUrl = `${cleanBase}#proof=${base64UrlEncode(envelopeBytes)}`;
  const savingsBytes = Math.max(0, payloadBytes.length - compressedPayloadBytes);
  const savingsPct =
    payloadBytes.length > 0 ? Math.round((savingsBytes / payloadBytes.length) * 1000) / 10 : 0;

  if (envelopeBytes.length > MAX_PROOF_BYTES) {
    return {
      uncompressedPayloadBytes: payloadBytes.length,
      compressedPayloadBytes,
      usedDeflate,
      proofBytesLength: envelopeBytes.length,
      proofUrlChars: previewUrl.length,
      qrVersion: null,
      qrModules: null,
      eccLevel,
      tier: 'capacity-exceeded',
      savingsBytes,
      savingsPct,
      previewUrl: null,
    };
  }

  try {
    const qr = generateQrMatrix(previewUrl, eccLevel);
    return {
      uncompressedPayloadBytes: payloadBytes.length,
      compressedPayloadBytes,
      usedDeflate,
      proofBytesLength: envelopeBytes.length,
      proofUrlChars: previewUrl.length,
      qrVersion: qr.version,
      qrModules: qr.size,
      eccLevel,
      tier: classifyQrSizeTier(envelopeBytes.length, qr.version),
      savingsBytes,
      savingsPct,
      previewUrl,
    };
  } catch {
    return {
      uncompressedPayloadBytes: payloadBytes.length,
      compressedPayloadBytes,
      usedDeflate,
      proofBytesLength: envelopeBytes.length,
      proofUrlChars: previewUrl.length,
      qrVersion: null,
      qrModules: null,
      eccLevel,
      tier: 'capacity-exceeded',
      savingsBytes,
      savingsPct,
      previewUrl: null,
    };
  }
}
