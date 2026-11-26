import type { SupportedLocale } from '../core/storage/consent';

export interface DiscordAndUxTranslations {
  webhook: {
    sectionTitle: string;
    sectionSubtitle: string;
    urlLabel: string;
    urlPlaceholder: string;
    localOnlyNotice: string;
    autoSendLabel: string;
    autoSendHint: string;
    saveBtn: string;
    testBtn: string;
    deleteBtn: string;
    savedMsg: string;
    deletedMsg: string;
    testSuccessMsg: string;
    sendingLabel: string;
    invalidUrlError: string;
    notConfiguredError: string;
    networkError: string;
    httpErrorPrefix: string;
    configureLinkLabel: string;
  };
  certifyLog: {
    sendBtn: string;
    sendingBtn: string;
    sentBadge: string;
    autoSentBadge: string;
    privacyHint: string;
    setupPrompt: string;
  };
  keyBackup: {
    sendPublicKeyBtn: string;
    sendingBtn: string;
    sentPublicKeyMsg: string;
    sendEncryptedBtn: string;
    encryptedConfirmWarning: string;
    sentEncryptedMsg: string;
  };
  identityLink: {
    sectionTitle: string;
    sectionSubtitle: string;
    keySelectLabel: string;
    discordHandleLabel: string;
    discordHandlePlaceholder: string;
    passphraseLabel: string;
    passphrasePlaceholder: string;
    signBtn: string;
    signedSuccessMsg: string;
    copyJsonBtn: string;
    downloadJsonBtn: string;
    copyLinkBtn: string;
    showQrBtn: string;
    hideQrBtn: string;
    copiedLabel: string;
    importTitle: string;
    importPlaceholder: string;
    importBtn: string;
    importSuccessMsg: string;
    invalidHandleError: string;
    invalidClaimError: string;
    verifiedBindingsTitle: string;
    removeBindingBtn: string;
    verifyBadgeTitle: string;
    verifyBadgeDesc: string;
    verifyBadgeSourceExchange: string;
    verifyBadgeSourceManifest: string;
  };
  homeUx: {
    benefitSubcopy: string;
    howItWorksTitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    demoCalloutPrefix: string;
    demoCalloutBtn: string;
  };
  keyLossAlert: {
    title: string;
    body: string;
    keysPageLink: string;
    storagePageLink: string;
    dismissBtn: string;
  };
}

