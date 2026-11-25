import fs from 'node:fs';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { encode as encodePng } from 'fast-png';

interface MockDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties: Record<string, string>;
  modifiedTime: string;
  content?: string;
}

function buildSamplePng(width = 160, height = 120): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y) & 0xff;
      data[i + 1] = (x * 3 + y * 5) & 0xff;
      data[i + 2] = (x + y * 9) & 0xff;
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

async function dismissCookieBannerIfVisible(page: Page): Promise<void> {
  const rejectBtn = page.getByTestId('cookie-reject-btn');
  if (await rejectBtn.isVisible().catch(() => false)) {
    await rejectBtn.click();
  }
}

async function navigateSpaToCreate(page: Page): Promise<void> {
  const desktopLink = page.getByTestId('nav-create-link');
  if (await desktopLink.isVisible().catch(() => false)) {
    await desktopLink.click();
  } else {
    await page.getByTestId('nav-menu-toggle').click();
    await page.getByTestId('nav-menu-panel').locator('a[href="/create"]').click();
  }
}

async function navigateSpaToStorage(page: Page): Promise<void> {
  await page.getByTestId('nav-menu-toggle').click();
  await page.getByTestId('menu-storage-link').click();
}

function createSharedMockGoogleEnvironment() {
  const files = new Map<string, MockDriveFile>();
  let nextId = 1;
  let gisScriptRequests = 0;
  const revokedTokens: string[] = [];
  const driveListSpaces: string[] = [];
  let activeAccount: 'acct1' | 'acct2' = 'acct1';

  const accountProfiles = {
    acct1: {
      displayName: 'Yomi Artist',
      emailAddress: 'yomi@example.com',
      permissionId: 'perm-yomi-1',
    },
    acct2: {
      displayName: 'Alt Persona',
      emailAddress: 'alt@example.com',
      permissionId: 'perm-alt-2',
    },
  };

  async function installOnContext(context: BrowserContext): Promise<void> {
    await context.route('https://accounts.google.com/gsi/client', async (route) => {
      gisScriptRequests++;
      const js = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.oauth2 = {
          initTokenClient: function(cfg) {
            return {
              requestAccessToken: function(overrideCfg) {
                var promptVal = (overrideCfg && overrideCfg.prompt) || '';
                var token = promptVal === 'consent'
                  ? 'mock-oauth-token-acct2'
                  : 'mock-oauth-token-acct1';
                setTimeout(function() {
                  cfg.callback({
                    access_token: token,
                    expires_in: 3600,
                    scope: 'https://www.googleapis.com/auth/drive.appdata',
                    token_type: 'Bearer'
                  });
                }, 10);
              }
            };
          },
          hasGrantedAllScopes: function(resp, scope) {
            return Boolean(resp && typeof resp.scope === 'string' && resp.scope.indexOf(scope) !== -1);
          },
          revoke: function(token, done) {
            fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), { method: 'POST' })
              .finally(function() { if (done) done(); });
          }
        };
      `;
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: js,
      });
    });

    await context.route('https://oauth2.googleapis.com/revoke**', async (route) => {
      const u = new URL(route.request().url());
      const tok = u.searchParams.get('token');
      if (tok) revokedTokens.push(tok);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await context.route('https://www.googleapis.com/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method().toUpperCase();
      const authHeader = req.headers()['authorization'] ?? '';
      const userKey: 'acct1' | 'acct2' = authHeader.includes('acct2') ? 'acct2' : activeAccount;

      if (url.pathname === '/drive/v3/about') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: accountProfiles[userKey] }),
        });
        return;
      }

      if (url.pathname.startsWith('/upload/drive/v3/files')) {
        const ct = req.headers()['content-type'] ?? '';
        const boundary = ct.split('boundary=')[1]?.trim() ?? '';
        const rawBody = req.postData() ?? '';
        const parts = rawBody.split(`--${boundary}`).filter((p) => p.includes('\r\n\r\n'));
        const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim()) as {
          name: string;
          mimeType: string;
          parents?: string[];
          appProperties?: Record<string, string>;
        };
        const payloadText = parts[1].split('\r\n\r\n')[1].trim();
        const existingIdMatch = url.pathname.match(/\/upload\/drive\/v3\/files\/([^/]+)$/);
        const fileId = existingIdMatch ? decodeURIComponent(existingIdMatch[1]) : `drive-file-${nextId++}`;
        const existing = files.get(fileId);
        const record: MockDriveFile = {
          id: fileId,
          name: meta.name,
          mimeType: meta.mimeType ?? 'application/json',
          parents: meta.parents ?? existing?.parents ?? ['appDataFolder'],
          appProperties: meta.appProperties ?? existing?.appProperties ?? {},
          modifiedTime: new Date().toISOString(),
          content: payloadText,
        };
        files.set(fileId, record);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(record),
        });
        return;
      }

      if (url.pathname === '/drive/v3/files' && method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}') as {
          name: string;
          mimeType: string;
          parents?: string[];
          appProperties?: Record<string, string>;
        };
        const id = `drive-folder-${nextId++}`;
        const folder: MockDriveFile = {
          id,
          name: body.name,
          mimeType: body.mimeType,
          parents: body.parents ?? ['appDataFolder'],
          appProperties: body.appProperties ?? {},
          modifiedTime: new Date().toISOString(),
        };
        files.set(id, folder);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(folder),
        });
        return;
      }

      if (url.pathname === '/drive/v3/files' && method === 'GET') {
        driveListSpaces.push(url.searchParams.get('spaces') ?? '');
        const q = url.searchParams.get('q') ?? '';
        const list = Array.from(files.values()).filter((f) => {
          if (q.includes('application/vnd.google-apps.folder') && f.mimeType !== 'application/vnd.google-apps.folder') {
            return false;
          }
          const parentMatch = q.match(/'([^']+)' in parents/);
          if (parentMatch && !f.parents.includes(parentMatch[1])) return false;
          const propMatches = Array.from(
            q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g),
          );
          for (const m of propMatches) {
            if (f.appProperties[m[1]] !== m[2]) return false;
          }
          return true;
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: list }),
        });
        return;
      }

      const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
      if (fileMatch) {
        const id = decodeURIComponent(fileMatch[1]);
        const found = files.get(id);
        if (!found) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Not Found' } }),
          });
          return;
        }
        if (url.searchParams.get('alt') === 'media') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: found.content ?? '{}',
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(found),
        });
        return;
      }

      await route.fulfill({ status: 400, body: '{}' });
    });
  }

  return {
    files,
    getGisScriptRequests: () => gisScriptRequests,
    getRevokedTokens: () => revokedTokens,
    getDriveListSpaces: () => driveListSpaces,
    setActiveAccount: (a: 'acct1' | 'acct2') => {
      activeAccount = a;
    },
    installOnContext,
  };
}

test.describe('Personal Google Drive Encrypted Vault Sync E2E', () => {
  test('lazy-loads GIS only on click with drive.appdata scope, encrypts all Drive uploads client-side, restores on Device 2 with passphrase, isolates account switches, and preserves local data on disconnect/revoke', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const mockGoogle = createSharedMockGoogleEnvironment();

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    await mockGoogle.installOnContext(context1);
    await mockGoogle.installOnContext(context2);

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const unexpectedExternalRequests: string[] = [];
    const pageErrors: string[] = [];

    for (const p of [page1, page2]) {
      p.on('pageerror', (e) => pageErrors.push(e.message));
      p.on('request', (req) => {
        const u = new URL(req.url());
        if (
          u.protocol !== 'blob:' &&
          u.protocol !== 'data:' &&
          u.hostname !== '127.0.0.1' &&
          u.hostname !== 'localhost' &&
          u.hostname !== 'accounts.google.com' &&
          u.hostname !== 'www.googleapis.com' &&
          u.hostname !== 'oauth2.googleapis.com'
        ) {
          unexpectedExternalRequests.push(req.url());
        }
      });
    }

    try {
      // 1. At rest on /storage: GIS MUST NOT be loaded until user clicks connect
      await page1.goto('/storage');
      await dismissCookieBannerIfVisible(page1);
      await expect(page1.getByTestId('storage-provider-google-drive')).toBeVisible();
      expect(mockGoogle.getGisScriptRequests()).toBe(0);

      // 2. Connect Google Account on Device 1 -> lazy-loads GIS and keeps token strictly in memory
      await page1.getByTestId('drive-connect-btn').click();
      await expect(page1.getByTestId('drive-account-label')).toContainText('Yomi Artist');
      await expect(page1.getByTestId('drive-scope-badge')).toBeVisible();
      await expect(page1.getByTestId('drive-scope-badge')).toContainText('drive.appdata');
      expect(mockGoogle.getGisScriptRequests()).toBe(1);

      const webStorageText = await page1.evaluate(() =>
        JSON.stringify({ ls: localStorage, ss: sessionStorage }),
      );
      expect(webStorageText).not.toContain('mock-oauth-token');

      // 3. Unlock / Initialize encrypted Vault & create a signed artwork on Device 1 in Simple Mode (preserving RAM-only session)
      await page1.getByTestId('drive-passphrase-input').fill('vault-passphrase-2026');
      await page1.getByTestId('drive-unlock-btn').click();
      await expect(page1.getByTestId('drive-unlocked-panel')).toBeVisible();

      await navigateSpaToCreate(page1);
      const artPath = testInfo.outputPath('drive-sync-art.png');
      fs.writeFileSync(artPath, buildSamplePng());
      await page1.getByTestId('create-image-input').setInputFiles(artPath);
      await page1.getByTestId('create-author-input').fill('DriveSecretArtist');
      await page1.getByTestId('create-title-input').fill('DriveSecretMasterpiece');
      const dlPromise = page1.waitForEvent('download');
      await page1.getByTestId('create-sign-button').click();
      await dlPromise;
      await expect(page1.getByTestId('create-result-section')).toBeVisible();

      // Return to /storage via SPA link & sync to Personal Google Drive (appDataFolder)
      await navigateSpaToStorage(page1);
      await expect(page1.getByTestId('drive-cross-device-counts')).toContainText('Author IDs: 1');
      await expect(page1.getByTestId('drive-sync-now-btn')).toBeVisible();
      await page1.getByTestId('drive-sync-now-btn').click();
      await expect(page1.getByTestId('drive-status-msg')).toBeVisible();

      // Verify all Drive queries used spaces=appDataFolder and never touched root Drive
      expect(mockGoogle.getDriveListSpaces().length).toBeGreaterThan(0);
      expect(mockGoogle.getDriveListSpaces().every((s) => s.includes('appDataFolder'))).toBe(true);

      // Inspect every stored file on Google Drive: opaque names & ciphertext-only JSON (NO plaintext titles/names/tokens/pixels)
      expect(mockGoogle.files.size).toBeGreaterThanOrEqual(4);
      for (const file of mockGoogle.files.values()) {
        expect(file.parents).not.toContain('root');
        if (file.mimeType === 'application/vnd.google-apps.folder') continue;
        expect(file.name).not.toContain('DriveSecretMasterpiece');
        expect(file.name).not.toContain('DriveSecretArtist');
        expect(file.content).toBeTruthy();
        expect(file.content).not.toContain('DriveSecretMasterpiece');
        expect(file.content).not.toContain('DriveSecretArtist');
        expect(file.content).not.toContain('mock-oauth-token');
        const parsed = JSON.parse(file.content!);
        expect(['chm-vault-keyring-v1', 'chm-vault-aead-v1']).toContain(parsed.format);
      }

      // 4. Device 2 (fresh browser context): connecting Google alone does NOT expose proofs; wrong passphrase fails; right passphrase restores
      await page2.goto('/storage');
      await dismissCookieBannerIfVisible(page2);
      await page2.getByTestId('drive-connect-btn').click();
      await expect(page2.getByTestId('drive-account-label')).toContainText('Yomi Artist');
      await expect(page2.getByTestId('drive-unlock-form')).toBeVisible();
      await expect(page2.getByTestId('vault-total-count')).toHaveText('0');

      await page2.getByTestId('drive-passphrase-input').fill('wrong-vault-passphrase');
      await page2.getByTestId('drive-unlock-btn').click();
      await expect(page2.getByTestId('drive-error-msg')).toBeVisible();

      await page2.getByTestId('drive-passphrase-input').fill('vault-passphrase-2026');
      await page2.getByTestId('drive-unlock-btn').click();
      await expect(page2.getByTestId('drive-unlocked-panel')).toBeVisible();
      await page2.getByTestId('drive-sync-now-btn').click();
      await expect(page2.getByTestId('drive-status-msg')).toBeVisible();
      await expect(page2.getByTestId('drive-cross-device-counts')).toContainText('Trusted: 1');
      await expect(page2.getByTestId('drive-cross-device-counts')).toContainText('Author IDs: 0');
      await expect(page2.getByTestId('vault-total-count')).toHaveText('1');
      await expect(page2.getByTestId('vault-proof-item').first()).toContainText(
        'DriveSecretMasterpiece',
      );

      // 5. Switch Google account on Device 1 -> isolates session & clears prior unlocked keyring
      mockGoogle.setActiveAccount('acct2');
      await page1.getByTestId('drive-switch-account-btn').click();
      await expect(page1.getByTestId('drive-account-label')).toContainText('Alt Persona');
      await expect(page1.getByTestId('drive-unlock-form')).toBeVisible();

      // 6. Revoke & Disconnect on Device 1 -> revokes OAuth token & preserves all local Vault proofs
      await page1.getByTestId('drive-revoke-btn').click();
      await expect(page1.getByTestId('drive-connect-btn')).toBeVisible();
      expect(mockGoogle.getRevokedTokens()).toContain('mock-oauth-token-acct2');
      await expect(page1.getByTestId('vault-total-count')).toHaveText('1');

      // 7. Full reload on Device 2 proves OAuth token is never persisted across page reloads while local Vault persists
      await page2.reload();
      await expect(page2.getByTestId('drive-connect-btn')).toBeVisible();
      await expect(page2.getByTestId('vault-total-count')).toHaveText('1');

      expect(pageErrors).toEqual([]);
      expect(unexpectedExternalRequests).toEqual([]);
    } finally {
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
    }
  });
});
