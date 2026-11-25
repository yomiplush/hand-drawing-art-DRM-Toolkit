import type { SupportedLocale } from '../core/storage/consent';

export interface HumanUxTranslations {
  mode: {
    simpleModeBannerTitle: string;
    simpleModeBannerBody: string;
    switchToAdvancedBtn: string;
    advancedActiveNote: string;
  };
  createUx: {
    step1Short: string;
    step2Short: string;
    step3Short: string;
    step1Subtitle: string;
    step2Subtitle: string;
    step3SaveTitle: string;
    step3Subtitle: string;
    autoKeyNotice: string;
    autoKeyCreatedNote: string;
    artistNameSimpleLabel: string;
    artistNameSimplePlaceholder: string;
    artworkTitleSimpleLabel: string;
    artworkTitleSimplePlaceholder: string;
    licenseSimpleLabel: string;
    simpleKeyReadyBadge: string;
    backToEditBtn: string;
    startAnotherBtn: string;
    shareArtworkBtn: string;
    noOverwriteNote: string;
    qrIncludedNote: string;
    progressLabel: string;
    progressStages: {
      decoding: string;
      hashing: string;
      signing: string;
      encoding: string;
      complete: string;
    };
  };
  verifyUx: {
    step1Short: string;
    step2Short: string;
    step3Short: string;
    progressLabel: string;
    progressStages: {
      decoding: string;
      scanningQr: string;
      verifying: string;
      hashing: string;
      complete: string;
    };
    perceptualNotice: string;
    selfDeclaredTimestampNote: string;
    historyTitle: string;
    historySubtitle: string;
    historyEmpty: string;
    historyClearBtn: string;
    historyValidLabel: string;
    historyInvalidLabel: string;
    historyAdvancedHint: string;
  };
  driveRecovery: {
    crossDeviceTitle: string;
    crossDeviceDesc: string;
    crossDeviceTargets: string;
    syncedCountsLabel: string;
    recoverySectionTitle: string;
    recoverySectionDesc: string;
    recoveryOptInWarning: string;
    recoveryPassphraseLabel: string;
    recoveryPassphrasePlaceholder: string;
    recoveryUploadBtn: string;
    recoveryRefreshBtn: string;
    recoveryRestoreBtn: string;
    recoveryRestorePassPlaceholder: string;
    recoveryNoBackups: string;
    recoveryUploadedMsg: string;
    recoveryRestoredMsg: string;
  };
  keyRecoveryGuide: {
    title: string;
    subtitle: string;
    steps: [
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
    ];
  };
}

