# Deployment & Standalone Release Guide (`DEPLOYMENT.md`)

Certified Handmade is a **100% static Vite + React + PWA** application requiring **zero backend services**, **zero server databases**, **zero OAuth server secrets**, and **zero paid infrastructure**. It ships in two mutually compatible distributions:

1. **Web / PWA Edition (`dist/`)** — hosted on **Cloudflare Pages (Free plan)** at `https://www.certified-handmade.com/`.
2. **Portable Standalone Edition (`release/`)** — static Go loopback launchers embedding `dist/` for **Linux x86_64** and **Windows x86_64**, distributed via **GitHub Releases** with `SHA256SUMS.txt`.

---

## 1. Google OAuth 2.0 Public Client Configuration (Optional Personal Drive Sync)

Certified Handmade uses the **Google Identity Services (GIS) OAuth 2.0 Token Model** (`https://accounts.google.com/gsi/client`) strictly in the browser with narrow scope `https://www.googleapis.com/auth/drive.file`.

- **Public Client ID (`.env.example`):**
  ```env
  VITE_GOOGLE_CLIENT_ID=948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com
  ```
- **Google Cloud Console Requirements:**
  - Application type: **Web application**
  - Authorized JavaScript origins: `https://www.certified-handmade.com` (plus `http://localhost:5173` / `http://127.0.0.1:4173` for local dev if desired)
  - Scope: `https://www.googleapis.com/auth/drive.file`
- **Strictly Prohibited:**
  - **NEVER** place an OAuth `client_secret` in `.env`, Cloudflare Pages environment variables, or client bundle code.
  - **NEVER** deploy Cloudflare Workers OAuth proxies, Service Accounts, or Firebase Auth.

---

## 2. Cloudflare Pages Setup (Free Plan)

1. Log in to the Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select repository: `yomiplush/hand-drawing-art-DRM-Toolkit`.
3. Configure build settings:
   - **Production branch:** `main`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
   - **Environment variables (Build):** set `VITE_GOOGLE_CLIENT_ID` (public Client ID above; defaults cleanly via [`src/core/google/config.ts`](./src/core/google/config.ts) if omitted).
4. Deploy. Cloudflare Pages serves:
   - `dist/_redirects` (`/* /index.html 200`) for direct SPA route access (`/create`, `/verify#proof=...`, `/vault`, `/storage`, `/keys`, `/devices`, `/exchange`, `/docs`).
   - Pre-generated static SEO shells (`dist/*.html` via [`scripts/generate-seo-pages.mjs`](./scripts/generate-seo-pages.mjs)).
   - `dist/_headers` for strict Content Security Policy & popup headers:
     - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (preserves GIS OAuth popup messaging)
     - `Content-Security-Policy`: `default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' wss: https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (zero `unsafe-eval`, zero inline scripts, GIS script lazy-loaded strictly on user connect click).
     - `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`.

---

## 2.1 Cloudflare Features That Break the Strict CSP (Disable These)

Certified Handmade ships a deliberately strict Content Security Policy (`script-src 'self'` with **zero** `unsafe-inline` and **zero** third-party origins beyond Google Identity Services). Cloudflare can inject scripts at the edge that violate that policy, producing console errors such as:

```
Executing inline script violates the following Content Security Policy directive 'script-src 'self' ...'.
Loading the script 'https://static.cloudflareinsights.com/beacon.min.js/...' violates ... 'script-src 'self' ...'.
```

Both come from Cloudflare's automatic injection (`window.__CF$cv$params` for Bot Fight Mode/Managed Challenge, and the Web Analytics beacon), **not** from this repository's code. Because the project advertises zero tracking and zero third-party analytics, the correct fix is to **disable the injection**, not to loosen the CSP with `unsafe-inline` or a `static.cloudflareinsights.com` allowance.

In the Cloudflare dashboard for `certified-handmade.com`:

1. **Speed → Optimization → Rocket Loader:** **Off**. Rocket Loader rewrites and defers scripts, injecting inline bootstrap code.
2. **Security → Bots → Bot Fight Mode:** **Off**. Bot Fight Mode injects the inline `__CF$cv$params` script into every HTML response.
3. **Analytics & Logs → Web Analytics:** **do not enable** for this zone (or remove the beacon). It injects `static.cloudflareinsights.com/beacon.min.js`.
4. **Scrape Shield → Email Address Obfuscation:** **Off** if it rewrites inline script content.
5. Keep **Always Use HTTPS**, the apex→`www` **301 redirect**, and `_headers`/`_redirects` handling enabled.

> **Why not just add `unsafe-inline`?** It would silently permit any injected or XSS-planted inline script, and it directly contradicts the project's stated zero-telemetry, strict-CSP posture documented in [`SECURITY.md`](./SECURITY.md). If a future Cloudflare feature must be kept, prefer a nonce/hash-based CSP or move that feature off the zone.

Verify after changing settings:

```bash
curl -sI https://www.certified-handmade.com/ | grep -i content-security-policy
# Reload the site and confirm zero CSP violations in the browser console.
```

---

## 3. Assigning Custom Domain (`www.certified-handmade.com`) & Apex 301 Redirect

1. Open your Cloudflare Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `www.certified-handmade.com` as the canonical production domain.
3. Configure an apex-to-`www` **301 Permanent Redirect** in Cloudflare:
   - Ensure a Proxied (`proxied: true`) DNS record exists for the apex domain `certified-handmade.com` (e.g. dummy `AAAA` record pointing to `100::`).
   - Add a **Single Redirect** rule (`http_request_dynamic_redirect`):
     - **Expression:** `(http.host eq "certified-handmade.com")`
     - **Target URL (Dynamic):** `concat("https://www.certified-handmade.com", http.request.uri.path)`
     - **Status code:** `301` (`preserve_query_string: true`)
4. Keep **Always Use HTTPS** enabled (required for Web Crypto API, Service Worker PWA registration, and Google OAuth production origin matching).

---

## 4. Building & Distributing the Portable Standalone Edition (Zero Cost)

No paid CI/CD runners, third-party Go modules, or commercial code-signing services are required.

> **Google OAuth Note on Standalone (`http://127.0.0.1:43777`):** `checkGoogleDriveEnvironmentSupport()` intentionally disables Google OAuth on the offline loopback Standalone server and omits `accounts.google.com` from `standalone/server.go`'s strict CSP. Standalone users export/import `.chmvault.json` encrypted archives cleanly across origins via `/vault` & `/storage`.

