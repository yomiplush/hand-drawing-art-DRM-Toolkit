# Pluggable Storage Providers & Encrypted Vault Synchronization (`STORAGE-PROVIDERS.md`)

**Scope:** Storage abstraction (`StorageProvider`), Vault AEAD cryptography (`vaultCrypto.ts`), and bidirectional incremental Drive `appDataFolder` sync (`driveSyncEngine.ts`)  
**Status:** Implemented (`src/core/storage/providers/*`, `src/core/vault/*`)

---

## 1. Pluggable Storage Architecture

Certified Handmade decouples its Ed25519 signing/verification core and `CHM-DEVICE-PAIRING-v1` / `CHM-SYNC-v1` authentication layer from persistence backends behind a clean `StorageProvider` contract (`src/core/storage/providers/types.ts`):

```text
CHM Core
├── Cryptographic Proof Engine (Ed25519, CAR-v1, CBOR v1/v2/v3, .chmevidence)
├── Identity & Device Auth (CHM-DEVICE-PAIRING-v1 + Auth-Only Nostr CHM-SYNC-v1)
├── StorageProviderRegistry (src/core/storage/providers/providerRegistry.ts)
│   ├── IndexedDbStorageProvider      (Local browser IndexedDB v7 — always active)
│   ├── PortableFileStorageProvider   (Offline encrypted/plain .chmvault.json files)
│   ├── GoogleDriveStorageProvider    (Opt-in personal Google Drive appDataFolder Encrypted Vault)
│   └── [Future Providers]            (IPFS / Helia, WebDAV, Peer-to-Peer WebRTC)
└── Human-Friendly UI (/vault, /storage, /create, /verify — Simple & Advanced Modes)
```

### Built-In Providers (`defaultStorageRegistry`)

| Provider ID | Class | Kind | Capabilities | Persistence Medium |
| --- | --- | --- | --- | --- |
| `indexeddb` | `IndexedDbStorageProvider` | `local` | Offline, Passphrase Archive | Browser IndexedDB `certified-handmade-store` (`v7`) |
| `portable-file` | `PortableFileStorageProvider` | `file` | Offline, Passphrase Archive | User filesystem `.chmvault.json` |
| `google-drive` | `GoogleDriveStorageProvider` | `cloud` | Incremental Sync, Passphrase Encryption, Account Switch | User's hidden Google Drive `appDataFolder` (`drive.appdata` scope) |

> Future decentralized backends (IPFS/Helia pinning, personal WebDAV servers, or P2P sync) implement the same `StorageProvider` interface (`getStatus`, `exportSnapshot`, `importSnapshot`, `exportEncryptedSnapshot`, `importEncryptedSnapshot`, optional `sync`, `disconnect`) without modifying Core Cryptography or Identity code. Note that free public IPFS without dedicated pinning does not guarantee permanent availability, so local IndexedDB and `.chmvault.json` always remain primary truth.

---

## 2. Encrypted Vault Cryptography (`src/core/vault/vaultCrypto.ts`)

Every remote Vault record is encrypted strictly client-side via Web Crypto API before touching Drive or encrypted file exports:

### Key Hierarchy & Separation

1. **Independent 256-Bit Vault Master Key (`VMK`):** Generated via `crypto.getRandomValues(32)` (`generateVaultMasterKey`). Never derived from Ed25519 signing keys or Nostr `secp256k1` keys; `assertVaultPassphraseValid` explicitly blocks passing `nsec1...` or `chm-key-backup...` strings as a Vault passphrase.
2. **Passphrase-Wrapped Keyring (`chm-vault-keyring-v1`):**
   - KDF: `PBKDF2-SHA256`, default `600,000` iterations (strictly bounded `100,000..5,000,000`), fresh 16-byte random salt.
   - Cipher: `AES-256-GCM` with fresh 12-byte random IV and AAD:
     `CHM-VAULT-KEYRING-v1|vault=<vaultId>|epoch=<currentEpoch>`.
3. **HKDF-SHA256 Per-Purpose Subkey Derivation (`derivePurposeSubkey`):**
   - Salt: `SHA-256("chm-hkdf-salt:" + vaultId)`
   - Info: `"chm-vault-v1:" + purpose + ":epoch=" + epoch`
   - Cryptographically isolates categories so ciphertext analysis in one collection cannot cross into another (`manifest`, `proofs`, `profiles`, `policies`, `settings`, `snapshots`, plus authenticated identity/device/recovery collections).
4. **Per-Record AEAD Envelope (`chm-vault-aead-v1`):**
   - Fresh 12-byte CSPRNG IV for every encryption call (nonce reuse forbidden).
   - `contentHash`: lowercase hex `SHA-256` of canonical JSON plaintext.
   - AAD: `CHM-VAULT-REC-v1|v=<vaultId>|p=<purpose>|e=<epoch>|id=<recordId>|h=<contentHash>` (binding ciphertext integrity to vault ID, purpose, epoch, record ID, and content hash).