const EN: HumanUxTranslations = {
  mode: {
    simpleModeBannerTitle: 'Detailed settings are tucked away in Simple Mode',
    simpleModeBannerBody:
      'You can certify and verify artworks safely without touching this screen. Switch to Advanced Mode anytime to inspect keys, linked devices, or technical tools without reloading or losing drafts.',
    switchToAdvancedBtn: 'Switch to Advanced Mode',
    advancedActiveNote: 'Advanced Mode is active — full controls are visible.',
  },
  createUx: {
    step1Short: 'Choose Image',
    step2Short: 'Review Proof',
    step3Short: 'Save PNG',
    step1Subtitle: 'Pick a finished illustration from your device or tablet. Your original file is never overwritten.',
    step2Subtitle: 'Review your artist name, artwork title, and usage rules before signing.',
    step3SaveTitle: '3. Save Certified Image',
    step3Subtitle: 'Your certified PNG is ready. Save a copy to your device or share it directly.',
    autoKeyNotice:
      'First time? No setup needed — signing automatically creates a local artist stamp in this browser.',
    autoKeyCreatedNote:
      'Created your local artist stamp automatically. Save an encrypted backup (.chkey.json) when convenient so you can restore it on another device.',
    artistNameSimpleLabel: 'Artist Name (shown in proof)',
    artistNameSimplePlaceholder: 'e.g. Pen name or studio name',
    artworkTitleSimpleLabel: 'Artwork Title (optional)',
    artworkTitleSimplePlaceholder: 'e.g. Moonlit Fox',
    licenseSimpleLabel: 'Usage Rules (License)',
    simpleKeyReadyBadge: 'Local artist stamp ready',
    backToEditBtn: 'Back & Adjust Details',
    startAnotherBtn: 'Certify Another Artwork',
    shareArtworkBtn: 'Share Certified PNG',
    noOverwriteNote: 'A new .certified-handmade.png file is created; your original image stays untouched.',
    qrIncludedNote: 'A clean border QR code is added around the image so every artwork pixel stays untouched.',
    progressLabel: 'Preparing your certified image locally…',
    progressStages: {
      decoding: 'Reading image pixels…',
      hashing: 'Computing artwork fingerprint…',
      signing: 'Signing proof locally…',
      encoding: 'Building lossless PNG…',
      complete: 'Complete',
    },
  },
  verifyUx: {
    step1Short: 'Pick Image / QR',
    step2Short: 'Verify Locally',
    step3Short: 'View Result',
    progressLabel: 'Checking certificate locally…',
    progressStages: {
      decoding: 'Reading image…',
      scanningQr: 'Scanning QR proof…',
      verifying: 'Checking signature…',
      hashing: 'Comparing pixels…',
      complete: 'Verification complete',
    },
    perceptualNotice:
      'Perceptual similarity is a visual comparison hint only — never cryptographic proof. Social media recompression can lower exact pixel match while keeping visual similarity.',
    selfDeclaredTimestampNote:
      'Creation method and timestamp are self-declared by the signer’s device clock (unless backed by extra evidence files).',
    historyTitle: 'Local Verification History',
    historySubtitle: 'Recent checks saved only in this browser (max 50 entries).',
    historyEmpty: 'No verification checks recorded yet.',
    historyClearBtn: 'Clear History',
    historyValidLabel: 'Signature Valid',
    historyInvalidLabel: 'Attention Needed',
    historyAdvancedHint: 'Detailed verification history & raw CBOR inspector are available in Advanced Mode.',
  },
  driveRecovery: {
    crossDeviceTitle: 'Multi-Device Sync (Windows / macOS / Linux / iPadOS / iOS / Android)',
    crossDeviceDesc:
      'Optional Google sync uses your hidden appDataFolder (drive.appdata) only. Public author identities, paired device authorizations, revocations, profiles, and proof records sync encrypted — artwork images and unencrypted private keys never leave your device.',
    crossDeviceTargets: 'Supports Windows · macOS · Linux · iPadOS · iOS · Android browsers',
    syncedCountsLabel: 'Synced identities & paired devices',
    recoverySectionTitle: 'Optional Encrypted Key Recovery Backup (Opt-In)',
    recoverySectionDesc:
      'By default, private signing keys stay strictly on each device. Only if you explicitly upload an encrypted recovery envelope here can you restore a signing key onto a new device using your recovery passphrase.',
    recoveryOptInWarning:
      'Google sign-in alone NEVER unlocks or downloads your signing keys. Only your recovery passphrase can decrypt this backup on your device.',
    recoveryPassphraseLabel: 'Recovery backup passphrase (min 8 chars)',
    recoveryPassphrasePlaceholder: 'Strong passphrase to encrypt recovery backup',
    recoveryUploadBtn: 'Upload Encrypted Recovery Backup',
    recoveryRefreshBtn: 'Refresh Backups',
    recoveryRestoreBtn: 'Restore Key to This Device',
    recoveryRestorePassPlaceholder: 'Enter backup decryption passphrase',
    recoveryNoBackups: 'No encrypted key recovery backups stored in appDataFolder yet.',
    recoveryUploadedMsg: 'Encrypted key recovery backup uploaded to your hidden appDataFolder.',
    recoveryRestoredMsg: 'Signing key decrypted locally and imported to this device.',
  },
  keyRecoveryGuide: {
    title: 'Key Backup & Device Recovery Guide',
    subtitle: 'How to safely keep your artist stamp across tablets, phones, and computers.',
    steps: [
      {
        title: '1. Save an encrypted .chkey.json backup',
        body: 'Download your encrypted key file in My Keys (Advanced Mode) and store it in your personal password manager or cloud folder.',
      },
      {
        title: '2. Pair a new device without copying private keys',
        body: 'Prefer pairing each device (iPad, PC, smartphone) with its own independent device key authorized by your existing device.',
      },
      {
        title: '3. Optional Google Drive appDataFolder sync',
        body: 'Connect Google Drive in Sync & Storage to keep author public identities, paired devices, revocations, and optional encrypted recovery envelopes synchronized.',
      },
      {
        title: '4. If a device is lost or replaced',
        body: 'Issue a device revocation notice from another trusted device, then restore from your .chkey.json file or opt-in encrypted recovery backup.',
      },
    ],
  },
};