const enDiscordUx: DiscordAndUxTranslations = {
  webhook: {
    sectionTitle: 'Discord Webhook Integration',
    sectionSubtitle:
      'Send certification proof logs and public key backups directly to your own private Discord channel.',
    urlLabel: 'Discord Webhook URL',
    urlPlaceholder: 'https://discord.com/api/webhooks/...',
    localOnlyNotice:
      'Note: Your Webhook URL is stored ONLY in your browser (localStorage) and is never sent to any developer server.',
    autoSendLabel: 'Automatically send proof log to Discord when certifying artwork',
    autoSendHint:
      'Only metadata and proof hash are sent — your original artwork image is never uploaded.',
    saveBtn: 'Save Webhook',
    testBtn: 'Send Test',
    deleteBtn: 'Delete',
    savedMsg: 'Discord Webhook settings saved locally.',
    deletedMsg: 'Discord Webhook URL removed from this browser.',
    testSuccessMsg: 'Test message sent to your Discord channel!',
    sendingLabel: 'Sending…',
    invalidUrlError:
      'Invalid Discord Webhook URL. It must start with https://discord.com/api/webhooks/ (or discordapp.com).',
    notConfiguredError:
      'No Discord Webhook URL is configured yet. Set it up in Storage & Sync first.',
    networkError:
      'Could not reach Discord. Check your internet connection or verify that the Webhook URL is valid.',
    httpErrorPrefix: 'Discord rejected the request',
    configureLinkLabel: 'Configure Discord Webhook',
  },
  certifyLog: {
    sendBtn: 'Send Proof Log to Discord',
    sendingBtn: 'Sending to Discord…',
    sentBadge: 'Proof log sent to Discord',
    autoSentBadge: 'Auto-sent proof log to Discord',
    privacyHint: 'Sends title, proof hash, timestamp, and key fingerprint only (no image data).',
    setupPrompt: 'Want to archive proof logs to Discord?',
  },
  keyBackup: {
    sendPublicKeyBtn: 'Send Public Key Backup to Discord',
    sendingBtn: 'Sending…',
    sentPublicKeyMsg: 'Public key backup sent to your Discord channel.',
    sendEncryptedBtn: 'Send Encrypted Key (.chkey.json) to Discord',
    encryptedConfirmWarning:
      'WARNING: You are about to send your encrypted private key backup (.chkey.json) to a Discord channel. Only proceed if this is a private channel you trust and your backup is protected with a strong passphrase. Continue?',
    sentEncryptedMsg: 'Encrypted key backup sent to your Discord channel.',
  },
  identityLink: {
    sectionTitle: 'Discord Account Link (Signed Public Key Profile)',
    sectionSubtitle:
      'Cryptographically sign your Discord username (e.g. @username) with your artist key so verifiers can confirm your Discord identity.',
    keySelectLabel: 'Artist Signing Key',
    discordHandleLabel: 'Discord Username',
    discordHandlePlaceholder: '@username',
    passphraseLabel: 'Key Passphrase (if required)',
    passphrasePlaceholder: 'Leave empty if non-extractable WebCrypto key',
    signBtn: 'Sign & Link Discord Profile',
    signedSuccessMsg: 'Signed Discord profile created and saved locally.',
    copyJsonBtn: 'Copy Signed JSON',
    downloadJsonBtn: 'Download JSON',
    copyLinkBtn: 'Copy Share Link',
    showQrBtn: 'Show QR',
    hideQrBtn: 'Hide QR',
    copiedLabel: 'Copied!',
    importTitle: 'Verify & Import Artist Discord Profile',
    importPlaceholder: 'Paste signed Discord profile JSON or share link…',
    importBtn: 'Verify & Save Binding',
    importSuccessMsg: 'Verified and saved Discord profile binding.',
    invalidHandleError: 'Please enter a valid Discord username (e.g. @username).',
    invalidClaimError: 'Invalid or tampered Discord profile signature.',
    verifiedBindingsTitle: 'Verified Discord Key Bindings',
    removeBindingBtn: 'Remove',
    verifyBadgeTitle: 'Verified Discord Account Linked',
    verifyBadgeDesc: "This artwork is linked to the signer's Discord account.",
    verifyBadgeSourceExchange: 'Verified via Signed Artist Key Exchange Profile',
    verifyBadgeSourceManifest: 'Signed inside Artwork Proof Manifest',
  },
  homeUx: {
    benefitSubcopy:
      'Prove your art is human-made, counter AI doubts, and detect tampering — free, no sign-up, 100% on your device.',
    howItWorksTitle: 'How Invisible Seal & QR Works',
    step1Title: '1. Select in Browser',
    step1Desc: 'Drop your drawing locally. Nothing is ever uploaded.',
    step2Title: '2. Stamp Seal & QR',
    step2Desc: 'Embed an invisible cryptographic signature and QR code.',
    step3Title: '3. Verify Anytime',
    step3Desc: 'Anyone can check authenticity and tampering in seconds.',
    demoCalloutPrefix: "Don't have an image handy?",
    demoCalloutBtn: 'Try Demo Verification with a Sample Artwork',
  },
  keyLossAlert: {
    title: 'Protect Your Artist Key Before You Leave',
    body: 'Clearing your browser cache will erase your signing key. Back up your key now (Local file / Google Drive / Discord) so you can always prove authorship.',
    keysPageLink: 'Open Key Management',
    storagePageLink: 'Google Drive & Discord Backup',
    dismissBtn: 'Dismiss',
  },
};

