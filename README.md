# Certified Handmade

**Your Art. Your Rights. Your Freedom.**

Certified Handmade is a **¥0 / $0 forever**, open-source, local-first, offline-first **Cryptographic Artwork Provenance**, **Encrypted Proof Vault**, and **Pluggable Storage & Device Auth** toolkit. Artists can cryptographically sign illustrations locally with Ed25519, embed self-contained verification QR codes into lossless PNG margins (Protocol v1), masked in-image overlays (Protocol v2), or compact DEFLATE + dictionary-compressed QR payloads carrying full artwork/creator/policy/evidence metadata (Protocol v3), manage an encrypted Proof Vault across **Local IndexedDB**, **Portable Encrypted Files (`.chmvault.json`)**, and opt-in **Personal Google Drive**, and optionally synchronize **device authentication & revocations only** over untrusted free public Nostr relays (`CHM-SYNC-v1`)—or run 100% offline via the **Web / PWA Edition** (`https://certified-handmade.com/`), the **Portable Standalone Edition** (`http://127.0.0.1:43777` for Linux x86_64 and Windows x86_64), or the **Independent Offline CLIs**.

- **Website:** https://certified-handmade.com/
- **Repository:** https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit
- **License:** MIT (see [`LICENSE`](./LICENSE))

---

## Core Principles

- **¥0 / $0 Mandatory User Cost Forever & Domain-Only Maintainer Cost** (no subscriptions, paywalls, paid APIs, cloud DBs, VPS, telemetry, or paid relays)
- **100% Free & Open Source** (MIT License)
- **No NFTs, No Blockchain, No Cryptocurrency, No Crypto Wallets**
- **No Mandatory Accounts, No Central Authentication Authority, No Mandatory Backend**
- **No Artwork Upload, No Tracking, No Ads, No Telemetry, No Vendor Lock-in**
- **Local First & Offline First** (IndexedDB + Portable `.chmvault.json` + PWA + Portable Standalone Binaries + Independent CLIs; optional Personal Google Drive & Nostr are strictly additive extensions)
- **Strict Responsibility Isolation & Graceful Degradation:**
  - Ed25519 signing, verification, and local Proof Vault work **100%** without Google Drive or Nostr.
  - **Google OAuth 2.0 (GIS Token Model, `drive.appdata` (`appDataFolder`) scope)** authorizes storage in the *user's own* Google Drive only—it never acts as a CHM Ed25519 identity and **cannot decrypt** the Vault without the Vault passphrase (or cross-device key share).
  - **Nostr (`CHM-SYNC-v1`)** is strictly limited to **device registration, authorization, revocation, identity transport binding, and signed checkpoints**—never proof vaults, artwork details, author profiles, SNS links, policy presets, settings, or public proof broadcasts.

All key generation, Ed25519 signing, canonical RGBA8 pixel hashing, PNG encoding/decoding, QR burning, QR scanning, streaming local evidence hashing, AES-256-GCM Vault encryption, visual similarity checks, notice verification, challenge-response checks, and NIP-44/NIP-59 gift-wrap encryption run **100% locally on your device**.

---

## Editions

| Edition | Target | Internet Required? | Storage & OAuth Origin |
| --- | --- | --- | --- |
| **Web / PWA Edition** | Desktop, iPhone, iPad, Android browsers | First visit over HTTPS caches PWA; subsequent use works offline (optional opt-in Google Drive Vault & Nostr device-auth sync when explicitly connected) | `https://certified-handmade.com` |
| **Standalone Edition** | **Linux x86_64** & **Windows x86_64** | **No** — works 100% offline from launch #1 (zero Node.js/Go install needed) | `http://127.0.0.1:43777` (uses Local IndexedDB + Portable `.chmvault.json`; Google OAuth intentionally disabled on loopback) |
| **Independent CLI Verifiers** | `tools/chm-verify` (Go) & `tools/chm-verify.mjs` (Node.js) | **No** — stateless verification importing zero files from `src/` | CLI / JSON stdout (`v1`, `v2`, and `v3` supported) |

> **Moving keys & vaults between Web, Standalone, and other devices:** Export a passphrase-encrypted `.chkey.json` backup in **Identity / Keys** (`/keys`) and a `.chmvault.json` backup (or sync via Personal Google Drive on Web) in **Proof Vault & Storage** (`/vault`, `/storage`).

---

## Features

