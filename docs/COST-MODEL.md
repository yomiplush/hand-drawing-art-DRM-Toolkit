# Quantitative Cost & Capacity Model (`COST-MODEL.md`)

**Maintainer Fixed Recurring Cost:** Domain registration (`certified-handmade.com`, ~$10–$20 / year)  
**Maintainer Marginal User Cost:** **\$0.00 / user** across all scale tiers

---

## 1. Per-Artifact & Per-User Footprint

Because artwork pixels (`PNG`/`PSD`/`KRA`) **never** leave the user's device, only tiny cryptographic structures are stored or synced:

| Item | Typical Wire / Storage Size | Storage Location |
| --- | --- | --- |
| Primary `CHM1` / `CHM2` Signed Proof (`proofBytes`) | `~250 – 450 B` (capped at `2048 B`) | QR fragment + `CHM-VAULT-v1` |
| Full `VaultProofRecord` in IndexedDB (`CHM-VAULT-v1`) | `~850 – 1,200 B` (~1 KiB) | Local IndexedDB `proofVault` |
| 1,000 Signed Proofs in Vault | `~1.0 – 1.2 MiB` | Local IndexedDB |
| 10,000 Signed Proofs in Vault | `~10 – 12 MiB` | Local IndexedDB |
| Device Pairing Certificate (`CHM-DEVICE-PAIRING-v1`) | `~350 – 600 B` (max `2048 B`) | Local IndexedDB + QR |
| Single Sync Operation (`CHM-SYNC-v1:OP`) in NIP-59 Wrap | `~1.2 – 2.5 KiB` | Ephemeral relay event + `syncOpLog` |
| Monthly Sync Budget Default (`DEFAULT_ONLINE_SYNC_BUDGET_BYTES`) | `1,048,576 B` (`1 MiB` / 30 days) | `syncSettings.syncWindowBytesUsed` |

Even at 1,000–10,000 signed artworks per artist, total local IndexedDB footprint (`< 15 MiB`) fits comfortably inside browser origin quotas (`hundreds of MiB to GiB`) with zero cloud storage cost.

---

## 2. Scaling Analysis (100 to 1,000,000 Users)

| Scale Tier | Total Signed Artworks (Est. ~50/user) | Maintainer Server Compute / DB Cost | Cloudflare Pages Static CDN Cost | Nostr Relay Bandwidth (Only If Opted-In, <= 1 MiB/mo/device) |
| --- | --- | --- | --- | --- |
| **100 Users** | 5,000 proofs | **\$0** (no backend) | **\$0** (free static tier; PWA caches assets locally) | Negligible; easily absorbed by 1–2 free community relays |
| **1,000 Users** | 50,000 proofs | **\$0** (no backend) | **\$0** | Low (< 1 GiB/mo aggregate if every user syncs max budget) |
| **10,000 Users** | 500,000 proofs | **\$0** (no backend) | **\$0** | Distributed across user-selected free relays / self-hosted relays |
| **100,000 Users** | 5,000,000 proofs | **\$0** (no backend) | **\$0** | Self-partitioned: each user connects only to their own configured relays; Priority `>=2` capped at `1 MiB/30d` |
| **1,000,000 Users** | 50,000,000 proofs | **\$0** (no backend) | **\$0** | **No single maintainer relay bottleneck**—users can swap presets, run personal relays, or stay 100% offline with `.chmvault.json` |

### Why Cloudflare Pages + PWA Scales to 1,000,000 Users at \$0
1. Static HTML/JS/CSS (`~1.8 MiB` precache) is cached aggressively by Cloudflare's edge AND cached on-device by `dist/sw.js` (`vite-plugin-pwa`). Returning offline/PWA launches consume **zero network requests**.
2. Zero server-side functions (`Pages Functions` = 0, `Workers` = 0, `D1`/`KV`/`R2` = 0) guarantees zero metered request/egress overages.
3. Heavy cryptographic work (Ed25519, PBKDF2, SHA-256, PNG RGBA8 decoding, QR rendering, IndexedDB search) executes entirely on the **user's CPU/GPU**.
4. Users never depend on any single Nostr relay operator: community relays can be added/removed per user, and if all public relays throttle or close, offline `.chkey.json` / `.chmvault.{json,enc.json}` / `.chdevreg.json` keep working cleanly.