const jaDiscordUx: DiscordAndUxTranslations = {
  webhook: {
    sectionTitle: 'Discord Webhook 連携',
    sectionSubtitle:
      '作品証明の完了ログや公開鍵のバックアップを、ご自身のDiscordチャンネルへ直接送信できます。',
    urlLabel: 'Discord Webhook URL',
    urlPlaceholder: 'https://discord.com/api/webhooks/...',
    localOnlyNotice:
      '※入力されたWebhook URLはお使いのブラウザ内（localStorage）にのみ保存され、開発者サーバーには一切送信されません。',
    autoSendLabel: '作品証明の完了時に証明ログをDiscordへ自動送信する',
    autoSendHint:
      '送信されるのはタイトル・ハッシュ・タイムスタンプ・公開鍵フィンガープリントのみです（元画像データは送信されません）。',
    saveBtn: 'Webhookを保存',
    testBtn: 'テスト送信',
    deleteBtn: '削除',
    savedMsg: 'Discord Webhook設定をブラウザ内に保存しました。',
    deletedMsg: 'Discord Webhook URLをブラウザから削除しました。',
    testSuccessMsg: 'Discordチャンネルへテストメッセージを送信しました！',
    sendingLabel: '送信中…',
    invalidUrlError:
      '無効なDiscord Webhook URLです。https://discord.com/api/webhooks/ から始まるURLを入力してください。',
    notConfiguredError:
      'Discord Webhook URLが未設定です。先に「ストレージ＆同期」画面で設定してください。',
    networkError:
      'Discordへの送信に失敗しました。ネットワーク接続またはWebhook URLが有効か確認してください。',
    httpErrorPrefix: 'Discordからエラーが返されました',
    configureLinkLabel: 'Discord Webhookを設定する',
  },
  certifyLog: {
    sendBtn: '証明ログをDiscordに送信',
    sendingBtn: 'Discordへ送信中…',
    sentBadge: '証明ログをDiscordに送信しました',
    autoSentBadge: '証明ログをDiscordへ自動送信しました',
    privacyHint: 'タイトル・作品ハッシュ・署名時刻・公開鍵フィンガープリントのみ送信します（元画像は送信しません）。',
    setupPrompt: '証明ログをDiscordに保存しませんか？',
  },
  keyBackup: {
    sendPublicKeyBtn: '公開鍵をDiscordへ送信',
    sendingBtn: '送信中…',
    sentPublicKeyMsg: '公開鍵バックアップをDiscordチャンネルへ送信しました。',
    sendEncryptedBtn: '暗号化済み鍵(.chkey.json)をDiscordへ送信',
    encryptedConfirmWarning:
      '【警告】暗号化済みの秘密鍵バックアップ（.chkey.json）をDiscordチャンネルへ送信しようとしています。強力なパスフレーズで保護されており、かつ自分専用のプライベートチャンネルであることを確認した場合のみ続行してください。送信しますか？',
    sentEncryptedMsg: '暗号化済み鍵バックアップをDiscordチャンネルへ送信しました。',
  },
  identityLink: {
    sectionTitle: 'Discordアカウント紐付け（署名済み公開鍵プロフィール）',
    sectionSubtitle:
      '公開鍵にDiscordユーザー名（例: @username）を含めて電子署名し、検証画面で署名主のDiscordアカウントとして証明できます。',
    keySelectLabel: '署名に使用する鍵',
    discordHandleLabel: 'Discordユーザー名',
    discordHandlePlaceholder: '@username',
    passphraseLabel: '鍵のパスフレーズ（必要な場合）',
    passphrasePlaceholder: 'WebCrypto鍵の場合は空欄のままで構いません',
    signBtn: 'Discordプロフィールに署名して紐付け',
    signedSuccessMsg: '署名済みDiscordプロフィールを作成し、ローカルに保存しました。',
    copyJsonBtn: '署名済みJSONをコピー',
    downloadJsonBtn: 'JSONを保存',
    copyLinkBtn: '共有リンクをコピー',
    showQrBtn: 'QRを表示',
    hideQrBtn: 'QRを隠す',
    copiedLabel: 'コピーしました',
    importTitle: '他作者のDiscordプロフィールを検証・インポート',
    importPlaceholder: '署名済みDiscordプロフィールJSONまたは共有リンクを貼り付け…',
    importBtn: '署名を検証して保存',
    importSuccessMsg: '署名を検証し、Discordアカウント紐付けを保存しました。',
    invalidHandleError: '有効なDiscordユーザー名を入力してください（例: @username）。',
    invalidClaimError: 'Discordプロフィールの署名が無効、または改ざんされています。',
    verifiedBindingsTitle: '検証済みのDiscord鍵紐付け一覧',
    removeBindingBtn: '削除',
    verifyBadgeTitle: 'Discordアカウント紐付け検証済み',
    verifyBadgeDesc: 'この作品は署名主のDiscordアカウントと紐付けられています。',
    verifyBadgeSourceExchange: '署名済みArtist Key Exchangeプロフィールにより検証',
    verifyBadgeSourceManifest: '作品証明マニフェスト内の署名メタデータにより検証',
  },
  homeUx: {
    benefitSubcopy:
      'AI生成疑惑への対抗・手描き自作の証明・無断転載や改ざん検知を、登録不要・無料・端末内完結で。',
    howItWorksTitle: '見えない電子署名 ＆ QRの仕組み（3ステップ）',
    step1Title: '1. ブラウザで選択',
    step1Desc: '手元の作品を選ぶだけ。画像は外部に一切送信されません。',
    step2Title: '2. 見えない署名とQRを付与',
    step2Desc: '端末内で電子署名とQRコードを作品に刻みます。',
    step3Title: '3. いつでも誰でも検証',
    step3Desc: '作品の真贋や改ざんの有無を誰でも数秒で確認できます。',
    demoCalloutPrefix: '手元に画像がない方はこちら：',
    demoCalloutBtn: 'サンプル作品で検証を試す（Try Demo Verification）',
  },
  keyLossAlert: {
    title: '署名鍵の紛失を防ぐため、今のうちにバックアップを',
    body: 'ブラウザのキャッシュを削除するとあなたの署名鍵が失われます。今のうちに鍵のバックアップ（ローカル保存 / Google Drive / Discord）を行ってください。',
    keysPageLink: '鍵管理画面を開く',
    storagePageLink: 'Google Drive / Discord連携へ',
    dismissBtn: '閉じる',
  },
};

export const DISCORD_UX_I18N: Record<SupportedLocale, DiscordAndUxTranslations> = {
  en: enDiscordUx,
  ja: jaDiscordUx,
  'zh-CN': enDiscordUx,
  'zh-TW': enDiscordUx,
  ko: enDiscordUx,
  ru: enDiscordUx,
  uk: enDiscordUx,
  es: enDiscordUx,
  fr: enDiscordUx,
  de: enDiscordUx,
  pt: enDiscordUx,
  it: enDiscordUx,
  ar: enDiscordUx,
};