const JA: HumanUxTranslations = {
  mode: {
    simpleModeBannerTitle: '詳細設定はシンプルモードでは折りたたまれています',
    simpleModeBannerBody:
      'ふだんの作品証明や確認は、この画面を触らなくても安全に行えます。鍵管理・端末連携・詳細ツールを使う場合は、入力中の内容を消さずにいつでもアドバンスドモードへ切り替えられます。',
    switchToAdvancedBtn: 'アドバンスドモードへ切り替える',
    advancedActiveNote: 'アドバンスドモードが有効です（すべての詳細設定を表示中）。',
  },
  createUx: {
    step1Short: '画像を選ぶ',
    step2Short: '内容を確認',
    step3Short: '画像を保存',
    step1Subtitle: '証明したいイラストを選んでください。元の画像ファイルは一切上書きされません。',
    step2Subtitle: '作者名・作品タイトル・利用ルールを確認して、端末内で署名します。',
    step3SaveTitle: '3. 証明付き画像を保存する',
    step3Subtitle: '証明付きのPNGが完成しました。端末に保存したり、そのまま共有できます。',
    autoKeyNotice:
      'はじめてでも設定は不要です。署名ボタンを押すと、この端末専用の作家スタンプ（鍵）が自動で用意されます。',
    autoKeyCreatedNote:
      'この端末専用の作家スタンプを自動作成しました。機種変更やブラウザ初期化に備え、あとで暗号化バックアップ（.chkey.json）を保存しておくと安心です。',
    artistNameSimpleLabel: '作者名（証明に表示されます）',
    artistNameSimplePlaceholder: '例：ペンネーム・サークル名',
    artworkTitleSimpleLabel: '作品タイトル（任意）',
    artworkTitleSimplePlaceholder: '例：月夜のきつね',
    licenseSimpleLabel: '利用ルール（ライセンス）',
    simpleKeyReadyBadge: '端末内の作家スタンプ準備OK',
    backToEditBtn: '戻って修正する',
    startAnotherBtn: '別の作品を証明する',
    shareArtworkBtn: '証明付き画像を共有',
    noOverwriteNote: '新しい「.certified-handmade.png」として保存されるため、元の画像はそのまま残ります。',
    qrIncludedNote: '元画像の絵には一切手を加えず、外側のきれいな余白にQRコードをお付けします。',
    progressLabel: '端末内で証明付き画像を作成しています…',
    progressStages: {
      decoding: '画像を読み込んでいます…',
      hashing: '作品の指紋を計算しています…',
      signing: '端末内で署名しています…',
      encoding: '無劣化PNGを書き出しています…',
      complete: '完了しました',
    },
  },
  verifyUx: {
    step1Short: '画像・QRを選ぶ',
    step2Short: '端末内で検証',
    step3Short: '結果を見る',
    progressLabel: '端末内で証明を確認しています…',
    progressStages: {
      decoding: '画像を読み込んでいます…',
      scanningQr: 'QRコードを読み取っています…',
      verifying: '署名を確かめています…',
      hashing: 'ピクセルの一致を確認中…',
      complete: '検証が完了しました',
    },
    perceptualNotice:
      '知覚ハッシュによる類似度は「見た目の参考情報」であり、暗号学的な一致証明ではありません。SNS再圧縮でピクセル一致が外れた場合の目安として利用します。',
    selfDeclaredTimestampNote:
      '制作方法や作成日時は、署名端末の時計に基づく自己申告です（制作ログファイル等が別途添付されている場合を除く）。',
    historyTitle: 'ローカル検証履歴',
    historySubtitle: 'このブラウザ内に保存された直近の検証ログ（最大50件）です。',
    historyEmpty: 'まだ検証履歴はありません。',
    historyClearBtn: '履歴を消去',
    historyValidLabel: '署名有効',
    historyInvalidLabel: '要注意 / 不一致',
    historyAdvancedHint: '詳細な検証ログと生データ確認はアドバンスドモードで利用できます。',
  },
  driveRecovery: {
    crossDeviceTitle: '複数端末同期（Windows / macOS / Linux / iPadOS / iOS / Android）',
    crossDeviceDesc:
      '任意のGoogle連携は、ドライブ内の非表示専用領域（appDataFolder / drive.appdata）のみを使用します。公開ID・承認済み端末リスト・失効情報・プロフィール・証明は暗号化して同期され、作品画像や生の秘密鍵は絶対にアップロードされません。',
    crossDeviceTargets: 'Windows・macOS・Linux・iPadOS・iOS・Android ブラウザ対応',
    syncedCountsLabel: '同期済み公開ID・承認端末',
    recoverySectionTitle: '任意の暗号化鍵復旧バックアップ（明示的オプトイン）',
    recoverySectionDesc:
      '通常、署名用秘密鍵は各端末から外に出ません。ご自身で復旧用パスフレーズを設定して暗号化バックアップを保存した場合のみ、新しい端末へ鍵を復元できます。',
    recoveryOptInWarning:
      'Googleログインだけでは署名鍵の復号や署名権限の取得はできません。復元には端末側でパスフレーズ復号が必要です。',
    recoveryPassphraseLabel: '復旧バックアップ用パスフレーズ（8文字以上）',
    recoveryPassphrasePlaceholder: '復旧データを暗号化する強いパスフレーズ',
    recoveryUploadBtn: '暗号化済み復旧データを保存',
    recoveryRefreshBtn: 'バックアップ一覧を更新',
    recoveryRestoreBtn: 'この端末へ鍵を復元',
    recoveryRestorePassPlaceholder: '復号用パスフレーズを入力',
    recoveryNoBackups: 'appDataFolder に暗号化復旧バックアップはまだありません。',
    recoveryUploadedMsg: '暗号化済み復旧バックアップをアプリ専用隠し領域（appDataFolder）に保存しました。',
    recoveryRestoredMsg: 'バックアップをローカル復号し、署名鍵をこの端末へ読み込みました。',
  },
  keyRecoveryGuide: {
    title: '鍵のバックアップ・復旧ガイド',
    subtitle: 'iPad・スマホ・PCの機種変更やブラウザデータ消去に備えるための安全な手順です。',
    steps: [
      {
        title: '1. 暗号化バックアップ（.chkey.json）を保存する',
        body: 'アドバンスドモードの「マイ鍵管理」から、パスフレーズで保護された .chkey.json を書き出してパスワード管理アプリ等へ保管してください。',
      },
      {
        title: '2. 新しい端末は「端末ペアリング」で追加するのが安全',
        body: '秘密鍵をコピーする代わりに、既存端末からの署名済み承認で新しいPCやiPadへ独立した署名鍵を発行できます。',
      },
      {
        title: '3. Google ドライブ（appDataFolder）で公開IDと端末状態を同期',
        body: '「端末同期・ストレージ」で任意連携すると、公開ID・承認端末・失効通知・任意の暗号化済み復旧バックアップを複数端末で共有できます。',
      },
      {
        title: '4. 端末を紛失・買い替えたときは',
        body: '別の承認済み端末から紛失端末を失効させたうえ、.chkey.json またはオプトイン保存した暗号化復旧バックアップから復元します。',
      },
    ],
  },
};

