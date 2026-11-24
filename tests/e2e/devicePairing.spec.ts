import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { encode as cborEncode } from 'cborg';
import { encode as encodePng } from 'fast-png';
import {
  base64UrlEncode,
  createSignedEnrollmentCertificate,
  createSignedPairingRequest,
  encodeEnrollmentCertificateUrl,
  encodePairingRequestUrl,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';

ed25519.hashes.sha512 = sha512;

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

test.describe('CHM Secure Device Pairing (CHM-DEVICE-PAIRING-v1) E2E', () => {
  test('multi-device QR pairing (PC -> iPhone & iPad), Japanese UX, trust & replay/tamper/expired/double-reg/malformed defenses', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const contextPC = await browser.newContext();
    const contextPhone = await browser.newContext();
    const contextTablet = await browser.newContext();
    const contextUnverified = await browser.newContext();

    const pagePC = await contextPC.newPage();
    const pagePhone = await contextPhone.newPage();
    const pageTablet = await contextTablet.newPage();
    const pageUnverified = await contextUnverified.newPage();

    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    for (const p of [pagePC, pagePhone, pageTablet, pageUnverified]) {
      p.on('console', (msg) => {
        consoleMessages.push(msg.text());
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
      p.on('request', (req) => {
        const url = new URL(req.url());
        if (
          url.protocol !== 'blob:' &&
          url.protocol !== 'data:' &&
          url.hostname !== '127.0.0.1' &&
          url.hostname !== 'localhost'
        ) {
          externalRequests.push(req.url());
        }
      });
    }

    try {
      // 1. Setup PC (Owner) identity on /keys and verify navigation link to /devices
      await pagePC.goto('/');
      await dismissCookieBannerIfVisible(pagePC);
      await pagePC.getByTestId('nav-menu-toggle').click();
      await expect(pagePC.getByTestId('menu-devices-link')).toBeVisible();
      await pagePC.keyboard.press('Escape');

      await pagePC.goto('/keys');
      await pagePC.getByTestId('keygen-label').fill('YomiPlush');
      await pagePC.getByTestId('keygen-submit').click();
      await expect(pagePC.getByTestId('author-key-card')).toHaveCount(1);
      await pagePC.getByTestId('keys-manage-devices-link').click();
      await expect(pagePC).toHaveURL(/\/devices$/);
      await expect(pagePC.getByTestId('myid-summary-card')).toHaveCount(1);

      // 2. Scenario 1: PC -> iPhone pairing across separate browser contexts + QR PNG upload
      await pagePhone.goto('/devices');
      await dismissCookieBannerIfVisible(pagePhone);
      await pagePhone.getByTestId('pairing-device-name-input').fill('iPhone 16 Pro');
      await pagePhone.getByTestId('pairing-create-req-btn').click();
      await expect(pagePhone.getByTestId('pairing-request-qr-panel')).toBeVisible();

      const reqUrlPhone = await pagePhone.getByTestId('pairing-req-url-input').inputValue();
      expect(reqUrlPhone).toContain('/devices#pair-req=');
      assertNoPrivateKeyLeak('pairing-req-url', reqUrlPhone);

      const reqDlPromise = pagePhone.waitForEvent('download');
      await pagePhone.getByTestId('pairing-req-download-qr').click();
      const reqDl = await reqDlPromise;
      const reqQrPng = testInfo.outputPath('iphone-pair-req.png');
      await reqDl.saveAs(reqQrPng);
      expect(fs.readFileSync(reqQrPng).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      // Tampered request token rejected (Scenario 4)
      await pagePC.getByTestId('devices-tab-approve').click();
      const tamperedReqUrl =
        reqUrlPhone.slice(0, -4) + (reqUrlPhone.endsWith('AAAA') ? 'BBBB' : 'AAAA');
      await pagePC.getByTestId('pairing-req-paste-input').fill(tamperedReqUrl);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();
      await expect(pagePC.getByTestId('pairing-approve-confirm-card')).toHaveCount(0);

      // Scenario 6: Fake / all-zero & small-order public key rejected
      const fakePayloadBytes = cborEncode(
        new Map<number, unknown>([
          [1, 1],
          [2, new Uint8Array(16).fill(1)],
          [3, new Uint8Array(16).fill(2)],
          [4, new Uint8Array(32).fill(0)], // all-zero PK
          [5, 'Fake Device'],
          [6, new Map<number, unknown>([[1, 3]])],
          [7, new Uint8Array(32).fill(3)],
          [8, Math.floor(Date.now() / 1000)],
          [9, Math.floor(Date.now() / 1000) + 300],
          [10, ['device-identity']],
        ]),
      );
      const fakeEnvelope = cborEncode([1, 1, fakePayloadBytes, new Uint8Array(64).fill(9)]);
      await pagePC
        .getByTestId('pairing-req-paste-input')
        .fill(`chm-pair-req:${base64UrlEncode(fakeEnvelope)}`);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();

      const smallOrderPk = new Uint8Array(32);
      smallOrderPk[0] = 0x01; // identity curve point
      const smallOrderPayload = cborEncode(
        new Map<number, unknown>([
          [1, 1],
          [2, new Uint8Array(16).fill(4)],
          [3, new Uint8Array(16).fill(5)],
          [4, smallOrderPk],
          [5, 'SmallOrder'],
          [6, new Map<number, unknown>([[1, 3]])],
          [7, new Uint8Array(32).fill(6)],
          [8, Math.floor(Date.now() / 1000)],
          [9, Math.floor(Date.now() / 1000) + 300],
          [10, ['device-identity']],
        ]),
      );
      const smallOrderEnvelope = cborEncode([1, 1, smallOrderPayload, new Uint8Array(64).fill(9)]);
      await pagePC
        .getByTestId('pairing-req-paste-input')
        .fill(`chm-pair-req:${base64UrlEncode(smallOrderEnvelope)}`);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();

      // Scenario 16: Malformed / unknown-version / oversized QR payload rejected
      await pagePC.getByTestId('pairing-req-paste-input').fill('not-a-valid-pairing-token');
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();

      const unknownVerEnvelope = cborEncode([99, 1, fakePayloadBytes, new Uint8Array(64).fill(9)]);
      await pagePC
        .getByTestId('pairing-req-paste-input')
        .fill(`chm-pair-req:${base64UrlEncode(unknownVerEnvelope)}`);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();

      await pagePC
        .getByTestId('pairing-req-paste-input')
        .fill(`chm-pair-req:${'A'.repeat(4500)}`);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toBeVisible();

      // Now upload real iPhone request QR PNG on PC and confirm explicit approval dialog
      await pagePC.getByTestId('pairing-req-upload-input').setInputFiles(reqQrPng);
      await expect(pagePC.getByTestId('pairing-approve-confirm-card')).toBeVisible();
      await expect(pagePC.getByTestId('pairing-approve-confirm-card')).toContainText('iPhone 16 Pro');
      await expect(pagePC.getByTestId('pairing-approve-confirm-card')).toContainText('YomiPlush');
      await expect(pagePC.getByTestId('pairing-approve-confirm-btn')).toBeVisible();

      await pagePC.getByTestId('pairing-approve-confirm-btn').click();
      await expect(pagePC.getByTestId('pairing-approval-qr-panel')).toBeVisible();

      const certUrlPhone = await pagePC.getByTestId('pairing-cert-url-output').inputValue();
      expect(certUrlPhone).toContain('/devices#pair-cert=');
      assertNoPrivateKeyLeak('pairing-cert-url', certUrlPhone);

      const certDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('pairing-cert-download-qr').click();
      const certDl = await certDlPromise;
      const certQrPng = testInfo.outputPath('iphone-approval-cert.png');
      await certDl.saveAs(certQrPng);

      // Scenario 5: Tampered enrollment certificate rejected on Phone
      const tamperedCertUrl =
        certUrlPhone.slice(0, -4) + (certUrlPhone.endsWith('AAAA') ? 'BBBB' : 'AAAA');
      await pagePhone.getByTestId('pairing-cert-text-input').fill(tamperedCertUrl);
      await pagePhone.getByTestId('pairing-cert-inspect-btn').click();
      await expect(pagePhone.getByTestId('pairing-step2-error')).toBeVisible();
      await expect(pagePhone.getByTestId('pairing-cert-preview')).toHaveCount(0);

      // Phone inspects real approval QR PNG, checks explicit owner confirmation, completes registration
      await pagePhone.getByTestId('pairing-cert-file-input').setInputFiles(certQrPng);
      await expect(pagePhone.getByTestId('pairing-cert-preview')).toBeVisible();
      await expect(pagePhone.getByTestId('pairing-confirm-owner-checkbox')).not.toBeChecked();
      await pagePhone.getByTestId('pairing-confirm-owner-checkbox').check();
      await pagePhone.getByTestId('pairing-complete-btn').click();

      await expect(pagePhone.getByTestId('pairing-completed-banner')).toBeVisible();
      await pagePhone.getByTestId('devices-tab-registry').click();
      await expect(pagePhone.getByTestId('paired-device-card')).toHaveCount(1);
      await expect(pagePhone.getByTestId('paired-device-status').first()).toContainText(
        'Active · Verified Owner',
      );

      // Scenario 9: QR replay rejected EVEN when browser clock is rolled back!
      await pagePC.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        w.__origDateNow = Date.now;
        const past = Date.now() - 120_000;
        Date.now = () => past;
      });
      await pagePC.getByTestId('devices-tab-approve').click();
      await pagePC.getByTestId('pairing-req-paste-input').fill(reqUrlPhone);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toContainText(/Replay/i);
      await pagePC.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        if (w.__origDateNow) Date.now = w.__origDateNow;
      });

      await pagePhone.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        w.__origDateNow = Date.now;
        const past = Date.now() - 120_000;
        Date.now = () => past;
      });
      await pagePhone.getByTestId('devices-tab-add').click();
      await pagePhone.getByTestId('pairing-cert-text-input').fill(certUrlPhone);
      await pagePhone.getByTestId('pairing-cert-inspect-btn').click();
      await expect(pagePhone.getByTestId('pairing-step2-error')).toBeVisible();
      await pagePhone.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        if (w.__origDateNow) Date.now = w.__origDateNow;
      });

      // Scenario 10: Double registration prevented cleanly when already paired device issues a new request
      await pagePhone.getByTestId('pairing-create-req-btn').click();
      const secondReqPhone = await pagePhone.getByTestId('pairing-req-url-input').inputValue();
      await pagePC.getByTestId('pairing-req-paste-input').fill(secondReqPhone);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toContainText(/Double-registration/i);

      // Cancel Phone's unused second request
      await pagePhone.getByTestId('pairing-cancel-req-btn').click();
      await expect(pagePhone.getByTestId('pairing-request-qr-panel')).toHaveCount(0);

      // Scenario 2: Pair iPad as second device using Japanese UI!
      await pagePC.getByTestId('lang-select').selectOption('ja');
      await pageTablet.goto('/devices');
      await dismissCookieBannerIfVisible(pageTablet);
      await pageTablet.getByTestId('lang-select').selectOption('ja');
      await pageTablet.getByTestId('pairing-device-name-input').fill('iPad Pro');
      await pageTablet.getByTestId('pairing-create-req-btn').click();
      const reqUrlTablet = await pageTablet.getByTestId('pairing-req-url-input').inputValue();

      await pagePC.getByTestId('pairing-req-paste-input').fill(reqUrlTablet);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-confirm-card')).toContainText(
        '「iPad Pro」をあなたのデバイスとして登録しますか？',
      );
      await pagePC.getByTestId('pairing-approve-confirm-btn').click();
      const certUrlTablet = await pagePC.getByTestId('pairing-cert-url-output').inputValue();

      await pageTablet.getByTestId('pairing-cert-text-input').fill(certUrlTablet);
      await pageTablet.getByTestId('pairing-cert-inspect-btn').click();
      await pageTablet.getByTestId('pairing-confirm-owner-checkbox').check();
      await pageTablet.getByTestId('pairing-complete-btn').click();
      await expect(pageTablet.getByTestId('pairing-completed-banner')).toContainText('登録が完了しました');

      await pagePC.getByTestId('devices-tab-registry').click();
      await expect(pagePC.getByTestId('paired-device-card')).toHaveCount(2);

      // Scenario 13: Reload preserves paired devices in IndexedDB
      await pagePC.reload();
      await pagePC.getByTestId('devices-tab-registry').click();
      await expect(pagePC.getByTestId('paired-device-card')).toHaveCount(2);

      // Scenario 7a: Untrusted Owner ID is NEVER auto-trusted when confirmation checkbox is unchecked
      await pageUnverified.goto('/devices');
      await dismissCookieBannerIfVisible(pageUnverified);
      await pageUnverified.getByTestId('pairing-device-name-input').fill('Sketchpad Unverified');
      await pageUnverified.getByTestId('pairing-create-req-btn').click();
      const reqUnverified = await pageUnverified.getByTestId('pairing-req-url-input').inputValue();

      // Switch PC back to en for deterministic labels
      await pagePC.getByTestId('lang-select').selectOption('en');
      await pagePC.getByTestId('devices-tab-approve').click();
      await pagePC.getByTestId('pairing-req-paste-input').fill(reqUnverified);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await pagePC.getByTestId('pairing-approve-confirm-btn').click();
      const certUnverified = await pagePC.getByTestId('pairing-cert-url-output').inputValue();

      await pageUnverified.getByTestId('pairing-cert-text-input').fill(certUnverified);
      await pageUnverified.getByTestId('pairing-cert-inspect-btn').click();
      // Do NOT check pairing-confirm-owner-checkbox!
      await expect(pageUnverified.getByTestId('pairing-confirm-owner-checkbox')).not.toBeChecked();
      await pageUnverified.getByTestId('pairing-complete-btn').click();
      await pageUnverified.getByTestId('devices-tab-registry').click();
      await expect(pageUnverified.getByTestId('paired-device-status').first()).toContainText(
        'Active · Owner Unconfirmed',
      );
      // Explicit later confirmation promotes to Active · Verified Owner
      await pageUnverified.getByTestId('confirm-paired-owner-btn').click();
      await expect(pageUnverified.getByTestId('paired-device-status').first()).toContainText(
        'Active · Verified Owner',
      );

      // Scenario 7b & 8: Cross-owner cert substitution rejected & Expired pairing request rejected
      const otherOwnerSeed = hexToBytes(
        '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      );
      const otherOwnerPub = ed25519.getPublicKey(otherOwnerSeed);
      const devSeed = hexToBytes(
        '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
      );
      const devPub = ed25519.getPublicKey(devSeed);
      const pinnedReq = await createSignedPairingRequest({
        deviceId: new Uint8Array(16).fill(0x22),
        devicePublicKey: devPub,
        deviceDisplayName: 'Pinned Device',
        ownerPublicKey: otherOwnerPub,
        signWithDeviceKey: (msg) => ed25519.sign(msg, devSeed),
      });
      const pinnedReqUrl = encodePairingRequestUrl(pinnedReq, 'http://127.0.0.1:4173/devices');

      // Inspecting request pinned to a DIFFERENT Owner ID on PC must throw cross-owner error
      await pagePC.getByTestId('pairing-req-paste-input').fill(pinnedReqUrl);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toContainText(/different.*Owner/i);

      // Scenario 8: Expired request rejected when clock advances past 5-minute TTL
      const freshReq = await createSignedPairingRequest({
        deviceId: new Uint8Array(16).fill(0x33),
        devicePublicKey: devPub,
        deviceDisplayName: 'Expiring Tablet',
        signWithDeviceKey: (msg) => ed25519.sign(msg, devSeed),
      });
      await pagePC.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        w.__origDateNow = Date.now;
        const future = Date.now() + 10 * 60 * 1000;
        Date.now = () => future;
      });
      await pagePC
        .getByTestId('pairing-req-paste-input')
        .fill(encodePairingRequestUrl(freshReq, 'http://127.0.0.1:4173/devices'));
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await expect(pagePC.getByTestId('pairing-approve-error')).toContainText(/expired/i);
      await pagePC.evaluate(() => {
        const w = window as unknown as { __origDateNow?: () => number };
        if (w.__origDateNow) Date.now = w.__origDateNow;
      });

      // Cross-owner cert substitution on Phone against pending session:
      await pagePhone.getByTestId('devices-tab-add').click();
      await pagePhone.getByTestId('pairing-create-req-btn').click();
      await expect(pagePhone.getByTestId('pairing-request-qr-panel')).toBeVisible();
      // Create a mismatch cert signed by otherOwnerSeed for different request
      const mismatchCert = await createSignedEnrollmentCertificate({
        request: pinnedReq,
        ownerPublicKey: otherOwnerPub,
        ownerDisplayName: 'Attacker Owner',
        signWithOwnerKey: (msg) => ed25519.sign(msg, otherOwnerSeed),
      });
      await pagePhone
        .getByTestId('pairing-cert-text-input')
        .fill(encodeEnrollmentCertificateUrl(mismatchCert, 'http://127.0.0.1:4173/devices'));
      await pagePhone.getByTestId('pairing-cert-inspect-btn').click();
      await expect(pagePhone.getByTestId('pairing-step2-error')).toBeVisible();

      // Check zero private key strings logged to console
      assertNoPrivateKeyLeak('browser-console', consoleMessages.join('\n'));
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      await contextPC.close();
      await contextPhone.close();
      await contextTablet.close();
      await contextUnverified.close();
    }
  });

  test('revocation confirmation + QR propagation, stale backup monotonicity, corrupt IndexedDB quarantine, and camera-denied fallback', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const contextPC = await browser.newContext();
    const contextPhone = await browser.newContext();

    // Scenario 15: Stub camera permission denial on Phone
    await contextPhone.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException('Camera access denied', 'NotAllowedError');
          },
        },
      });
    });

    const pagePC = await contextPC.newPage();
    const pagePhone = await contextPhone.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    for (const p of [pagePC, pagePhone]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
    }

    try {
      // Quick-create Owner Identity on PC directly inside /devices
      await pagePC.goto('/devices');
      await dismissCookieBannerIfVisible(pagePC);
      await pagePC.getByTestId('pairing-quick-myid-name').fill('YomiPlush Main');
      await pagePC.getByTestId('pairing-quick-myid-submit').click();
      await expect(pagePC.getByTestId('myid-summary-card')).toHaveCount(1);

      // Pair Phone
      await pagePhone.goto('/devices');
      await dismissCookieBannerIfVisible(pagePhone);
      await pagePhone.getByTestId('pairing-device-name-input').fill('Lost Phone');
      await pagePhone.getByTestId('pairing-create-req-btn').click();
      const reqUrl = await pagePhone.getByTestId('pairing-req-url-input').inputValue();

      await pagePC.getByTestId('devices-tab-approve').click();
      await pagePC.getByTestId('pairing-req-paste-input').fill(reqUrl);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await pagePC.getByTestId('pairing-approve-confirm-btn').click();

      const certDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('pairing-cert-download-qr').click();
      const certDl = await certDlPromise;
      const certQrPath = testInfo.outputPath('cam-denied-cert.png');
      await certDl.saveAs(certQrPath);

      // Trigger camera-denied fallback UI on Phone, then upload QR PNG instead!
      await pagePhone.getByTestId('chmx-camera-start').first().click();
      await expect(pagePhone.locator('.chmx-banner-error').first()).toContainText(
        /Camera unavailable/i,
      );
      await pagePhone.getByTestId('pairing-cert-file-input').setInputFiles(certQrPath);
      await pagePhone.getByTestId('pairing-confirm-owner-checkbox').check();
      await pagePhone.getByTestId('pairing-complete-btn').click();
      await expect(pagePhone.getByTestId('pairing-completed-banner')).toBeVisible();

      // Export PRE-REVOCATION signed registry backup (.chdevreg.json & .chdevreg.cbor)
      await pagePC.getByTestId('devices-tab-registry').click();
      const jsonDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('export-registry-json-btn').click();
      const jsonDl = await jsonDlPromise;
      const staleJsonPath = testInfo.outputPath('pre-revoke-registry.chdevreg.json');
      await jsonDl.saveAs(staleJsonPath);
      const staleJsonRaw = fs.readFileSync(staleJsonPath, 'utf8');
      assertNoPrivateKeyLeak('exported-registry-json', staleJsonRaw);

      const cborDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('export-registry-cbor-btn').click();
      const cborDl = await cborDlPromise;
      const cborPath = testInfo.outputPath('pre-revoke-registry.chdevreg.cbor');
      await cborDl.saveAs(cborPath);
      expect(fs.readFileSync(cborPath).byteLength).toBeGreaterThan(32);

      // Scenario 11: Revoke Phone with confirmation UI and generate signed revocation QR
      await pagePC.getByTestId('revoke-device-open-btn').click();
      await expect(pagePC.getByTestId('revoke-confirm-panel')).toBeVisible();
      await pagePC.getByTestId('revoke-reason-select').selectOption('lost-device');
      await pagePC.getByTestId('revoke-confirm-submit-btn').click();

      await expect(pagePC.getByTestId('paired-device-status').first()).toContainText('Revoked');
      await expect(pagePC.getByTestId('revocation-qr-panel')).toBeVisible();

      const revDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('pairing-rev-download-qr').click();
      const revDl = await revDlPromise;
      const revQrPng = testInfo.outputPath('lost-phone-revocation.png');
      await revDl.saveAs(revQrPng);

      // Scenario 12: Re-import stale pre-revocation backup on PC -> revocation MUST NOT roll back!
      await pagePC.getByTestId('import-registry-file-input').setInputFiles(staleJsonPath);
      await expect(pagePC.getByTestId('registry-action-msg')).toContainText(
        'Preserved local revocations: 1',
      );
      await expect(pagePC.getByTestId('paired-device-status').first()).toContainText('Revoked');

      // Import revocation QR PNG on Phone -> Phone marks local device revoked & blocks new pairing requests!
      await pagePhone.getByTestId('devices-tab-registry').click();
      await pagePhone.getByTestId('pairing-rev-file-input').setInputFiles(revQrPng);
      await expect(pagePhone.getByTestId('pairing-rev-import-msg')).toBeVisible();
      await pagePhone.getByTestId('devices-tab-add').click();
      await expect(pagePhone.getByTestId('device-revoked-alert')).toBeVisible();
      await expect(pagePhone.getByTestId('pairing-create-req-btn')).toBeDisabled();

      // Reload Phone to verify revocation persistence across reload (Scenario 13)
      await pagePhone.reload();
      await expect(pagePhone.getByTestId('device-revoked-alert')).toBeVisible();

      // Scenario 14: Inject corrupt IndexedDB record -> quarantined with warning, never shown as trusted
      await pagePC.evaluate(async () => {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('certified-handmade-store');
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['pairedDevices', 'deviceIdentities'], 'readwrite');
            tx.objectStore('pairedDevices').put({
              key: 'corrupt-owner:corrupt-device',
              deviceName: 'Injected Fake Device',
              localVerificationStatus: 'active-trusted',
            });
            tx.objectStore('deviceIdentities').put({
              deviceIdHex: 'bad-id',
              deviceName: 'Corrupt Identity',
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      });

      await pagePC.reload();
      await expect(pagePC.getByTestId('pairing-corruption-warning')).toBeVisible();
      await expect(pagePC.getByTestId('pairing-corruption-warning')).toContainText(
        'corrupt-owner:corrupt-device',
      );
      await pagePC.getByTestId('devices-tab-registry').click();
      await expect(pagePC.getByTestId('paired-device-card')).toHaveCount(1);
      await expect(pagePC.getByTestId('paired-device-card').first()).not.toContainText(
        'Injected Fake Device',
      );

      // Clean up corrupt entries via UI buttons deterministically
      const clearBtns = pagePC.getByTestId('clear-corrupt-record-btn');
      let remaining = await clearBtns.count();
      while (remaining > 0) {
        await clearBtns.first().click();
        await expect(clearBtns).toHaveCount(remaining - 1);
        remaining -= 1;
      }
      await expect(pagePC.getByTestId('pairing-corruption-warning')).toHaveCount(0);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await pagePC.close().catch(() => {});
      await pagePhone.close().catch(() => {});
      await contextPC.close();
      await contextPhone.close();
    }
  });

  test('offline pairing via Service Worker + existing artwork signing v1/v2 & /verify regression + dist/devices.html', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(60_000);
    const contextPC = await browser.newContext();
    const contextTablet = await browser.newContext();

    const pagePC = await contextPC.newPage();
    const pageTablet = await contextTablet.newPage();
    const externalRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    for (const p of [pagePC, pageTablet]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
      p.on('request', (req) => {
        const url = new URL(req.url());
        if (
          url.protocol !== 'blob:' &&
          url.protocol !== 'data:' &&
          url.hostname !== '127.0.0.1' &&
          url.hostname !== 'localhost'
        ) {
          externalRequests.push(req.url());
        }
      });
    }

    try {
      // Warm up SW cache on both browser contexts
      await pagePC.goto('/devices');
      await dismissCookieBannerIfVisible(pagePC);
      await pagePC.evaluate(async () => {
        if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
      });
      await pagePC.waitForTimeout(600);

      await pageTablet.goto('/devices');
      await dismissCookieBannerIfVisible(pageTablet);
      await pageTablet.evaluate(async () => {
        if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
      });
      await pageTablet.waitForTimeout(600);

      // Go 100% OFFLINE in both contexts
      await contextPC.setOffline(true);
      await contextTablet.setOffline(true);

      await pagePC.getByTestId('pairing-quick-myid-name').fill('Offline Studio');
      await pagePC.getByTestId('pairing-quick-myid-submit').click();
      await expect(pagePC.getByTestId('myid-summary-card')).toHaveCount(1);

      await pageTablet.getByTestId('pairing-device-name-input').fill('Offline Tablet');
      await pageTablet.getByTestId('pairing-create-req-btn').click();
      const reqUrl = await pageTablet.getByTestId('pairing-req-url-input').inputValue();

      await pagePC.getByTestId('devices-tab-approve').click();
      await pagePC.getByTestId('pairing-req-paste-input').fill(reqUrl);
      await pagePC.getByTestId('pairing-req-inspect-btn').click();
      await pagePC.getByTestId('pairing-approve-confirm-btn').click();
      const certUrl = await pagePC.getByTestId('pairing-cert-url-output').inputValue();

      await pageTablet.getByTestId('pairing-cert-text-input').fill(certUrl);
      await pageTablet.getByTestId('pairing-cert-inspect-btn').click();
      await pageTablet.getByTestId('pairing-confirm-owner-checkbox').check();
      await pageTablet.getByTestId('pairing-complete-btn').click();
      await expect(pageTablet.getByTestId('pairing-completed-banner')).toBeVisible();

      // Scenario 18: Verify existing v1/v2 artwork signing & /verify flow still works cleanly
      await contextPC.setOffline(false);
      await contextTablet.setOffline(false);

      const artPath = testInfo.outputPath('pairing-regression-art.png');
      fs.writeFileSync(artPath, buildSampleArtworkPng());
      await pagePC.goto('/create');
      await pagePC.getByTestId('create-image-input').setInputFiles(artPath);
      await pagePC.locator('[data-testid="create-identity-advanced"] > button').click();
      await pagePC.getByTestId('create-title-input').fill('Post-Pairing Artwork');
      const signedDlPromise = pagePC.waitForEvent('download');
      await pagePC.getByTestId('create-sign-button').click();
      const signedDl = await signedDlPromise;
      const signedPng = testInfo.outputPath('post-pairing-signed.png');
      await signedDl.saveAs(signedPng);

      await pagePC.goto('/verify');
      await pagePC.getByTestId('verify-image-input').setInputFiles(signedPng);
      await expect(pagePC.getByTestId('status-signature')).toContainText('Valid');
      await expect(pagePC.getByTestId('status-integrity')).toContainText('Matched');
      await expect(pagePC.getByTestId('status-identity')).toContainText('Unverified');

      await pagePC.getByTestId('verify-trust-label-input').fill('Offline Studio');
      await pagePC.getByTestId('verify-trust-confirm-checkbox').check();
      await pagePC.getByTestId('verify-trust-btn').click();
      await expect(pagePC.getByTestId('status-identity')).toContainText('Trusted (Offline Studio)');

      // Verify static SEO shell dist/devices.html exists
      const devicesHtmlPath = path.resolve(process.cwd(), 'dist', 'devices.html');
      expect(fs.existsSync(devicesHtmlPath)).toBe(true);
      expect(fs.readFileSync(devicesHtmlPath, 'utf8')).toContain(
        '<link rel="canonical" href="https://certified-handmade.com/devices" />',
      );

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      await contextPC.close();
      await contextTablet.close();
    }
  });

  test('pairs 4+ devices under one Owner ID, renders 3+ My IDs, supports same-filename QR uploads, hash validation & separate device ID regeneration', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(150_000);
    const contextOwner = await browser.newContext();
    const devContexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pageOwner = await contextOwner.newPage();
    const devPages = await Promise.all(devContexts.map((c) => c.newPage()));
    const deviceNames = ['Device 1 Phone', 'Device 2 iPad', 'Device 3 Android', 'Device 4 SubPC'];

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    for (const p of [pageOwner, ...devPages]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
    }

    try {
      // 1. Create 4 Owner IDs on /keys -> verify ALL 4 appear on /devices (no 2-item truncation!)
      await pageOwner.goto('/keys');
      await dismissCookieBannerIfVisible(pageOwner);
      for (const label of ['Owner Alpha', 'Owner Beta', 'Owner Gamma', 'Owner Delta']) {
        await pageOwner.getByTestId('keygen-label').fill(label);
        await pageOwner.getByTestId('keygen-submit').click();
      }
      await expect(pageOwner.getByTestId('author-key-card')).toHaveCount(4);
      await pageOwner.getByTestId('keys-manage-devices-link').click();
      await expect(pageOwner).toHaveURL(/\/devices$/);
      await expect(pageOwner.getByTestId('myid-summary-card')).toHaveCount(4);

      const sharedReqQrPath = testInfo.outputPath('shared-request-qr.png');
      const sharedCertQrPath = testInfo.outputPath('shared-approval-qr.png');

      // 2. Pair all 4 distinct devices, always reusing the EXACT SAME QR image filename!
      await pageOwner.getByTestId('devices-tab-approve').click();
      for (let i = 0; i < devPages.length; i++) {
        const dp = devPages[i];
        await dp.goto('/devices');
        await dismissCookieBannerIfVisible(dp);
        await dp.getByTestId('pairing-device-name-input').fill(deviceNames[i]);
        await dp.getByTestId('pairing-create-req-btn').click();
        await expect(dp.getByTestId('pairing-request-qr-panel')).toBeVisible();

        const dlReqPromise = dp.waitForEvent('download');
        await dp.getByTestId('pairing-req-download-qr').click();
        const dlReq = await dlReqPromise;
        await dlReq.saveAs(sharedReqQrPath);

        if (i > 0) {
          // Use the explicit clear button to start approving the next device cleanly
          const nextBtn = pageOwner.getByTestId('pairing-approve-next-btn');
          if (await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click();
          }
        }

        // Upload using identical filename across iterations (proves input.value reset works)
        await pageOwner.getByTestId('pairing-req-upload-input').setInputFiles(sharedReqQrPath);
        await expect(pageOwner.getByTestId('pairing-approve-confirm-card')).toContainText(deviceNames[i]);
        await pageOwner.getByTestId('pairing-approve-confirm-btn').click();
        await expect(pageOwner.getByTestId('pairing-approval-qr-panel')).toBeVisible();

        const dlCertPromise = pageOwner.waitForEvent('download');
        await pageOwner.getByTestId('pairing-cert-download-qr').click();
        const dlCert = await dlCertPromise;
        await dlCert.saveAs(sharedCertQrPath);

        await dp.getByTestId('pairing-cert-file-input').setInputFiles(sharedCertQrPath);
        await expect(dp.getByTestId('pairing-cert-preview')).toBeVisible();
        await dp.getByTestId('pairing-confirm-owner-checkbox').check();
        await dp.getByTestId('pairing-complete-btn').click();
        await expect(dp.getByTestId('pairing-completed-banner')).toBeVisible();
      }

      // 3. Verify Owner registry shows all 4 paired devices before & after reload
      await pageOwner.getByTestId('devices-tab-registry').click();
      await expect(pageOwner.getByTestId('paired-device-card')).toHaveCount(4);
      await pageOwner.reload();
      await pageOwner.getByTestId('devices-tab-registry').click();
      await expect(pageOwner.getByTestId('paired-device-card')).toHaveCount(4);
      for (const name of deviceNames) {
        await expect(pageOwner.locator('[data-testid="paired-device-card"]', { hasText: name })).toHaveCount(1);
      }

      // 4. Export signed registry backup with 4 devices & verify another browser imports all 4 monotonically
      const regDlPromise = pageOwner.waitForEvent('download');
      await pageOwner.getByTestId('export-registry-json-btn').click();
      const regDl = await regDlPromise;
      const regPath = testInfo.outputPath('four-devices.chdevreg.json');
      await regDl.saveAs(regPath);

      await devPages[0].getByTestId('devices-tab-registry').click();
      await devPages[0].getByTestId('import-registry-file-input').setInputFiles(regPath);
      await expect(devPages[0].getByTestId('registry-action-msg')).toBeVisible();
      await expect(devPages[0].getByTestId('paired-device-card')).toHaveCount(4);

      // 5. Already-paired browser shows clear guidance + regenerate button; hash route blocks double-reg
      await devPages[0].getByTestId('devices-tab-add').click();
      await expect(devPages[0].getByTestId('local-device-paired-badge')).toBeVisible();
      await expect(devPages[0].getByTestId('pairing-already-paired-note')).toBeVisible();
      await expect(devPages[0].getByTestId('device-regenerate-btn')).toBeVisible();

      // Same identity request opened via #pair-req= hash must enforce double-registration block
      await devPages[0].getByTestId('pairing-create-req-btn').click();
      const dupReqUrl = await devPages[0].getByTestId('pairing-req-url-input').inputValue();
      const dupHash = new URL(dupReqUrl).hash;
      await pageOwner.goto(`/devices${dupHash}`);
      await expect(pageOwner.getByTestId('pairing-approve-error')).toContainText(/Double-registration/i);
      await devPages[0].getByTestId('pairing-cancel-req-btn').click();

      // Regenerating a separate Device Identity on devPages[0] allows enrolling a 5th identity cleanly
      await devPages[0].getByTestId('device-regenerate-btn').click();
      await devPages[0].getByTestId('pairing-device-name-input').fill('Device 5 Separate Profile');
      await devPages[0].getByTestId('pairing-create-req-btn').click();
      const fifthReqUrl = await devPages[0].getByTestId('pairing-req-url-input').inputValue();

      await pageOwner.getByTestId('devices-tab-approve').click();
      await pageOwner.getByTestId('pairing-req-paste-input').fill(fifthReqUrl);
      await pageOwner.getByTestId('pairing-req-inspect-btn').click();
      await pageOwner.getByTestId('pairing-approve-confirm-btn').click();
      const fifthCertUrl = await pageOwner.getByTestId('pairing-cert-url-output').inputValue();

      await devPages[0].getByTestId('pairing-cert-text-input').fill(fifthCertUrl);
      await devPages[0].getByTestId('pairing-cert-inspect-btn').click();
      await expect(devPages[0].getByTestId('pairing-cert-preview')).toBeVisible();
      // Owner Delta is already locally trusted on devPages[0] from Device 1 pairing
      await expect(devPages[0].getByTestId('pairing-confirm-owner-checkbox')).toHaveCount(0);
      await devPages[0].getByTestId('pairing-complete-btn').click();
      await expect(devPages[0].getByTestId('pairing-completed-banner')).toBeVisible();

      await pageOwner.getByTestId('devices-tab-registry').click();
      await expect(pageOwner.getByTestId('paired-device-card')).toHaveCount(5);

      // 6. Verify mobile viewport has no horizontal overflow
      await pageOwner.setViewportSize({ width: 375, height: 812 });
      const overflowPx = await pageOwner.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflowPx).toBeLessThanOrEqual(1);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await contextOwner.close();
      await Promise.all(devContexts.map((c) => c.close()));
    }
  });
});
