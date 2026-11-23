import { verifyEd25519Signature } from '../crypto/ed25519';
import { bytesToHex, constantTimeEqual, sha256, sha256Streamed } from '../crypto/sha256';
import {
  UnsupportedEvidenceVersionError,
  buildEvidenceSigningMessage,
  decodeSignedEvidenceEnvelope,
  extractEvidenceBytesFromInput,
} from '../manifest/evidenceExtension';
import type {
  EvidenceRecordCheckResult,
  EvidenceVerificationSummary,
  MismatchedSuppliedEvidenceFile,
  SignedManifest,
} from '../manifest/types';

export interface SuppliedEvidenceFileInput {
  name: string;
  data: Blob | Uint8Array;
}

function emptyEvidenceSummary(
  status: EvidenceVerificationSummary['status'],
  errors: string[] = [],
  warnings: string[] = [],
  evidenceBytesLength: number | null = null,
): EvidenceVerificationSummary {
  return {
    status,
    signatureValid: false,
    proofBindingValid: false,
    publicKeyMatchesProof: false,
    artworkIdMatchesProof: false,
    artworkSha256MatchesProof: false,
    proofSha256MatchesProof: false,
    extension: null,
    evidenceBytesLength,
    recordChecks: [],
    verifiedRecordCount: 0,
    unavailableRecordCount: 0,
    mismatchedSuppliedFiles: [],
    errors,
    warnings,
  };
}

