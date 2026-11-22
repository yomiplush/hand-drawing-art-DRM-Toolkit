# Certified Handmade

**Your Art. Your Rights. Your Freedom.**

Certified Handmade is a 100% free, open-source, offline-first web application (PWA) for declaring cryptographic provenance, authorship signatures, and usage rights on human-made digital art—and burning a self-contained verification QR code into a lossless PNG margin or translucent in-image overlay.

- **Website:** https://certified-handmade.com/
- **Repository:** https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit
- **License:** MIT (see [`LICENSE`](./LICENSE))

---

## Core Principles

- **100% Free & Open Source** (MIT License)
- **No NFTs, No Blockchain, No Cryptocurrency, No Crypto Wallets**
- **No Accounts, No Subscriptions, No Paywalls, No Ads**
- **No Central Authentication or Database Server**
- **No Telemetry, No External Scripts, No Server File Uploads**
- **Local Processing & Offline First (PWA)**

All key generation, Ed25519 signing, canonical RGBA8 pixel hashing, PNG encoding/decoding, QR burning, QR scanning, and verification run **100% locally inside your browser**.

---

## Features

1. **Local Ed25519 Key Management (`/keys`)**
   - Generates Ed25519 keypairs inside the browser (non-extractable Web Crypto `CryptoKey` in IndexedDB where supported, with audited `@noble/ed25519` fallback).
   - Passphrase-encrypted private key backups (`.chkey.json` using PBKDF2-SHA256 + AES-256-GCM) and restore flow.
   - Public key export and a personal **Locally Trusted Keys** list (no central CA).
2. **Certificate Creation, Outer QR Border & In-Image QR Studio (`/create`)**
   - Normalizes PNG (lossless via `fast-png`, preserving exact straight RGBA8 including `alpha = 0`), JPEG, and WebP inputs into Canonical Artwork Raster (`RGBA8`).
   - Encodes artwork SHA-256, region `[x, y, width, height]`, optional `qrMask`, declared timestamp, license (`All Rights Reserved`, `CC0-1.0`, `CC BY / BY-SA / BY-NC / BY-NC-SA / BY-ND / BY-NC-ND 4.0`), and non-binding intent flags (including AI training preference) into deterministic RFC 8949 CBOR signed with Ed25519.
   - Solves the image-hash / QR circular dependency via Protocol v1 (placing the QR code strictly outside `[x, y, width, height]`) or Protocol v2 (masking `qrMask` in the Manual In-Image QR Studio).
3. **Independent Verification (`/verify`)**
   - Accepts `/verify#proof=...` URL fragments directly (fragment data is never sent in HTTP requests), pasted proof tokens, clipboard images, PWA Web Share Target handoffs, uploaded signed PNGs, or live local camera QR scanning (`getUserMedia`).
   - Displays **three independent statuses** without conflating them:
     - **A. Cryptographic Signature:** `Valid` / `Invalid` / `Unsupported`
     - **B. Artwork Integrity:** `Matched` / `Mismatched` / `Not Checked`
     - **C. Author Identity:** `Locally Trusted Key` / `Unknown / Unverified Key`
4. **13-Language UI** & Responsive Touch-First Design (Desktop, iPad Safari, iPhone Safari, Android Chrome).
5. **Offline PWA:** Once loaded once and cached by the Service Worker, signing and verifying run completely offline.

---

## Important Limitations & Scope

- **Signature ≠ Proof of Hand-Drawing:** A valid Ed25519 signature proves only that the holder of a keypair signed the manifest and (when checked) that the artwork pixels match. It cannot mathematically prove from a finished image alone that no AI tools were used.
- **Self-Declared Timestamps:** Without an external timestamp authority, `issuedAt` reflects the local device clock declared by the signer.
- **First-Load Offline Constraint:** A device that has never visited or cached the PWA cannot fetch the web app over the internet while offline. However, once cached, all operations work offline, and proofs follow open [`SPEC.md`](./SPEC.md) so anyone can verify them independently even if the hosting domain disappears.
- **Browser Storage Volatility:** IndexedDB keys can be deleted by browser eviction or clearing site data. Always export and safely store an encrypted `.chkey.json` backup.

---

## Local Development

### Prerequisites

- Node.js 20+ (tested on Node 26)
- npm 10+

### Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Typecheck & Lint
npm run typecheck
npm run lint

# Run unit & integration tests (Vitest)
npm test

# Production build (static files + PWA Service Worker in dist/)
npm run build

# Preview production build locally
npm run preview

# Run E2E tests (Playwright, builds/serves dist/)
npx playwright test
```

---

## Cloudflare Pages Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for step-by-step instructions to connect this GitHub repository to **Cloudflare Pages** (Free plan, `npm run build` -> `dist/`, static assets only, no Workers/Functions required).

---

## Documentation Index

- [`SPEC.md`](./SPEC.md) — Canonical manifest schema, deterministic RFC 8949 CBOR format, RGBA8 normalization, signing domain separation, and verifiable test vectors.
- [`SECURITY.md`](./SECURITY.md) — Threat model, key storage architecture, verification semantics, CSP, and residual risks.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages setup, SPA routing, PWA headers, and self-hosting guide.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) — Open-source dependencies and licenses.