1. **Decentralized Ed25519 Key Management, Trust & Challenges (`/keys`, `/exchange`)**
   - Generates Ed25519 keypairs inside the browser (non-extractable Web Crypto `CryptoKey` in IndexedDB where supported, with audited `@noble/ed25519` fallback).
   - Passphrase-encrypted private key backups (`.chkey.json` using 600,000-iteration PBKDF2-SHA256 + AES-256-GCM) with live passphrase strength feedback (`8+` required, `12+` recommended), non-mutating backup verification ("Verify Backup Only"), and restore flow.
   - Displays copyable full 64-hex SHA-256 key fingerprints and scannable fingerprint QR codes, integrates with `@yomiplush/chm-exchange`, and requires explicit out-of-band fingerprint confirmation before promoting a received key to **Trusted** (`unconfirmed` vs `confirmed`).
   - Supports offline **Key Revocation & Rotation Notices** (`CHM-NOTICE1\0`, `.chnotice.json` / `chm-notice:`) and **Offline Key-Possession Challenge-Response** (`CHM-CHALLENGE1\0`).

2. **Certificate Creation, Mandatory Working-File Verification, Protocol v3 Self-Contained Compact QR & QR Studio (`/create`)**
   - **Mandatory Multi-Layer Working Files (Anti-Spoofing & Zero-Upload Guarantee):** Requires genuine multi-layer working project files (`.psd`, `.psb`, `.clip`, `.procreate`, `.kra`, `.ora`, `.sai2`, etc.) with at least 2 active non-transparent pixel layers, rejecting raw flat PNG/JPEG/WebP photos or one-click AI-generated images (including flat images wrapped in a `.psd` with an empty transparent layer). All parsing, layer verification, and flattening into Canonical Artwork Raster (`CAR-v1` straight `RGBA8`) run **100% locally in your browser**—your `.psd`/working file is **never uploaded to any server**, and only the locally merged lossless PNG with the embedded QR code is exported. The working file's SHA-256 digest is automatically bound into Protocol `v3` `evidenceHashes` (CBOR key `16`).
   - Supports **Protocol v1** (Outer QR Border), **Protocol v2** (In-Image Masked QR Overlay, `qrMask`), and **Protocol v3** (`CHM3\0`, default when self-contained extended fields or extended license flags are used):
     - Encodes full self-contained artwork descriptions (`<=600 B`), creator website, up to `12` SNS links + `8` portfolio links (with a 15-code longest-prefix canonical URL dictionary), creation method & creation environment, up to `8` local evidence SHA-256 hashes, 12-bit extended policy flags (`allowsDerivatives`, `allowsModifications`, `requiresAttribution`), and `policyNote` **directly inside the deterministic CBOR QR payload** using optional raw DEFLATE (`usedDeflate`)—keeping QR density low and scannable offline without any external server.
     - Displays real-time QR sizing meter (`compact` / `standard` / `large` / `capacity-exceeded`), module dimensions, and compression savings before signing.
   - Supports **multi-profile author switching & SNS presets**, reusable **custom Policy Presets**, and optional standalone `.chmevidence` signed extensions (`CHM-EVIDENCE1\0`) for large metadata or `9..24` evidence files. Raw PSD/KRA/CLIP/WIP files remain strictly local on your device.
   - Protocol v2/v3 masked Studio displays live `qrMask` excluded-area percentage warnings (`>15%` caution, `>30%` high), excluded-mask overlay highlight, and one-click **Optimize QR Size**.
   - Post-render QR readability self-check verifies every generated PNG before export, saves a compact `CHM-VAULT-v1` proof record to `/vault`, and optionally exports a `.chproof.json` portable proof bundle.