function makeLocalized(
  overrides: Partial<Record<'modeTitle' | 'modeBody' | 'modeBtn' | 's1' | 's2' | 's3' | 'share' | 'another' | 'back' | 'history' | 'recoveryTitle', string>>,
): HumanUxTranslations {
  return {
    ...EN,
    mode: {
      ...EN.mode,
      simpleModeBannerTitle: overrides.modeTitle ?? EN.mode.simpleModeBannerTitle,
      simpleModeBannerBody: overrides.modeBody ?? EN.mode.simpleModeBannerBody,
      switchToAdvancedBtn: overrides.modeBtn ?? EN.mode.switchToAdvancedBtn,
    },
    createUx: {
      ...EN.createUx,
      step1Short: overrides.s1 ?? EN.createUx.step1Short,
      step2Short: overrides.s2 ?? EN.createUx.step2Short,
      step3Short: overrides.s3 ?? EN.createUx.step3Short,
      shareArtworkBtn: overrides.share ?? EN.createUx.shareArtworkBtn,
      startAnotherBtn: overrides.another ?? EN.createUx.startAnotherBtn,
      backToEditBtn: overrides.back ?? EN.createUx.backToEditBtn,
    },
    verifyUx: {
      ...EN.verifyUx,
      historyTitle: overrides.history ?? EN.verifyUx.historyTitle,
    },
    keyRecoveryGuide: {
      ...EN.keyRecoveryGuide,
      title: overrides.recoveryTitle ?? EN.keyRecoveryGuide.title,
    },
  };
}

