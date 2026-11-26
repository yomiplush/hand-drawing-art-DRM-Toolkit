import { GALLERY_DECK_OFFLINE_VIEWER_FILENAME } from '../../types/gallerydeck';

export const OFFLINE_VIEWER_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:;";

/**
 * Generates a 100% self-contained single-file HTML offline decryptor & gallery viewer.
 * - Zero external CDNs, zero network calls (enforced by strict CSP).
 * - Uses browser-native Web Crypto API (PBKDF2 SHA-256 + AES-GCM 256-bit).
 * - Supports showDirectoryPicker (PC) and automatic <input type="file" multiple> fallback
 *   (iOS Safari / Android, including iOS Files app -> Google Drive / iCloud) as well as
 *   single-file `.gdvault` with File.slice() on-demand decryption.
 * - Immediately calls URL.revokeObjectURL() when closing or switching full-resolution images.
 */
export function generateOfflineViewerHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="${OFFLINE_VIEWER_CSP}" />
  <title>GalleryDeck Offline Vault Viewer</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #060b14;
      --panel: #0f172a;
      --border: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #22d3ee;
      --accent-dark: #0891b2;
      --danger: #f43f5e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(6, 11, 20, 0.92);
      border-bottom: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    header h1 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
    .badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(34, 211, 238, 0.14);
      color: var(--accent);
      border: 1px solid rgba(34, 211, 238, 0.35);
    }
    main { max-width: 1120px; margin: 0 auto; padding: 16px; }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    input[type="password"] {
      flex: 1;
      min-width: 200px;
      background: #020617;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
    }
    button {
      background: #1e293b;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      color: #020617;
      border-color: var(--accent);
    }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .hint { font-size: 12px; color: var(--muted); margin: 8px 0 0; line-height: 1.5; }
    .error { color: var(--danger); font-size: 13px; margin-top: 8px; }
    .tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
    .tab {
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      white-space: nowrap;
    }
    .tab.active { background: #fff; color: #020617; border-color: #fff; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .tile {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      padding: 0;
      text-align: left;
      display: flex;
      flex-direction: column;
    }
    .tile img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #020617;
      display: block;
    }
    .tile-meta { padding: 8px 10px; }
    .tile-title {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tile-sub { font-size: 10px; color: var(--muted); margin-top: 2px; }
    .modal {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(2, 6, 23, 0.94);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal.open { display: flex; }
    .modal-bar {
      width: 100%;
      max-width: 1000px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .modal-img-wrap {
      flex: 1;
      width: 100%;
      max-width: 1000px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .modal-img-wrap img {
      max-width: 100%;
      max-height: 82vh;
      object-fit: contain;
      border-radius: 10px;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header>
    <div class="row">
      <h1>GalleryDeck Offline Viewer</h1>
      <span class="badge">Zero-Knowledge · 100% Offline</span>
    </div>
    <button id="lockBtn" class="hidden" type="button">Lock &amp; Clear Memory</button>
  </header>

  <main>
    <section id="unlockPanel" class="card">
      <div class="row" style="margin-bottom: 10px;">
        <button id="pickDirBtn" type="button">Select Encrypted Folder (PC)</button>
        <button id="pickFilesBtn" type="button">Select .gdvault or .enc Files (iOS / Android / PC)</button>
        <input id="fileInput" type="file" multiple class="hidden" />
      </div>
      <div id="selectedInfo" class="hint">No files selected yet.</div>
      <div class="row" style="margin-top: 12px;">
        <input id="passphraseInput" type="password" placeholder="Enter vault passphrase..." autocomplete="off" />
        <button id="unlockBtn" class="primary" type="button" disabled>Decrypt &amp; Open</button>
      </div>
      <p class="hint">
        All decryption runs locally via Web Crypto API (PBKDF2 SHA-256 + AES-GCM 256-bit).
        Only thumbnails are decrypted upfront; full-resolution images are decrypted one-by-one on tap and released immediately on close.
      </p>
      <div id="errorBox" class="error"></div>
    </section>

    <section id="galleryPanel" class="hidden">
      <div id="folderTabs" class="tabs"></div>
      <div id="grid" class="grid"></div>
    </section>
  </main>

  <div id="viewerModal" class="modal" role="dialog" aria-modal="true">
    <div class="modal-bar">
      <div id="modalTitle" style="font-size: 14px; font-weight: 600;"></div>
      <button id="closeModalBtn" type="button">Close (Release Memory)</button>
    </div>
    <div class="modal-img-wrap">
      <div id="modalLoading" class="hint">Decrypting full-resolution image...</div>
      <img id="modalImg" alt="" class="hidden" />
    </div>
  </div>

  <script>
  (function () {
    'use strict';
    const MAGIC = [0x47, 0x44, 0x45, 0x31]; // GDE1
    const VAULT_MAGIC = [0x47, 0x44, 0x56, 0x31]; // GDV1
    const HEADER_BYTES = 37;
    const MIN_ITER = 100000;

    let selectedFiles = [];
    let activeSession = null;
    let activeFolder = 'ALL';
    let currentFullUrl = null;

    const pickDirBtn = document.getElementById('pickDirBtn');
    const pickFilesBtn = document.getElementById('pickFilesBtn');
    const fileInput = document.getElementById('fileInput');
    const selectedInfo = document.getElementById('selectedInfo');
    const passphraseInput = document.getElementById('passphraseInput');
    const unlockBtn = document.getElementById('unlockBtn');
    const lockBtn = document.getElementById('lockBtn');
    const errorBox = document.getElementById('errorBox');
    const unlockPanel = document.getElementById('unlockPanel');
    const galleryPanel = document.getElementById('galleryPanel');
    const folderTabs = document.getElementById('folderTabs');
    const grid = document.getElementById('grid');
    const viewerModal = document.getElementById('viewerModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalLoading = document.getElementById('modalLoading');
    const modalImg = document.getElementById('modalImg');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (typeof window.showDirectoryPicker !== 'function') {
      pickDirBtn.classList.add('hidden');
    }

    function updateUnlockReady() {
      unlockBtn.disabled = selectedFiles.length === 0 || passphraseInput.value.length === 0;
    }

    pickDirBtn.addEventListener('click', async () => {
      errorBox.textContent = '';
      try {
        const dir = await window.showDirectoryPicker({ mode: 'read' });
        const files = [];
        for await (const entry of dir.values()) {
          if (entry.kind === 'file') {
            files.push(await entry.getFile());
          }
        }
        selectedFiles = files;
        selectedInfo.textContent = 'Folder: ' + dir.name + ' (' + files.length + ' files)';
        updateUnlockReady();
      } catch (e) {
        if (e && e.name !== 'AbortError') errorBox.textContent = e.message || 'Failed to read folder.';
      }
    });

    pickFilesBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      errorBox.textContent = '';
      selectedFiles = Array.from(fileInput.files || []);
      selectedInfo.textContent = selectedFiles.length + ' file(s) selected.';
      updateUnlockReady();
    });

    passphraseInput.addEventListener('input', updateUnlockReady);

    async function decryptBytes(encrypted, passphrase) {
      if (encrypted.byteLength <= HEADER_BYTES) throw new Error('Corrupted encrypted chunk.');
      for (let i = 0; i < 4; i++) {
        if (encrypted[i] !== MAGIC[i]) throw new Error('Invalid chunk header.');
      }
      const view = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
      const iterations = view.getUint32(5, false);
      if (iterations < MIN_ITER) throw new Error('Iteration count below minimum.');
      const salt = encrypted.slice(9, 25);
      const iv = encrypted.slice(25, 37);
      const ciphertext = encrypted.slice(37);

      const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
      return new Uint8Array(plain);
    }

    async function createChunkReader(files) {
      const vaultFile = files.find((f) => f.name.toLowerCase().endsWith('.gdvault'));
      if (vaultFile) {
        const prefix = new Uint8Array(await vaultFile.slice(0, 8).arrayBuffer());
        for (let i = 0; i < 4; i++) {
          if (prefix[i] !== VAULT_MAGIC[i]) throw new Error('Invalid .gdvault file.');
        }
        const indexLen = new DataView(prefix.buffer).getUint32(4, false);
        const indexBuf = await vaultFile.slice(8, 8 + indexLen).arrayBuffer();
        const index = JSON.parse(new TextDecoder().decode(indexBuf));
        const payloadOffset = 8 + indexLen;
        return async (name) => {
          const entry = index.entries[name];
          if (!entry) return null;
          return new Uint8Array(await vaultFile.slice(payloadOffset + entry.offset, payloadOffset + entry.offset + entry.length).arrayBuffer());
        };
      }
      const map = new Map();
      for (const f of files) map.set(f.name.split('/').pop() || f.name, f);
      return async (name) => {
        const f = map.get(name);
        return f ? new Uint8Array(await f.arrayBuffer()) : null;
      };
    }

    function releaseFullImage() {
      if (currentFullUrl) {
        URL.revokeObjectURL(currentFullUrl);
        currentFullUrl = null;
      }
      modalImg.removeAttribute('src');
      modalImg.classList.add('hidden');
      viewerModal.classList.remove('open');
    }

    closeModalBtn.addEventListener('click', releaseFullImage);
    viewerModal.addEventListener('click', (e) => {
      if (e.target === viewerModal) releaseFullImage();
    });

    function clearSession() {
      releaseFullImage();
      if (activeSession) {
        for (const u of activeSession.urls) URL.revokeObjectURL(u);
        activeSession = null;
      }
      grid.innerHTML = '';
      folderTabs.innerHTML = '';
      galleryPanel.classList.add('hidden');
      lockBtn.classList.add('hidden');
      unlockPanel.classList.remove('hidden');
      passphraseInput.value = '';
      updateUnlockReady();
    }

    lockBtn.addEventListener('click', clearSession);

    function renderGallery() {
      if (!activeSession) return;
      const { manifest, thumbUrls, readChunk, passphrase } = activeSession;
      const folders = ['ALL'].concat(manifest.folders || []);
      folderTabs.innerHTML = '';
      for (const f of folders) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab' + (activeFolder === f ? ' active' : '');
        btn.textContent = f === 'ALL' ? 'All (' + manifest.items.length + ')' : f;
        btn.addEventListener('click', () => {
          activeFolder = f;
          renderGallery();
        });
        folderTabs.appendChild(btn);
      }

      grid.innerHTML = '';
      const filtered = activeFolder === 'ALL'
        ? manifest.items
        : manifest.items.filter((it) => it.folder === activeFolder);

      for (const item of filtered) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tile';
        const img = document.createElement('img');
        img.alt = item.title || '';
        if (thumbUrls[item.id]) img.src = thumbUrls[item.id];
        const meta = document.createElement('div');
        meta.className = 'tile-meta';
        const title = document.createElement('div');
        title.className = 'tile-title';
        title.textContent = item.title || item.id;
        const sub = document.createElement('div');
        sub.className = 'tile-sub';
        sub.textContent = item.width + '×' + item.height;
        meta.appendChild(title);
        meta.appendChild(sub);
        tile.appendChild(img);
        tile.appendChild(meta);

        tile.addEventListener('click', async () => {
          releaseFullImage();
          modalTitle.textContent = item.title || item.id;
          modalLoading.classList.remove('hidden');
          modalLoading.textContent = 'Decrypting full-resolution image...';
          viewerModal.classList.add('open');
          try {
            const enc = await readChunk(item.imgFile);
            if (!enc) throw new Error('Missing image chunk: ' + item.imgFile);
            const plain = await decryptBytes(enc, passphrase);
            currentFullUrl = URL.createObjectURL(new Blob([plain], { type: item.mimeType || 'image/png' }));
            modalImg.src = currentFullUrl;
            modalImg.classList.remove('hidden');
            modalLoading.classList.add('hidden');
          } catch (err) {
            modalLoading.textContent = err.message || 'Failed to decrypt image.';
          }
        });
        grid.appendChild(tile);
      }
    }

    unlockBtn.addEventListener('click', async () => {
      errorBox.textContent = '';
      unlockBtn.disabled = true;
      const passphrase = passphraseInput.value;
      try {
        const readChunk = await createChunkReader(selectedFiles);
        const manifestEnc = await readChunk('manifest.enc');
        if (!manifestEnc) throw new Error('manifest.enc not found.');
        const manifestBytes = await decryptBytes(manifestEnc, passphrase);
        const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));

        const thumbUrls = {};
        const urls = [];
        for (const item of manifest.items) {
          const thumbEnc = await readChunk(item.thumbFile);
          if (!thumbEnc) continue;
          try {
            const plain = await decryptBytes(thumbEnc, passphrase);
            const u = URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }));
            thumbUrls[item.id] = u;
            urls.push(u);
          } catch {}
        }

        activeSession = { manifest, thumbUrls, urls, readChunk, passphrase };
        activeFolder = 'ALL';
        unlockPanel.classList.add('hidden');
        galleryPanel.classList.remove('hidden');
        lockBtn.classList.remove('hidden');
        renderGallery();
      } catch (e) {
        errorBox.textContent = e.message || 'Decryption failed. Check passphrase.';
      } finally {
        updateUnlockReady();
      }
    });
  })();
  </script>
</body>
</html>`;
}

export function downloadOfflineViewerHtml(): void {
  const html = generateOfflineViewerHtml();
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = GALLERY_DECK_OFFLINE_VIEWER_FILENAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
