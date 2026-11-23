# Deployment & Standalone Release Guide (`DEPLOYMENT.md`)

Certified Handmade is a **100% static Vite + React + PWA** application requiring **zero backend services**, **zero databases**, and **zero paid infrastructure**. It ships in two mutually compatible distributions:

1. **Web / PWA Edition (`dist/`)** — hosted on **Cloudflare Pages (Free plan)** at `https://certified-handmade.com/`.
2. **Portable Standalone Edition (`release/`)** — static Go loopback launchers embedding `dist/` for **Linux x86_64** and **Windows x86_64**, distributed via **GitHub Releases** with `SHA256SUMS.txt`.

---

## 1. Cloudflare Pages Setup (Free Plan)

1. Log in to the Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select repository: `yomiplush/hand-drawing-art-DRM-Toolkit`.
3. Configure build settings:
   - **Production branch:** `main`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
4. Deploy. Cloudflare Pages serves:
   - `dist/_redirects` (`/* /index.html 200`) for direct SPA route access (including `/verify#proof=...`).
   - `dist/_headers` for strict Content Security Policy (`script-src 'self'`, `connect-src 'self'`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self)`).

---

## 2. Assigning Custom Domain (`certified-handmade.com`)

1. Open your Cloudflare Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `certified-handmade.com` (and optionally `www.certified-handmade.com` redirecting to apex).
3. Cloudflare configures DNS and Universal SSL/TLS automatically.
4. Keep **Always Use HTTPS** enabled (required for Web Crypto API and Service Worker PWA registration).

---

## 3. Building & Distributing the Portable Standalone Edition (Zero Cost)

No paid CI/CD runners, third-party Go modules, or commercial code-signing services are required.

### 3.1 Local Reproducible Build (Linux Host)

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

### 3.2 Publishing to GitHub Releases

- **Manual local upload (zero CI usage):** Run `npm run build:standalone`, create a GitHub Release for tag `vX.Y.Z`, and attach the `.tar.gz`, `.zip`, standalone binaries, and `SHA256SUMS.txt`.
- **Optional zero-cost GitHub Actions release:** `.github/workflows/release-standalone.yml` uses standard public-repo free `ubuntu-latest` runners (never paid macOS/Windows/larger runners) and runs only on manual `workflow_dispatch` or `v*` tag pushes.

---

## 4. Self-Hosting Without Cloudflare

The `dist/` directory built by `npm run build` is portable to any static HTTPS host (GitHub Pages, Nginx, Caddy, Apache, IPFS):

- Fall back unknown paths (`/create`, `/verify`, `/tutorial`, `/keys`, `/docs`) to `/index.html` with HTTP `200` (without stripping URL `#proof=...` fragments).
- Serve over **HTTPS** (or `http://localhost` / `http://127.0.0.1`) so `crypto.subtle`, `navigator.mediaDevices`, and Service Workers work in browsers.
- If hosting under a subpath, build with:
  ```bash
  VITE_BASE_PATH=/certified-handmade/ npm run build
  ```
