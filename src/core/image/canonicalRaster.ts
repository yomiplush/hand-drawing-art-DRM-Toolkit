import { bytesToHex, sha256 } from '../crypto/sha256';
import type { ArtworkRegion } from '../manifest/types';
import { extractRegionFromRaster } from './pngCodec';
import type { CanonicalRaster } from './pngCodec';

export async function hashCanonicalRaster(raster: CanonicalRaster): Promise<Uint8Array> {
  if (raster.data.length !== raster.width * raster.height * 4) {
    throw new Error('Canonical RGBA8 raster buffer length mismatch');
  }
  return sha256(raster.data);
}

export async function hashCanonicalRasterHex(raster: CanonicalRaster): Promise<string> {
  return bytesToHex(await hashCanonicalRaster(raster));
}

export async function hashArtworkRegion(
  raster: CanonicalRaster,
  region: ArtworkRegion,
): Promise<{ digest: Uint8Array; hex: string }> {
  const cropped = extractRegionFromRaster(raster, region);
  const digest = await hashCanonicalRaster(cropped);
  return { digest, hex: bytesToHex(digest) };
}

/**
 * Hashes canonical RGBA8 raster pixels inside `region` while zeroing out the RGBA bytes
 * inside `mask` (relative to `region`). Used for v2 in-image QR overlays so every pixel
 * outside the QR box is verified byte-for-byte.
 */
export async function hashMaskedArtworkRegion(
  raster: CanonicalRaster,
  region: ArtworkRegion,
  mask: ArtworkRegion,
): Promise<{ digest: Uint8Array; hex: string }> {
  const cropped = extractRegionFromRaster(raster, region);
  const [mx, my, mw, mh] = mask;
  if (
    mx < 0 ||
    my < 0 ||
    mw < 1 ||
    mh < 1 ||
    mx + mw > cropped.width ||
    my + mh > cropped.height
  ) {
    throw new Error('Mask region exceeds cropped artwork bounds');
  }
  const maskedData = new Uint8Array(cropped.data);
  const stride = cropped.width * 4;
  for (let row = 0; row < mh; row++) {
    const start = (my + row) * stride + mx * 4;
    maskedData.fill(0, start, start + mw * 4);
  }
  const digest = await sha256(maskedData);
  return { digest, hex: bytesToHex(digest) };
}
