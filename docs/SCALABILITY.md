# Scalability & Performance Characteristics (`SCALABILITY.md`)

---

## 1. Per-Artist Local Scale (1,000 – 10,000+ Signed Artworks)

Certified Handmade's `CHM-VAULT-v1` IndexedDB store (`src/core/vault/vaultStore.ts`) is engineered for heavy pro-illustrator catalogs without cloud databases:

- **Single-Transaction Batch Writes (`saveVaultProofBatch`):** Inserts 10,000 compact `VaultProofRecord` records inside a single IndexedDB `readwrite` transaction (~10–12 MiB total storage). Verified in automated tests (`tests/unit/vaultScaleAndBackup.test.ts`).
- **Indexed Secondary Keys:** `proofVault` defines IndexedDB indexes on `issuedAt`, `authorFingerprintHex`, `artworkIdHex`, `licenseId`, and `syncSelected`.
- **Bounded Queries & Pagination:** `queryVaultProofs({ query, authorFingerprintHex, syncSelectedOnly, limit, offset })` streams cursors/pages (`limit` default `24` in `/vault`) so rendering thousands of artworks stays responsive on mobile and desktop browsers.
- **Streaming File Hashing (`Mode C`):** Evidence WIP/PSD/KRA/timelapse hashing streams files in 2 MiB chunks up to `512 MiB` so memory stays flat.
- **Anti-Bomb PNG Preflight:** `IHDR` validation checks dimensions (`<= 8192 px` input, `<= 32 MP`) before `IDAT` inflation.

---

## 2. Ecosystem-Wide Decentralization (1M+ Users)

- **Zero Shared Database:** Every user's device is their own database of record (`IndexedDB`). Increasing total users from `100` to `1,000,000` creates **zero database lock contention** or query scaling cost for the maintainer.
- **Zero Server Compute:** Signing, PNG/QR rendering, perceptual hashing (`dHash64` / `pHash64`), verification, and backup encryption all scale horizontally across user CPUs.
- **Chunked & Capped Network Sync:** Even when multi-device sync is enabled, `syncSelectedVaultProofs` batches at most `MAX_VAULT_PROOFS_PER_BUNDLE = 16` proofs per NIP-59 envelope and obeys the 30-day `1 MiB` soft sync budget so public relays are never flooded.
- **Federation Without Lock-In:** Users distribute across independent public relays or run their own lightweight personal Nostr relays (`strfry`, `nostr-rs-relay`, `khatru`), or use offline `.chmvault.json` USB/cloud-drive sync directly.
