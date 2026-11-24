import type { SupportedLocale } from '../core/storage/consent';

export interface DevicePairingTranslations {
  navItem: string;
  title: string;
  subtitle: string;
  helpLabel: string;
  helpTitle: string;
  helpPoints: [string, string, string, string];
  myIdSectionTitle: string;
  myIdEmptyDesc: string;
  goToKeysBackupBtn: string;
  quickCreateIdLabel: string;
  quickCreateIdPlaceholder: string;
  quickCreateIdPassPlaceholder: string;
  quickCreateIdBtn: string;
  thisDeviceTitle: string;
  thisDeviceRevokedAlert: string;
  regenerateDeviceIdBtn: string;
  createSeparateDeviceIdBtn: string;
  alreadyPairedBadge: string;
  alreadyPairedUnderOwnersLabel: string;
  alreadyPairedStep1Note: string;
  approveNextDeviceBtn: string;
  addDeviceTab: string;
  approveDeviceTab: string;
  registryTab: string;
  // Step 1: New device
  step1Heading: string;
  step1Desc: string;
  deviceNameLabel: string;
  deviceNamePlaceholder: string;
  devicePassLabel: string;
  devicePassPlaceholder: string;
  generateRequestQrBtn: string;
  cancelRequestBtn: string;
  requestQrTitle: string;
  requestExpiresIn: string;
  requestExpiredBadge: string;
  downloadQrPngBtn: string;
  copyUrlBtn: string;
  copiedMsg: string;
  // Step 2 on new device
  step2NewHeading: string;
  step2NewDesc: string;
  scanCameraBtn: string;
  stopCameraBtn: string;
  cameraHint: string;
  cameraDeniedFallbackMsg: string;
  uploadQrImageLabel: string;
  pasteInputLabel: string;
  pasteInputPlaceholder: string;
  verifyCertBtn: string;
  confirmOwnerCheckbox: string;
  completePairingBtn: string;
  pairingCompletedTitle: string;
  pairingCompletedDesc: string;
  ownerUnverifiedWarning: string;
  ownerConfirmedBadge: string;
  // Step 2 on existing owner device
  approveHeading: string;
  approveDesc: string;
  selectOwnerIdLabel: string;
  ownerPassphraseLabel: string;
  ownerPassphrasePlaceholder: string;
  confirmDialogTitlePrefix: string;
  confirmDialogTitleSuffix: string;
  confirmDeviceNameLabel: string;
  confirmOwnerIdLabel: string;
  confirmPermissionLabel: string;
  confirmPermissionValue: string;
  confirmApproveBtn: string;
  confirmCancelBtn: string;
  approvalQrReadyTitle: string;
  approvalQrReadyDesc: string;
  // Device list & revocation
  registeredDevicesTitle: string;
  noDevicesYet: string;
  offlineSyncWarning: string;
  statusActiveTrusted: string;
  statusActiveUnverified: string;
  statusRevoked: string;
  statusConflict: string;
  confirmOwnerNowBtn: string;
  revokeDeviceBtn: string;
  revokeConfirmTitle: string;
  revokeReasonLabel: string;
  revokeReasons: {
    'lost-device': string;
    'device-compromised': string;
    retired: string;
    other: string;
  };
  revokeNoteLabel: string;
  revokeNotePlaceholder: string;
  revokeConfirmSubmitBtn: string;
  revocationQrTitle: string;
  revocationQrDesc: string;
  importRevocationTitle: string;
  importRevocationBtn: string;
  revocationImportedMsg: string;
  // Registry backup export/import
  backupExportTitle: string;
  backupExportDesc: string;
  exportRegistryJsonBtn: string;
  exportRegistryCborBtn: string;
  importRegistryFileLabel: string;
  importRegistrySuccess: string;
  // Technical details & warnings
  technicalDetailsSummary: string;
  detailPublicKey: string;
  detailFingerprintShort: string;
  detailFingerprintFull: string;
  detailDeviceId: string;
  detailProtocol: string;
  detailStorageMode: string;
  detailIssuedAt: string;
  noRootKeyCopyNote: string;
  corruptRecordWarningTitle: string;
  clearCorruptRecordBtn: string;
  keysPageManageDevicesBtn: string;
  exchangePagePairingLink: string;
  docsPairingTitle: string;
  docsPairingBody: string;
}

