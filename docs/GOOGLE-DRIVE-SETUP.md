# Google Drive Encrypted Vault Setup & Architecture (`GOOGLE-DRIVE-SETUP.md`)

**Scope:** Optional Personal Google Drive `appDataFolder` storage via Google Identity Services (GIS) OAuth 2.0 Token Model  
**Status:** Implemented (`src/core/google/*`, `src/core/vault/driveSyncEngine.ts`, `/storage`)

---

## 1. Design Goals & Non-Negotiable Constraints

Google Drive integration in Certified Handmade is strictly an **optional, client-encrypted personal storage extension**:

- **Zero Maintainer Backend or Aggregation:** Files live exclusively inside the **user's own hidden Google Drive `appDataFolder`**. The maintainer never receives, proxies, or stores user data.
- **Zero Broad Drive Access:** Requests only the minimal `https://www.googleapis.com/auth/drive.appdata` scope (`spaces=appDataFolder`), never `drive` or `drive.file` access to the user's ordinary My Drive folders.
- **Google Account ≠ CHM Identity:** Authorizing Google Drive never replaces Ed25519 signing keys, never mints provenance proofs, and never enables signing on a new device by itself.
- **Google Login Cannot Decrypt the Vault:** Connecting Google alone only provides OAuth transport access to opaque ciphertext. Unlocking requires the user's independent **Vault passphrase** (or an encrypted cross-device key-share from an already-unlocked trusted device).
- **100% Optional:** Signing, verifying, key management, device pairing, and local Vault operations work identically offline or with Google Drive disconnected across Windows, macOS, Linux, iPadOS, iOS, and Android.

---

## 2. OAuth 2.0 Configuration (GIS Token Model)

Certified Handmade uses Google Identity Services (`https://accounts.google.com/gsi/client`) in **Token Model** mode with Google Drive API v3:

- **Public Client ID (`.env.example` & `src/core/google/config.ts`):**
  ```env
  VITE_GOOGLE_CLIENT_ID=948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com
  ```
- **Production Origin:** `https://certified-handmade.com`
- **Requested Scope:** `https://www.googleapis.com/auth/drive.appdata` (hidden app-private Drive storage only — full Drive scope is forbidden; `Google Cloud Console → OAuth Consent Screen` should list `https://www.googleapis.com/auth/drive.appdata`)
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
| **Popup & Consent Edge Cases** | Handles `access_denied`, `popup_closed`, `popup_failed_to_open`, missing `drive.appdata` scope grant (`hasGrantedAllScopes`), and offline script load failure with calm, artist-friendly guidance (`FriendlyErrorAlert`). |
| **Account Identification & Switch Isolation** | Calls `GET /drive/v3/about?fields=user(displayName,emailAddress,permissionId)` immediately after authorization. Switching accounts clears previous RAM tokens, zeroizes in-memory unlocked `VMK`s (`zeroizeUnlockedVaultKeyring`), and switches to a separate `IndexedDB` state keyed by `SHA-256("chm-google-acct:" + accountKey)`—preventing cached file ID, queue, or conflict leakage across accounts. |
| **Disconnect vs. Revoke** | **Disconnect Session** clears the RAM token & account session locally without touching Google permissions or local IndexedDB proofs/profiles/keys. **Revoke OAuth Access** additionally calls `google.accounts.oauth2.revoke(token)`. |

---

## 4. Hidden `appDataFolder` Layout & Privacy Protection

`GoogleDriveClient` stores encrypted artifacts directly inside the user's Google Drive `appDataFolder` (`spaces=appDataFolder`, parent `['appDataFolder']`), keeping normal `My Drive` folders uncluttered and unreachable:

```text
appDataFolder/
├── keyring.chmk                  (appProperties: chmRole=keyring, chmVaultId, chmEpoch)
├── manifest.chme                 (appProperties: chmRole=manifest, chmVaultId, chmSeq, chmEpoch)
├── chunk-<hash>-<epoch>.chmv     (appProperties: chmRole=proofs-chunk, chmVaultId, chmHash)
├── identities.chmv               (appProperties: chmRole=identities, chmVaultId, chmHash)
├── devices.chmv                  (appProperties: chmRole=devices, chmVaultId, chmHash)
├── profiles.chmv                 (appProperties: chmRole=profiles, chmVaultId, chmHash)
├── policies.chmv                 (appProperties: chmRole=policies, chmVaultId, chmHash)
├── settings.chmv                 (appProperties: chmRole=settings, chmVaultId, chmHash)
└── recovery.chmv                 (opt-in only — encrypted key recovery envelopes, double-encrypted)
```

### Key Privacy & Reliability Properties

- **Opaque Filenames:** Filenames (`keyring.chmk`, `manifest.chme`, `chunk-<hash>-<epoch>.chmv`, etc.) never leak artwork titles, author names, URLs, or filenames.
- **Discovery & Recovery via `appProperties`:** Queries filter by `appProperties has { key='chmApp' and value='certified-handmade' }` in `spaces=appDataFolder` (`DRIVE_APPDATA_SPACE`).
- **Synchronized (Encrypted Client-Side):** Author public identities & trusted keys (`identities.chmv`), signed device enrollment certificates & monotonic revocations (`devices.chmv`), signed proof records (`proofBase64Url` + metadata snapshot), author profiles/SNS links, policy presets, vault user settings, deletion tombstones, and **explicit opt-in** encrypted key recovery envelopes (`recovery.chmv`, each entry separately passphrase-wrapped with `PBKDF2-SHA256 600,000 + AES-256-GCM` before Vault AEAD wrapping).
- **Never Uploaded Automatically (`assertNoForbiddenSyncSecrets`):** Artwork image files/pixels/rasters, PSD/KRA/CLIP/WIP project files, raw unencrypted private keys, Nostr `nsec`/`ncryptsec1` secrets, and OAuth access tokens.

---

## 5. Multi-Device Flow & Cloudflare Pages Checklist

1. **Device 1:** Open `/storage` → **Connect Google Account** → approve `drive.appdata` → set a strong **Vault Passphrase** (`12+` chars recommended; `PBKDF2-SHA256 600,000` wraps a fresh 256-bit `VMK`) → **Sync Now** (optionally include an encrypted recovery backup if moving keys without QR pairing).
2. **Device 2:** Open `/storage` → **Connect Google Account** (same Google account) → unlock existing Vault by entering the **Vault Passphrase** (or importing a `chm-vault-keyshare-v1` encrypted share from Device 1) → **Sync Now**. New devices approve signing independently via QR Device Pairing (`/devices`) or explicit encrypted backup restoration (`/keys` / `/storage`).
3. **Cloudflare Pages Production Checklist:**
   - Verify `VITE_GOOGLE_CLIENT_ID` matches Google Cloud Console Web Client ID (`948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com`).
   - Verify Google Cloud Console **OAuth Consent Screen → Data Access / Scopes** includes `https://www.googleapis.com/auth/drive.appdata`.
   - Verify Authorized JavaScript Origin includes `https://certified-handmade.com`.
   - Verify `public/_headers` preserves `Cross-Origin-Opener-Policy: same-origin-allow-popups` and CSP allows only `https://accounts.google.com/gsi/client` + `https://accounts.google.com/gsi/` frames.
   - Verify `.env.example` and production JS bundles contain zero client secrets.
