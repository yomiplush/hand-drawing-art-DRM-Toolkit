# Certified Handmade

**Your Art. Your Rights. Your Freedom.**

Certified Handmade is a **¥0 / $0 forever**, open-source, offline-first **Cryptographic Artwork Provenance**, **Local Proof Vault**, and **Decentralized Device Synchronization** toolkit. Artists can cryptographically sign illustrations locally with Ed25519, embed self-contained verification QR codes into lossless PNG margins (Protocol v1) or masked in-image overlays (Protocol v2), manage compact local proof vaults (`/vault`), and optionally pair or synchronize devices across untrusted free public Nostr relays (`CHM-SYNC-v1`)—or run 100% offline via the **Web / PWA Edition** (`certified-handmade.com`), the **Portable Standalone Edition** (`127.0.0.1:43777` for Linux x86_64 and Windows x86_64), or the **Independent Offline CLIs**.

- **Website:** https://certified-handmade.com/
- **Repository:** https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit
- **License:** MIT (see [`LICENSE`](./LICENSE))

---

## Core Principles

- **¥0 / $0 Mandatory User Cost Forever & Domain-Only Maintainer Cost** (no subscriptions, paywalls, paid APIs, cloud DBs, VPS, telemetry, or paid relays)
- **100% Free & Open Source** (MIT License)
- **No NFTs, No Blockchain, No Cryptocurrency, No Crypto Wallets**
- **No Accounts, No Social Logins, No Tracking, No Ads**
- **No Central Authentication Server, No Central CRL, No Mandatory Backend, No Artwork Upload**
- **Local First & Offline First** (IndexedDB + PWA + Portable Standalone Binaries + Independent CLIs)
- **Strict Layer Separation & Graceful Degradation** (Ed25519 CHM core works 100% independently even if Nostr relays are offline, blocked, or disabled)

All key generation, Ed25519 signing, canonical RGBA8 pixel hashing, PNG encoding/decoding, QR burning, QR scanning, streaming local evidence hashing, visual similarity checks, notice verification, challenge-response checks, and NIP-44/NIP-59 gift-wrap encryption run **100% locally on your device**.

---

## Editions

| Edition | Target | Internet Required? | Storage Origin |
| --- | --- | --- | --- |
| **Web / PWA Edition** | Desktop, iPhone, iPad, Android browsers | First visit over HTTPS caches PWA; subsequent use works offline (optional opt-in Nostr sync only when enabled) | `https://certified-handmade.com` |
| **Standalone Edition** | **Linux x86_64** & **Windows x86_64** | **No** — works 100% offline from launch #1 (zero Node.js/Go install needed) | `http://127.0.0.1:43777` |
| **Independent CLI Verifiers** | `tools/chm-verify` (Go) & `tools/chm-verify.mjs` (Node.js) | **No** — stateless verification importing zero files from `src/` | CLI / JSON stdout |

> **Moving keys between Web & Standalone:** Because browsers isolate IndexedDB storage per origin, export a passphrase-encrypted `.chkey.json` backup in **Identity / Keys** (`/keys`) or during quick key generation and restore it on the other edition.

---

## Features

1. **Decentralized Ed25519 Key Management, Trust & Challenges (`/keys`, `/exchange`)**
   - Generates Ed25519 keypairs inside the browser (non-extractable Web Crypto `CryptoKey` in IndexedDB where supported, with audited `@noble/ed25519` fallback).
   - Passphrase-encrypted private key backups (`.chkey.json` using 600,000-iteration PBKDF2-SHA256 + AES-256-GCM) with live passphrase strength feedback (`8+` required, `12+` recommended), non-mutating backup verification ("Verify Backup Only"), and restore flow.
   - Displays copyable full 64-hex SHA-256 key fingerprints and scannable fingerprint QR codes, integrates with `@yomiplush/chm-exchange`, and requires explicit out-of-band fingerprint confirmation before promoting a received key to **Trusted** (`unconfirmed` vs `confirmed`).
   - Supports offline **Key Revocation & Rotation Notices** (`CHM-NOTICE1\0`, `.chnotice.json` / `chm-notice:`)—single-signed for revocation and dual-signed (old + new key) for rotation—and **Offline Key-Possession Challenge-Response** (`CHM-CHALLENGE1\0`).
