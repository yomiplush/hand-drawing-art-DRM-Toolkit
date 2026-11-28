import type { VerifyMobileTranslations } from '../../verifyMobile';

export const EN: VerifyMobileTranslations = {
  proofStep2Title: 'Next Step: Select or Paste the Artwork Image to Verify Pixels',
  proofStep2Desc:
    'The QR signature is loaded. Choose the artwork file from Photos/Files or copy an image and tap Paste Image from Clipboard.',
  pasteImageBtn: 'Paste Image from Clipboard',
  pasteBusy: 'Reading Clipboard…',
  pasteNoImage: 'No image found in clipboard. Copy an image first or select a file.',
  pasteUnsupported:
    'Clipboard button access is blocked by this browser. Use Ctrl+V / browser Paste or choose a file instead.',
  pasteHint: 'Tip: Long-press → Copy Image in another app, then paste directly here (Ctrl+V / Paste supported).',
  rawProofToggle: 'Inspect or Edit Raw Proof URL / Token',
  attachedReadyBadge: 'Loaded Image',
  sharedImageVerifiedNote: 'Verified from shared image QR code',
  sharedImageNoQrNote:
    'Shared image loaded (no QR found inside the image). Scan or paste a proof URL to verify its SHA-256 pixels.',
  cameraFollowUpHint: 'QR proof loaded! Now select or paste the artwork image above to verify pixel integrity.',
};
