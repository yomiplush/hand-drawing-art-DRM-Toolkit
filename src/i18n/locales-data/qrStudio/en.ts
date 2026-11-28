import type { QrStudioTranslations } from '../../qrStudio';

export const EN: QrStudioTranslations = {
  navLabel: 'QR Studio',
  title: 'Manual In-Image QR Studio',
  subtitle:
    'Drag, resize, and blend a semi-transparent or styled QR code directly inside your artwork. Every pixel outside the QR mask remains SHA-256 verified.',
  modeSectionTitle: 'QR Placement Mode',
  modeOuterLabel: 'Outer Margin Frame (Simple)',
  modeOuterDesc: 'Adds a clean border outside the artwork so zero artwork pixels are covered.',
  modeStudioLabel: 'In-Image Semi-Transparent QR Studio',
  modeStudioDesc: 'Drag position, tune size & opacity, and blend a QR directly inside the image.',
  uploadFirstHint: 'Select an artwork image in Step 1 above to preview and drag your semi-transparent QR code here.',
  createBannerTitle: 'Want to embed a semi-transparent QR directly inside the artwork?',
  createBannerDesc:
    'Open the dedicated Manual QR Studio to drag position, tune size & opacity, and test live QR readability without adding an outer border.',
  createBannerBtn: 'Open QR Studio',
  backToMarginCreate: 'Use Margin Frame Mode (/create)',
  previewTitle: 'Interactive Placement Canvas (Drag the QR Box)',
  previewHint:
    'Drag the QR box directly on the canvas or fine-tune with the presets and sliders below. Every pixel outside the dashed QR mask is verified bit-for-bit.',
  presetsLabel: 'Quick Position Presets',
  presets: {
    topLeft: 'Top-Left',
    topRight: 'Top-Right',
    bottomLeft: 'Bottom-Left',
    bottomRight: 'Bottom-Right',
    center: 'Center',
  },
  controlsTitle: 'QR Position, Size, Opacity & Style',
  xLabel: 'X Position (px)',
  yLabel: 'Y Position (px)',
  sizeLabel: 'QR Box Size (px)',
  opacityLabel: 'Opacity (Translucency)',
  styleLabel: 'Overlay Style',
  eccLabel: 'Error Correction (ECC)',
  styles: {
    'frosted-light': 'Frosted Light Plate (Recommended)',
    'frosted-dark': 'Frosted Dark Plate (Inverted)',
    'modules-dark': 'Dark Modules Only (No Plate)',
    'modules-light': 'Light Modules Only (No Plate)',
  },
  eccOptions: {
    M: 'M (15% — Compact matrix)',
    Q: 'Q (25% — Balanced for translucency)',
    H: 'H (30% — Max resilience on busy art)',
  },
  readabilityLabel: 'Live Local Readability Check',
  readabilityOk: 'Scannable in live preview',
  readabilityWarn: 'Low contrast / hard to scan — increase opacity, enlarge box size, or use Frosted Light',
  readabilityHint: 'Tested 100% locally with jsQR against the blended preview raster.',
  maskRegionLabel: 'Signed QR Mask Region [x, y, w, h]',
  signInImageBtn: 'Sign & Export In-Image QR PNG',
  signingBusy: 'Hashing Outside Mask, Signing & Embedding…',
  maskedDigestNote:
    'Protocol v2: All pixels outside the QR box are protected by SHA-256. Both this PNG and your clean pre-QR original verify cleanly.',
};
