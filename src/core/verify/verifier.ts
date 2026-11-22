import { defaultHumanMadeAssessor } from '../assessment';
import { computePublicKeyFingerprint, verifyEd25519Signature } from '../crypto/ed25519';
import { bytesToHex, constantTimeEqual } from '../crypto/sha256';
import { hashArtworkRegion, hashCanonicalRaster } from '../image/canonicalRaster';
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
  SignatureStatus,
  VerificationResult,
} from '../manifest/types';
import { decodeQrFromCanonicalRaster } from '../qr/qrDecoder';
import { findTrustedKeyByPublicKey } from '../storage/keyStore';
import type { TrustedKeyRecord } from '../storage/keyStore';

export type TrustedKeyLookup = (publicKey32: Uint8Array) => Promise<TrustedKeyRecord | undefined>;

export async function verifyProofAndArtwork(params: {
  proofInput: string;
  artworkRaster?: CanonicalRaster | null;
  lookupTrustedKey?: TrustedKeyLookup;
}): Promise<VerificationResult> {
  const {
    proofInput,
    artworkRaster = null,
    lookupTrustedKey = findTrustedKeyByPublicKey,
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
      assessmentStatus: 'not-assessed',
      manifest: null,
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
        assessmentStatus: 'not-assessed',
        manifest: null,
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
      assessmentStatus: 'not-assessed',
      manifest: null,
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

  const identityStatus: AuthorIdentityStatus = trustedRecord ? 'locally-trusted' : 'unknown';

  let integrityStatus: ArtworkIntegrityStatus = 'not-checked';
  let matchedMode: VerificationResult['matchedMode'] = null;
  let computedArtworkSha256Hex: string | null = null;

  if (artworkRaster) {
    const [rx, ry, rw, rh] = manifest.region;
    if (artworkRaster.width === rw && artworkRaster.height === rh) {
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

  const assessment = await defaultHumanMadeAssessor.assess(artworkRaster);

  return {
    protocolVersion: manifest.version,
    signatureStatus,
    integrityStatus,
    identityStatus,
    assessmentStatus: assessment.status,
    manifest,
    publicKeyFingerprintHex: fp.fullHex,
    publicKeyFingerprintShort: fp.shortDisplay,
    trustedKeyLabel: trustedRecord?.label ?? null,
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
}): Promise<{
  qrRawText: string;
  qrStrategy: string;
  imageWidth: number;
  imageHeight: number;
  sourceFormat: 'png' | 'browser-raster';
  raster: CanonicalRaster;
  verification: VerificationResult;
}> {
  const { raster, sourceFormat } = await decodeImageFileToCanonicalRgba8(params.fileOrBytes);
  const qr = decodeQrFromCanonicalRaster(raster);
  if (!qr) {
    throw new Error('No readable Certified Handmade QR code found in this image.');
  }
  const verification = await verifyProofAndArtwork({
    proofInput: qr.rawText,
    artworkRaster: raster,
    lookupTrustedKey: params.lookupTrustedKey,
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