const JA_DEVICE_PAIRING: DevicePairingTranslations = {
  navItem: '登録済みデバイス',
  title: 'デバイス連携・登録',
  subtitle: 'PC・スマホ・タブレットをサーバーなしで安全にマイIDへ結びつけます。',
  helpLabel: 'デバイス連携の仕組み（？）',
  helpTitle: '安全なデバイス連携について',
  helpPoints: [
    'サーバーやアカウント登録は一切使わず、オフラインでもQRコード2回だけで端末を結びつけられます。',
    '新しい端末には専用の鍵だけを新しく作り、大切なマイIDの秘密鍵はコピーしません。',
    'カメラが使えない環境でも、QR画像のアップロードやテキストの貼り付けで登録・解除できます。',
    '登録した端末を紛失したときは、「この端末を解除」から解除用QRやファイルを作成できます。',
  ],
  myIdSectionTitle: 'マイID（所有者ID）',
  myIdEmptyDesc: '新しい端末を承認するには、先にメイン端末でマイIDを作成またはバックアップ復元してください。',
  goToKeysBackupBtn: 'マイID作成・バックアップへ',
  quickCreateIdLabel: '新しくマイIDを作る（ペンネーム）',
  quickCreateIdPlaceholder: '例：YomiPlush',
  quickCreateIdPassPlaceholder: 'バックアップ用パスフレーズ（任意・8文字以上）',
  quickCreateIdBtn: 'マイIDを作成',
  thisDeviceTitle: 'この端末（デバイス）',
  thisDeviceRevokedAlert: 'この端末の鍵は解除（失効）されているため、そのままでは再登録できません。必要な場合は新しいデバイスIDを作り直してください。',
  regenerateDeviceIdBtn: '新しいデバイスIDを作り直す',
  createSeparateDeviceIdBtn: '別のデバイスIDを新しく作成',
  alreadyPairedBadge: '登録済み',
  alreadyPairedUnderOwnersLabel: '連携先のマイID',
  alreadyPairedStep1Note:
    'このブラウザはすでに登録済みです。3台目以降の別端末を追加する場合は、その端末のブラウザでこのページを開いてQRを作成してください。（同じブラウザで別の端末IDを新しく作り直したい場合のみ、上の「この端末」欄から新しいデバイスIDを作成できます）',
  approveNextDeviceBtn: '次の端末を承認する（表示をクリア）',
  addDeviceTab: 'デバイスを追加（新端末）',
  approveDeviceTab: 'QRを読み取って承認（既存端末）',
  registryTab: '登録済みデバイス・バックアップ',
  step1Heading: 'ステップ 1：この端末の登録QRを表示する',
  step1Desc: 'パソコンやタブレットなど、すでにマイIDがある端末でこのQRコードを読み取ってください。',
  deviceNameLabel: 'この端末の名前',
  deviceNamePlaceholder: '例：iPhone / iPad / サブPC',
  devicePassLabel: '端末保護パスフレーズ（対応外ブラウザのみ必須）',
  devicePassPlaceholder: '必要な場合のみ入力（8文字以上）',
  generateRequestQrBtn: '登録用QRコードを作成',
  cancelRequestBtn: 'このリクエストをキャンセル',
  requestQrTitle: '新しい端末の登録リクエストQR',
  requestExpiresIn: '有効期限（残り時間）',
  requestExpiredBadge: '期限切れ（作り直してください）',
  downloadQrPngBtn: 'QR画像を保存 (PNG)',
  copyUrlBtn: 'リンク / コードをコピー',
  copiedMsg: 'コピーしました',
  step2NewHeading: 'ステップ 2：既存端末の承認QRを読み取る',
  step2NewDesc: '既存端末で「承認する」を押した後に表示される承認QRコードをここで読み込みます。',
  scanCameraBtn: 'カメラでQRコードを読み取る',
  stopCameraBtn: 'カメラを停止',
  cameraHint: 'カメラで承認QRコードまたは解除QRコードを映してください。',
  cameraDeniedFallbackMsg: 'カメラを利用できませんでした。下の「QR画像を選ぶ」または「リンク・コードを貼り付け」をご利用ください。',
  uploadQrImageLabel: 'カメラが使えない場合：QR画像ファイル（PNG/JPEG/WebP）から読み込む',
  pasteInputLabel: 'またはリンク・コードを貼り付け',
  pasteInputPlaceholder: '承認QRのURL、画像読み取り文字、またはトークンを貼り付け',
  verifyCertBtn: '承認内容を確認',
  confirmOwnerCheckbox: '既存端末に表示されているマイIDと同じであることを確認しました',
  completePairingBtn: '登録を完了する',
  pairingCompletedTitle: '登録が完了しました',
  pairingCompletedDesc: 'この端末はあなたのマイIDに正常に結びつけられました。',
  ownerUnverifiedWarning: 'まだこの端末側で「マイID本人確認」が完了していません。既存端末のIDと見比べて問題なければ確認ボタンを押してください。',
  ownerConfirmedBadge: 'マイID本人確認済み',
  approveHeading: '新しい端末を承認する（既存端末）',
  approveDesc: '新しい端末に表示されたQRコードを読み取り、内容を確認してから承認してください。QRを読み取っただけで自動登録されることはありません。',
  selectOwnerIdLabel: '使用するマイID',
  ownerPassphraseLabel: 'マイIDのパスフレーズ（設定している場合）',
  ownerPassphrasePlaceholder: '暗号化バックアップのパスフレーズ',
  confirmDialogTitlePrefix: '「',
  confirmDialogTitleSuffix: '」をあなたのデバイスとして登録しますか？',
  confirmDeviceNameLabel: 'デバイス名',
  confirmOwnerIdLabel: '登録先のマイID',
  confirmPermissionLabel: '登録先の権限',
  confirmPermissionValue: '端末の識別のみ（作品の代理署名・他端末の承認はできません）',
  confirmApproveBtn: '承認する',
  confirmCancelBtn: 'キャンセル',
  approvalQrReadyTitle: '承認QRコードができました',
  approvalQrReadyDesc: '新しい端末の「ステップ 2」でこのQRコードを読み取ると登録が完了します。',
  registeredDevicesTitle: '登録済みデバイス',
  noDevicesYet: 'まだ登録されているデバイスはありません。',
  offlineSyncWarning: 'サーバーを持たない設計のため、登録一覧や解除状態は他の端末へ自動同期されません。他端末にも反映したい場合は、下の解除QRまたはバックアップファイルを取り込んでください。なお、オフライン環境では他端末で解除済みかどうかを自動判定できないため、この表示だけで「どこでも解除されていない」と保証することはできません。',
  statusActiveTrusted: '有効・確認済み',
  statusActiveUnverified: '有効（マイID未確認）',
  statusRevoked: '解除済み（失効）',
  statusConflict: '競合・要注意（自動停止）',
  confirmOwnerNowBtn: 'マイIDを本人確認して有効化',
  revokeDeviceBtn: 'この端末を解除',
  revokeConfirmTitle: 'この端末を本当に解除しますか？',
  revokeReasonLabel: '解除の理由',
  revokeReasons: {
    'lost-device': '端末を紛失した',
    'device-compromised': '第三者に使われた可能性がある',
    retired: '機種変更・使わなくなった',
    other: 'その他',
  },
  revokeNoteLabel: 'メモ（任意）',
  revokeNotePlaceholder: '例：2026年11月 スマホ買い替え',
  revokeConfirmSubmitBtn: '署名付きで解除を実行する',
  revocationQrTitle: '端末の解除通知（他の端末へ共有）',
  revocationQrDesc: 'この端末が記録されました。オフラインの別端末にも解除を伝えるには、このQRまたはファイルを別端末で読み込んでください。',
  importRevocationTitle: '別の端末で作った解除通知を取り込む',
  importRevocationBtn: '解除通知を取り込む',
  revocationImportedMsg: '解除通知を検証し、ローカル登録簿を更新しました。',
  backupExportTitle: 'デバイス一覧・解除記録のバックアップ',
  backupExportDesc: '登録済みデバイス一覧と解除情報を署名付きファイルとして保存・読み込みできます。古い一覧を読み込んでも、一度解除した端末は復活しません。',
  exportRegistryJsonBtn: 'JSONバックアップを保存 (.chdevreg.json)',
  exportRegistryCborBtn: 'CBORバックアップを保存 (.chdevreg.cbor)',
  importRegistryFileLabel: 'バックアップファイル（.chdevreg.json / .chdevreg.cbor）を読み込む',
  importRegistrySuccess: '署名付きデバイス一覧ファイルを検証し、安全に統合しました。',
  technicalDetailsSummary: '詳細（公開情報・プロトコル確認）',
  detailPublicKey: '公開鍵',
  detailFingerprintShort: '識別コード（短縮）',
  detailFingerprintFull: 'SHA-256 フィンガープリント',
  detailDeviceId: 'デバイスID',
  detailProtocol: 'プロトコル',
  detailStorageMode: '鍵の保管方式',
  detailIssuedAt: '発行・記録時刻',
  noRootKeyCopyNote: 'v1では端末鍵だけで作品の代理署名はできません。作品への署名にはマイID本体（または暗号化バックアップ復元）を使います。',
  corruptRecordWarningTitle: '壊れたローカルデータが見つかりました（安全のため自動無効化）',
  clearCorruptRecordBtn: '壊れたレコードを削除',
  keysPageManageDevicesBtn: 'デバイスを追加・管理',
  exchangePagePairingLink: '自分のスマホ・タブレットを登録する場合は「登録済みデバイス」へ',
  docsPairingTitle: 'CHM Secure Device Pairing（CHM-DEVICE-PAIRING-v1）',
  docsPairingBody: 'サーバー・クラウドDB・アカウント登録を一切使わずに、PC・スマホ・タブレットを同じマイIDへ紐づける2段階QRプロトコルです。各端末で独立したEd25519デバイス鍵（Web Crypto non-extractable優先）を生成し、ルート秘密鍵は一切コピーしません。登録要求・承認証明書・端末解除通知・デバイス登録簿バックアップ（.chdevreg.json / .chdevreg.cbor）は決定的RFC 8949 CBOR＋ドメイン分離Ed25519署名で保護され、v1では端末鍵単体による作品の代理署名および他端末への委任承認を厳格に禁止しています。',
};