2. **Certificate Creation, Optional Artwork Details (`.chmevidence`), Outer QR Border (v1) & In-Image QR Studio (v2) (`/create`)**
   - Normalizes PNG (lossless via `fast-png`, preserving exact straight RGBA8 including `alpha = 0`), JPEG, and WebP inputs into Canonical Artwork Raster (`RGBA8`).
   - Encodes artwork SHA-256, region `[x, y, width, height]`, optional `qrMask` (v2), declared timestamp, license (`All Rights Reserved`, `CC0-1.0`, `CC BY / BY-SA / BY-NC / BY-NC-SA / BY-ND / BY-NC-ND 4.0`), and non-binding intent flags (including AI training preference) into deterministic RFC 8949 CBOR signed with Ed25519.
   - **Artwork Details (Optional):** Collapsible progressive disclosure for multilingual artwork title/artist/description, creator website & unbounded social/portfolio links (with optional local IndexedDB default persistence), creation method declaration (`hand-drawn-no-ai`, `hand-drawn-ai-assisted`, `ai-generated`, `other`, `prefer-not-to-disclose`), creation environment notes (software, hardware, input device, free-form notes), and streaming local `SHA-256` hashing of private evidence files (sketches, WIPs, PSD/KRA/CLIP projects, timelapses—raw files stay local on your device).
   - **Compact QR & `.chmevidence`:** Extended details are signed in a separate domain-separated `.chmevidence` file (`CHM-EVIDENCE1\0`) cryptographically bound (`proofSha256`, `artworkId`, `artworkSha256`, `publicKey`) to the primary proof—leaving the embedded QR code (`0` extra bytes) compact and backward compatible.
   - Protocol v2 Studio displays live `qrMask` excluded-area percentage warnings (`>15%` caution, `>30%` high), an optional excluded-mask highlight overlay on the preview canvas, and a one-click **Optimize QR Size** helper.
   - Post-render QR readability self-check verifies every generated PNG before export, automatically saves a compact ~1 KiB `CHM-VAULT-v1` proof record to `/vault`, and optionally exports a `.chproof.json` portable proof bundle alongside the PNG and `.chmevidence`.
3. **Local Proof Vault & Portable Backups (`/vault`, `CHM-VAULT-v1`)**
   - Stores compact signed proof records (`< 1.2 KiB` each, `0` image pixels, `0` private keys) inside IndexedDB `proofVault`, scaled and indexed for 10,000+ proofs.
   - Supports instant local filtering/search, selective per-proof sync checkboxes (`syncSelected`), plain JSON vault export/import (`containsPrivateKeys: false`), and passphrase-encrypted AES-256-GCM (PBKDF2 600,000 iterations) vault archive export/restore.
   - Optional opt-in **Public Proof Index** (`CHM-PUBLIC-PROOF-v1`, Nostr NIP-78 `kind 30078`) publishes or queries public `CHM1` proof tokens over verified free relays without uploading artwork pixels or private metadata.
4. **Independent Offline Verification (`Mode A / B / C`) & SNS Visual Helper (`/verify`)**
   - Accepts `/verify#proof=...` URL fragments, pasted proof tokens, `.chproof.json` proof bundles, clipboard images, PWA Web Share Target handoffs, uploaded signed PNGs, or live local camera QR scanning (`getUserMedia`).
   - Supports three offline verification modes:
     - **Mode A:** Artwork + embedded QR / primary proof only.
     - **Mode B:** Primary proof + `.chmevidence` signed extension (rejecting standalone `.chmevidence` without a primary proof, and reporting unsupplied evidence files honestly as *Unavailable*, never *Invalid*).
     - **Mode C:** Primary proof + `.chmevidence` + local evidence files (streaming SHA-256 verification).
   - Never automatically fetches or navigates to remote URLs during verification.
   - Displays **independent statuses** without conflating them (`Valid`/`Invalid`/`Unsupported`, `Matched`/`Mismatched`/`Not Checked`, `Locally Trusted Key`/`Unknown / Unverified Key`, Local Key Notice Check, and `declared by creator` extended details).
   - Includes a collapsible, strictly **non-cryptographic** `dHash64` + `DCT pHash64` helper to visually compare SNS-recompressed copies locally.
