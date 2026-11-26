import { computePublicKeyFingerprint } from '../../core/crypto/ed25519';
import { bytesToHex } from '../../core/crypto/sha256';
import { hashCanonicalRaster } from '../../core/image/canonicalRaster';
import { decodeImageFileToCanonicalRgba8 } from '../../core/image/pngCodec';
import type { CanonicalRaster } from '../../core/image/pngCodec';
import { rasterToPreviewDataUrl } from '../../core/image/previewDataUrl';
import { createInImageSignedArtworkPng, createSignedArtworkPng } from '../../core/manifest/signArtwork';
import { LICENSE_DEFINITIONS } from '../../core/manifest/types';
import type { CompactSnsLink, LicenseDeclaration, LicenseId } from '../../core/manifest/types';
import { createAuthorKey, listAuthorKeys } from '../../core/storage/keyStore';
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
): Promise<GalleryArtworkItem> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { raster } = await decodeImageFileToCanonicalRgba8(file);
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
  qrMode?: 'in-image' | 'outer-border';
  inImagePlacement?: {
    x: number;
    y: number;
    boxSize: number;
    opacity: number;
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
    qrMode = 'in-image',
    inImagePlacement,
  } = params;
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

  const signed =
    qrMode === 'outer-border'
      ? await createSignedArtworkPng({
          artworkRaster: raster,
          authorKey,
          license: buildLicenseDeclaration(licenseId),
          authorName: authorName || item.authorName || authorKey.label,
          artworkTitle: resolvedTitle,
          description,
          website,
          snsLinks,
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
          description,
          website,
          snsLinks,
          compactBase45Url: true,
          nostrUltraCompactQr: true,
          qrOptions: (() => {
            const defaultBoxSize = Math.max(
              120,
              Math.min(280, Math.round(Math.min(raster.width, raster.height) * 0.16)),
            );
            const boxSize = inImagePlacement?.boxSize ?? defaultBoxSize;
            return {
              x: inImagePlacement?.x ?? Math.max(12, raster.width - boxSize - 16),
              y: inImagePlacement?.y ?? Math.max(12, raster.height - boxSize - 16),
              boxSize,
              opacity: inImagePlacement?.opacity ?? 1,
              style: 'frosted-light' as const,
              eccLevel: 'L' as const,
              quietZoneModules: 1,
            };
          })(),
        });

  const signedBlobRef = `blob:${item.id}:signed`;
  await idbAdapter.saveBlob(signedBlobRef, signed.pngBytes, 'image/png');

  const fingerprint = await computePublicKeyFingerprint(authorKey.publicKey);
  const signedThumbnail = buildThumbnailDataUrl(signed.raster);
  const hashFragmentIdx = signed.proofUrl.indexOf('#proof=');
  const proofToken = hashFragmentIdx >= 0 ? signed.proofUrl.slice(hashFragmentIdx + '#proof='.length) : undefined;
  const now = Date.now();

  return {
    ...item,
    title: resolvedTitle ?? item.title,
    description: description ?? item.description,
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
  const proofInput = item.proofUrl || item.proofToken;
  if (!proofInput) {
    return {
      ...item,
      provenanceStatus: 'unverified',
      verifiedAt: Date.now(),
      verificationSummary: 'No cryptographic proof attached',
    };
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
