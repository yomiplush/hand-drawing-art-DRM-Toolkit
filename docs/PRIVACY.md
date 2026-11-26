# Privacy & Data Minimization (`PRIVACY.md`)

---

## 1. Zero-Telemetry, Zero-Upload Guarantee

1. **No Artwork Uploads:** Source illustrations, WIP sketches, `.psd`/`.kra`/`.clip` project files, timelapses, thumbnails, and raw pixels **never** leave the user's device—not to `certified-handmade.com`, not to Cloudflare, and not to any Nostr relay.
2. **Zero Behavioral Tracking:** No cookies for analytics, no Google Analytics, no telemetry endpoints, no error-reporting SaaS, and no third-party font/CDN runtime dependencies. (The consent banner in-app records only local functional storage opt-in.)
3. **Zero Network Connections at Rest:** Before explicit user consent to enable Decentralized Sync in `/devices`, **zero external HTTP, fetch, or WebSocket requests** are opened on any route (`/`, `/create`, `/verify`, `/keys`, `/exchange`, `/devices`, `/vault`, `/docs`). Verified continuously in Playwright E2E tests (`expect(externalRequests).toEqual([])`).

---

## 2. Sync & Vault Metadata Minimization

| Data Location | What Is Stored / Sent | What Is Explicitly Excluded |
| --- | --- | --- |
| **Local `CHM-VAULT-v1` (`proofVault` store)** | Compact primary `CHM1` CBOR proof (`~300–500 B`), `artworkId`, `authorFingerprint`, title/author/license strings, `imageSha256Hex`, opt-in flags (`~1 KiB` total/record). | Artwork pixels, thumbnails, local filesystem paths, WIP binaries, private keys. |
| **Local GalleryDeck & Encrypted Vaults (`certified-handmade-gallerydeck`, `certified-handmade-encrypted-vaults`)** | Local artwork catalog, local image blobs, and zero-knowledge `.gdvault` encrypted archives stored strictly in browser IndexedDB (or user-selected local folder via File System Access API). | Unsolicited cloud uploads, telemetry, plaintext passphrases. |
| **Private Device Sync (`kind 1059` NIP-59)** | NIP-44 ciphertext inside ephemeral single-use Gift Wrap (`p`-tag = recipient `nostrPubkeyHex`, `created_at` randomized up to `+/- 48h`), containing CBOR device ops and user-selected Vault proofs only. | Artwork pixels, unselected Vault items, private keys, plaintext social profile scraping. |
| **Opt-In Public Proof Index (`kind 30078`) & Artwork Likes (`kind 7`)** | Published **only** on explicit per-action user trigger. Public Proof Index contains `CHM-PUBLIC-PROOF-v1` JSON + tags. Daily like rate-limiting computes a client-side daily salted SHA-256 hash using Cloudflare's same-origin `/cdn-cgi/trace` IP (raw IP is never stored or published). | Raw IP addresses, private keys, device lists, device IDs, WIP hashes, artwork images. |
| **Optional Google Drive (`drive.appdata`) & Discord Webhook** | Client-side AES-256-GCM encrypted vault files inside hidden `appDataFolder` with RAM-only OAuth tokens; or user-configured Discord Webhook certificate summary embeds. | Original artworks, unencrypted private keys, visible Drive files, third-party analytics. |

---

## 3. Content Security Policy & Browser Privacy

- **Strict CSP (`public/_headers`, `index.html`, `standalone/server.go`):**
  - Blocks inline scripts (`script-src 'self'`), objects (`object-src 'none'`), and framing (`frame-ancestors 'none'`).
  - `connect-src 'self'` on Web Edition (or `wss://` strictly when user enables Decentralized Sync) guarantees pages cannot silently phone home.
- **Fragment-Only Proofs (`#proof=...`):** Embedded verification URLs store payloads after `#`, preventing HTTP servers or proxies from receiving proof bytes during URL sharing.
- **No Unsolicited Webhooks / Link Previews:** `/verify` and `/vault` display creator profile links as sanitized plain text/`rel="noopener noreferrer"` links (`http:`/`https:` only, rejecting `javascript:`, `data:`, credentials, and Unicode bidi overrides) and never prefetch linked URLs.
- **Test Isolation Hygiene:** Automated unit, integration, and Playwright E2E tests exclusively target an in-process loopback `MockNostrRelay` (`ws://127.0.0.1` / `wss://127.0.0.1`) and **never** touch public relays.
