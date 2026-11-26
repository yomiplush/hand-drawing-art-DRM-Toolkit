import type { SupportedLocale } from '../core/storage/consent';

export interface SimpleTranslations {
  mode: {
    simpleLabel: string;
    advancedLabel: string;
    switchGroupAria: string;
    switchToAdvancedHint: string;
    switchToSimpleHint: string;
  };
  header: {
    languageAria: string;
    openAdvancedNav: string;
    closeAdvancedNav: string;
    activeKeyLabel: string;
    noKeyYet: string;
    storedKeysCount: string;
    offlineReadyLabel: string;
    specNavLabel: string;
    offlineNavLabel: string;
  };
  home: {
    headline: string;
    subline: string;
    localOnlyBadge: string;
    localOnlyTipLabel: string;
    localOnlyTipText: string;
    createCardTitle: string;
    createCardDesc: string;
    verifyCardTitle: string;
    verifyCardDesc: string;
    sampleDemoLink: string;
    exchangeFooterLink: string;
    switchToAdvancedLink: string;
  };
  create: {
    pageTitle: string;
    pageSubtitle: string;
    step1Title: string;
    step1Prompt: string;
    step1Hint: string;
    step2Title: string;
    artistNameLabel: string;
    artistNamePlaceholder: string;
    titleLabel: string;
    titlePlaceholder: string;
    licenseLabel: string;
    qrStyleLabel: string;
    qrStyleTipLabel: string;
    qrStyleTipText: string;
    styleOuterTitle: string;
    styleOuterDesc: string;
    styleInsideTitle: string;
    styleInsideDesc: string;
    localTrustNote: string;
    step3Cta: string;
    stampingBusy: string;
    celebrationTitle: string;
    celebrationSubtitle: string;
    redownloadBtn: string;
    shareBtn: string;
    verifyNowBtn: string;
    backupCardTitle: string;
    backupTipLabel: string;
    backupTipText: string;
    backupReadyBtn: string;
    backupPassPlaceholder: string;
    backupCreateAndSaveBtn: string;
    backupSavedBadge: string;
    backupShortPassError: string;
  };
  verify: {
    pageTitle: string;
    pageSubtitle: string;
    sampleTryBtn: string;
    scanningLabel: string;
    verdictPassTitle: string;
    verdictPassDesc: string;
    verdictPassTipLabel: string;
    verdictPassTipText: string;
    verdictSnsTitle: string;
    verdictSnsDesc: string;
    verdictSnsTipLabel: string;
    verdictSnsTipText: string;
    verdictWarnTitle: string;
    verdictWarnDesc: string;
    verdictWarnTipText: string;
    artistPillLabel: string;
    titlePillLabel: string;
    licensePillLabel: string;
    expandDetailsBtn: string;
    collapseDetailsBtn: string;
    tryAnotherBtn: string;
  };
  advancedTips: {
    ed25519Label: string;
    ed25519Text: string;
    canonicalRgbaLabel: string;
    canonicalRgbaText: string;
    protocolModesLabel: string;
    protocolModesText: string;
    exchangeLabel: string;
    exchangeText: string;
    driveVaultLabel: string;
    driveVaultText: string;
  };
}

