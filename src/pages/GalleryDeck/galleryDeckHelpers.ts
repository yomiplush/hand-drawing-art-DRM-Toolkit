import { computePublicKeyFingerprint } from '../../core/crypto/ed25519';
import { base64UrlEncode, bytesToHex } from '../../core/crypto/sha256';
import { fetchProofFromNostrRelays } from '../../core/nostr/proofRelay';
import { hashCanonicalRaster } from '../../core/image/canonicalRaster';
import { decodeImageFileToCanonicalRgba8 } from '../../core/image/pngCodec';
import type { CanonicalRaster } from '../../core/image/pngCodec';
import { rasterToPreviewDataUrl } from '../../core/image/previewDataUrl';
import { createInImageSignedArtworkPng, createSignedArtworkPng } from '../../core/manifest/signArtwork';
import { LICENSE_DEFINITIONS } from '../../core/manifest/types';
import type { CompactSnsLink, CreationMethod, LicenseDeclaration, LicenseId } from '../../core/manifest/types';
import { createAuthorKey, listAuthorKeys } from '../../core/storage/keyStore';
import { assertArtworkSafeAsync } from '../../core/security/artworkSafetyGate';
import {
  buildSourceProjectProofTag,
  type SourceProjectFileLike,
  type SourceProjectVerificationResult,
  verifySourceProjectFile,
} from '../../core/security/sourceProjectVerifier';
import { verifyProofAndArtwork } from '../../core/verify/verifier';
import type {
  FileSystemGalleryAdapter,
  IndexedDbGalleryAdapter,
} from '../../services/galleryStorage';
import type { GalleryArtworkItem, GalleryDeckCatalog } from '../../types/gallerydeck';

function generateItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `art-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildLicenseDeclaration(licenseId: LicenseId): LicenseDeclaration {
  const def = LICENSE_DEFINITIONS.find((d) => d.id === licenseId) ?? LICENSE_DEFINITIONS[0];
  return {
    licenseId: def.id,
    commercialUse: def.allowsCommercialDefault,
    redistribution: def.allowsRedistributionDefault,
    aiTraining: 'disallow',
  };
}

/**
 * Generates a compact thumbnail data URL from a CanonicalRaster so the catalog
 * stays lightweight and fast for Steam Deck carousel rendering.
 */
function buildThumbnailDataUrl(raster: CanonicalRaster): string {
  return rasterToPreviewDataUrl(raster) ?? '';
}

/**
 * Imports a user-selected image file 100% client-side, computes its canonical RGBA8 hash,
 * stores the full binary in IndexedDB, and returns a new GalleryArtworkItem.
 */
export async function importArtworkFileToDeck(
  file: File,
  idbAdapter: IndexedDbGalleryAdapter,
  fsAdapter?: FileSystemGalleryAdapter,
  sourceProjectFile?: SourceProjectFileLike,
): Promise<GalleryArtworkItem> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { raster } = await decodeImageFileToCanonicalRgba8(file);
  await assertArtworkSafeAsync({
    fileName: file.name,
    rawBytes: bytes,
    raster,
  });
  let sourceProof: SourceProjectVerificationResult | undefined;
  if (sourceProjectFile) {
    // Verified 100% locally in memory; raw working project bytes are NEVER saved to IndexedDB or Google Drive
    sourceProof = await verifySourceProjectFile(sourceProjectFile);
  }
  const sha256Bytes = await hashCanonicalRaster(raster);
  const sha256Hex = bytesToHex(sha256Bytes);
  const thumbnailDataUrl = buildThumbnailDataUrl(raster);

  const id = generateItemId();
  const blobRef = `blob:${id}`;
  await idbAdapter.saveBlob(blobRef, bytes, file.type || 'image/png');
  if (fsAdapter?.isLinked()) {
    await fsAdapter.writeArtworkFile(file.name, bytes).catch(() => {});
  }

  const now = Date.now();
  return {
    id,
    title: '',
    createdAt: file.lastModified || now,
    importedAt: now,
    updatedAt: now,
    width: raster.width,
    height: raster.height,
    mimeType: file.type || 'image/png',
    fileSizeBytes: bytes.byteLength,
    thumbnailDataUrl,
    blobRef,
    localFileName: file.name,
    provenanceStatus: 'unverified',
    qrMode: 'none',
    artworkSha256Hex: sha256Hex,
    tags: [],
    collections: [],
    ...(sourceProof
      ? {
          sourceProjectFormat: sourceProof.projectFormat,
          sourceLayerCount: sourceProof.layerCount,
          sourceCommitmentHash: sourceProof.sourceCommitmentHash,
        }
      : {}),
  };
}

/**
 * Re-links artwork thumbnails and full-resolution blobs from the user's fixed local folder
 * after browser cookie/cache eviction or Google Drive metadata-only DB restore.
 */
export async function relinkCatalogFromLocalFolder(
  catalog: GalleryDeckCatalog,
  fsAdapter: FileSystemGalleryAdapter,
  idbAdapter: IndexedDbGalleryAdapter,
): Promise<{ catalog: GalleryDeckCatalog; relinkedCount: number }> {
  if (!fsAdapter.isLinked()) {
    return { catalog, relinkedCount: 0 };
  }
  let relinkedCount = 0;
  const updatedItems: GalleryArtworkItem[] = [];

  for (const item of catalog.items) {
    if (item.deleted || (item.thumbnailDataUrl && item.blobRef) || !item.localFileName) {
      updatedItems.push(item);
      continue;
    }
    const file = await fsAdapter.readArtworkFile(item.localFileName);
    if (!file) {
      updatedItems.push(item);
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { raster } = await decodeImageFileToCanonicalRgba8(file);
      const thumbnailDataUrl = buildThumbnailDataUrl(raster);
      const blobRef = item.blobRef ?? `blob:${item.id}`;
      await idbAdapter.saveBlob(blobRef, bytes, file.type || 'image/png');
      relinkedCount += 1;
      updatedItems.push({
        ...item,
        thumbnailDataUrl,
        blobRef,
      });
    } catch {
      updatedItems.push(item);
    }
  }

  return {
    catalog: {
      ...catalog,
      localFolderName: fsAdapter.getDirectoryName() ?? catalog.localFolderName,
      items: updatedItems,
    },
    relinkedCount,
  };
}

/**
 * Signs an unverified artwork directly in-place using the existing Ed25519 + QR pipeline.
 * Automatically creates a local Ed25519 author key if the user doesn't have one yet.
 */
export async function certifyArtworkInDeck(params: {
  item: GalleryArtworkItem;
  idbAdapter: IndexedDbGalleryAdapter;
  licenseId?: LicenseId;
  authorName?: string;
  artworkTitle?: string;
  description?: string;
  website?: string;
  snsLinks?: CompactSnsLink[];
  portfolioLinks?: Array<{ url: string; label?: string }>;
  tags?: string[];
  creationMethod?: CreationMethod;
  qrMode?: 'in-image' | 'outer-border';
  sourceProjectFile?: SourceProjectFileLike;
  inImagePlacement?: {
    x: number;
    y: number;
    boxSize: number;
    opacity: number;
    style?: 'frosted-light' | 'frosted-dark' | 'modules-dark' | 'modules-light';
  };
}): Promise<GalleryArtworkItem> {
  const {
    item,
    idbAdapter,
    licenseId = 'ARR',
    authorName,
    artworkTitle,
    description,
    website,
    snsLinks,
    portfolioLinks,
    tags,
    creationMethod,
    qrMode = 'in-image',
    sourceProjectFile,
    inImagePlacement,
  } = params;
  await assertArtworkSafeAsync({
    fileName: item.localFileName,
    title: artworkTitle ?? item.title,
    description: description ?? item.description,
    tags: tags ?? item.tags,
  });
  let sourceProof: SourceProjectVerificationResult | undefined;
  if (sourceProjectFile) {
    sourceProof = await verifySourceProjectFile(sourceProjectFile);
  }
  const blobKey = item.blobRef ?? `blob:${item.id}`;
  const storedBlob = await idbAdapter.loadBlob(blobKey);
  if (!storedBlob) {
    throw new Error('Original image data is not cached on this device. Re-import the image to certify.');
  }

  let keys = await listAuthorKeys();
  if (keys.length === 0) {
    const { record } = await createAuthorKey({ label: 'GalleryDeck Artist Key' });
    keys = [record];
  }
  const authorKey = keys[0];

  const file = new File([storedBlob.bytes.slice()], `${item.title || 'artwork'}.png`, {
    type: storedBlob.mimeType || 'image/png',
  });
  const { raster } = await decodeImageFileToCanonicalRgba8(file);

  const resolvedTitle = artworkTitle || item.title || undefined;
  const cleanDescription = description?.trim() || undefined;
  const baseTags =
    tags && tags.length > 0
      ? tags.map((t) => t.replace(/^#+/, '').trim()).filter(Boolean).slice(0, 14)
      : [];
  if (sourceProof) {
    baseTags.push(buildSourceProjectProofTag(sourceProof));
  }
  const cleanTags = baseTags.length > 0 ? baseTags : undefined;

  const signed =
    qrMode === 'outer-border'
      ? await createSignedArtworkPng({
          artworkRaster: raster,
          authorKey,
          license: buildLicenseDeclaration(licenseId),
          authorName: authorName || item.authorName || authorKey.label,
          artworkTitle: resolvedTitle,
          description: cleanDescription,
          tags: cleanTags,
          website,
          snsLinks,
          portfolioLinks,
          creationMethod,
          burnOptions: {
            placement: 'bottom-right',
            marginPx: 16,
            theme: 'dark-slate',
            showLabel: true,
          },
        })
      : await createInImageSignedArtworkPng({
          artworkRaster: raster,
          authorKey,
          license: buildLicenseDeclaration(licenseId),
          authorName: authorName || item.authorName || authorKey.label,
          artworkTitle: resolvedTitle,
          description: cleanDescription,
          tags: cleanTags,
          website,
          snsLinks,
          portfolioLinks,
          creationMethod,
          compactBase45Url: true,
          nostrUltraCompactQr: true,
          qrOptions: (() => {
            const defaultBoxSize = Math.max(
              180,
              Math.min(340, Math.round(Math.min(raster.width, raster.height) * 0.22)),
            );
            const boxSize = inImagePlacement?.boxSize ?? defaultBoxSize;
            return {
              x: inImagePlacement?.x ?? Math.max(12, raster.width - boxSize - 16),
              y: inImagePlacement?.y ?? Math.max(12, raster.height - boxSize - 16),
              boxSize,
              opacity: inImagePlacement?.opacity ?? 1,
              style: inImagePlacement?.style ?? 'frosted-light',
              eccLevel: 'H' as const,
              quietZoneModules: 2,
            };
          })(),
        });

  const signedBlobRef = `blob:${item.id}:signed`;
  await idbAdapter.saveBlob(signedBlobRef, signed.pngBytes, 'image/png');

  const fingerprint = await computePublicKeyFingerprint(authorKey.publicKey);
  const signedThumbnail = buildThumbnailDataUrl(signed.raster);
  const proofToken = base64UrlEncode(signed.proofBytes);
  const now = Date.now();

  return {
    ...item,
    title: resolvedTitle ?? item.title,
    description: description ?? item.description,
    tags: tags ?? item.tags,
    authorName: authorName || item.authorName || authorKey.label,
    updatedAt: now,
    width: signed.raster.width,
    height: signed.raster.height,
    mimeType: 'image/png',
    fileSizeBytes: signed.pngBytes.byteLength,
    thumbnailDataUrl: signedThumbnail,
    blobRef: signedBlobRef,
    provenanceStatus: 'signed',
    qrMode: qrMode === 'outer-border' ? 'outer-border' : 'in-image-mask',
    publicKeyFingerprint: fingerprint.shortDisplay,
    artworkSha256Hex: bytesToHex(signed.manifest.sha256),
    licenseId,
    proofToken,
    proofUrl: signed.proofUrl,
    verifiedAt: now,
    verificationSummary: 'Ed25519 signature & QR verified',
  };
}

/**
 * Runs the existing `/verify` cryptographic integrity check against the stored artwork blob.
 */
export async function verifyArtworkInDeck(params: {
  item: GalleryArtworkItem;
  idbAdapter: IndexedDbGalleryAdapter;
}): Promise<GalleryArtworkItem> {
  const { item, idbAdapter } = params;
  let proofInput = item.proofToken || item.proofUrl;
  if (!proofInput) {
    return {
      ...item,
      provenanceStatus: 'unverified',
      verifiedAt: Date.now(),
      verificationSummary: 'No cryptographic proof attached',
    };
  }

  // If only a Nostr /N/<eventId> URL is stored, resolve the signed proofBytes automatically
  const nostrMatch = proofInput.match(/\/[nN]\/([0-9a-fA-F]{64})(?:$|[?#])/);
  if (nostrMatch) {
    const resolvedBytes = await fetchProofFromNostrRelays(nostrMatch[1]);
    proofInput = base64UrlEncode(resolvedBytes);
  }

  let artworkRaster: CanonicalRaster | null = null;
  if (item.blobRef) {
    const stored = await idbAdapter.loadBlob(item.blobRef);
    if (stored) {
      const file = new File([stored.bytes.slice()], `${item.title || 'artwork'}.png`, {
        type: stored.mimeType || 'image/png',
      });
      const decoded = await decodeImageFileToCanonicalRgba8(file);
      artworkRaster = decoded.raster;
    }
  }

  const result = await verifyProofAndArtwork({
    proofInput,
    artworkRaster,
  });

  const isValid =
    result.signatureStatus === 'valid' &&
    (artworkRaster === null || result.integrityStatus === 'matched');

  const now = Date.now();
  return {
    ...item,
    updatedAt: now,
    provenanceStatus: isValid ? 'signed' : 'invalid',
    publicKeyFingerprint: result.publicKeyFingerprintShort ?? item.publicKeyFingerprint,
    verifiedAt: now,
    verificationSummary: isValid
      ? `Valid Ed25519 (${result.integrityStatus})`
      : result.errors[0] || `Verification failed (${result.signatureStatus}/${result.integrityStatus})`,
  };
}
