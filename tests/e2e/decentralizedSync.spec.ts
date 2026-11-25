import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { encode as encodePng } from 'fast-png';
import { MockNostrRelay } from '../helpers/mockNostrRelay';

function buildSampleArtworkPng(width = 160, height = 120): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 5 + y * 11) & 0xff;
      data[i + 2] = (x * 13 + y) & 0xff;
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

function assertNoPrivateKeyLeak(label: string, text: string): void {
  const forbidden = [
    'privateKey',
    'webCryptoPrivateKey',
    'encryptedBackup',
    'ciphertext',
    'pkcs8',
    'seed32',
    'nsec1',
  ];
  for (const key of forbidden) {
    expect(text, `${label} leaked ${key}`).not.toContain(key);
  }
}

async function dismissCookieBannerIfVisible(page: import('@playwright/test').Page): Promise<void> {
  const rejectBtn = page.getByTestId('cookie-reject-btn');
  if (await rejectBtn.isVisible().catch(() => false)) {
    await rejectBtn.click();
  }
}

async function removeAllRelaysSequentially(page: import('@playwright/test').Page): Promise<void> {
  let count = await page.getByTestId('sync-relay-remove-btn').count();
  while (count > 0) {
    await page.getByTestId('sync-relay-remove-btn').first().click();
    await expect(page.getByTestId('sync-relay-remove-btn')).toHaveCount(count - 1);
    count -= 1;
  }
}