const enSimple: SimpleTranslations = {
  mode: {
    simpleLabel: 'Simple',
    advancedLabel: 'Advanced',
    switchGroupAria: 'Switch between Simple and Advanced mode',
    switchToAdvancedHint: 'Switch to Advanced Mode',
    switchToSimpleHint: 'Back to Simple Mode',
  },
  header: {
    languageAria: 'Language',
    openAdvancedNav: 'Menu & Tools',
    closeAdvancedNav: 'Close menu',
    activeKeyLabel: 'Active key',
    noKeyYet: 'Auto-ready',
    storedKeysCount: 'keys',
    offlineReadyLabel: 'Offline ready',
    specNavLabel: 'Spec',
    offlineNavLabel: 'Offline',
  },
  home: {
    headline: 'Your art. Your proof.',
    subline: 'Always free. No sign-up. No image uploads.',
    localOnlyBadge: '100% Local on Your Device',
    localOnlyTipLabel: 'About local-only processing',
    localOnlyTipText:
      'Everything runs 100% inside your device. Your artwork is never uploaded to any server.',
    createCardTitle: 'Certify Artwork',
    createCardDesc: 'Stamp your invisible seal & QR onto your drawing in seconds.',
    verifyCardTitle: 'Verify Artwork',
    verifyCardDesc: 'Check if an image is authentic and hasn’t been altered.',
    sampleDemoLink: 'Try "Verify Artwork" with a sample drawing',
    exchangeFooterLink: 'Artist Key Exchange',
    switchToAdvancedLink: 'Switch to Advanced Mode',
  },
  create: {
    pageTitle: 'Sign My Drawing',
    pageSubtitle: 'Pick an image, enter your name, and stamp your seal.',
    step1Title: '1. Choose your drawing',
    step1Prompt: 'Tap or drop your drawing here',
    step1Hint: 'PNG, JPG, or WebP — nothing leaves your device.',
    step2Title: '2. Your name & seal style',
    artistNameLabel: 'Artist Name',
    artistNamePlaceholder: 'e.g. Sakura',
    titleLabel: 'Artwork Title (optional)',
    titlePlaceholder: 'e.g. Moonlight Sketch',
    licenseLabel: 'Sharing Rule',
    qrStyleLabel: 'Where should the seal go?',
    qrStyleTipLabel: 'About seal styles',
    qrStyleTipText:
      "'Outer QR Frame' leaves every pixel of your art untouched. 'In-Image QR' helps your seal survive social media compression!",
    styleOuterTitle: 'Outer QR Frame (Recommended)',
    styleOuterDesc: 'Adds a clean frame outside your art with 0% pixel change.',
    styleInsideTitle: 'In-Image QR (For Social Media)',
    styleInsideDesc: 'Blends a soft translucent seal inside the corner.',
    localTrustNote: '100% offline in your browser — your art stays on your device.',
    step3Cta: 'Sign My Drawing',
    stampingBusy: 'Stamping your seal…',
    celebrationTitle: 'Your signed artwork is ready!',
    celebrationSubtitle: 'Your PNG download started automatically. Keep a spare key just in case.',
    redownloadBtn: 'Download Again',
    shareBtn: 'Share Artwork',
    verifyNowBtn: 'Verify This Artwork',
    backupCardTitle: 'Save Recovery Key (.chkey.json)',
    backupTipLabel: 'About the recovery key',
    backupTipText:
      "This secret backup file lets you prove you're the original artist even if you switch devices or clear browser data.",
    backupReadyBtn: 'Save Recovery Key (.chkey.json)',
    backupPassPlaceholder: 'Create a secret password (8+ chars)',
    backupCreateAndSaveBtn: 'Lock & Save Recovery Key',
    backupSavedBadge: 'Recovery key saved',
    backupShortPassError: 'Please enter at least 8 characters to protect your backup.',
  },
  verify: {
    pageTitle: 'Check an Image',
    pageSubtitle: 'Drop a signed artwork or scan a QR code to verify.',
    sampleTryBtn: 'Try a sample artwork',
    scanningLabel: 'Scanning artwork seal…',
    verdictPassTitle: 'Verified Authentic Art!',
    verdictPassDesc: 'The artist signature and pixels match the original.',
    verdictPassTipLabel: 'How this check works',
    verdictPassTipText:
      "We checked the cryptographic signature against the artwork pixels and confirmed it hasn't been altered.",
    verdictSnsTitle: 'Signature Verified via QR!',
    verdictSnsDesc: 'The artist signature is valid, though the pixels differ from the original file.',
    verdictSnsTipLabel: 'Why pixels can differ on social media',
    verdictSnsTipText:
      "Social media apps often shrink and re-save images automatically. Use 'In-Image QR' mode when sharing on SNS!",
    verdictWarnTitle: 'No Seal Found or Image Modified',
    verdictWarnDesc: 'We could not match a valid artist seal on this image.',
    verdictWarnTipText:
      'If this came from social media or a screenshot, try checking the original file or the QR code directly.',
    artistPillLabel: 'Artist',
    titlePillLabel: 'Title',
    licensePillLabel: 'Rule',
    expandDetailsBtn: 'Show Detailed Verification Data',
    collapseDetailsBtn: 'Hide Detailed Verification Data',
    tryAnotherBtn: 'Check Another Image',
  },
  advancedTips: {
    ed25519Label: 'About Ed25519 keys',
    ed25519Text:
      'Ed25519 signs proofs locally in WebCrypto/noble-ed25519 so your private key never leaves IndexedDB.',
    canonicalRgbaLabel: 'About Canonical RGBA8',
    canonicalRgbaText:
      'Pixels are normalized into raw unpremultiplied RGBA8 bytes (zeroing RGB where alpha is 0) before SHA-256 hashing.',
    protocolModesLabel: 'About Protocol v1 / v2 (qrMask)',
    protocolModesText:
      'Outer Frame preserves the artwork rectangle intact; In-Image Mode masks the qrMask rectangle before hashing.',
    exchangeLabel: 'About /exchange',
    exchangeText:
      'Share public keys via #key= links or QR codes and verify SHA-256 fingerprints out-of-band before trusting.',
    driveVaultLabel: 'About Google Drive Vault (drive.appdata)',
    driveVaultText:
      'Uses strictly the hidden appDataFolder scope with client-side AES-256-GCM encryption; originals are never uploaded.',
  },
};

