# Google Drive Encrypted Vault Setup & Architecture (`GOOGLE-DRIVE-SETUP.md`)

**Scope:** Optional Personal Google Drive storage via Google Identity Services (GIS) OAuth 2.0 Token Model  
**Status:** Implemented (`src/core/google/*`, `src/core/vault/driveSyncEngine.ts`, `/storage`)

---

## 1. Design Goals & Non-Negotiable Constraints

Google Drive integration in Certified Handmade is strictly an **optional, client-encrypted personal storage extension**:

- **Zero Maintainer Backend or Aggregation:** Files live exclusively inside the **user's own Google Drive** (`My Drive`). The maintainer never receives, proxies, or stores user data.
- **Google Account ≠ CHM Identity:** Authorizing Google Drive never replaces Ed25519 signing keys, never mints provenance proofs, and never certifies authorship.
- **Google Login Cannot Decrypt the Vault:** Connecting Google alone only provides OAuth transport access to opaque ciphertext. Unlocking requires the user's independent **Vault passphrase** (or an encrypted cross-device key-share from an already-unlocked trusted device).
- **100% Optional:** Signing, verifying, key management, device pairing, and local Vault operations work identically offline or with Google Drive disconnected.

---

## 2. OAuth 2.0 Configuration (GIS Token Model)

Certified Handmade uses Google Identity Services (`https://accounts.google.com/gsi/client`) in **Token Model** mode with Google Drive API v3:

- **Public Client ID (`.env.example` & `src/core/google/config.ts`):**
  ```env
  VITE_GOOGLE_CLIENT_ID=948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com
  ```
- **Production Origin:** `https://certified-handmade.com`
- **Requested Scope:** `https://www.googleapis.com/auth/drive.file` (narrow per-file/app-created access only — full Drive scope is forbidden)
- **Prohibited Auth Patterns:**
  - Zero OAuth `client_secret` in client code or frontend environment variables
  - Zero Google Service Accounts, Firebase Authentication, or Cloudflare Workers OAuth servers

### CSP & Popup Headers (`public/_headers` & `index.html`)

- `script-src 'self' https://accounts.google.com/gsi/client` (GIS `<script>` is injected dynamically **only** when the user explicitly clicks **Connect Google Account**)
- `style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style`
- `frame-src https://accounts.google.com/gsi/`
- `connect-src 'self' wss: https:`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` (preserves GIS OAuth popup communication without weakening `object-src 'none'` or permitting `unsafe-eval`)

> **Standalone Edition Note (`http://127.0.0.1:43777`):** `checkGoogleDriveEnvironmentSupport()` detects loopback Standalone origins (`standalone-loopback`) and intentionally disables Google OAuth. Standalone users exchange data offline using `.chmvault.json` encrypted files.

---

## 3. OAuth Session Lifecycle & Security (`src/core/google/gisAuth.ts`)

| Requirement | Implementation (`InMemoryGoogleAuthManager`) |
| --- | --- |
| **RAM-only Access Token** | `accessToken`, `tokenExpiresAtMs`, and `grantedScopes` exist solely as private class fields in RAM. Tokens are **never** written to `localStorage`, `sessionStorage`, IndexedDB, URLs, or logs (`toJSON()` excludes them; full page reload clears the token). |
| **Expiry & Re-Authorization** | `hasValidAccessToken()` enforces a `30_000 ms` safety buffer before expiry and prompts explicit user reconnection on expiry or HTTP `401`. No silent background token polling is assumed. |
| **Popup & Consent Edge Cases** | Handles `access_denied`, `popup_closed`, `popup_failed_to_open`, missing `drive.file` scope grant (`hasGrantedAllScopes`), and offline script load failure with clear user errors. |
| **Account Identification & Switch Isolation** | Calls `GET /drive/v3/about?fields=user(displayName,emailAddress,permissionId)` immediately after authorization. Switching accounts clears previous RAM tokens, zeroizes in-memory unlocked `VMK`s (`zeroizeUnlockedVaultKeyring`), and switches to a separate `IndexedDB` state keyed by `SHA-256("chm-google-acct:" + accountKey)`—preventing cached file ID, queue, or conflict leakage across accounts. |
| **Disconnect vs. Revoke** | **Disconnect Session** clears the RAM token & account session locally without touching Google permissions or local IndexedDB proofs/profiles/keys. **Revoke OAuth Access** additionally calls `google.accounts.oauth2.revoke(token)`. |

