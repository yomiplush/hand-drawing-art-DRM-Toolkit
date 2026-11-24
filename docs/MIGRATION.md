# Compatibility & Migration Guide (`MIGRATION.md`)

---

## 1. Non-Breaking Guarantees for Existing Certified Handmade Users

Upgrading to **Decentralized Device Sync (`CHM-SYNC-v1`)** and **Proof Vault (`CHM-VAULT-v1`)** preserves 100% backward compatibility with all existing artifacts:

- **Existing Signed Artworks (`Protocol v1` & `v2`):** Byte-for-byte identical verification across the Web/PWA UI, Portable Standalone Edition, Node CLI (`tools/chm-verify.mjs`), and Go CLI (`tools/chm-verify`). Embedded QR codes retain `0` extra bytes.
- **`.chproof.json` & `.chmevidence`:** Portable proof bundles and Mode A/B/C evidence extensions work unchanged and can be imported directly into `/vault`.
- **`.chkey.json` & `.chnotice.json`:** Existing Author keys, Trusted Keys (`trustedKeys`), and Key Notices (`keyNotices`) in `IndexedDB` (`chm-drm-keystore`) remain intact across schema upgrades.

---

## 2. IndexedDB Schema Evolution (`src/core/storage/keyStore.ts`)

Upgrading `chm-drm-keystore` creates additional object stores cleanly inside `onupgradeneeded` without mutating or deleting existing stores:
- Existing stores preserved: `authorKeys`, `trustedKeys`, `keyNotices`, `creatorProfiles`, `deviceIdentity`, `pairedDevices`, `pairingSessions`, `usedPairingNonces`, `deviceRevocations`.
- Added/used for sync & vault:
  - `nostrKeys` (`webcrypto-aesgcm-wrapped` / `nip49-encrypted` `secp256k1` keys, non-extractable wrapping `CryptoKey`)
  - `syncSettings`, `syncPeerBindings`, `syncOpLog`, `syncOutbox`
  - `proofVault` (`CHM-VAULT-v1` compact verified proof index)

---

## 3. Migrating Across Origins (Web/PWA <-> Portable Standalone / New Browser)

1. Export `.chkey.json` from **`/keys`**.
2. Export `.chmvault.json` or `.chmvault.enc.json` from **`/vault`** (Note: `CHM-VAULT-v1` backups **never** export private keys, so keep `.chkey.json` backed up separately).
3. If migrating paired devices, export `.chdevreg.json` from **`/devices`**.
4. Import on the target origin (`https://certified-handmade.com` or `http://127.0.0.1:43777`).
5. **Opting Into Nostr Sync:** Existing paired devices do not enable Nostr sync automatically. To sync incrementally over relays, explicitly opt-in on **`/devices`** -> **Decentralized Sync**, probe/choose free relays, and exchange `chm-sync-bind:` peer cards (or re-scan `#pair-cert=` containing `&sync-bind=`).