const jaSimple: SimpleTranslations = {
  mode: {
    simpleLabel: 'かんたん',
    advancedLabel: '詳細',
    switchGroupAria: 'かんたんモードと詳細モードを切り替え',
    switchToAdvancedHint: '詳細モードに切り替え',
    switchToSimpleHint: 'かんたんモードに戻す',
  },
  header: {
    languageAria: '言語',
    openAdvancedNav: 'ツール・メニュー',
    closeAdvancedNav: 'メニューを閉じる',
    activeKeyLabel: '使用中の鍵',
    noKeyYet: '自動準備OK',
    storedKeysCount: '件の鍵',
    offlineReadyLabel: 'オフライン対応済',
    specNavLabel: '仕様・ドキュメント',
    offlineNavLabel: 'オフライン版',
  },
  home: {
    headline: '大切な絵に、あなたの証を。',
    subline: 'ずっと無料・登録なし・画像の送信ゼロ',
    localOnlyBadge: '完全にあなたの端末内だけで動きます',
    localOnlyTipLabel: 'ローカル処理について',
    localOnlyTipText:
      'このサイトはあなたのスマホやPCの中だけで動きます。絵のデータがネットに送られることは絶対にありません。',
    createCardTitle: '作品を証明する',
    createCardDesc: '絵を選んで名前を入れるだけ。10秒で「自分の証」を入れられます。',
    verifyCardTitle: '本物かチェックする',
    verifyCardDesc: '画像やQRを読み込んで、本物のデータかすぐに見分けます。',
    sampleDemoLink: '🔍 サンプル画像で「本物チェック」を試してみる',
    exchangeFooterLink: '作家キー交換 (/exchange)',
    switchToAdvancedLink: '詳細モードに切り替える',
  },
  create: {
    pageTitle: 'サイン入り画像を作る',
    pageSubtitle: '絵を選んで名前を入れたら、あとはポンッと押すだけ！',
    step1Title: '1. イラストを選ぶ',
    step1Prompt: 'ここにイラストをポンッと入れてね',
    step1Hint: 'PNG・JPG・WebPが使えます（外に送信されません）',
    step2Title: '2. おなまえとスタンプの種類',
    artistNameLabel: 'あなたの作家名（ペンネーム）',
    artistNamePlaceholder: '例：さくら',
    titleLabel: '作品のタイトル（なくてもOK）',
    titlePlaceholder: '例：月夜のらくがき',
    licenseLabel: '見てくれる人とのルール',
    qrStyleLabel: 'QRスタンプの場所をえらぶ',
    qrStyleTipLabel: 'スタンプ種類のちがい',
    qrStyleTipText:
      '『フチにQR』は絵を1ミリも変えずに証明できます。『絵の中にQR』はX（Twitter）などに貼って画質が変わっても本物と証明しやすいよ！',
    styleOuterTitle: 'フチにQR（おすすめ・無劣化）',
    styleOuterDesc: '絵の外側にきれいなフレームをつけて、絵を1ドットも変えません。',
    styleInsideTitle: '絵の中にQR（SNS用・半透明）',
    styleInsideDesc: '絵のすみっこに半透明のスタンプをそっと重ねます。',
    localTrustNote: 'ネット送信ゼロ！この端末の中だけで安全に処理されます。',
    step3Cta: 'サイン入り画像を保存する',
    stampingBusy: 'スタンプを押しています…',
    celebrationTitle: 'スタンプ完了！画像を保存しました',
    celebrationSubtitle: 'ダウンロードが始まったよ！念のため「合カギ」も残しておこう。',
    redownloadBtn: 'もう一回ダウンロード',
    shareBtn: '画像をシェアする',
    verifyNowBtn: 'この画像をチェックしてみる',
    backupCardTitle: '🔑 万が一のために「合カギ」を保存しておく',
    backupTipLabel: '合カギファイルについて',
    backupTipText:
      'スマホを買い替えたりブラウザの履歴を消したときに、「自分が本人だ」と証明し直すための大切な「合カギ」ファイルです。',
    backupReadyBtn: '合カギファイルを保存する (.chkey.json)',
    backupPassPlaceholder: '合カギを守る合言葉（8文字以上）',
    backupCreateAndSaveBtn: '合カギを作って保存する',
    backupSavedBadge: '合カギを保存しました！',
    backupShortPassError: '合言葉は8文字以上で入力してください。',
  },
  verify: {
    pageTitle: '本物チェック',
    pageSubtitle: 'イラストを入れるかQRを読み込むと、すぐに判定します。',
    sampleTryBtn: 'サンプル画像で試してみる',
    scanningLabel: 'イラストの証をスキャン中…',
    verdictPassTitle: '✅ 本物の作品です！',
    verdictPassDesc: '作家のサインも、絵のピクセルデータも元のまま一致しました！',
    verdictPassTipLabel: '判定のしくみ',
    verdictPassTipText:
      '暗号サインと絵のデータを照合して、改ざんされていない本物のデータだと確認しました！',
    verdictSnsTitle: '✅ SNS経由でもサインを確認できました！',
    verdictSnsDesc: '作家のサインは本物ですが、元の絵より少し圧縮・加工されています。',
    verdictSnsTipLabel: 'SNSで画像が変わる理由',
    verdictSnsTipText:
      'XやLINEなどに送ると画像が自動で縮んで元のデータと少し変わることがあります。SNS用には『絵の中にQR』モードがおすすめ！',
    verdictWarnTitle: '⚠️ サインが見つからないか、画像が加工されています',
    verdictWarnDesc: 'この画像からは有効な証明サインを読み取れませんでした。',
    verdictWarnTipText:
      'SNSで画質が落ちた画像やスクリーンショットでは読めないことがあります。元のファイルやQRリンクから試してね。',
    artistPillLabel: '作家名',
    titlePillLabel: 'タイトル',
    licensePillLabel: 'ルール',
    expandDetailsBtn: '詳しい検証データを見る',
    collapseDetailsBtn: '詳しい検証データを閉じる',
    tryAnotherBtn: '別の画像をチェックする',
  },
  advancedTips: {
    ed25519Label: 'Ed25519 署名鍵について',
    ed25519Text:
      'WebCrypto（非抽出鍵）または暗号化シードで端末内生成され、秘密鍵はIndexedDBの外へ送信されません。',
    canonicalRgbaLabel: 'Canonical RGBA8 正規化について',
    canonicalRgbaText:
      '透明領域(alpha=0)のRGB値を0に正規化した生RGBA8ピクセル列からSHA-256ダイジェストを算出します。',
    protocolModesLabel: 'Protocol v1 / v2 (qrMask) について',
    protocolModesText:
      'Outer Frameは原画領域を完全無改変で保持し、In-ImageはqrMask矩形をマスク除外してハッシュ検証します。',
    exchangeLabel: '/exchange 公開鍵交換について',
    exchangeText:
      '#key= URLやQR経由で公開鍵を受け渡し、登録前にSHA-256フィンガープリントを別経路で照合できます。',
    driveVaultLabel: 'Google Drive 連携 (drive.appdata) について',
    driveVaultText:
      '隠しアプリ専用領域(appDataFolder)のみを使い、端末側AES-256-GCMで暗号化したメタデータだけを保存します。',
  },
};