3. **Encrypted Proof Vault & Pluggable Storage Providers (`/vault`, `/storage`)**
   - **Three Built-In Pluggable `StorageProvider` Backends (`src/core/storage/providers/`):**
     1. **`IndexedDbStorageProvider` (`certified-handmade-store` v7):** Zero-pixel local browser Vault (`proofVault`, `creatorProfiles`, `policyPresets`, `storageState`, `vaultTombstones`), scaled and indexed for 10,000+ proofs.
     2. **`PortableFileStorageProvider` (`.chmvault.json`):** Plain or passphrase-encrypted (`PBKDF2-SHA256 600,000` + `AES-256-GCM`) portable vault archives for offline OS/origin transfer.
     3. **`GoogleDriveStorageProvider` (Optional Opt-In Personal Google Drive):** Uses **Google Identity Services OAuth 2.0 Token Model** (`https://accounts.google.com/gsi/client`, narrow `https://www.googleapis.com/auth/drive.appdata` scope) to store **strictly client-side AES-256-GCM encrypted** Vault artifacts inside the user's hidden Google Drive `appDataFolder` (`spaces=appDataFolder`, leaving ordinary `My Drive` files untouched and recovering automatically via `appProperties`).
   - **Vault Encryption & Sync Guarantees:**
     - **RAM-only OAuth tokens:** Access tokens never touch `localStorage`, `sessionStorage`, `IndexedDB`, URLs, or logs; GIS script loads only on explicit connect click.
     - **Independent Vault Master Key (`VMK`):** 256-bit random key wrapped via `PBKDF2-SHA256` (`chm-vault-keyring-v1`) and expanded via `HKDF-SHA256` into purpose-isolated subkeys (`manifest`, `proofs`, `profiles`, `policies`, `settings`, `snapshots`) with AAD-bound `AES-256-GCM` envelopes (`chm-vault-aead-v1`). Connecting Google alone **cannot decrypt** the Vault.
     - **Conflict-safe incremental sync:** Content-hash deduplication, immutable proof chunks, offline pending queue with exponential backoff retries, `lastManifestSeq` rollback detection, soft delete tombstones, three-way conflict preservation (`keep-local` / `accept-remote` / `keep-both`, never blind last-write-wins), cross-device `chm-vault-keyshare-v1` rotation, and strict defense-in-depth rejection (`assertNoForbiddenSyncSecrets`) of artwork pixels, RAW/PSD/KRA/CLIP files, Ed25519 private keys, Nostr keys, and OAuth tokens.

4. **Independent Offline Verification (`Mode A / B / C`) & SNS Visual Helper (`/verify`)**
   - Accepts `/verify#proof=...` URL fragments, pasted `v1`/`v2`/`v3` proof tokens, `.chproof.json` proof bundles, clipboard images, PWA Web Share Target handoffs, uploaded signed PNGs, or live local camera QR scanning (`getUserMedia`).
   - Supports **Mode A** (QR / primary proof—now carrying full self-contained details & evidence hashes in Protocol v3), **Mode B** (Primary proof + `.chmevidence`), and **Mode C** (local streaming SHA-256 verification of sketches/WIPs/project files against signed v3 QR hashes or `.chmevidence`).
   - Displays **independent statuses** without conflating them (`Valid`/`Invalid`/`Unsupported`, `Matched`/`Mismatched`/`Not Checked`, `Locally Trusted Key`/`Unknown / Unverified Key`, Local Key Notice Check, and `declared by creator` self-declared fields) plus a strictly non-cryptographic `dHash64` + `DCT pHash64` visual similarity helper.

5. **CHM Secure Device Pairing & Strict Auth-Only Nostr Sync (`/devices`, `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`)**
   - **Offline 2-Step QR Pairing (`CHM-DEVICE-PAIRING-v1`):** Pairs PC, smartphone, and tablet browsers to an existing CHM Identity 100% offline via a 2-step QR handshake with an 8-character out-of-band MitM confirmation code (`CHM-PAIR-CONFIRM1\0`), independent per-device Ed25519 keys, explicit `['device-identity']` privilege boundary, persistent `requestId`/`nonce` replay defense, monotonic signed revocations, and `.chdevreg.{json,cbor}` snapshots.
   - **Strict Auth-Only Nostr Sync (`CHM-SYNC-v1`):** Disabled at rest (`0` background relay traffic). Strictly restricted to device registration, authorization, revocation (`Priority 0`, bypassing budget deferral), identity transport binding, and signed checkpoints over NIP-44 v2 + NIP-59 Gift Wrap (`kind 1059`) with zero-cost NIP-11 relay filtering. Proof vaults, artwork details, author profiles, SNS links, policy presets, settings, and Public Proof Index broadcasts (`NOSTR_PUBLIC_PROOF_PUBLISHING_DISABLED`) are **never** published to Nostr relays.
   - Google Drive connection and Nostr device sync operate **100% independently**.

6. **Gentle Azure Light/Dark Theme, Simple/Advanced Mode & 13-Language Touch-First UI:** Opens in calm **Simple Mode** by default with 3-step certification & verification flows while preserving full technical controls inside **Advanced Mode** without losing unsaved edits.

---

## Independent Offline CLI Verifiers (`tools/`)

To verify artworks, proofs (`v1`, `v2`, `v3`), `.chmevidence` extensions, and key notices independently of the web app (`zero src/ imports`):

