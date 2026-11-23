import { computePublicKeyFingerprint, verifyEd25519Signature } from '../crypto/ed25519';
import { bytesToHex, constantTimeEqual } from '../crypto/sha256';
import {
  hashArtworkRegion,
  hashCanonicalRaster,
  hashMaskedArtworkRegion,
} from '../image/canonicalRaster';
import { computeMaskCoverageStats } from '../image/inImageQr';
import { decodeImageFileToCanonicalRgba8 } from '../image/pngCodec';
import type { CanonicalRaster } from '../image/pngCodec';
import {
  UnsupportedProtocolVersionError,
  buildSigningMessage,
  decodeSignedProofEnvelope,
} from '../manifest/cborCodec';
import { extractProofBytesFromInput } from '../manifest/proofUrl';
import type {
  ArtworkIntegrityStatus,
  AuthorIdentityStatus,
  LocalKeyNoticeStatus,
  SignatureStatus,
  VerificationKeyNoticeSummary,
  VerificationResult,
} from '../manifest/types';
import { decodeQrFromCanonicalRaster } from '../qr/qrDecoder';
import {
  findKeyNoticesByPublicKey,
  findTrustedKeyByPublicKey,
} from '../storage/keyStore';
import type { StoredKeyNoticeRecord, TrustedKeyRecord } from '../storage/keyStore';

export type TrustedKeyLookup = (publicKey32: Uint8Array) => Promise<TrustedKeyRecord | undefined>;
export type KeyNoticeLookup = (publicKey32: Uint8Array) => Promise<StoredKeyNoticeRecord[]>;