function makeFallbackSimple(overrides: {
  mode: SimpleTranslations['mode'];
  header?: Partial<SimpleTranslations['header']>;
  home?: Partial<SimpleTranslations['home']>;
  create?: Partial<SimpleTranslations['create']>;
  verify?: Partial<SimpleTranslations['verify']>;
  advancedTips?: Partial<SimpleTranslations['advancedTips']>;
}): SimpleTranslations {
  return {
    mode: overrides.mode,
    header: { ...enSimple.header, ...overrides.header },
    home: { ...enSimple.home, ...overrides.home },
    create: { ...enSimple.create, ...overrides.create },
    verify: { ...enSimple.verify, ...overrides.verify },
    advancedTips: { ...enSimple.advancedTips, ...overrides.advancedTips },
  };
}

export const SIMPLE_I18N: Record<SupportedLocale, SimpleTranslations> = {
  en: enSimple,
  ja: jaSimple,
  'zh-CN': makeFallbackSimple({
    mode: {
      simpleLabel: '简易',
      advancedLabel: '高级',
      switchGroupAria: '切换简易与高级模式',
      switchToAdvancedHint: '切换到高级模式',
      switchToSimpleHint: '返回简易模式',
    },
    home: {
      headline: '你的画作，你的证明。',
      subline: '永久免费 · 无需注册 · 不上传图片',
      localOnlyBadge: '100% 仅在本地设备运行',
      localOnlyTipText: '所有处理完全在您的手机或电脑本地完成，画作绝不会上传至任何服务器。',
      createCardTitle: '为作品签名',
      createCardDesc: '几秒内为画作盖上本地防伪印章与二维码。',
      verifyCardTitle: '验证作品',
      verifyCardDesc: '检查图片是否为原作者签署且未被篡改。',
      sampleDemoLink: '🔍 用示例图片体验“验证作品”',
      exchangeFooterLink: '画家公钥交换',
      switchToAdvancedLink: '切换到高级模式',
    },
    create: {
      pageTitle: '为画作添加证明',
      pageSubtitle: '选择图片、填写署名，一键盖章保存。',
      step1Title: '1. 选择你的画作',
      step1Prompt: '点击或拖拽画作到这里',
      step2Title: '2. 署名与印章样式',
      artistNameLabel: '画师名称',
      licenseLabel: '授权规则',
      qrStyleLabel: '选择二维码印章位置',
      qrStyleTipText:
        '“外框二维码”完全不改动原图像素；“画内二维码”更适合发到社交平台，压缩后也更容易验真。',
      styleOuterTitle: '外框二维码（推荐·无损原图）',
      styleInsideTitle: '画内二维码（适合社交平台）',
      localTrustNote: '100% 本地离线处理，原图绝不离开您的设备。',
      step3Cta: '盖章并保存图片',
      celebrationTitle: '签名完成！已保存带证明的图片',
      backupCardTitle: '🔑 保存备用密钥文件 (.chkey.json)',
      backupTipText: '更换手机或清除浏览器数据后，可用此密匙文件重新证明您是原作者。',
      backupReadyBtn: '保存备用密钥 (.chkey.json)',
      backupCreateAndSaveBtn: '加密并保存备用密钥',
      backupSavedBadge: '备用密钥已保存',
    },
    verify: {
      pageTitle: '真伪验证',
      pageSubtitle: '上传带二维码的画作或扫码立即验证。',
      sampleTryBtn: '试一试示例图片',
      scanningLabel: '正在扫描作品印章…',
      verdictPassTitle: '✅ 验证通过：正版原作！',
      verdictPassDesc: '画师签名有效，像素与原图完全一致。',
      verdictPassTipText: '已将加密签名与画作像素逐一比对，确认数据未被篡改。',
      verdictSnsTitle: '✅ 已通过二维码确认画师签名！',
      verdictSnsDesc: '画师签名有效，但像素因压缩与原图略有差异。',
      verdictSnsTipText: '社交平台会自动压缩图片导致像素变化，发图推荐“画内二维码”模式。',
      verdictWarnTitle: '⚠️ 未找到有效印章或图片已被修改',
      verdictWarnDesc: '未能在此图片中读取到有效的作品签名。',
      expandDetailsBtn: '查看详细验证数据',
      collapseDetailsBtn: '收起详细验证数据',
      tryAnotherBtn: '验证另一张图片',
    },
  }),
  'zh-TW': makeFallbackSimple({
    mode: {
      simpleLabel: '簡易',
      advancedLabel: '進階',
      switchGroupAria: '切換簡易與進階模式',
      switchToAdvancedHint: '切換至進階模式',
      switchToSimpleHint: '返回簡易模式',
    },
    home: {
      headline: '你的畫作，你的證明。',
      subline: '永久免費 · 免註冊 · 不上傳圖片',
      localOnlyBadge: '100% 僅在本機裝置運行',
      localOnlyTipText: '所有處理完全在您的手機或電腦本機完成，畫作絕不會上傳到任何伺服器。',
      createCardTitle: '簽署作品',
      createCardDesc: '幾秒內為畫作蓋上專屬防偽印章與 QR 碼。',
      verifyCardTitle: '驗證作品',
      verifyCardDesc: '檢查圖片是否為原作者簽署且未被竄改。',
      sampleDemoLink: '🔍 用範例圖片體驗「驗證作品」',
      exchangeFooterLink: '繪師金鑰交換',
      switchToAdvancedLink: '切換至進階模式',
    },
    create: {
      pageTitle: '為畫作加上證明',
      pageSubtitle: '選擇圖片、填寫名稱，一鍵蓋章下載。',
      step1Title: '1. 選擇你的畫作',
      step1Prompt: '點擊或拖放畫作到這裡',
      step2Title: '2. 署名與印章樣式',
      artistNameLabel: '繪師名稱',
      licenseLabel: '授權規則',
      qrStyleLabel: '選擇 QR 印章位置',
      qrStyleTipText:
        '「外框 QR」完全不改動原圖像素；「畫內 QR」更適合發佈到社群媒體，壓縮後也更容易驗證。',
      styleOuterTitle: '外框 QR（推薦·原圖無損）',
      styleInsideTitle: '畫內 QR（適合社群分享）',
      localTrustNote: '100% 本機離線運算，圖片絕不離開您的裝置。',
      step3Cta: '蓋章並儲存圖片',
      celebrationTitle: '簽署完成！已儲存證明圖片',
      backupCardTitle: '🔑 儲存備援金鑰 (.chkey.json)',
      backupTipText: '更換裝置或清除瀏覽器資料後，此秘密備份檔能讓您重新證明自己是原作者。',
      backupReadyBtn: '儲存備援金鑰 (.chkey.json)',
      backupCreateAndSaveBtn: '加密並儲存備援金鑰',
      backupSavedBadge: '備援金鑰已儲存',
    },
    verify: {
      pageTitle: '真偽驗證',
      pageSubtitle: '上傳畫作或掃描 QR 碼即可立即檢查。',
      sampleTryBtn: '試試範例畫作',
      scanningLabel: '正在掃描作品印章…',
      verdictPassTitle: '✅ 驗證通過：真品原作！',
      verdictPassDesc: '作者簽章有效且像素與原圖完全相符。',
      verdictPassTipText: '已比對密碼簽章與圖片像素，確認資料未遭竄改。',
      verdictSnsTitle: '✅ 已透過 QR 驗證作者簽章！',
      verdictSnsDesc: '作者簽章有效，但圖片因社群壓縮與原檔略有不同。',
      verdictSnsTipText: '社群平台常會自動縮小並重存圖片，分享時推薦使用「畫內 QR」模式！',
      verdictWarnTitle: '⚠️ 找不到印章或圖片已修改',
      verdictWarnDesc: '無法從這張圖片讀取有效的作者簽章。',
      expandDetailsBtn: '檢視詳細驗證資料',
      collapseDetailsBtn: '隱藏詳細驗證資料',
      tryAnotherBtn: '檢查另一張圖片',
    },
  }),
  ko: makeFallbackSimple({
    mode: {
      simpleLabel: '간편',
      advancedLabel: '고급',
      switchGroupAria: '간편 모드와 고급 모드 전환',
      switchToAdvancedHint: '고급 모드로 전환',
      switchToSimpleHint: '간편 모드로 돌아가기',
    },
    home: {
      headline: '당신의 그림, 당신의 증명.',
      subline: '평생 무료 · 가입 불필요 · 이미지 업로드 없음',
      localOnlyBadge: '내 기기 안에서 100% 로컬 작동',
      localOnlyTipText: '이 사이트는 스마트폰이나 PC 내부에서만 작동하며 그림이 서버로 전송되지 않습니다.',
      createCardTitle: '작품 인증하기',
      createCardDesc: '몇 초 만에 내 그림에 서명 도장과 QR 코드를 담으세요.',
      verifyCardTitle: '작품 확인하기',
      verifyCardDesc: '이미지가 진짜인지, 수정되지 않았는지 바로 확인합니다.',
      sampleDemoLink: '🔍 샘플 그림으로 "작품 확인" 체험해보기',
      exchangeFooterLink: '작가 키 교환',
      switchToAdvancedLink: '고급 모드로 전환',
    },
    create: {
      pageTitle: '내 그림에 서명하기',
      pageSubtitle: '그림을 고르고 이름을 적으면 바로 완성됩니다.',
      step1Title: '1. 그림 선택하기',
      step1Prompt: '여기에 그림을 놓거나 탭하세요',
      step2Title: '2. 작가 이름 & 도장 스타일',
      artistNameLabel: '작가 이름',
      licenseLabel: '이용 규칙',
      qrStyleLabel: 'QR 도장 위치',
      qrStyleTipText:
        "'바깥 테두리 QR'은 원화 픽셀을 전혀 건드리지 않습니다. '그림 안 QR'은 SNS 압축 후에도 검증하기 좋습니다!",
      styleOuterTitle: '바깥 테두리 QR (추천 · 무손실)',
      styleInsideTitle: '그림 안 QR (SNS 공유용)',
      localTrustNote: '100% 오프라인 작동 — 그림이 기기 밖으로 나가지 않습니다.',
      step3Cta: '서명하고 이미지 저장하기',
      celebrationTitle: '서명 완료! 이미지가 저장되었어요',
      backupCardTitle: '🔑 복구 열쇠 파일 저장하기 (.chkey.json)',
      backupTipText: '기기를 바꾸거나 브라우저 기록을 지웠을 때 본인임을 다시 증명해 주는 소중한 백업 파일입니다.',
      backupReadyBtn: '복구 열쇠 저장 (.chkey.json)',
      backupCreateAndSaveBtn: '암호화하여 복구 열쇠 저장',
      backupSavedBadge: '복구 열쇠 저장됨',
    },
    verify: {
      pageTitle: '작품 진위 확인',
      pageSubtitle: '인증 이미지를 올리거나 QR 코드를 스캔하세요.',
      sampleTryBtn: '샘플 그림으로 확인하기',
      scanningLabel: '작품 도장을 스캔하는 중…',
      verdictPassTitle: '✅ 정품 작품으로 확인됨!',
      verdictPassDesc: '작가 서명과 그림 픽셀이 원본과 정확히 일치합니다.',
      verdictPassTipText: '암호 서명과 픽셀 데이터를 대조해 변조되지 않은 원본임을 확인했습니다!',
      verdictSnsTitle: '✅ SNS 경유 이미지도 서명 확인 완료!',
      verdictSnsDesc: '작가 서명은 유효하지만, SNS 압축으로 원본과 픽셀이 다릅니다.',
      verdictSnsTipText: "SNS에 올리면 이미지가 자동 압축될 수 있어요. SNS용으로는 '그림 안 QR' 모드를 추천합니다!",
      verdictWarnTitle: '⚠️ 서명이 없거나 이미지가 수정됨',
      verdictWarnDesc: '이 이미지에서 유효한 작가 서명을 찾지 못했습니다.',
      expandDetailsBtn: '자세한 검증 데이터 보기',
      collapseDetailsBtn: '자세한 검증 데이터 숨기기',
      tryAnotherBtn: '다른 이미지 확인하기',
    },
  }),
  ru: makeFallbackSimple({
    mode: {
      simpleLabel: 'Простой',
      advancedLabel: 'Расширенный',
      switchGroupAria: 'Переключить простой и расширенный режимы',
      switchToAdvancedHint: 'Переключить в расширенный режим',
      switchToSimpleHint: 'Вернуться в простой режим',
    },
    home: {
      headline: 'Ваш рисунок. Ваше доказательство.',
      subline: 'Всегда бесплатно. Без регистрации. Без загрузки на сервер.',
      localOnlyBadge: '100% локально на вашем устройстве',
      createCardTitle: 'Подписать работу',
      verifyCardTitle: 'Проверить работу',
      sampleDemoLink: '🔍 Попробовать проверку на примере рисунка',
    },
    create: {
      pageTitle: 'Подписать рисунок',
      step3Cta: 'Подписать и сохранить',
      celebrationTitle: 'Готово! Подписанный рисунок сохранён',
      backupCardTitle: '🔑 Сохранить резервный ключ (.chkey.json)',
    },
    verify: {
      pageTitle: 'Проверить изображение',
      verdictPassTitle: '✅ Подлинная работа подтверждена!',
      verdictSnsTitle: '✅ Подпись подтверждена через QR!',
      verdictWarnTitle: '⚠️ Печать не найдена или файл изменён',
    },
  }),
  uk: makeFallbackSimple({
    mode: {
      simpleLabel: 'Простий',
      advancedLabel: 'Розширений',
      switchGroupAria: 'Перемкнути простий і розширений режими',
      switchToAdvancedHint: 'Перемкнути у розширений режим',
      switchToSimpleHint: 'Повернутися до простого режиму',
    },
    home: {
      headline: 'Ваш малюнок. Ваш доказ.',
      subline: 'Завжди безкоштовно. Без реєстрації. Без завантаження файлів.',
      localOnlyBadge: '100% локально на вашому пристрої',
      createCardTitle: 'Засвідчити роботу',
      verifyCardTitle: 'Перевірити роботу',
      sampleDemoLink: '🔍 Спробувати перевірку на зразку малюнка',
    },
    create: {
      pageTitle: 'Підписати малюнок',
      step3Cta: 'Підписати та зберегти',
      celebrationTitle: 'Готово! Підписаний малюнок збережено',
      backupCardTitle: '🔑 Зберегти резервний ключ (.chkey.json)',
    },
    verify: {
      pageTitle: 'Перевірити зображення',
      verdictPassTitle: '✅ Автентичну роботу підтверджено!',
      verdictSnsTitle: '✅ Підпис підтверджено через QR!',
      verdictWarnTitle: '⚠️ Печатку не знайдено або файл змінено',
    },
  }),
  es: makeFallbackSimple({
    mode: {
      simpleLabel: 'Simple',
      advancedLabel: 'Avanzado',
      switchGroupAria: 'Cambiar entre modo Simple y Avanzado',
      switchToAdvancedHint: 'Cambiar a modo Avanzado',
      switchToSimpleHint: 'Volver a modo Simple',
    },
    home: {
      headline: 'Tu arte. Tu prueba.',
      subline: 'Siempre gratis. Sin registro. Sin subir imágenes.',
      localOnlyBadge: '100% local en tu dispositivo',
      createCardTitle: 'Certificar obra',
      verifyCardTitle: 'Verificar obra',
      sampleDemoLink: '🔍 Probar verificación con un dibujo de muestra',
    },
    create: {
      pageTitle: 'Firmar mi dibujo',
      step3Cta: 'Firmar y guardar',
      celebrationTitle: '¡Tu dibujo firmado está listo!',
      backupCardTitle: '🔑 Guardar clave de recuperación (.chkey.json)',
    },
    verify: {
      pageTitle: 'Verificar imagen',
      verdictPassTitle: '✅ ¡Obra auténtica verificada!',
      verdictSnsTitle: '✅ ¡Firma verificada por QR!',
      verdictWarnTitle: '⚠️ Sin sello válido o imagen modificada',
    },
  }),
  fr: makeFallbackSimple({
    mode: {
      simpleLabel: 'Simple',
      advancedLabel: 'Avancé',
      switchGroupAria: 'Basculer entre le mode Simple et Avancé',
      switchToAdvancedHint: 'Passer en mode Avancé',
      switchToSimpleHint: 'Revenir en mode Simple',
    },
    home: {
      headline: 'Votre art. Votre preuve.',
      subline: 'Toujours gratuit. Sans compte. Sans envoi d’image.',
      localOnlyBadge: '100 % local sur votre appareil',
      createCardTitle: 'Certifier une œuvre',
      verifyCardTitle: 'Vérifier une œuvre',
      sampleDemoLink: '🔍 Essayer la vérification avec un dessin exemple',
    },
    create: {
      pageTitle: 'Signer mon dessin',
      step3Cta: 'Signer et enregistrer',
      celebrationTitle: 'Votre dessin signé est prêt !',
      backupCardTitle: '🔑 Sauvegarder la clé de secours (.chkey.json)',
    },
    verify: {
      pageTitle: 'Vérifier une image',
      verdictPassTitle: '✅ Œuvre authentique vérifiée !',
      verdictSnsTitle: '✅ Signature vérifiée via QR !',
      verdictWarnTitle: '⚠️ Sceau introuvable ou image modifiée',
    },
  }),
  de: makeFallbackSimple({
    mode: {
      simpleLabel: 'Einfach',
      advancedLabel: 'Erweitert',
      switchGroupAria: 'Zwischen Einfach- und Erweitert-Modus wechseln',
      switchToAdvancedHint: 'In den Erweitert-Modus wechseln',
      switchToSimpleHint: 'Zurück zum Einfach-Modus',
    },
    home: {
      headline: 'Deine Kunst. Dein Beweis.',
      subline: 'Immer kostenlos. Ohne Konto. Keine Bild-Uploads.',
      localOnlyBadge: '100 % lokal auf deinem Gerät',
      createCardTitle: 'Werk zertifizieren',
      verifyCardTitle: 'Werk prüfen',
      sampleDemoLink: '🔍 Prüfung mit einem Beispielbild testen',
    },
    create: {
      pageTitle: 'Meine Zeichnung signieren',
      step3Cta: 'Signieren & speichern',
      celebrationTitle: 'Deine signierte Zeichnung ist fertig!',
      backupCardTitle: '🔑 Wiederherstellungsschlüssel sichern (.chkey.json)',
    },
    verify: {
      pageTitle: 'Bild prüfen',
      verdictPassTitle: '✅ Authentisches Kunstwerk bestätigt!',
      verdictSnsTitle: '✅ Signatur per QR bestätigt!',
      verdictWarnTitle: '⚠️ Kein Siegel gefunden oder Bild verändert',
    },
  }),
  pt: makeFallbackSimple({
    mode: {
      simpleLabel: 'Simples',
      advancedLabel: 'Avançado',
      switchGroupAria: 'Alternar entre modo Simples e Avançado',
      switchToAdvancedHint: 'Mudar para modo Avançado',
      switchToSimpleHint: 'Voltar para modo Simples',
    },
    home: {
      headline: 'Sua arte. Sua prova.',
      subline: 'Sempre grátis. Sem cadastro. Sem envio de imagens.',
      localOnlyBadge: '100% local no seu dispositivo',
      createCardTitle: 'Certificar arte',
      verifyCardTitle: 'Verificar arte',
      sampleDemoLink: '🔍 Testar verificação com um desenho de exemplo',
    },
    create: {
      pageTitle: 'Assinar meu desenho',
      step3Cta: 'Assinar e salvar',
      celebrationTitle: 'Seu desenho assinado está pronto!',
      backupCardTitle: '🔑 Salvar chave de recuperação (.chkey.json)',
    },
    verify: {
      pageTitle: 'Verificar imagem',
      verdictPassTitle: '✅ Arte autêntica verificada!',
      verdictSnsTitle: '✅ Assinatura verificada via QR!',
      verdictWarnTitle: '⚠️ Selo não encontrado ou imagem alterada',
    },
  }),
  it: makeFallbackSimple({
    mode: {
      simpleLabel: 'Semplice',
      advancedLabel: 'Avanzata',
      switchGroupAria: 'Passa tra modalità Semplice e Avanzata',
      switchToAdvancedHint: 'Passa alla modalità Avanzata',
      switchToSimpleHint: 'Torna alla modalità Semplice',
    },
    home: {
      headline: 'La tua arte. La tua prova.',
      subline: 'Sempre gratis. Nessun account. Nessun caricamento.',
      localOnlyBadge: '100% locale sul tuo dispositivo',
      createCardTitle: 'Certifica opera',
      verifyCardTitle: 'Verifica opera',
      sampleDemoLink: '🔍 Prova la verifica con un disegno di esempio',
    },
    create: {
      pageTitle: 'Firma il mio disegno',
      step3Cta: 'Firma e salva',
      celebrationTitle: 'Il tuo disegno firmato è pronto!',
      backupCardTitle: '🔑 Salva chiave di recupero (.chkey.json)',
    },
    verify: {
      pageTitle: 'Controlla immagine',
      verdictPassTitle: '✅ Opera autentica verificata!',
      verdictSnsTitle: '✅ Firma verificata tramite QR!',
      verdictWarnTitle: '⚠️ Sigillo non trovato o immagine modificata',
    },
  }),
  ar: makeFallbackSimple({
    mode: {
      simpleLabel: 'بسيط',
      advancedLabel: 'متقدم',
      switchGroupAria: 'التبديل بين الوضع البسيط والمتقدم',
      switchToAdvancedHint: 'التبديل إلى الوضع المتقدم',
      switchToSimpleHint: 'العودة إلى الوضع البسيط',
    },
    home: {
      headline: 'فنك. دليلك.',
      subline: 'مجاني دائماً · بدون تسجيل · بدون رفع الصور',
      localOnlyBadge: 'يعمل 100% محلياً على جهازك فقط',
      createCardTitle: 'توثيق العمل',
      verifyCardTitle: 'التحقق من العمل',
      sampleDemoLink: '🔍 جرّب التحقق باستخدام رسمة تجريبية',
    },
    create: {
      pageTitle: 'توقيع رسمتي',
      step3Cta: 'توقيع وحفظ الصورة',
      celebrationTitle: 'رسمتك الموقّعة جاهزة!',
      backupCardTitle: '🔑 حفظ مفتاح الاسترداد (.chkey.json)',
    },
    verify: {
      pageTitle: 'فحص الصورة',
      verdictPassTitle: '✅ عمل أصلي موثّق!',
      verdictSnsTitle: '✅ تم التحقق من التوقيع عبر رمز QR!',
      verdictWarnTitle: '⚠️ لم يتم العثور على ختم أو تم تعديل الصورة',
    },
  }),
};
