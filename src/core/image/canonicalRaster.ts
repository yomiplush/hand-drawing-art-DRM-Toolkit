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
