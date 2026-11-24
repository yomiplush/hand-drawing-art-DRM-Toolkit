# Local Vault Storage & Sync Data Budget (`STORAGE-BUDGET.md`)

---

## 1. Compact `CHM-VAULT-v1` Schema (`src/core/vault/types.ts`)

Every locally signed artwork proof saved in IndexedDB `proofVault` uses `CHM-VAULT-v1`:
- Stores: `id` (SHA-256 of proof), `protocolVersion`, `artworkIdHex`, `authorPublicKeyBase64Url`, `authorFingerprintHex`, `authorFingerprintShort`, `authorName`, `artworkTitle`, `creationMethod`, `licenseId`, `commercialUse`, `redistribution`, `aiTraining`, `imageSha256Hex`, `issuedAt`, `proofBase64Url`, `syncSelected`, `publicIndexOptIn`, `createdAt`, `updatedAt`.
- **Target Size:** `< 1,200 B` (~1 KiB) per proof record.
- **Hard Exclusions:** Zero image pixels, zero thumbnails, zero evidence binaries, and zero private keys.

---

## 2. 30-Day Rolling Soft Online Sync Budget

To remain polite to free public Nostr relays and mobile data connections:

- **Default Window & Cap:** `DEFAULT_ONLINE_SYNC_BUDGET_BYTES = 1_048_576` (`1 MiB`) over `SYNC_BUDGET_WINDOW_MS = 30 days` (`src/core/sync/types.ts`).
- Window automatically resets after 30 days (`loadSyncSettings`).
- Every published outbox frame increments `syncWindowBytesUsed`.

### Priority-Based Deferral Rules (`flushOutbox`)
1. **Priority `0` (`revoke-device`):** **Never blocked** by the 30-day soft cap—security revocations always flush immediately.
2. **Priority `1` (`enroll-device`, `authorize-sync-device`, `checkpoint`, bindings):** **Never blocked** by the soft cap so multi-device identity stays consistent.
3. **Priority `2` (`CHM-VAULT-v1` selected proofs + creator defaults) & Priority `3`:**
   - When `projectedBytes + estBytes > onlineSyncBudgetBytes`, sending is cleanly deferred (`budgetDeferredCount` / `skippedDueToBudget: true`).
   - UI surfaces `gracefulFallbackReason = 'budget-limit'` with a calm hint linking to offline JSON / AES-256-GCM backups on `/vault` (or allowing user-initiated relay replacement).
