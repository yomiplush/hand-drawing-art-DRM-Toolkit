import type { SeoTranslations } from '../../seo';

export const EN: SeoTranslations = {
  home: {
    title: 'Certified Handmade — Cryptographic Artwork Provenance & Offline QR Certificates',
    description:
      'Open-source, 100% local-first & standalone Cryptographic Artwork Provenance toolkit for artists. Sign lossless PNG artwork with Ed25519, SHA-256 tamper detection & AES-256-GCM key backups—no copy-protection lock-in, no servers.',
    keywords:
      'Hand-drawing Artist, Hand-drawn Art DRM, DRM, Encryption, Local-First, Standalone, Offline PWA, Ed25519, SHA-256, AES-256-GCM, Cryptographic Art Provenance, QR Artwork Verification',
  },
  create: {
    title: 'Create Cryptographic Artwork Provenance Certificate & PNG QR | Certified Handmade',
    description:
      'Sign your hand-drawn artwork locally with Ed25519 cryptographic signatures and SHA-256 pixel hashing. Export lossless PNGs with an outer QR frame or encrypted key proof—zero server upload.',
    keywords:
      'Create Art Certificate, Hand-drawn Art DRM, Ed25519 Signing, Lossless PNG QR, Local Encryption, Standalone Art Provenance',
  },
  createStudio: {
    title: 'Manual In-Image QR Studio — Translucent PNG Provenance Overlay | Certified Handmade',
    description:
      'Place, resize, rotate, and blend translucent cryptographic DRM QR codes directly inside your illustration canvas with real-time scannability checks and masked pixel integrity.',
    keywords:
      'In-Image QR Studio, Translucent QR Code Art, Hand-drawing DRM, Standalone PNG Signer, Masked Pixel Integrity',
  },
  verify: {
    title: 'Verify Artwork Provenance, Ed25519 Signature & QR Proof | Certified Handmade',
    description:
      'Verify Ed25519 artwork signatures, SHA-256 canonical pixel integrity, #proof= URL fragments, and locally trusted artist keys 100% locally offline via PNG upload, camera QR, or clipboard.',
    keywords:
      'Verify Artwork DRM, QR Proof Verifier, Ed25519 Signature Check, SHA-256 Pixel Integrity, Offline Verification',
  },
  tutorial: {
    title: 'Step-by-Step Guide to Cryptographic Artwork Provenance | Certified Handmade',
    description:
      'Beginner-friendly standalone guide: generate an encrypted Ed25519 signing key, embed a verification QR into your hand-drawn PNG, and choose ARR or Creative Commons licenses.',
    keywords:
      'Art DRM Tutorial, Hand-drawing Artist Guide, Ed25519 Key Setup, Artwork Licensing Guide, Local-First Signing',
  },
  exchange: {
    title: 'CHM Public-Key Exchange — Share & Verify Ed25519 Keys | Certified Handmade',
    description:
      'Share your Ed25519 artist public key via portable #key= URLs, QR codes, or JSON, and verify SHA-256 fingerprints locally offline without servers.',
    keywords:
      'CHM-Exchange, Ed25519 Public-Key Exchange, Artist Fingerprint Verification, QR Key Sharing, Offline Trust',
  },
  keys: {
    title: 'Local Signing Keys & AES-256-GCM Encrypted Backup | Certified Handmade',
    description:
      'Generate Ed25519 artist identity keys in your browser and export passphrase-encrypted .chkey.json backups protected with AES-256-GCM & PBKDF2-SHA256—no accounts or cloud.',
    keywords:
      'Ed25519 Artist Key, AES-256-GCM Key Backup, Local Key Management, Standalone Cryptography, PBKDF2-SHA256',
  },
  docs: {
    title: 'Cryptographic Architecture, SPEC & Offline Verifier Docs | Certified Handmade',
    description:
      'Technical reference for Certified Handmade: RFC 8949 CBOR proof schema, RGBA8 canonical SHA-256 digests, Protocol v1/v2 QR masks, AES-256-GCM backups, and license definitions.',
    keywords:
      'Art DRM Specification, RFC 8949 CBOR, Ed25519 Provenance Spec, AES-256-GCM Encryption, Cryptographic Art Docs',
  },
  privacy: {
    title: 'Privacy Policy & GDPR Local-Only Architecture | Certified Handmade',
    description:
      'GDPR privacy disclosure: zero tracking, zero analytics, CSP connect-src self wss: (outbound wss:// relays only if opt-in sync is enabled), and 100% local artwork/key processing.',
    keywords:
      'Privacy Policy, GDPR Compliance, Zero Telemetry, Local-Only Web App, Offline Privacy',
  },
  homeFaqTitle: 'Frequently Asked Questions — Cryptographic Artwork Provenance',
  homeFaqSubtitle:
    'Clear answers for hand-drawing artists looking for serverless encryption, offline provenance, and long-term proof.',
  homeFaqs: [
    {
      q: 'What is Cryptographic Artwork Provenance and how does Certified Handmade differ from copy-protection DRM?',
      a: 'Certified Handmade is a standalone, local-first Cryptographic Artwork Provenance and tamper-detection toolkit—not copy-prevention DRM. It binds an Ed25519 signature, license claim, and SHA-256 canonical pixel hash directly into a lossless PNG and scannable QR code on your own device without cloud databases or blockchains.',
    },
    {
      q: 'Does it really run 100% locally and standalone offline without any server upload?',
      a: 'Yes. Every operation—key generation, SHA-256 hashing, Ed25519 signing, AES-256-GCM key backup encryption, and QR encoding/decoding—runs inside your browser with strict Content-Security-Policy (connect-src \'self\' wss: wss:, allowing external wss:// traffic only when you explicitly opt in to optional Device Sync). Once cached as a PWA, core signing and verification work 100% offline.',
    },
    {
      q: 'How are my artist keys and backups encrypted?',
      a: 'Signing keys use Ed25519 cryptography. Exported .chkey.json key backups are encrypted locally with AES-256-GCM using a 600,000-iteration PBKDF2-SHA256 key derivation from your passphrase, so you can keep portable cold backups safely without accounts.',
    },
    {
      q: 'Why does Certified Handmade say "Your artwork should outlive the platform that certifies it"?',
      a: 'Platforms and startups shut down, change terms, or break links. Certified Handmade encodes compact RFC 8949 CBOR proofs inside standard PNG tEXt chunks and self-contained QR/#proof= links under an open MIT specification (SPEC.md), so anyone can verify your work decades from now even if the website disappears.',
    },
    {
      q: 'How do Outer QR Border (v1) and Translucent In-Image QR Studio (v2) verify pixels without breaking hashes?',
      a: 'In Protocol v1, the QR code sits strictly outside the artwork rectangle [x, y, w, h]. In Protocol v2 (In-Image QR Studio), a masked rectangle qrMask excludes only the translucent QR area before SHA-256 hashing—so both the signed PNG and the clean original illustration verify bit-for-bit.',
    },
  ],
};
