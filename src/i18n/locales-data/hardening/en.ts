import type { HardeningTranslations } from '../../hardening';

export const EN: HardeningTranslations = {
  passphraseStrength: {
    label: 'Passphrase strength',
    tooShort: 'Too short (< 8 chars)',
    fair: 'Acceptable (8–11 chars; 12+ recommended)',
    strong: 'Strong (12+ chars)',
    guidance: 'Minimum 8 characters required; 12+ characters with mixed words or symbols is strongly recommended.',
  },
  fingerprint: {
    label: 'SHA-256 Key Fingerprint',
    fullHexLabel: 'Full SHA-256 Hex',
    shortLabel: 'Short ID',
    copyFullBtn: 'Copy Full Fingerprint',
    copiedFull: 'Fingerprint Copied',
    showQrBtn: 'Fingerprint QR',
    hideQrBtn: 'Hide QR',
    qrCaption: 'Scan or compare full SHA-256 fingerprint out-of-band before trusting.',
  },
  trust: {
    outOfBandNote:
      'Received or scanned keys are never auto-trusted. Verify the full SHA-256 fingerprint via an independent channel (official artist website, social bio, or direct message) first.',
    confirmCheckbox: 'I verified this public key fingerprint via an independent channel',
    unconfirmedBadge: 'Unconfirmed (Needs Fingerprint Check)',
    confirmNowBtn: 'Confirm Fingerprint',
    saveUnconfirmedBtn: 'Save Unconfirmed Only',
    unconfirmedHelp:
      'Saved locally for reference only. Treated as Unverified until you confirm its fingerprint.',
  },
  challenge: {
    sectionTitle: 'Offline Key-Possession Challenge-Response',
    sectionSubtitle:
      'Verify offline that someone currently holds a private key—without servers or accounts.',
    createTitle: '1. Create Challenge Token',
    targetPubLabel: 'Target Public Key (base64url or JSON bundle)',
    noteLabel: 'Optional Context Note (max 96 bytes)',
    notePlaceholder: 'e.g., Profile check 2026-11',
    createBtn: 'Generate Challenge',
    challengeTokenLabel: 'Challenge Token (send to key holder)',
    signTitle: '2. Sign Challenge with My Key',
    challengeInputLabel: 'Received Challenge Token / JSON',
    signKeySelectLabel: 'Local Signing Key',
    signPassLabel: 'Passphrase (if encrypted seed)',
    signBtn: 'Sign Challenge',
    responseTokenLabel: 'Signed Challenge Response',
    verifyTitle: '3. Verify Challenge Response Offline',
    responseInputLabel: 'Signed Response Token / JSON',
    verifyBtn: 'Verify Response',
    validResult: 'Key possession verified offline for this nonce & public key.',
    invalidResult: 'Challenge-response verification failed.',
    scopeDisclaimer:
      'Important: Passing this check proves private-key possession for this nonce only. It does NOT prove real-world identity, legal authorship, or that the artwork was hand-drawn.',
  },
  notices: {
    sectionTitle: 'Key Revocation & Rotation Notices (Offline)',
    sectionSubtitle:
      'Publish or import signed notices (.chnotice.json / chm-notice:) to announce retired, rotated, or compromised keys.',
    createTitle: 'Create Signed Notice',
    subjectKeyLabel: 'Subject Key to Revoke or Rotate',
    typeLabel: 'Notice Type',
    typeRevocation: 'Revocation Notice (single signature)',
    typeRotation: 'Key Rotation Notice (dual signature: old + new key)',
    replacementKeyLabel: 'Replacement Key (for Rotation)',
    reasonLabel: 'Reason',
    reasons: {
      'key-compromise': 'Key compromise suspected',
      'key-superseded': 'Key superseded by rotation',
      retired: 'Key retired',
      other: 'Other',
    },
    noteLabel: 'Optional Note (max 160 bytes)',
    passLabel: 'Passphrase if key uses encrypted seed',
    createBtn: 'Create Signed Notice',
    downloadBtn: 'Download .chnotice.json',
    copyBtn: 'Copy chm-notice: Token',
    compromiseWarning:
      'Limitation: Anyone holding a leaked old private key could sign a notice or issue backdated signatures. Without a central revocation server, offline verifiers only know notices they import locally.',
    importTitle: 'Import & Verify Notice Offline',
    importPlaceholder: 'Paste chm-notice:... token or .chnotice.json',
    importBtn: 'Verify & Save Notice Locally',
    importFileBtn: 'Load .chnotice.json File',
    listTitle: 'Locally Imported Notices',
    noNotices: 'No revocation or rotation notices imported on this device.',
    revokeBadge: 'Revocation Notice',
    rotateBadge: 'Rotation Notice',
    issuedAtLabel: 'Notice self-declared time',
    noneLocalInfo:
      'Local Revocation Check: No notice stored locally on this device (does NOT guarantee this key has not been revoked elsewhere).',
    localMatchBannerRevoked:
      'Local Revocation Notice Found: This signing key has an imported revocation notice on this device. Verify status out-of-band.',
    localMatchBannerRotated:
      'Local Key Rotation Notice Found: This key has a signed rotation notice pointing to a replacement key.',
    historicalValidNote:
      'Historical cryptographic validity of past certificates is reported independently and never silently rewritten.',
  },
  similarity: {
    sectionTitle: 'SNS Recompression Visual Similarity Helper',
    badgeNonCrypto: 'Non-Cryptographic · Auxiliary Only',
    subtitle:
      'Compare a recompressed or resized social-media copy against a reference image locally. Visual similarity does NOT prove cryptographic integrity.',
    dropTitle: 'Select or drop a second image to visually compare',
    compareBtn: 'Compare Visual Hashes',
    clearBtn: 'Clear Comparison',
    combinedLabel: 'Combined Visual Similarity (dHash + pHash)',
    dHashLabel: 'dHash (64-bit)',
    pHashLabel: 'pHash DCT (64-bit)',
    bandHigh: 'High visual resemblance (non-cryptographic)',
    bandModerate: 'Moderate visual resemblance (non-cryptographic)',
    bandLow: 'Low visual resemblance',
    disclaimer:
      'Strict SHA-256 remains the only cryptographic integrity check. Perceptual hashes (dHash/pHash) help check recompressed SNS images but can have false positives or miss small edits.',
    noBaseline: 'Load or drop an artwork image first to run visual comparison.',
  },
  qrMaskSafety: {
    coverageLabel: 'Excluded qrMask Area',
    tierOk: 'Low exclusion (<= 15%)',
    tierCaution: 'Moderate exclusion (> 15%)',
    tierHigh: 'High exclusion (> 30%)',
    warnCaution:
      'Notice: More than 15% of the artwork area is excluded by qrMask from SHA-256 verification. Reduce QR box size if possible.',
    warnHigh:
      'Warning: Over 30% of the artwork area is excluded by qrMask from SHA-256 integrity checks. Shrink the QR or use Protocol v1 outer margin.',
    highlightToggle: 'Highlight Excluded qrMask Area',
    optimizeSizeBtn: 'Optimize QR Size',
    appliedHint: 'Minimized to readable integer-aligned size.',
  },
  docsAddendum: {
    cliTitle: 'Independent Offline CLI Verifiers',
    cliBody:
      'Verify signed PNGs, #proof= URLs, .chproof.json bundles, and .chnotice.json notices outside the browser with standalone zero-src-import CLIs: Go (tools/chm-verify) and Node.js (tools/chm-verify.mjs).',
    noticesTitle: 'Revocation, Rotation & Challenge Scope',
    noticesBody:
      'Offline revocation/rotation notices (CHM-NOTICE1) and key-possession challenges (CHM-CHALLENGE1) operate strictly locally with domain-separated Ed25519 signatures and do not depend on a central CA.',
  },
};