const EN_DEVICE_PAIRING: DevicePairingTranslations = {
  navItem: 'Paired Devices',
  title: 'Device Pairing & Management',
  subtitle: 'Link your PC, smartphone, and tablet to your CHM Identity locally and offline with no central server.',
  helpLabel: 'How Device Pairing Works (?)',
  helpTitle: 'About Secure Device Pairing',
  helpPoints: [
    'Works 100% serverless and offline via a 2-step QR handshake—no accounts, relays, or cloud storage.',
    'Each device generates its own dedicated Ed25519 device key; your root author private key is never copied.',
    'If camera access is unavailable, you can upload QR PNG/JPEG/WebP images or paste tokens/URLs.',
    'If you lose a device, generate a signed revocation notice QR/file to disable it locally across devices.',
  ],
  myIdSectionTitle: 'My ID (CHM Owner Identity)',
  myIdEmptyDesc: 'To approve a new device, create or restore a CHM Identity first.',
  goToKeysBackupBtn: 'Go to Keys & Backup',
  quickCreateIdLabel: 'Quick-Create My ID (Artist Name)',
  quickCreateIdPlaceholder: 'e.g. YomiPlush',
  quickCreateIdPassPlaceholder: 'Backup passphrase (optional, 8+ chars)',
  quickCreateIdBtn: 'Create My ID',
  thisDeviceTitle: 'This Device',
  thisDeviceRevokedAlert: 'This local device key has been revoked and cannot be re-used. Generate a new Device Identity if you intentionally want to re-enroll.',
  regenerateDeviceIdBtn: 'Generate New Device Identity',
  createSeparateDeviceIdBtn: 'Generate New Separate Device ID',
  alreadyPairedBadge: 'Paired',
  alreadyPairedUnderOwnersLabel: 'Linked to My ID',
  alreadyPairedStep1Note:
    'This browser is already registered. To add a 3rd+ device, open this page on that new device’s browser to create its pairing QR. (If you intentionally need a separate Device ID in this browser, generate a new one in the “This Device” card above.)',
  approveNextDeviceBtn: 'Approve Another Device (Clear)',
  addDeviceTab: 'Add This Device (New)',
  approveDeviceTab: 'Approve a Device (Existing)',
  registryTab: 'Paired Devices & Backup',
  step1Heading: 'Step 1: Show This Device’s Pairing QR',
  step1Desc: 'Scan this QR code with an existing device (such as your PC) that already holds your CHM Identity.',
  deviceNameLabel: 'Device Display Name',
  deviceNamePlaceholder: 'e.g. iPhone / iPad / Studio PC',
  devicePassLabel: 'Device Key Passphrase (only needed on fallback browsers)',
  devicePassPlaceholder: 'Required only if browser lacks Web Crypto Ed25519 (8+ chars)',
  generateRequestQrBtn: 'Create Pairing QR Code',
  cancelRequestBtn: 'Cancel Request',
  requestQrTitle: 'New Device Pairing Request QR',
  requestExpiresIn: 'Expires in',
  requestExpiredBadge: 'Expired (create a new QR)',
  downloadQrPngBtn: 'Save QR Image (PNG)',
  copyUrlBtn: 'Copy Link / Code',
  copiedMsg: 'Copied',
  step2NewHeading: 'Step 2: Scan Approval QR from Existing Device',
  step2NewDesc: 'After tapping Approve on your existing device, scan or import the Approval QR code shown there.',
  scanCameraBtn: 'Scan QR with Camera',
  stopCameraBtn: 'Stop Camera',
  cameraHint: 'Point your camera at the Approval QR or Revocation QR.',
  cameraDeniedFallbackMsg: 'Camera unavailable. Please upload a QR image or paste the approval link/code below.',
  uploadQrImageLabel: 'No camera? Upload QR image file (PNG/JPEG/WebP)',
  pasteInputLabel: 'Or paste approval URL / code',
  pasteInputPlaceholder: 'Paste approval URL (#pair-cert=...) or token',
  verifyCertBtn: 'Inspect Approval',
  confirmOwnerCheckbox: 'I verified this Owner ID matches the one displayed on my existing device',
  completePairingBtn: 'Complete Registration',
  pairingCompletedTitle: 'Registration Complete',
  pairingCompletedDesc: 'This device is now paired to your CHM Identity.',
  ownerUnverifiedWarning: 'This Owner ID has not been confirmed yet on this device. Compare it with your existing device and confirm trust.',
  ownerConfirmedBadge: 'Owner Confirmed',
  approveHeading: 'Approve a New Device (Existing Device)',
  approveDesc: 'Scan the new device’s QR code, inspect its details, and explicitly confirm before signing.',
  selectOwnerIdLabel: 'Select My ID',
  ownerPassphraseLabel: 'Key Passphrase (if encrypted fallback)',
  ownerPassphrasePlaceholder: 'Enter passphrase to unlock My ID',
  confirmDialogTitlePrefix: 'Register "',
  confirmDialogTitleSuffix: '" as your device?',
  confirmDeviceNameLabel: 'Device Name',
  confirmOwnerIdLabel: 'Owner CHM Identity',
  confirmPermissionLabel: 'Granted Permissions',
  confirmPermissionValue: 'Device identity only (cannot sign artworks or approve other devices)',
  confirmApproveBtn: 'Approve',
  confirmCancelBtn: 'Cancel',
  approvalQrReadyTitle: 'Approval QR Ready',
  approvalQrReadyDesc: 'Scan this QR code in Step 2 on the new device to finish pairing.',
  registeredDevicesTitle: 'Paired Devices',
  noDevicesYet: 'No paired devices recorded on this browser yet.',
  offlineSyncWarning: 'Because there is no central server, device lists and revocations do NOT sync automatically across devices. Share the revocation QR or export/import a signed registry backup to update other devices. An offline device cannot prove a key is unrevoked elsewhere.',
  statusActiveTrusted: 'Active · Verified Owner',
  statusActiveUnverified: 'Active · Owner Unconfirmed',
  statusRevoked: 'Revoked',
  statusConflict: 'Conflict (Disabled)',
  confirmOwnerNowBtn: 'Confirm Owner Identity',
  revokeDeviceBtn: 'Remove / Revoke This Device',
  revokeConfirmTitle: 'Revoke this device permanently?',
  revokeReasonLabel: 'Reason',
  revokeReasons: {
    'lost-device': 'Lost device',
    'device-compromised': 'Possible compromise',
    retired: 'Retired / replaced',
    other: 'Other',
  },
  revokeNoteLabel: 'Note (optional)',
  revokeNotePlaceholder: 'e.g. Replaced phone Nov 2026',
  revokeConfirmSubmitBtn: 'Generate Signed Revocation',
  revocationQrTitle: 'Signed Revocation Notice (Share to Other Devices)',
  revocationQrDesc: 'Recorded locally. Scan or import this QR/token on your other devices to propagate the revocation offline.',
  importRevocationTitle: 'Import Revocation Notice from Another Device',
  importRevocationBtn: 'Import Revocation',
  revocationImportedMsg: 'Verified revocation notice and updated local device registry.',
  backupExportTitle: 'Signed Device Registry Backup',
  backupExportDesc: 'Export or import your paired device list and revocations as signed files. Re-importing stale snapshots never rolls back known revocations.',
  exportRegistryJsonBtn: 'Export JSON (.chdevreg.json)',
  exportRegistryCborBtn: 'Export CBOR (.chdevreg.cbor)',
  importRegistryFileLabel: 'Import signed backup (.chdevreg.json / .chdevreg.cbor)',
  importRegistrySuccess: 'Verified signed device registry and reconciled monotonically.',
  technicalDetailsSummary: 'Details (Public Keys, Fingerprints & Protocol)',
  detailPublicKey: 'Public Key',
  detailFingerprintShort: 'Short Fingerprint',
  detailFingerprintFull: 'SHA-256 Fingerprint',
  detailDeviceId: 'Device ID',
  detailProtocol: 'Protocol',
  detailStorageMode: 'Key Custody',
  detailIssuedAt: 'Issued At',
  noRootKeyCopyNote: 'In v1, paired devices cannot sign artworks on behalf of your root author key. Keep using your root key (or encrypted .chkey.json backup) to sign artworks.',
  corruptRecordWarningTitle: 'Corrupt local storage records detected and quarantined',
  clearCorruptRecordBtn: 'Delete Corrupt Entry',
  keysPageManageDevicesBtn: 'Add & Manage Devices',
  exchangePagePairingLink: 'Pairing your own phone/tablet? Open Paired Devices',
  docsPairingTitle: 'CHM Secure Device Pairing (CHM-DEVICE-PAIRING-v1)',
  docsPairingBody: 'A 100% serverless, offline 2-step QR protocol that pairs PCs, smartphones, and tablets to a CHM Identity without accounts, relays, or copying root private keys. Each device generates its own Ed25519 keypair (Web Crypto non-extractable preferred) and receives an owner-signed deterministic RFC 8949 CBOR enrollment certificate, with signed revocations and monotonic registry backups (.chdevreg.json / .chdevreg.cbor). In v1, paired device keys hold device-identity scope only—delegated artwork signing and delegated approvals are prohibited.',
};

const EXTRA_NAV_LABELS: Record<Exclude<SupportedLocale, 'en' | 'ja'>, string> = {
  'zh-CN': '已配对设备',
  'zh-TW': '已配對裝置',
  ko: '등록된 기기',
  ru: 'Мои устройства',
  uk: 'Мої пристрої',
  es: 'Dispositivos',
  fr: 'Appareils',
  de: 'Geräte',
  pt: 'Dispositivos',
  it: 'Dispositivi',
  ar: 'الأجهزة المقترنة',
};

export const DEVICE_PAIRING_I18N: Record<SupportedLocale, DevicePairingTranslations> = {
  en: EN_DEVICE_PAIRING,
  ja: JA_DEVICE_PAIRING,
  'zh-CN': { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS['zh-CN'] },
  'zh-TW': { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS['zh-TW'] },
  ko: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ko },
  ru: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ru },
  uk: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.uk },
  es: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.es },
  fr: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.fr },
  de: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.de },
  pt: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.pt },
  it: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.it },
  ar: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ar },
};