### Key Epochs, Rotation & Cross-Device Key Sharing

- **Cross-Device Share (`chm-vault-keyshare-v1`):** Exports unlocked epoch `VMK`s encrypted with a short-lived transfer passphrase (`CHM-VAULT-SHARE-v1|vault=<vaultId>|epoch=<currentEpoch>`) for onboarding another trusted device.
- **Epoch Rotation (`rotateVaultKeyringEpoch`):** Advances `currentEpoch = prev + 1` with a fresh 256-bit `VMK` (`rotationReason`: `'device-revoked' | 'manual-rotation'`), retains prior epochs strictly for decrypting historical immutable chunks while encrypting new/rewritten manifests and mutable files under the new epoch.
- **Honest Security Disclosure:** Rotating Vault keys after device revocation prevents the revoked device from decrypting **future** epoch writes; it does **not** magically remote-wipe proofs or keys already synced to that device prior to revocation.

---

## 3. Synchronization Mechanics (`src/core/vault/driveSyncEngine.ts`)

1. **Signed Proofs as Immutable Chunks (`proofs-chunk`):**
   - IndexedDB `proofVault` keys every signed proof by `id = SHA-256(proofBytes)`. Different proof payloads never overwrite an existing `id`.
   - Proofs upload in content-addressed immutable batches (`PROOF_CHUNK_SIZE = 100`, filename `chunk-<batchHash>-<epoch>.chmv`). Already-known chunk hashes skip re-upload (`skippedDuplicateCount`), and downloaded remote proofs re-run full Ed25519 verification (`verifyAndBuildVaultProofRecord`) before saving locally.
2. **Author Public Identities, Device Enrollments & Revocations (`identities.chmv`, `devices.chmv`):**
   - Public keys, paired device certificates (`SignedEnrollmentCertificate`), and signed device revocations (`SignedDeviceRevocationNotice`) sync monotonically inside `appDataFolder` without uploading raw private keys or granting automatic signing permission on Google login alone.
   - Optional encrypted key recovery (`recovery.chmv`) is **opt-in only**, storing separately passphrase-encrypted key envelopes (`encryptedKeyEnvelope` wrapped with PBKDF2-SHA256 + AES-256-GCM inside Vault AEAD).
3. **Rollback & Divergent Manifest Detection:**
   - Every encrypted manifest carries monotonic `manifestSeq`, `prevManifestHash`, and `epoch`.
   - If a pulled remote manifest shows `manifestSeq < state.lastManifestSeq` or same `manifestSeq` with divergent `contentHash`, `runGoogleDriveSync` records `rollbackWarning`, aborts automatic pull, and preserves local data cleanly.
4. **Three-Way Conflict Detection (No Silent Last-Write-Wins):**
   - Mutable collections (**Author Profiles**, **Policy Presets**, and **Vault Settings**) compare `(localContentHash, remoteContentHash, syncedEntityHashes[key])` instead of blindly trusting `updatedAt` timestamps.
   - Concurrent modifications to the same record on two offline devices are **never overwritten silently**—both `localRecord` and `remoteRecord` are preserved inside `PersistedDriveAccountState.conflicts` until the user explicitly chooses `keep-local`, `accept-remote`, or `keep-both` (`resolveVaultSyncConflict`).
5. **Logical Deletes via Tombstones (`STORE_VAULT_TOMBSTONES`):**
   - Deleting a proof, profile, or policy preset records a `VaultTombstoneRecord` (`entityType`, `entityId`, `deletedAt`) merged union-style during sync so deleted records are not silently resurrected by stale devices.
6. **Offline Queue & Exponential Backoff Retries:**
   - Mutations occurring offline are queued in `PersistedDriveAccountState.pendingQueue` inside IndexedDB `storageState` (`CHM_DB_VERSION = 7`) and flushed on next online sync. Local saves always succeed immediately even if cloud sync fails.
   - Transient Drive API errors (`429`, `500`, `502`, `503`, `504`) retry cleanly with jittered exponential backoff (`baseBackoffMs * 2^attempt + jitter`).
7. **Runtime Defense-in-Depth (`assertNoForbiddenSyncSecrets`):**
   - Recursively inspects every outbound object before encryption and throws immediately if it detects `Uint8Array`/`ArrayBuffer` buffers or sensitive field names (`raster`, `rgba`, `pixels`, `pngBytes`, `imageData`, `projectFileBytes`, `webCryptoPrivateKey`, `seed32`, `privateKey`, `secretKey`, `nsec`, `nip49`, `encryptedSecret`, `accessToken`, `access_token`), while only allowing passphrase-encrypted `EncryptedKeyBackup` structures when `allowRecoveryEnvelopes` is explicitly opted in.