---

## 4. Personal Google Drive Folder Layout & Metadata Protection

`GoogleDriveClient.ensureVaultRootFolder` creates or recovers a single clean root folder inside the user's `My Drive` visible in the standard Google Drive UI:

```text
My Drive/
└── Certified Handmade/          (appProperties: chmApp=certified-handmade, chmRole=root, chmSchema=1)
    ├── keyring.chmk             (appProperties: chmRole=keyring, chmVaultId, chmEpoch)
    ├── manifest.chme            (appProperties: chmRole=manifest, chmVaultId, chmSeq, chmEpoch)
    ├── chunk-<hash>-<epoch>.chmv (appProperties: chmRole=proofs-chunk, chmVaultId, chmHash)
    ├── profiles.chmv            (appProperties: chmRole=profiles, chmVaultId, chmHash)
    ├── policies.chmv            (appProperties: chmRole=policies, chmVaultId, chmHash)
    └── settings.chmv            (appProperties: chmRole=settings, chmVaultId, chmHash)
```

### Key Privacy & Reliability Properties

- **Opaque Filenames:** Filenames (`keyring.chmk`, `manifest.chme`, `chunk-<hash>-<epoch>.chmv`, etc.) never leak artwork titles, author names, URLs, or filenames to Drive search indexes.
- **Discovery & Recovery via `appProperties`:** If the user renames, moves, or deletes/restores `Certified Handmade`, `ensureVaultRootFolder` falls back from `knownFolderId` to querying `appProperties has { key='chmApp' and value='certified-handmade' } and appProperties has { key='chmRole' and value='root' }`, or cleanly recreates the folder and clears stale cached file IDs to re-upload safely.
- **Synchronized (Encrypted Client-Side):** Signed proof records (`proofBase64Url` + metadata snapshot), author profiles/SNS links, policy presets, vault user settings, deletion tombstones.
- **Strictly Forbidden (`assertNoForbiddenSyncSecrets`):** Artwork pixels/rasters, PSD/KRA/CLIP/WIP project files, unencrypted PII, Ed25519 private keys, Nostr `nsec`/`ncryptsec1` secrets, and OAuth access tokens.

---

## 5. Multi-Device Flow & Cloudflare Pages Checklist

1. **Device 1:** Open `/storage` → **Connect Google Account** → approve `drive.file` → set strong **Vault Passphrase** (`12+` chars recommended; `PBKDF2-SHA256 600,000` wraps a fresh 256-bit `VMK`) → **Sync Now**.
2. **Device 2:** Open `/storage` → **Connect Google Account** (same Google account) → unlock existing `Certified Handmade` Vault by entering the **Vault Passphrase** (or importing a `chm-vault-keyshare-v1` encrypted share from Device 1) → **Sync Now**.
3. **Cloudflare Pages Production Checklist:**
   - Verify `VITE_GOOGLE_CLIENT_ID` matches Google Cloud Console Web Client ID (`948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com`).
   - Verify Authorized JavaScript Origin includes `https://certified-handmade.com`.
   - Verify `public/_headers` preserves `Cross-Origin-Opener-Policy: same-origin-allow-popups` and CSP allows only `https://accounts.google.com/gsi/client` + `https://accounts.google.com/gsi/` frames.
   - Verify `.env.example` and production JS bundles contain zero client secrets.
