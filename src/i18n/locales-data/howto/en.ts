import type { HowToTranslations } from '../../howto';

export const EN: HowToTranslations = {
  homeTitle: 'How to Use in 3 Simple Steps',
  homeSubtitle: 'No technical setup required. Everything runs directly in your browser.',
  steps: [
    {
      title: '1. Drop Your Artwork',
      desc: 'Open “Create Certificate” and select your PNG/JPEG/WebP illustration. Your file never leaves your device.',
    },
    {
      title: '2. Pick Rules & Stamp Key',
      desc: 'If you have no key yet, create your artist signing key in one click right on the page. Leave “All Rights Reserved” if unsure.',
    },
    {
      title: '3. Save Signed PNG & Share',
      desc: 'Download the PNG with the QR burned cleanly into the margin. Anyone can verify it offline by dropping the image on “Verify”.',
    },
  ],
  simpleFlowHint: 'Quick flow: 1. Choose artwork -> 2. Check rules -> 3. Click the sign button below.',
  quickKeyTitle: 'First Time? Create Your Local Artist Stamp (1 Click)',
  quickKeyBody:
    'To sign your artwork, your browser needs a personal Ed25519 signing key stored locally on this device. Nothing is uploaded.',
  quickKeyBtn: 'Create My Artist Key in 1 Click',
  quickKeyBusy: 'Creating key…',
  quickKeyTip: 'Tip: You can download an encrypted backup (.chkey.json) anytime in Identity / Keys.',
  advancedToggle: 'Advanced QR Layout & URL Settings (Optional — defaults work great)',
  docsUsageTitle: 'Beginner’s 3-Step Guide for Artists',
};