export async function verifyEvidenceExtension(params: {
  evidenceInput?: string | null;
  proofBytes?: Uint8Array | null;
  manifest?: SignedManifest | null;
  suppliedEvidenceFiles?: SuppliedEvidenceFileInput[];
  onEvidenceHashProgress?: (
    fileIndex: number,
    totalFiles: number,
    processedBytes: number,
    totalBytes: number,
  ) => void;
}): Promise<EvidenceVerificationSummary> {
  const {
    evidenceInput,
    proofBytes = null,
    manifest = null,
    suppliedEvidenceFiles = [],
    onEvidenceHashProgress,
  } = params;

  const trimmed = typeof evidenceInput === 'string' ? evidenceInput.trim() : '';
  if (!trimmed) {
    return emptyEvidenceSummary('none');
  }

  if (!proofBytes || !manifest) {
    return emptyEvidenceSummary('missing-primary-proof', [
      'A standalone .chmevidence extension cannot be verified without the original artwork proof or signed image.',
    ]);
  }

  let evidenceBytes: Uint8Array;
  try {
    evidenceBytes = extractEvidenceBytesFromInput(trimmed);
  } catch (err) {
    return emptyEvidenceSummary('invalid', [
      err instanceof Error ? err.message : 'Failed to parse .chmevidence extension input',
    ]);
  }

  let decoded;
  try {
    decoded = decodeSignedEvidenceEnvelope(evidenceBytes);
  } catch (err) {
    if (err instanceof UnsupportedEvidenceVersionError) {
      return emptyEvidenceSummary(
        'unsupported',
        [err.message],
        [],
        evidenceBytes.length,
      );
    }
    return emptyEvidenceSummary(
      'invalid',
      [err instanceof Error ? err.message : 'Invalid .chmevidence CBOR payload'],
      [],
      evidenceBytes.length,
    );
  }

  const { extension, payloadBytes, signature } = decoded;
  const errors: string[] = [];
  const warnings: string[] = [];

  const signingMessage = buildEvidenceSigningMessage(payloadBytes);
  const signatureValid = await verifyEd25519Signature(
    extension.publicKey,
    signingMessage,
    signature,
  );
  if (!signatureValid) {
    errors.push(
      'Evidence extension Ed25519 signature verification failed: extension payload or signature was modified.',
    );
  }

  const expectedProofSha256 = await sha256(proofBytes);
  const publicKeyMatchesProof = constantTimeEqual(extension.publicKey, manifest.publicKey);
  const artworkIdMatchesProof = constantTimeEqual(extension.artworkId, manifest.artworkId);
  const artworkSha256MatchesProof = constantTimeEqual(extension.artworkSha256, manifest.sha256);
  const proofSha256MatchesProof = constantTimeEqual(extension.proofSha256, expectedProofSha256);

  if (!publicKeyMatchesProof) {
    errors.push(
      'Evidence extension signer public key does not match the primary artwork certificate.',
    );
  }
  if (!artworkIdMatchesProof) {
    errors.push('Evidence extension artworkId does not match the primary artwork certificate.');
  }
  if (!artworkSha256MatchesProof) {
    errors.push('Evidence extension artworkSha256 does not match the primary artwork digest.');
  }
  if (!proofSha256MatchesProof) {
    errors.push('Evidence extension proofSha256 does not match the provided CHM proof envelope.');
  }

  const proofBindingValid =
    publicKeyMatchesProof &&
    artworkIdMatchesProof &&
    artworkSha256MatchesProof &&
    proofSha256MatchesProof;

  let status: EvidenceVerificationSummary['status'];
  if (!signatureValid) {
    status = 'invalid';
  } else if (!proofBindingValid) {
    status = 'binding-mismatch';
  } else {
    status = 'valid';
  }

  const records = extension.evidenceRecords ?? [];
  const hashedSupplied: Array<{
    fileName: string;
    digest: Uint8Array;
    hex: string;
    byteLength: number;
  }> = [];

  for (let i = 0; i < suppliedEvidenceFiles.length; i++) {
    const file = suppliedEvidenceFiles[i];
    const hashed = await sha256Streamed(file.data, {
      onProgress: (processed, total) => {
        onEvidenceHashProgress?.(i, suppliedEvidenceFiles.length, processed, total);
      },
    });
    hashedSupplied.push({
      fileName: file.name,
      digest: hashed.digest,
      hex: hashed.hex,
      byteLength: hashed.byteLength,
    });
  }

  const matchedSuppliedIndices = new Set<number>();
  const recordChecks: EvidenceRecordCheckResult[] = records.map((rec, index) => {
    const shaHex = bytesToHex(rec.sha256);
    const matchIndex = hashedSupplied.findIndex(
      (sup) => sup.byteLength === rec.byteLength && constantTimeEqual(sup.digest, rec.sha256),
    );
    if (matchIndex >= 0) {
      matchedSuppliedIndices.add(matchIndex);
      return {
        index,
        sha256Hex: shaHex,
        byteLength: rec.byteLength,
        label: rec.label,
        category: rec.category,
        mimeType: rec.mimeType,
        status: 'verified',
        matchedFileName: hashedSupplied[matchIndex].fileName,
      };
    }
    return {
      index,
      sha256Hex: shaHex,
      byteLength: rec.byteLength,
      label: rec.label,
      category: rec.category,
      mimeType: rec.mimeType,
      status: 'unavailable',
    };
  });

  const mismatchedSuppliedFiles: MismatchedSuppliedEvidenceFile[] = [];
  for (let i = 0; i < hashedSupplied.length; i++) {
    if (!matchedSuppliedIndices.has(i)) {
      const sup = hashedSupplied[i];
      mismatchedSuppliedFiles.push({
        fileName: sup.fileName,
        byteLength: sup.byteLength,
        computedSha256Hex: sup.hex,
      });
    }
  }

  if (mismatchedSuppliedFiles.length > 0) {
    warnings.push(
      `${mismatchedSuppliedFiles.length} local evidence file(s) did not match any SHA-256 record in the signed extension.`,
    );
  }

  const verifiedRecordCount = recordChecks.filter((r) => r.status === 'verified').length;
  const unavailableRecordCount = recordChecks.filter((r) => r.status === 'unavailable').length;

  return {
    status,
    signatureValid,
    proofBindingValid,
    publicKeyMatchesProof,
    artworkIdMatchesProof,
    artworkSha256MatchesProof,
    proofSha256MatchesProof,
    extension,
    evidenceBytesLength: evidenceBytes.length,
    recordChecks,
    verifiedRecordCount,
    unavailableRecordCount,
    mismatchedSuppliedFiles,
    errors,
    warnings,
  };
}
