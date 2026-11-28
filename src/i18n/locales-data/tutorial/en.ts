import type { TutorialTranslations } from '../../tutorial';

export const EN: TutorialTranslations = {
  navLabel: 'Tutorial',
  homeCta: 'Simple Tutorial',
  title: 'Simple Step-by-Step Tutorial',
  subtitle: 'No cryptography jargon needed. Follow these steps in order to sign and verify your artwork.',
  reassuranceItems: [
    '100% free with zero accounts or sign-ups',
    'Your images and keys never leave your device',
    'Works completely offline once loaded',
  ],
  stepsTitle: 'Follow These Steps in Order',
  steps: [
    {
      title: '1. Open “Create Certificate” and Pick an Image',
      desc: 'Drop your PNG, JPEG, or WebP illustration onto the upload area. Nothing is uploaded to any server.',
      ctaLabel: 'Open Create Page',
      to: '/create',
    },
    {
      title: '2. Create Your Artist Stamp (1 Click) & Pick Rules',
      desc: 'If it is your first visit, click the 1-click button right on the page to create your local key. Leave “All Rights Reserved” selected if unsure.',
      ctaLabel: 'Try on Create Page',
      to: '/create',
    },
    {
      title: '3. Save Your Signed PNG & Test Verification',
      desc: 'Download the PNG with the QR burned cleanly into the margin. Drop it into “Verify” anytime to confirm signature and pixel match.',
      ctaLabel: 'Open Verify Page',
      to: '/verify',
    },
    {
      title: '4. Optional: Back Up Your Key Safely',
      desc: 'Keys live in your browser storage. Whenever convenient, save an encrypted backup (.chkey.json) in Identity / Keys so you never lose it.',
      ctaLabel: 'Manage & Back Up Keys',
      to: '/keys',
    },
  ],
  cheatTitle: 'Which License Should I Pick? Quick Cheat Sheet',
  cheatItems: [
    {
      scenario: 'Standard illustration (no reposts, edits, or commercial use without asking)',
      recommended: 'ARR (All Rights Reserved)',
      note: 'Default option—safest starting point for most artists.',
    },
    {
      scenario: 'Allow non-commercial reposts as-is if they credit you',
      recommended: 'CC BY-NC-ND 4.0',
      note: 'No edits and no commercial use, with credit required.',
    },
    {
      scenario: 'Free to share, remix, and use commercially with credit',
      recommended: 'CC BY 4.0',
      note: 'Great for open brushes, textures, or community assets.',
    },
    {
      scenario: 'Completely free public domain (no credit needed)',
      recommended: 'CC0 1.0',
      note: 'Waives copyright as broadly as allowed by law.',
    },
  ],
  cheatDocsLink: 'Read full explanations of all 8 licenses (Docs)',
  snsTipTitle: 'Practical Tip When Posting to Social Media',
  snsTipBody:
    'Many social platforms re-compress JPEGs or resize images, which alters pixel hashes. Keep your original “.certified-handmade.png” file safely, or share the generated proof URL (#proof=...) alongside your post if you want recipients to verify exact pixels.',
  faqTitle: 'Frequently Asked Questions',
  faqs: [
    {
      q: 'Do I need crypto, NFTs, or a paid plan?',
      a: 'No. Certified Handmade is 100% free, MIT open source, with zero NFTs, blockchains, ads, or accounts.',
    },
    {
      q: 'Does a valid signature prove no AI was used?',
      a: 'No. A cryptographic signature proves that the holder of a specific key signed that image and that pixels have not changed since signing. Publishing your public key on your official profile helps link it to you.',
    },
    {
      q: 'If I clear browser history, do old signed PNGs stop verifying?',
      a: 'No! All verification data lives inside the QR code itself, so anyone can verify your previously signed images forever. You only need a key backup if you want to keep signing with the exact same key.',
    },
  ],
  bottomTitle: 'Ready to try your first artwork?',
  bottomStartBtn: 'Create Signed PNG',
  bottomVerifyBtn: 'Verify Artwork / QR',
};