export async function verifyProofAndArtwork(params: {
  proofInput: string;
  artworkRaster?: CanonicalRaster | null;
  lookupTrustedKey?: TrustedKeyLookup;
  lookupKeyNotices?: KeyNoticeLookup;
}): Promise<VerificationResult> {
  const {
    proofInput,
    artworkRaster = null,
    lookupTrustedKey = findTrustedKeyByPublicKey,
    lookupKeyNotices = findKeyNoticesByPublicKey,
  } = params;

  const errors: string[] = [];
  const warnings: string[] = [];

  let proofBytes: Uint8Array;
  try {
    proofBytes = extractProofBytesFromInput(proofInput);
  } catch (err) {
    return {
      protocolVersion: null,
      signatureStatus: 'invalid',
      integrityStatus: 'not-checked',
      identityStatus: 'unknown',
      manifest: null,
      proofBytes: null,
      publicKeyFingerprintHex: null,
      publicKeyFingerprintShort: null,
      trustedKeyLabel: null,
      matchedMode: null,
      computedArtworkSha256Hex: null,
      proofBytesLength: null,
      errors: [err instanceof Error ? err.message : 'Failed to parse proof payload'],
      warnings: [],
    };
  }

  let decoded;
  try {
    decoded = decodeSignedProofEnvelope(proofBytes);
  } catch (err) {
    if (err instanceof UnsupportedProtocolVersionError) {
      return {
        protocolVersion: err.version,
        signatureStatus: 'unsupported',
        integrityStatus: 'not-checked',
        identityStatus: 'unknown',
        manifest: null,
        proofBytes,
        publicKeyFingerprintHex: null,
        publicKeyFingerprintShort: null,
        trustedKeyLabel: null,
        matchedMode: null,
        computedArtworkSha256Hex: null,
        proofBytesLength: proofBytes.length,
        errors: [err.message],
        warnings: [],
      };
    }
    return {
      protocolVersion: null,
      signatureStatus: 'invalid',
      integrityStatus: 'not-checked',
      identityStatus: 'unknown',
      manifest: null,
      proofBytes,
      publicKeyFingerprintHex: null,
      publicKeyFingerprintShort: null,
      trustedKeyLabel: null,
      matchedMode: null,
      computedArtworkSha256Hex: null,
      proofBytesLength: proofBytes.length,
      errors: [err instanceof Error ? err.message : 'Invalid CBOR manifest structure'],
      warnings: [],
    };
  }

  const { manifest, payloadBytes, signature } = decoded;
  const signingMessage = buildSigningMessage(payloadBytes);
  const sigValid = await verifyEd25519Signature(manifest.publicKey, signingMessage, signature);
  const signatureStatus: SignatureStatus = sigValid ? 'valid' : 'invalid';
  if (!sigValid) {
    errors.push('Ed25519 signature verification failed: manifest or signature was tampered with.');
  }

  const fp = await computePublicKeyFingerprint(manifest.publicKey);
  let trustedRecord: TrustedKeyRecord | undefined;
  try {
    trustedRecord = await lookupTrustedKey(manifest.publicKey);
  } catch {
    trustedRecord = undefined;
  }

  const isConfirmedTrust = Boolean(trustedRecord && trustedRecord.verificationState !== 'unconfirmed');
  const trustedKeyUnconfirmed = Boolean(trustedRecord && trustedRecord.verificationState === 'unconfirmed');
  const identityStatus: AuthorIdentityStatus = isConfirmedTrust ? 'locally-trusted' : 'unknown';

  if (trustedKeyUnconfirmed) {
    warnings.push(
      'Signer key is saved locally in unconfirmed state; confirm the full SHA-256 fingerprint out-of-band before treating it as trusted.',
    );
  }

  // Query local revocation / rotation notices without rewriting historical artwork signature validity
  let matchedNotices: StoredKeyNoticeRecord[];
  try {
    matchedNotices = await lookupKeyNotices(manifest.publicKey);
  } catch {
    matchedNotices = [];
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const keyNotices: VerificationKeyNoticeSummary[] = matchedNotices.map((n) => ({
    id: n.id,
    noticeType: n.noticeType,
    reason: n.reason,
    subjectFingerprintShort: n.subjectFingerprintShort,
    replacementFingerprintShort: n.replacementFingerprintShort,
    replacementPublicKeyBase64Url: n.replacementPublicKeyBase64Url,
    noticeIssuedAt: n.noticeIssuedAt,
    verifiedAt: nowUnix,
    note: n.note,
  }));

  let keyNoticeStatus: LocalKeyNoticeStatus = 'none-local';
  if (keyNotices.length > 0) {
    const hasRevocation = keyNotices.some((n) => n.noticeType === 'revocation');
    keyNoticeStatus = hasRevocation ? 'revocation-notice' : 'rotation-notice';
    warnings.push(
      keyNoticeStatus === 'revocation-notice'
        ? 'A locally imported signed revocation notice exists for this signing key. Historical signature math is unchanged, but verify the key status out-of-band.'
        : 'A locally imported signed key rotation notice exists for this signing key.',
    );
  }

  let qrMaskCoveragePct: number | null = null;
  let qrMaskCoverageTier: VerificationResult['qrMaskCoverageTier'] = null;
  if (manifest.qrMask) {
    const cov = computeMaskCoverageStats(manifest.region[2], manifest.region[3], manifest.qrMask);
    qrMaskCoveragePct = cov.coveragePct;
    qrMaskCoverageTier = cov.tier;
    if (cov.tier === 'high') {
      warnings.push(
        `Protocol v2 qrMask excludes ${cov.coveragePct}% of artwork area from SHA-256 hashing (>30%). Inspect the excluded region carefully.`,
      );
    } else if (cov.tier === 'caution') {
      warnings.push(
        `Protocol v2 qrMask excludes ${cov.coveragePct}% of artwork area from SHA-256 hashing (>15%).`,
      );
    }
  }

  let integrityStatus: ArtworkIntegrityStatus = 'not-checked';
  let matchedMode: VerificationResult['matchedMode'] = null;
  let computedArtworkSha256Hex: string | null = null;

  if (artworkRaster) {
    const [rx, ry, rw, rh] = manifest.region;
    if (manifest.qrMask) {
      const matchesExactSize = artworkRaster.width === rw && artworkRaster.height === rh;
      const fitsRegion = rx + rw <= artworkRaster.width && ry + rh <= artworkRaster.height;
      if (matchesExactSize || fitsRegion) {
        const targetRegion = matchesExactSize ? ([0, 0, rw, rh] as const) : manifest.region;
        const { digest, hex } = await hashMaskedArtworkRegion(
          artworkRaster,
          targetRegion,
          manifest.qrMask,
        );
        computedArtworkSha256Hex = hex;
        if (constantTimeEqual(digest, manifest.sha256)) {
          integrityStatus = 'matched';
          matchedMode = 'in-image-masked';
        } else {
          integrityStatus = 'mismatched';
          errors.push(
            'Artwork SHA-256 digest (outside QR mask) does not match the signed manifest.',
          );
        }
      } else {
        integrityStatus = 'mismatched';
        errors.push(
          `Image dimensions (${artworkRaster.width}x${artworkRaster.height}) are smaller than declared region [${rx}, ${ry}, ${rw}x${rh}].`,
        );
      }
    } else if (artworkRaster.width === rw && artworkRaster.height === rh) {
      const digest = await hashCanonicalRaster(artworkRaster);
      computedArtworkSha256Hex = bytesToHex(digest);
      if (constantTimeEqual(digest, manifest.sha256)) {
        integrityStatus = 'matched';
        matchedMode = 'full-artwork';
      } else {
        integrityStatus = 'mismatched';
        errors.push('Artwork SHA-256 digest does not match the signed manifest.');
      }
    } else if (rx + rw <= artworkRaster.width && ry + rh <= artworkRaster.height) {
      const { digest, hex } = await hashArtworkRegion(artworkRaster, manifest.region);
      computedArtworkSha256Hex = hex;
      if (constantTimeEqual(digest, manifest.sha256)) {
        integrityStatus = 'matched';
        matchedMode = 'embedded-region';
      } else {
        integrityStatus = 'mismatched';
        errors.push(
          `Extracted artwork region [${rx}, ${ry}, ${rw}x${rh}] SHA-256 does not match the signed manifest.`,
        );
      }
    } else {
      integrityStatus = 'mismatched';
      errors.push(
        `Image dimensions (${artworkRaster.width}x${artworkRaster.height}) are smaller than declared region [${rx}, ${ry}, ${rw}x${rh}].`,
      );
    }
  }

  return {
    protocolVersion: manifest.version,
    signatureStatus,
    integrityStatus,
    identityStatus,
    manifest,
    proofBytes,
    publicKeyFingerprintHex: fp.fullHex,
    publicKeyFingerprintShort: fp.shortDisplay,
    trustedKeyLabel: trustedRecord?.label ?? null,
    trustedKeyUnconfirmed,
    keyNoticeStatus,
    keyNotices,
    qrMaskCoveragePct,
    qrMaskCoverageTier,
    matchedMode,
    computedArtworkSha256Hex,
    proofBytesLength: proofBytes.length,
    errors,
    warnings,
  };
}

export async function verifyImageWithEmbeddedQr(params: {
  fileOrBytes: File | Blob | Uint8Array;
  lookupTrustedKey?: TrustedKeyLookup;
  lookupKeyNotices?: KeyNoticeLookup;
}): Promise<{
  qrRawText: string;
  qrStrategy: string;
  imageWidth: number;
  imageHeight: number;
  sourceFormat: 'png' | 'browser-raster';
  raster: CanonicalRaster;
  verification: VerificationResult;
}> {
  const rawBytes =
    params.fileOrBytes instanceof Uint8Array
      ? params.fileOrBytes
      : new Uint8Array(await params.fileOrBytes.arrayBuffer());

  const { raster, sourceFormat } = await decodeImageFileToCanonicalRgba8(rawBytes);
  const qr = decodeQrFromCanonicalRaster(raster);
  if (!qr) {
    throw new Error('No readable Certified Handmade QR code found in this image.');
  }
  const verification = await verifyProofAndArtwork({
    proofInput: qr.rawText,
    artworkRaster: raster,
    lookupTrustedKey: params.lookupTrustedKey,
    lookupKeyNotices: params.lookupKeyNotices,
  });
  return {
    qrRawText: qr.rawText,
    qrStrategy: qr.strategy,
    imageWidth: raster.width,
    imageHeight: raster.height,
    sourceFormat,
    raster,
    verification,
  };
}