### 4.1 Local Reproducible Build (Linux Host)

Requires Node.js 20+ and Go 1.22+ (standard library only, `CGO_ENABLED=0`):

```bash
npm ci
npm run build:standalone
```

`scripts/build-standalone.sh`:
1. Runs `npm run build` to produce fresh `dist/` assets.
2. Temporarily copies `dist/` into `standalone/webdist/` (restored on exit via cleanup `trap`).
3. Runs Go tests (`go test -race ./...`).
4. Cross-compiles reproducible binaries (`-trimpath -ldflags="-s -w"`):
   - `release/certified-handmade-linux-amd64` (statically linked Linux x86_64 ELF)
   - `release/certified-handmade-windows-amd64.exe` (Windows x86_64 portable console executable)
5. Packages reproducible archives (`tar` with `--sort=name` + `SOURCE_DATE_EPOCH`, Python deterministic-timestamp `.zip`) alongside `README-STANDALONE.txt` and `certified-handmade-standalone.desktop`:
   - `release/certified-handmade-standalone-<version>-linux-amd64.tar.gz`
   - `release/certified-handmade-standalone-<version>-windows-amd64.zip`
6. Writes `release/SHA256SUMS.txt`.

Verify checksums locally:

```bash
(cd release && sha256sum -c SHA256SUMS.txt)
```

### 4.2 Publishing to GitHub Releases

- **Manual local upload (zero CI usage):** Run `npm run build:standalone`, create a GitHub Release for tag `vX.Y.Z`, and attach the `.tar.gz`, `.zip`, standalone binaries, and `SHA256SUMS.txt`.
- **Optional zero-cost GitHub Actions release:** `.github/workflows/release-standalone.yml` uses standard public-repo free `ubuntu-latest` runners (never paid macOS/Windows/larger runners) and runs only on manual `workflow_dispatch` or `v*` tag pushes.

---

## 5. Self-Hosting Without Cloudflare

The `dist/` directory built by `npm run build` is portable to any static HTTPS host (GitHub Pages, Nginx, Caddy, Apache, IPFS):

- Fall back unknown paths (`/create`, `/verify`, `/tutorial`, `/keys`, `/devices`, `/vault`, `/storage`, `/exchange`, `/docs`) to `/index.html` with HTTP `200` (without stripping URL `#proof=...` fragments).
- Serve over **HTTPS** (or `http://localhost` / `http://127.0.0.1`) so `crypto.subtle`, `navigator.mediaDevices`, and Service Workers work in browsers.
- If self-hosting with Google Drive sync enabled on your own domain, register your own Web OAuth Client ID with Google Cloud Console and pass it at build time:
  ```bash
  VITE_GOOGLE_CLIENT_ID=<your-public-client-id> npm run build
  ```
- If hosting under a subpath, build with:
  ```bash
  VITE_BASE_PATH=/certified-handmade/ npm run build
  ```