```bash
# Node.js CLI (Mode A/B/C verification & key notices)
node tools/chm-verify.mjs signed-artwork.png
node tools/chm-verify.mjs --proof art.chproof.json --artwork original.png --evidence-file sketch.kra --json
node tools/chm-verify.mjs --proof art.chproof.json --artwork original.png --evidence art.chmevidence --evidence-file sketch.kra --json
node tools/chm-verify.mjs --notice notice.chnotice.json

# Go CLI (standard library only)
cd tools/chm-verify
go run . --proof /path/to/art.chproof.json --artwork /path/to/original.png --evidence-file /path/to/sketch.kra --json
go run . --notice /path/to/notice.chnotice.json
```

---

## Important Limitations & Scope

- **Cryptographic Provenance, Not Copy-Protection DRM:** Certified Handmade creates tamper-evident signatures and machine-readable rights declarations; it does **not** encrypt artwork pixels, block screenshots, or technically enforce `aiTraining: disallow`.
- **Signature ≠ Proof of Hand-Drawing or Legal Copyright:** A valid Ed25519 signature (or evidence hash match / offline key-possession challenge) proves only that the holder of that private key signed the data and (when checked) that pixels or local evidence files match their signed SHA-256 hashes. It cannot prove by math alone that no AI tools were used, verify external social account ownership, or prove legal copyright ownership.
- **Self-Declared Timestamps & Decentralized Notices:** Without a central server or TSA, `issuedAt`, `noticeIssuedAt`, and `.chmevidence` `createdAt` are self-declared, and offline verifiers only see `.chnotice.json` notices imported locally.
- **Google Account ≠ CHM Identity & Zero Remote Wipe:** Connecting Google Drive only authorizes storage on the user's Drive (`drive.appdata` (`appDataFolder`)). It does not authenticate CHM authorship or unlock Vault data without the passphrase. Revoking a device rotates future Vault epochs (`rotationReason: 'device-revoked'`) cleanly, but cannot remotely erase data or keys already copied before revocation.
- **Public Relay Availability & Retention:** Free community Nostr relays have zero uptime SLA or permanent retention guarantee. Encrypted NIP-59 envelopes only carry device authentication/revocation state; local IndexedDB, `.chkey.json`, `.chmvault.json`, and your Personal Google Drive Vault hold your backups.
- **Browser Storage Volatility:** IndexedDB stores (`certified-handmade-store` v7) can be cleared by browser eviction. Always export and verify encrypted `.chkey.json` and `.chmvault.json` backups (or sync to Personal Google Drive).

---

## Local Development & Standalone Builds

### Prerequisites

- **Web / Tests:** Node.js 20+ (tested on Node 24/26), npm 10+
- **Standalone Launcher & Go CLI:** Go 1.22+ (zero third-party Go modules — standard library only)

### Environment Variables (`.env.example`)

Copy `.env.example` if overriding the public Google OAuth Client ID for self-hosted builds (never place any OAuth Client Secret in frontend environment variables):

```env
VITE_GOOGLE_CLIENT_ID=948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com
```

### Commands

```bash
# Install Node dependencies
npm install

# Start development server
npm run dev

# Typecheck & Lint
npm run typecheck
npm run lint

# Run unit & integration tests (Vitest — local MockNostrRelay & mocked Google Drive, zero external network calls)
npm test

# Run Go independent CLI & Standalone server tests
cd tools/chm-verify && go test -v ./...
cd standalone && go test -v ./...

# Production web build (static files + PWA Service Worker in dist/)
npm run build

# Build portable Standalone binaries & reproducible archives in release/
npm run build:standalone

# Run web Playwright E2E tests (Desktop + Mobile Chromium, 100% mocked local routes)
npm run test:e2e

# Run offline Standalone Linux binary Playwright E2E tests (http://127.0.0.1:43777)
npm run test:standalone
```

---

## Cloudflare Pages & GitHub Releases Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:
- Free Cloudflare Pages deployment (`dist/`), `VITE_GOOGLE_CLIENT_ID` build config, Google Cloud Console Origin (`https://certified-handmade.com`), and strict CSP/COOP headers
- Local & zero-cost GitHub Releases packaging for Linux x86_64 and Windows x86_64 with `SHA256SUMS.txt`

---

## Documentation Index

