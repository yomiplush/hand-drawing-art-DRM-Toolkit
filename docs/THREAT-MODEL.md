# Certified Handmade Threat Model (`THREAT-MODEL.md`)

> **Verification & Audit Disclosure:** Internal threat modeling, property checks, fuzz/negative tests, Node/Go cross-implementation vectors, and Playwright E2E security checks have been performed on this codebase. **No independent third-party security or cryptographic audit has been conducted** (consistent with the zero-paid-services constraint).

---

## 1. Trust Boundaries

| Asset / Entity | Trust Level | Security Assumption |
| --- | --- | --- |
| **User Browser / Device Memory** | High (Trusted Computing Base) | Protected by same-origin isolation and strict CSP; endpoint/OS malware or malicious extensions compromise active sessions. |
| **IndexedDB (`chm-drm-keystore`)** | Local Origin Only | Holds non-extractable Web Crypto `CryptoKey`s, AES-GCM wrapped secrets, signed proofs (`CHM-VAULT-v1`), and sync logs; vulnerable to browser storage eviction or XSS if CSP is bypassed. |
| **Nostr Relays (`wss://...`)** | **Untrusted** | Can drop, delay, reorder, replay, censor, forge metadata, inject arbitrary JSON/events, or switch to paid access (`payment-required`). |
| **Verifiers / QR Scanners** | **Untrusted Inputs** | QR codes, pasted tokens, `.chmevidence`, `.chmvault.json`, and Nostr events are untrusted inputs parsed with strict canonical CBOR, size caps, and sanitization. |

---

## 2. Threat Matrix & Implemented Mitigations

| Threat | Layer | Mitigation |
| --- | --- | --- |
| **Cross-protocol key reuse (Ed25519 -> secp256k1)** | Layer 2 / 3 | Hard runtime invariant (`assertDistinctFromEd25519Secrets`) forbids Nostr keys from sharing bytes with Owner or Device Ed25519 keys. Independent CSPRNG key generation (`crypto.getRandomValues` / `@noble/curves`). |
| **Malicious / forged Nostr sync event from relay** | Layer 3 | Every incoming `kind 1059` Gift Wrap is verified for Schnorr signature -> decrypted with NIP-44 -> inner `kind 13` rumor sender pubkey matched against NIP-59 seal -> verified against `CHM-SYNC-v1:BIND\\0` / `CHM-SYNC-v1:OP\\0` Ed25519 signatures bound to a trusted Owner. |
| **Replay of old enrollment or un-revoking a compromised device** | Layer 2 / 3 | `CHM-DEVICE-PAIRING-v1` persists `req:<id>` and 256-bit `nonce:<hex>` in IndexedDB; `CHM-SYNC-v1` enforces contiguous hash-chained sequences (`sequence`, `prevOpHash`), causal gap detection, and monotonic `deviceRevocations` immunity against stale registry snapshots. |
| **Withholding or selective dropping by relays** | Layer 3 | Outgoing operations broadcast across multiple enabled relays; missing sequence numbers trigger explicit `hasCausalGap` UI warnings so a relay cannot silently hide an intervening revocation. |
| **Relay leaking revocation or sync traffic to revoked devices** | Layer 3 | `selectActiveSyncRecipients` and `flushOutbox` filter out any `revoked` or `conflict-revoked` device **both at queue time and right before socket publish**. NIP-59 uses single-use ephemeral keys per recipient wrap. |
| **Unauthorized privilege escalation via paired devices** | Layer 2 | v1 enrollment certificates allow only `["device-identity"]`; elevated capabilities are rejected by validators. |
| **Plaintext private key exfiltration** | All | Zero `localStorage` key storage, zero URL `#`/query key embedding, recursive JSON guard blocks `privateKey`, `seed32`, `nsec1`, `ncryptsec1` in exports, peer cards, and logs. Backups use PBKDF2-SHA256 (600,000 iter) + AES-256-GCM or NIP-49 scrypt (`ncryptsec1`). |
| **Accidental traffic / paywall surprise on public relays** | Layer 3 | Sync defaults OFF until user consent; test suite uses loopback `MockNostrRelay` (`expect(externalRequests).toEqual([])` at rest); NIP-11 pre-flight & runtime `payment-required` checks auto-disable paid relays; `1 MiB / 30 days` cap defers Priority >= 2 Vault bundles while keeping Priority 0 revocations unblocked. |
| **Fake or tampered Proof in Vault backup / Public Index (`kind 30078`)** | Layer 3 | Both `importVaultBackupJson` and `parseAndVerifyPublicProofEvent` re-decode canonical CBOR and verify the underlying `CHM1\\0` Ed25519 signature (`verifyAndBuildVaultProofRecord`) before storing or displaying any record. |
| **XSS / Unicode Bidi Spoofing / OOM Image Bombs** | Layer 1 / 4 | Strict CSP (`script-src 'self'`), no `dangerouslySetInnerHTML`, bidi/control-char rejection, pre-flight PNG `IHDR` bounds (`<= 8192 px` input, `<= 32 MP`), and bounded CBOR/JSON message sizes (`<= 64 KiB` sync op, `<= 16 KiB` public event). |
| **DNS Rebinding / Cross-Origin Drift in Standalone** | Layer 4 | Go launcher binds strictly to `127.0.0.1:43777`, enforces loopback `Host` header allowlist (`403` otherwise), read-only `GET`/`HEAD` (`405`), and refuses ephemeral port fallback. |

---

## 3. Residual Risks & Honest Boundaries

1. **Compromised Endpoint / Malicious Browser Extension:** If an attacker executes code within the page origin or captures the user's passphrase during active unlock, local signing and session decryption can be abused.
2. **Owner Root Key Compromise:** If the Owner Ed25519 root key leaks, the attacker can issue valid revocations, enrollments, and backdated `CHM1` signatures. Revoking the Owner key requires issuing a `CHM-NOTICE1` revocation/rotation and distributing it out-of-band / across peers.
3. **Relay Metadata Timing & Availability:** Even with NIP-59 randomized wrap timestamps (`+/- 48h`) and ephemeral sender keys, relay operators observe the recipient `p`-tag (`nostrPubkeyHex`) and client IP address unless the user routes traffic over Tor/VPN or uses a trusted community/self-hosted relay. Relays may also purge events at any time (mitigated by local-first IndexedDB storage and offline exports).
4. **No Formal Proof of Human Authorship or Legal Ownership:** Cryptographic signatures prove key possession and pixel digest equality—never human hand-drawing without AI, real-world legal identity, or copyright registration.