5. **CHM Secure Device Pairing & Decentralized Nostr Sync (`/devices`, `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`)**
   - **Offline 2-Step QR Pairing (`CHM-DEVICE-PAIRING-v1`):** Pairs PC, smartphone, and tablet browsers to an existing CHM Identity 100% offline via a 2-step QR handshake with an 8-character out-of-band MitM confirmation code (`CHM-PAIR-CONFIRM1\0`), independent per-device Ed25519 keys, explicit `['device-identity']` privilege boundary, persistent `requestId`/`nonce` replay defense, monotonic signed revocations, and `.chdevreg.{json,cbor}` snapshots.
   - **Opt-In Decentralized Nostr Sync (`CHM-SYNC-v1`):** Completely disabled at rest (`0` background relay traffic). When explicitly enabled by the user:
     - Enforces **strict key separation** between CHM Ed25519 identity keys and Nostr secp256k1 transport keys (`ncryptsec1` NIP-49 backup supported).
     - Authenticates transport bindings using dual Ed25519 + BIP-340 Schnorr attestations (`CHM-SYNC-v1:BIND\0` / `CHM-SYNC-v1:NOSTR-POP\0`) and hash-chained monotonic operations (`CHM-SYNC-v1:OP\0`).
     - Encrypts every cross-device sync bundle end-to-end with **NIP-44 v2 + NIP-59 Gift Wrap (`kind 1059`)** (NIP-04 strictly excluded).
     - Enforces **Zero-Cost NIP-11 Policy Pre-Flight** and runtime `payment-required` auto-pausing to block paid relays automatically, plus a **1 MiB / 30-day soft rolling sync budget** where Priority `0` revocations (`revoke-device`) and Priority `1` identity checkpoints always bypass deferral while Priority `2` proof vault sync degrades gracefully to offline export.
     - Validated against official Nostr specifications at [`nostr-protocol/nips@bec0fc8`](https://github.com/nostr-protocol/nips/commit/bec0fc8).
6. **13-Language UI & Touch-First Accessibility** across desktop and mobile viewports.

---

## Independent Offline CLI Verifiers (`tools/`)

To verify artworks, proofs, `.chmevidence` extensions, and key notices independently of the web app (`zero src/ imports`):

```bash
# Node.js CLI (Mode A/B/C verification & key notices)
node tools/chm-verify.mjs signed-artwork.png
node tools/chm-verify.mjs --proof art.chproof.json --artwork original.png --evidence art.chmevidence --evidence-file sketch.kra --json
node tools/chm-verify.mjs --notice notice.chnotice.json

# Go CLI (standard library only)
cd tools/chm-verify
go run . --proof /path/to/art.chproof.json --artwork /path/to/original.png --evidence /path/to/art.chmevidence --evidence-file /path/to/sketch.kra --json
go run . --notice /path/to/notice.chnotice.json
```

---

## Important Limitations & Scope

- **Cryptographic Provenance, Not Copy-Protection DRM:** Certified Handmade creates tamper-evident signatures and machine-readable rights declarations; it does **not** encrypt artwork pixels, block screenshots, or technically enforce `aiTraining: disallow`.
- **Signature ≠ Proof of Hand-Drawing or Legal Copyright:** A valid Ed25519 signature (or `.chmevidence` evidence hash match / offline key-possession challenge) proves only that the holder of that private key signed the data and (when checked) that pixels or local evidence files match their signed SHA-256 hashes. It cannot prove by math alone that no AI tools were used, verify external social account ownership, or prove legal copyright ownership.
- **Self-Declared Timestamps & Decentralized Notices:** Without a central server or TSA, `issuedAt`, `noticeIssuedAt`, and `.chmevidence` `createdAt` are self-declared, and offline verifiers only see `.chnotice.json` notices imported locally.
- **Public Relay Availability & Retention:** Free community Nostr relays have zero uptime SLA or permanent retention guarantee. Encrypted NIP-59 envelopes only assist device-to-device transport; local IndexedDB and encrypted `.chkey.json` / Vault backups remain your source of truth.
- **Perceptual Similarity Is Auxiliary Only:** `dHash`/`pHash` visual scores are non-cryptographic aids for resized/recompressed social images and never replace `SHA-256`.
- **Browser Storage Volatility:** IndexedDB stores (`authorKeys`, `trustedKeys`, `keyNotices`, `creatorProfiles`, `proofVault`, `syncSettings`, etc.) can be deleted by browser eviction or clearing site data. Always export and verify encrypted `.chkey.json` and Vault backups.

---

## Local Development & Standalone Builds

### Prerequisites

- **Web / Tests:** Node.js 20+ (tested on Node 26), npm 10+
- **Standalone Launcher & Go CLI:** Go 1.22+ (zero third-party Go modules — standard library only)

### Commands

```bash
# Install Node dependencies
npm install

# Start development server
npm run dev

# Typecheck & Lint
npm run typecheck
npm run lint

# Run unit & integration tests (Vitest — uses local MockNostrRelay loopback, zero external network calls)
npm test

# Run Go independent CLI & Standalone server tests
cd tools/chm-verify && go test -v ./...
cd standalone && go test -v ./...

# Production web build (static files + PWA Service Worker in dist/)
npm run build

# Build portable Standalone binaries & reproducible archives in release/
npm run build:standalone

# Run web Playwright E2E tests (Desktop + Mobile Chromium)
npm run test:e2e

# Run offline Standalone Linux binary Playwright E2E tests (http://127.0.0.1:43777)
npm run test:standalone
```

---

## Cloudflare Pages & GitHub Releases Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:
- Free Cloudflare Pages deployment (`dist/`)
- Local & zero-cost GitHub Releases packaging for Linux x86_64 and Windows x86_64 with `SHA256SUMS.txt`

---

## Documentation Index

### Core Protocol & Security Specifications
- [`SPEC.md`](./SPEC.md) — Canonical manifest schema (Protocol v1 & v2), `CHM-EVIDENCE1`, `CHM-NOTICE1`, `CHM-CHALLENGE1`, `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`, `CHM-VAULT-v1`, `CHM-PUBLIC-PROOF-v1`, and normative test vectors.
- [`SECURITY.md`](./SECURITY.md) — Threat model, out-of-band key trust, `.chmevidence` anti-replay/XSS boundaries, key separation & storage architecture, NIP-11/NIP-59 sync security, loopback HTTP hardening, CSP, and honest audit/residual-risk disclosures.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages setup, portable standalone build/release workflow, and self-hosting guide.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) — Open-source dependencies and licenses.