test.describe('Zero-Cost Decentralized Device Auth Sync & Strict Nostr Isolation E2E', () => {
  test('enforces zero traffic at rest, Vault local storage/JSON backup/restore, paid relay blocking & strict auth-only Nostr sync (never copies proofs over Nostr)', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);

    const freeRelay = new MockNostrRelay({ tls: true, requireAuth: false });
    const paidRelay = new MockNostrRelay({
      tls: true,
      nip11Document: {
        name: 'Paid Mock Relay',
        payments_url: 'https://paid.local/subscribe',
        limitation: { payment_required: true },
      },
    });
    const freeUrl = await freeRelay.start();
    const paidUrl = await paidRelay.start();

    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const externalRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    for (const p of [page1, page2]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
      p.on('request', (req) => {
        const u = new URL(req.url());
        if (
          u.protocol !== 'blob:' &&
          u.protocol !== 'data:' &&
          u.hostname !== '127.0.0.1' &&
          u.hostname !== 'localhost'
        ) {
          externalRequests.push(req.url());
        }
      });
    }

    try {
      // 1. At rest: zero external network connections & Vault starts empty
      await page1.goto('/vault');
      await dismissCookieBannerIfVisible(page1);
      await expect(page1.getByTestId('vault-empty-state')).toBeVisible();
      expect(externalRequests).toEqual([]);
      expect(freeRelay.getActiveClientCount()).toBe(0);

      // 2. Create author key & sign artwork -> automatically appears in local Proof Vault
      await page1.goto('/keys');
      await dismissCookieBannerIfVisible(page1);
      await page1.getByTestId('keygen-label').fill('ZeroCost Artist');
      await page1.getByTestId('keygen-submit').click();
      await expect(page1.getByTestId('author-key-card')).toHaveCount(1);

      await page1.goto('/create');
      const pngPath = testInfo.outputPath('sample-art.png');
      fs.writeFileSync(pngPath, buildSampleArtworkPng(160, 120));
      await page1.getByTestId('create-image-input').setInputFiles(pngPath);
      await page1.getByTestId('create-title-input').fill('Vault E2E Piece');
      const dlPromise = page1.waitForEvent('download');
      await page1.getByTestId('create-sign-button').click();
      await dlPromise;
      await expect(page1.getByTestId('create-result-section')).toBeVisible();

      // Verify Vault page records it compactly & supports JSON export/delete/restore
      await page1.goto('/vault');
      await expect(page1.getByTestId('vault-total-count')).toHaveText('1');
      await expect(page1.getByTestId('vault-proof-item')).toHaveCount(1);
      await expect(page1.getByTestId('vault-proof-item').first()).toContainText('Vault E2E Piece');

      const vaultJsonDlPromise = page1.waitForEvent('download');
      await page1.getByTestId('vault-export-json-btn').click();
      const vaultJsonDl = await vaultJsonDlPromise;
      const backupPath = testInfo.outputPath('vault-backup.json');
      await vaultJsonDl.saveAs(backupPath);
      const backupText = fs.readFileSync(backupPath, 'utf8');
      expect(backupText).toContain('"containsPrivateKeys": false');
      assertNoPrivateKeyLeak('vault-backup.json', backupText);

      // Toggle sync checkbox on the proof item
      const toggleCheckbox = page1.locator('[data-testid^="vault-sync-toggle-"]').first();
      await toggleCheckbox.check();
      await expect(page1.getByTestId('vault-sync-count')).toHaveText('1');

      // Delete & restore backup JSON
      await page1.locator('[data-testid^="vault-delete-"]').first().click();
      await expect(page1.getByTestId('vault-total-count')).toHaveText('0');
      await page1.getByTestId('vault-import-file-input').setInputFiles(backupPath);
      await expect(page1.getByTestId('vault-backup-msg')).toBeVisible();
      await expect(page1.getByTestId('vault-total-count')).toHaveText('1');
      await page1.locator('[data-testid^="vault-sync-toggle-"]').first().check();
      await expect(page1.getByTestId('vault-sync-count')).toHaveText('1');

      // 3. Pair Device 2 offline & test Opt-In Device Auth Sync + Free NIP-11 Policy + Paid Relay Block
      await page2.goto('/devices');
      await dismissCookieBannerIfVisible(page2);
      await page2.getByTestId('pairing-device-name-input').fill('Studio iPad');
      await page2.getByTestId('pairing-create-req-btn').click();
      const reqUrl2 = await page2.getByTestId('pairing-req-url-input').inputValue();

      await page1.goto('/devices');
      await page1.getByTestId('devices-tab-approve').click();
      await page1.getByTestId('pairing-req-paste-input').fill(reqUrl2);
      await page1.getByTestId('pairing-req-inspect-btn').click();
      await expect(page1.getByTestId('pairing-approve-confirm-card')).toBeVisible();
      await page1.getByTestId('pairing-approve-confirm-btn').click();
      const approvalUrl = await page1.getByTestId('pairing-cert-url-output').inputValue();

      await page2.getByTestId('pairing-cert-text-input').fill(approvalUrl);
      await page2.getByTestId('pairing-cert-inspect-btn').click();
      await page2.getByTestId('pairing-confirm-owner-checkbox').check();
      await page2.getByTestId('pairing-complete-btn').click();
      await expect(page2.getByTestId('pairing-completed-banner')).toBeVisible();

      // Enable Sync on Page 1 with local TLS free relay (remove external preset relays cleanly)
      await page1.getByTestId('devices-tab-sync').click();
      await expect(page1.getByTestId('nostr-auth-only-notice')).toBeVisible();
      await expect(page1.getByTestId('sync-vault-proofs-btn')).toHaveCount(0);
      await expect(page1.getByTestId('sync-enable-btn')).toBeDisabled();
      await page1.getByTestId('sync-consent-checkbox').check();
      await page1.getByTestId('sync-enable-btn').click();
      await expect(page1.getByTestId('sync-relay-list')).toBeVisible();

      await removeAllRelaysSequentially(page1);
      await page1.getByTestId('sync-relay-add-input').fill(freeUrl);
      await page1.getByTestId('sync-relay-add-btn').click();
      await expect(page1.getByTestId('sync-relay-list')).toContainText(freeUrl);

      // Verify free NIP-11 check works and paid relay is automatically rejected
      await page1.getByTestId('sync-relay-probe-btn').first().click();
      await expect(page1.getByTestId('sync-relay-policy-badge').first()).toBeVisible();

      await page1.getByTestId('sync-relay-add-input').fill(paidUrl);
      await page1.getByTestId('sync-relay-add-btn').click();
      await expect(page1.getByTestId('sync-relay-error')).toBeVisible();

      const peerCard1 = await page1.getByTestId('sync-peer-card-output').inputValue();
      assertNoPrivateKeyLeak('peerCard1', peerCard1);

      // Enable Sync on Page 2 using only local free TLS relay & link peer cards
      await page2.getByTestId('devices-tab-sync').click();
      await page2.getByTestId('sync-consent-checkbox').check();
      await page2.getByTestId('sync-enable-btn').click();
      await expect(page2.getByTestId('sync-relay-list')).toBeVisible();
      await removeAllRelaysSequentially(page2);
      await page2.getByTestId('sync-relay-add-input').fill(freeUrl);
      await page2.getByTestId('sync-relay-add-btn').click();
      await expect(page2.getByTestId('sync-relay-list')).toContainText(freeUrl);

      const peerCard2 = await page2.getByTestId('sync-peer-card-output').inputValue();
      await page2.getByTestId('sync-peer-import-input').fill(peerCard1);
      await page2.getByTestId('sync-peer-import-btn').click();
      await expect(page2.getByTestId('sync-peer-import-msg')).toBeVisible();

      await page1.getByTestId('sync-peer-import-input').fill(peerCard2);
      await page1.getByTestId('sync-peer-import-btn').click();
      await expect(page1.getByTestId('sync-peer-import-msg')).toBeVisible();

      // Sync device auth logs between Device 1 and Device 2 -> verify artwork proofs do NOT sync over Nostr
      await page1.getByTestId('sync-now-btn').click();
      await expect(page1.getByTestId('sync-now-btn')).toBeEnabled();
      await expect(page1.getByTestId('sync-budget-usage')).toBeVisible();

      await page2.getByTestId('sync-now-btn').click();
      await expect(page2.getByTestId('sync-now-btn')).toBeEnabled();
      await page2.goto('/vault');
      await expect(page2.getByTestId('vault-total-count')).toHaveText('0');
      await expect(page2.getByTestId('vault-empty-state')).toBeVisible();

      expect(externalRequests).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    } finally {
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
      await freeRelay.stop().catch(() => {});
      await paidRelay.stop().catch(() => {});
    }
  });
});
