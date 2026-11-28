import type { GoogleComplianceTranslations } from '../../googleCompliance';

export const EN: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Local-First Artwork Provenance & Offline QR Verification',
    appPurposeBody:
      'Certified Handmade is a free, MIT open-source toolkit that signs digital artwork locally in your browser using Ed25519 keys and SHA-256 pixel hashing, embedding a self-contained verification QR code into lossless PNGs—no login, no servers, and no artwork uploads.',
    drivePurposeTitle: 'Optional Google Drive App-Private Vault (drive.appdata)',
    drivePurposeBody:
      'Signing and verification work 100% offline without any account. Only if you choose to connect Google Drive in Storage, Certified Handmade requests the minimal drive.appdata scope strictly to store client-side AES-256-GCM encrypted proofs, identities, device records, and opt-in encrypted backups inside your hidden appDataFolder—never touching visible Drive files or uploading artwork images.',
    privacyLinkLabel: 'Privacy Policy & Google Data Notice',
    storageLinkLabel: 'Storage & Sync',
    docsLinkLabel: 'Technical Docs',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Optional Google OAuth 2.0 & Google Drive API (drive.appdata) Disclosure',
    sectionBody:
      '• Strictly Optional & User-Initiated: Certified Handmade works completely without a Google account. Only when you explicitly click "Connect Google Account" on /storage does your browser load Google Identity Services (accounts.google.com/gsi/client) and request the narrow https://www.googleapis.com/auth/drive.appdata scope.\n• RAM-Only OAuth Tokens: Access tokens are held strictly in volatile memory (RAM) and are never written to localStorage, IndexedDB, URLs, or logs. Disconnecting or revoking Google access never deletes local proofs or keys.\n• Hidden App-Private Encrypted Vault Only (appDataFolder): Certified Handmade accesses only its own hidden appDataFolder space in your Google Drive (encrypted keyring.chmk, manifest.chme, synced public author identities, signed device authorizations/revocations, proof/profile snapshots, and optional client-encrypted recovery backups). Original artworks, PSD/KRA/CLIP project files, unencrypted Ed25519 signing keys, and plaintext personal data are NEVER uploaded to Google Drive.\n• Google API Services User Data Policy (Limited Use): Certified Handmade’s use and transfer to any other app of information received from Google APIs strictly adhere to the Google API Services User Data Policy, including the Limited Use requirements. Data is used solely to provide personal encrypted sync across your devices and is never sold, used for ads, shared with third parties, or used to train AI/ML models.',
    tableRowName: 'Google OAuth Access Token (RAM only)',
    tableRowCategory: 'Optional User Consent (Art. 6(1)(a))',
    tableRowPurpose:
      'Authorizes access solely to Certified Handmade’s hidden AES-256-GCM encrypted appDataFolder (drive.appdata).',
    tableRowRetention: 'RAM only during active session; cleared on reload or disconnect',
  },
};
