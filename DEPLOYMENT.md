# Deployment Guide (`DEPLOYMENT.md`)

Certified Handmade is a **100% static Vite + React + PWA** application. It requires **zero backend services**, **zero Cloudflare Workers/Pages Functions**, and **zero databases** (KV, D1, R2 are not used).

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
4. Deploy! Cloudflare Pages automatically serves:
   - `dist/_redirects` (`/* /index.html 200`) for direct SPA route access (including `/verify#proof=...`).
   - `dist/_headers` for strict Content Security Policy (`script-src 'self'`, `connect-src 'self'`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self)`).

---

## 2. Assigning Custom Domain (`certified-handmade.com`)

> Note: Do not automate DNS modifications before ownership/zone setup. Assign the custom domain manually when ready:

1. Open your Cloudflare Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `certified-handmade.com` (and optionally `www.certified-handmade.com` redirecting to apex).
3. Cloudflare will configure the CNAME/DNS record in your Cloudflare zone and provision an automatic Universal SSL/TLS certificate.
4. Ensure **Always Use HTTPS** is enabled in Cloudflare SSL/TLS settings (required for Web Crypto API and Service Worker PWA registration).

---

## 3. Self-Hosting Without Cloudflare

The `dist/` directory built by `npm run build` is completely portable to any static HTTPS host (GitHub Pages, Nginx, Caddy, Apache, IPFS, local static server):

- Configure your static server to fall back unknown paths (`/create`, `/verify`, `/keys`, `/docs`) to `/index.html` with HTTP `200` (without stripping URL `#proof=...` fragments).
- Serve over **HTTPS** (or `http://localhost`) so `crypto.subtle`, `navigator.mediaDevices`, and Service Workers work in browsers.
- If hosting under a subpath (e.g., `https://example.org/certified-handmade/`), build with:
  ```bash
  VITE_BASE_PATH=/certified-handmade/ npm run build
  ```

---

## 4. PWA Offline Verification Notes

- Upon first visit over HTTPS, `sw.js` (Workbox) precaches all application assets (`index.html`, JS bundles, CSS, SVG/PNG icons, manifest).
- Subsequent visits—including direct links to `/verify#proof=...`—work completely offline.
- A device that has **never** loaded the app cannot bootstrap the web app while offline; users intending to verify offline in the field should open the site once (or install the PWA) beforehand.