export const HUMAN_UX_I18N: Record<SupportedLocale, HumanUxTranslations> = {
  en: EN,
  ja: JA,
  'zh-CN': makeLocalized({
    modeTitle: '高级设置已在简洁模式下收起',
    modeBtn: '切换到高级模式',
    s1: '选择画作',
    s2: '确认信息',
    s3: '保存图片',
    share: '分享已证明图片',
    another: '继续证明下一张',
    back: '返回修改',
    history: '本地验证记录',
    recoveryTitle: '密钥备份与恢复指南',
  }),
  'zh-TW': makeLocalized({
    modeTitle: '進階設定在簡易模式中已收合',
    modeBtn: '切換至進階模式',
    s1: '選擇畫作',
    s2: '確認內容',
    s3: '儲存圖片',
    share: '分享已證明圖片',
    another: '繼續證明下一張',
    back: '返回修改',
    history: '本機驗證紀錄',
    recoveryTitle: '金鑰備份與復原指南',
  }),
  ko: makeLocalized({
    modeTitle: '고급 설정은 심플 모드에서 숨겨져 있습니다',
    modeBtn: '고급 모드로 전환',
    s1: '이미지 선택',
    s2: '내용 확인',
    s3: 'PNG 저장',
    share: '증명 이미지 공유',
    another: '다른 작품 증명하기',
    back: '돌아가기',
    history: '로컬 검증 기록',
    recoveryTitle: '키 백업 및 복구 가이드',
  }),
  ru: makeLocalized({
    modeTitle: 'Расширенные настройки скрыты в простом режиме',
    modeBtn: 'Включить расширенный режим',
    s1: 'Выбрать работу',
    s2: 'Проверить данные',
    s3: 'Сохранить PNG',
    share: 'Поделиться',
    another: 'Подтвердить другую работу',
    back: 'Назад',
    history: 'Журнал проверок',
    recoveryTitle: 'Руководство по резервному копированию и восстановлению',
  }),
  uk: makeLocalized({
    modeTitle: 'Розширені налаштування приховано у простому режимі',
    modeBtn: 'Увімкнути розширений режим',
    s1: 'Вибрати твір',
    s2: 'Перевірити дані',
    s3: 'Зберегти PNG',
    share: 'Поділитися',
    another: 'Підтвердити інший твір',
    back: 'Назад',
    history: 'Історія перевірок',
    recoveryTitle: 'Посібник із резервного копіювання та відновлення',
  }),
  es: makeLocalized({
    modeTitle: 'La configuración avanzada está oculta en Modo Simple',
    modeBtn: 'Cambiar a Modo Avanzado',
    s1: 'Elegir imagen',
    s2: 'Revisar prueba',
    s3: 'Guardar PNG',
    share: 'Compartir imagen',
    another: 'Certificar otra obra',
    back: 'Volver y editar',
    history: 'Historial de verificación',
    recoveryTitle: 'Guía de respaldo y recuperación de claves',
  }),
  fr: makeLocalized({
    modeTitle: 'Les réglages détaillés sont masqués en mode Simple',
    modeBtn: 'Passer en mode Avancé',
    s1: 'Choisir l’image',
    s2: 'Vérifier les infos',
    s3: 'Enregistrer PNG',
    share: 'Partager l’image',
    another: 'Certifier une autre œuvre',
    back: 'Retour',
    history: 'Historique local',
    recoveryTitle: 'Guide de sauvegarde et récupération des clés',
  }),
  de: makeLocalized({
    modeTitle: 'Erweiterte Einstellungen sind im einfachen Modus verborgen',
    modeBtn: 'Zum Expertenmodus wechseln',
    s1: 'Bild wählen',
    s2: 'Angaben prüfen',
    s3: 'PNG speichern',
    share: 'Bild teilen',
    another: 'Weiteres Werk nachweisen',
    back: 'Zurück',
    history: 'Prüfverlauf',
    recoveryTitle: 'Anleitung zur Schlüsselsicherung & Wiederherstellung',
  }),
  pt: makeLocalized({
    modeTitle: 'Configurações detalhadas ficam ocultas no Modo Simples',
    modeBtn: 'Mudar para Modo Avançado',
    s1: 'Escolher imagem',
    s2: 'Revisar prova',
    s3: 'Salvar PNG',
    share: 'Compartilhar imagem',
    another: 'Certificar outra obra',
    back: 'Voltar e ajustar',
    history: 'Histórico de verificação',
    recoveryTitle: 'Guia de backup e recuperação de chaves',
  }),
  it: makeLocalized({
    modeTitle: 'Le impostazioni avanzate sono nascoste in Modalità Semplice',
    modeBtn: 'Passa a Modalità Avanzata',
    s1: 'Scegli immagine',
    s2: 'Controlla dati',
    s3: 'Salva PNG',
    share: 'Condividi immagine',
    another: 'Certifica un’altra opera',
    back: 'Indietro',
    history: 'Cronologia verifiche',
    recoveryTitle: 'Guida al backup e ripristino delle chiavi',
  }),
  ar: makeLocalized({
    modeTitle: 'الإعدادات التفصيلية مخفية في الوضع البسيط',
    modeBtn: 'التبديل إلى الوضع المتقدم',
    s1: 'اختر صورة',
    s2: 'راجع البيانات',
    s3: 'احفظ PNG',
    share: 'مشاركة الصورة',
    another: 'توثيق عمل آخر',
    back: 'رجوع',
    history: 'سجل التحقق المحلي',
    recoveryTitle: 'دليل النسخ الاحتياطي واستعادة المفاتيح',
  }),
};
