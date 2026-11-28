import type { UxGuidanceTranslations } from '../../uxGuidance';

export const EN: UxGuidanceTranslations = {
  snsRecompression: {
    createTitle: 'Best for original PNG distribution',
    createBody:
      'Uploading directly to social platforms (X, Instagram, Discord, etc.) usually recompresses or resizes images, which breaks exact RGBA8 pixel-integrity verification. Share the original exported PNG directly for full verification.',
    verifyTitle: 'Note on social-media recompression',
    verifyBody:
      'Images downloaded from social platforms (X, Instagram, Discord, etc.) are often recompressed or resized, which will cause strict RGBA8 Artwork Integrity checks to report a mismatch. Use the original PNG file whenever possible.',
  },
  qrReadability: {
    tooSmallWarning:
      'QR modules are smaller than 2 px each and may fail to scan on cameras. Increase the QR box size or click Optimize QR Size.',
    lowContrastWarning:
      'Contrast between the QR modules and artwork background is low (< 3.0:1). Increase opacity, switch to a frosted backdrop style, or move the QR to a more uniform area.',
    moduleSizeLabel: 'Module size',
    contrastRatioLabel: 'Contrast',
  },
};