### Core Protocol, Security & Deployment Specifications
- [`SPEC.md`](./SPEC.md) — Canonical manifest schema (Protocol `v1`, `v2`, & `v3` `CHM3\0`), `CHM-EVIDENCE1`, `CHM-NOTICE1`, `CHM-CHALLENGE1`, `CHM-DEVICE-PAIRING-v1`, strict auth-only `CHM-SYNC-v1`, `CHM-VAULT-v1` encrypted Drive envelopes, and normative test vectors.
- [`SECURITY.md`](./SECURITY.md) — Threat model, Google OAuth 2.0 GIS Token Model & RAM-only token boundaries, Encrypted Vault AES-256-GCM/HKDF-SHA256 design, strict Nostr auth-only isolation, Protocol v3 anti-bomb/dictionary sanitization, CSP/COOP hardening, and honest disclosures.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages setup (`VITE_GOOGLE_CLIENT_ID`, `https://certified-handmade.com`), portable standalone build/release workflow, and self-hosting guide.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) — Open-source dependencies and licenses.

### Architecture, Storage Providers, Protocol v3 & Sync Guides (`docs/`)
- [`docs/GOOGLE-DRIVE-SETUP.md`](./docs/GOOGLE-DRIVE-SETUP.md) — Google OAuth 2.0 GIS setup, `drive.appdata` (`appDataFolder`) personal folder structure (`appProperties`, recovery), multi-device passphrase/key-share unlock, account switching, and disconnect vs. revoke guide.
- [`docs/STORAGE-PROVIDERS.md`](./docs/STORAGE-PROVIDERS.md) — Pluggable `StorageProvider` architecture (`IndexedDbStorageProvider`, `PortableFileStorageProvider`, `GoogleDriveStorageProvider`), Vault encryption epochs, 3-way conflict resolution, tombstones, and extension points (IPFS/WebDAV/P2P).
- [`docs/CHM-COMPACT-PROOF-V3.md`](./docs/CHM-COMPACT-PROOF-V3.md) — Protocol `v3` (`CHM3\0`) self-contained compact QR specification, CBOR keys `1..17`, 12-bit policy flags, 15-code URL dictionary, raw DEFLATE framing & measured QR size benchmarks.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Clean layered architecture across CHM Crypto Core, Device Identity, Pluggable Storage & Auth-Only Sync, and UI.
- [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md) — Detailed threat analysis across local keys, device pairing, Nostr auth sync, Vault, and browser origins.
- [`docs/CHM-SYNC-PROTOCOL.md`](./docs/CHM-SYNC-PROTOCOL.md) — Normative `CHM-SYNC-v1` wire spec, adopted NIPs (`bec0fc8`), priority queue, and NIP-59 rumor framing.
- [`docs/KEY-MANAGEMENT.md`](./docs/KEY-MANAGEMENT.md) — Strict separation and custody rules for CHM Ed25519 keys vs. Nostr secp256k1 keys (`.chkey.json` & NIP-49 `ncryptsec1`).
- [`docs/PRIVACY.md`](./docs/PRIVACY.md) — Zero-tracking policy, metadata minimization, NIP-59 sender privacy, and pixel non-upload guarantees.
- [`docs/RECOVERY.md`](./docs/RECOVERY.md) — Encrypted backup, device loss revocation, and cross-origin migration recovery procedures.
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — IndexedDB schema migrations (`certified-handmade-store` up to `v7`) and non-breaking upgrade safety.
- [`docs/ZERO-COST-ARCHITECTURE.md`](./docs/ZERO-COST-ARCHITECTURE.md) — Architectural guarantees eliminating all user fees and paid backend dependencies.
- [`docs/COST-MODEL.md`](./docs/COST-MODEL.md) — Maintainer & user cost breakdown from 100 to 1,000,000+ users (domain-only cost model).
- [`docs/RELAY-POLICY.md`](./docs/RELAY-POLICY.md) — Zero-cost NIP-11 relay filtering, runtime `payment-required` auto-pause, and NIP-65 relay lists.
- [`docs/STORAGE-BUDGET.md`](./docs/STORAGE-BUDGET.md) — Compact `CHM-VAULT-v1` record schema and 1 MiB / 30-day rolling sync budget.
- [`docs/OFFLINE-MODE.md`](./docs/OFFLINE-MODE.md) — Offline-first PWA, Portable Standalone Edition, and graceful offline fallbacks.
- [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) — Client-side scaling to 10,000+ local proofs and relay traffic politeness.
- [`docs/DATA-PORTABILITY.md`](./docs/DATA-PORTABILITY.md) — Open standard export/import formats (`.chkey.json`, `.chproof.json`, `.chmevidence`, `.chdevreg`, `.chmvault.json`).