### Architecture, Zero-Cost & Decentralized Sync Guides (`docs/`)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Four-layer clean architecture (CHM Crypto Core, Device Identity, Abstract Sync/Vault, Human-Friendly UI).
- [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md) — Detailed threat analysis across local keys, device pairing, Nostr sync, Vault, and browser origins.
- [`docs/CHM-SYNC-PROTOCOL.md`](./docs/CHM-SYNC-PROTOCOL.md) — Normative `CHM-SYNC-v1` wire spec, adopted NIPs (`bec0fc8`), priority queue, and NIP-59 rumor framing.
- [`docs/KEY-MANAGEMENT.md`](./docs/KEY-MANAGEMENT.md) — Strict separation and custody rules for CHM Ed25519 keys vs. Nostr secp256k1 keys (`.chkey.json` & NIP-49 `ncryptsec1`).
- [`docs/PRIVACY.md`](./docs/PRIVACY.md) — Zero-tracking policy, metadata minimization, NIP-59 sender privacy, and pixel non-upload guarantees.
- [`docs/RECOVERY.md`](./docs/RECOVERY.md) — Encrypted backup, device loss revocation, and cross-origin migration recovery procedures.
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — IndexedDB schema migrations (`v1` -> `v4`) and zero-downtime upgrade safety.
- [`docs/ZERO-COST-ARCHITECTURE.md`](./docs/ZERO-COST-ARCHITECTURE.md) — Architectural guarantees eliminating all user fees and paid backend dependencies.
- [`docs/COST-MODEL.md`](./docs/COST-MODEL.md) — Maintainer & user cost breakdown from 100 to 1,000,000+ users (domain-only cost model).
- [`docs/RELAY-POLICY.md`](./docs/RELAY-POLICY.md) — Zero-cost NIP-11 relay filtering, runtime `payment-required` auto-pause, and NIP-65 relay lists.
- [`docs/STORAGE-BUDGET.md`](./docs/STORAGE-BUDGET.md) — Compact `CHM-VAULT-v1` record schema (`~1 KiB`) and 1 MiB / 30-day rolling sync budget.
- [`docs/OFFLINE-MODE.md`](./docs/OFFLINE-MODE.md) — Offline-first PWA, Portable Standalone Edition, and graceful offline fallbacks.
- [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) — Client-side scaling to 10,000+ local proofs and relay traffic politeness.
- [`docs/DATA-PORTABILITY.md`](./docs/DATA-PORTABILITY.md) — Open standard export/import formats (`.chkey.json`, `.chproof.json`, `.chmevidence`, `.chdevreg`, Vault JSON/encrypted backups).
