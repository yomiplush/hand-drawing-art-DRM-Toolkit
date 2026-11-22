import type { SupportedLocale } from '../core/storage/consent';

export interface SeoPageMeta {
  title: string;
  description: string;
  keywords: string;
}

export interface SeoFaqItem {
  q: string;
  a: string;
}

export interface SeoTranslations {
  home: SeoPageMeta;
  create: SeoPageMeta;
  createStudio: SeoPageMeta;
  verify: SeoPageMeta;
  tutorial: SeoPageMeta;
  keys: SeoPageMeta;
  exchange?: SeoPageMeta;
  docs: SeoPageMeta;
  privacy: SeoPageMeta;
  homeFaqTitle: string;
  homeFaqSubtitle: string;
  homeFaqs: SeoFaqItem[];
}

export const SEO_I18N: Record<SupportedLocale, SeoTranslations> = {
  en: {
    home: {
      title: 'Certified Handmade — Hand-Drawing Artist Local DRM, Encryption & Offline Provenance',
      description:
        'Open-source, 100% local-first & standalone DRM toolkit for hand-drawing artists. Sign lossless PNG artwork with Ed25519, SHA-256 & AES-256-GCM encryption, embed verification QR codes, and verify offline without servers.',
      keywords:
        'Hand-drawing Artist, Hand-drawn Art DRM, DRM, Encryption, Local-First, Standalone, Offline PWA, Ed25519, SHA-256, AES-256-GCM, Cryptographic Art Provenance, QR Artwork Verification',
    },
    create: {
      title: 'Create Hand-Drawn Art DRM Certificate & Encrypted PNG QR | Certified Handmade',
      description:
        'Sign your hand-drawn artwork locally with Ed25519 cryptographic signatures and SHA-256 pixel hashing. Export lossless PNGs with an outer QR frame or encrypted key proof—zero server upload.',
      keywords:
        'Create Art Certificate, Hand-drawn Art DRM, Ed25519 Signing, Lossless PNG QR, Local Encryption, Standalone Art Provenance',
    },
    createStudio: {
      title: 'Manual In-Image QR Studio — Translucent PNG DRM Overlay | Certified Handmade',
      description:
        'Place, resize, rotate, and blend translucent cryptographic DRM QR codes directly inside your illustration canvas with real-time scannability checks and masked pixel integrity.',
      keywords:
        'In-Image QR Studio, Translucent QR Code Art, Hand-drawing DRM, Standalone PNG Signer, Masked Pixel Integrity',
    },
    verify: {
      title: 'Verify Hand-Drawn Artwork, Ed25519 Signature & QR Proof | Certified Handmade',
      description:
        'Verify Ed25519 artwork signatures, SHA-256 canonical pixel integrity, #proof= URL fragments, and locally trusted artist keys 100% locally offline via PNG upload, camera QR, or clipboard.',
      keywords:
        'Verify Artwork DRM, QR Proof Verifier, Ed25519 Signature Check, SHA-256 Pixel Integrity, Offline Verification',
    },
    tutorial: {
      title: 'Step-by-Step Guide to Local Hand-Drawing Art DRM | Certified Handmade',
      description:
        'Beginner-friendly standalone guide: generate an encrypted Ed25519 signing key, embed a verification QR into your hand-drawn PNG, and choose ARR or Creative Commons licenses.',
      keywords:
        'Art DRM Tutorial, Hand-drawing Artist Guide, Ed25519 Key Setup, Artwork Licensing Guide, Local-First Signing',
    },
    exchange: {
      title: 'CHM Public-Key Exchange — Share & Verify Ed25519 Keys | Certified Handmade',
      description:
        'Share your Ed25519 artist public key via portable #key= URLs, QR codes, or JSON, and verify SHA-256 fingerprints locally offline without servers.',
      keywords:
        'CHM-Exchange, Ed25519 Public-Key Exchange, Artist Fingerprint Verification, QR Key Sharing, Offline Trust',
    },
    keys: {
      title: 'Local Signing Keys & AES-256-GCM Encrypted Backup | Certified Handmade',
      description:
        'Generate Ed25519 artist identity keys in your browser and export passphrase-encrypted .chkey.json backups protected with AES-256-GCM & PBKDF2-SHA256—no accounts or cloud.',
      keywords:
        'Ed25519 Artist Key, AES-256-GCM Key Backup, Local Key Management, Standalone Cryptography, PBKDF2-SHA256',
    },
    docs: {
      title: 'Cryptographic Architecture, SPEC & License Docs | Certified Handmade',
      description:
        'Technical reference for Certified Handmade: RFC 8949 CBOR proof schema, RGBA8 canonical SHA-256 digests, Protocol v1/v2 QR masks, AES-256-GCM backups, and license definitions.',
      keywords:
        'Art DRM Specification, RFC 8949 CBOR, Ed25519 Provenance Spec, AES-256-GCM Encryption, Cryptographic Art Docs',
    },
    privacy: {
      title: 'Privacy Policy & GDPR Local-Only Architecture | Certified Handmade',
      description:
        'GDPR privacy disclosure: zero tracking, zero analytics, strict connect-src self CSP, and 100% on-device local processing of artworks and cryptographic keys.',
      keywords:
        'Privacy Policy, GDPR Compliance, Zero Telemetry, Local-Only Web App, Offline Privacy',
    },
    homeFaqTitle: 'Frequently Asked Questions — Standalone Local Art DRM',
    homeFaqSubtitle:
      'Clear answers for hand-drawing artists looking for serverless encryption, offline provenance, and long-term proof.',
    homeFaqs: [
      {
        q: 'What is Local Hand-Drawing Art DRM and how is it different from cloud platforms?',
        a: 'Certified Handmade is a standalone, local-first DRM and cryptographic provenance toolkit. Instead of locking your illustrations inside a vendor cloud, database, or blockchain, it binds your Ed25519 digital signature, copyright license, and SHA-256 canonical pixel hash directly into a lossless PNG and scannable QR code on your own device.',
      },
      {
        q: 'Does it really run 100% locally and standalone offline without any server upload?',
        a: 'Yes. Every operation—key generation, SHA-256 hashing, Ed25519 signing, AES-256-GCM key backup encryption, and QR encoding/decoding—runs inside your browser with Content-Security-Policy connect-src \'self\'. Once installed or cached as a PWA, it works completely offline.',
      },
      {
        q: 'How are my artist keys and backups encrypted?',
        a: 'Signing keys use Ed25519 cryptography. Exported .chkey.json key backups are encrypted locally with AES-256-GCM using a 310,000-iteration PBKDF2-SHA256 key derivation from your passphrase, so you can keep portable cold backups safely without accounts.',
      },
      {
        q: 'Why does Certified Handmade say "Your artwork should outlive the platform that certifies it"?',
        a: 'Platforms and startups shut down, change terms, or break links. Certified Handmade encodes compact RFC 8949 CBOR proofs inside standard PNG tEXt chunks and self-contained QR/#proof= links under an open MIT specification (SPEC.md), so anyone can verify your work decades from now even if the website disappears.',
      },
      {
        q: 'How do Outer QR Border (v1) and Translucent In-Image QR Studio (v2) verify pixels without breaking hashes?',
        a: 'In Protocol v1, the QR code sits strictly outside the artwork rectangle [x, y, w, h]. In Protocol v2 (In-Image QR Studio), a masked rectangle qrMask excludes only the translucent QR area before SHA-256 hashing—so both the signed PNG and the clean original illustration verify bit-for-bit.',
      },
    ],
  },
  ja: {
    home: {
      title: 'Certified Handmade — 手描きアーティスト向け 完全ローカル駆動・スタンドアローン手描きDRM＆暗号署名',
      description:
        '手描きアーティストのためのオープンソース・完全ローカル駆動・スタンドアローン手描きDRMツール。サーバー送信ゼロでEd25519電子署名・SHA-256ピクセルハッシュ・AES-256-GCM暗号化バックアップを作成し、PNGへのQRコード埋め込みとオフライン検証を実現。',
      keywords:
        '手描き, 手描きDRM, イラストDRM, 暗号化, ローカル駆動, スタンドアローン, 完全ローカル, オフラインPWA, Hand-drawing Artist, DRM, Ed25519, SHA-256, AES-256-GCM, 電子署名',
    },
    create: {
      title: '手描き証明書を作成・PNGへQRコード埋め込み | Certified Handmade 手描きDRM',
      description:
        '手描きイラストを外部サーバーへ一切送信せず、ブラウザ内でEd25519電子署名とSHA-256ハッシュを計算。外枠QRフレーム付きPNGやAES-256-GCM対応の署名データをローカル生成します。',
      keywords:
        '手描きDRM, 証明書作成, イラスト暗号署名, PNG QRコード埋め込み, ローカル駆動, スタンドアローン, Ed25519',
    },
    createStudio: {
      title: 'インイメージQRスタジオ — 半透明QR配置・手描きDRM | Certified Handmade',
      description:
        '手描きイラストの絵柄の上に半透明の暗号証明QRコードを自由配置・サイズ調整・回転し、リアルタイム読取チェックとマスク領域整合性付きPNGをローカル書き出しできます。',
      keywords:
        '半透明QRコード, 画像内QRスタジオ, 手描きDRM, イラスト透かしQR, ローカル処理',
    },
    verify: {
      title: '手描き証明書・Ed25519署名・QRコードをオフライン検証 | Certified Handmade',
      description:
        '署名付きPNG・カメラQRスキャン・クリップボード貼り付け・#proof= URLからEd25519暗号署名、SHA-256ピクセル改ざんの有無、ローカル信頼済み作者鍵を完全オフラインで検証。',
      keywords:
        '手描き検証, DRM検証, Ed25519署名検証, ピクセル整合性, ローカル駆動, オフライン検証, QRスキャン',
    },
    tutorial: {
      title: 'はじめての手描きDRM ステップバイステップガイド | Certified Handmade',
      description:
        '初心者向けチュートリアル：ローカル暗号鍵の作成、手描きイラストへのQR証明書埋め込み、ARR（無断利用禁止）やクリエイティブ・コモンズライセンスの選び方をわかりやすく解説。',
      keywords:
        '手描きDRM 使い方, イラスト保護, 暗号鍵作成, ライセンス解説, スタンドアローン',
    },
    exchange: {
      title: 'CHM 公開鍵エクスチェンジ — Ed25519 公開鍵の共有・ローカル検証 | Certified Handmade',
      description:
        'Ed25519作者公開鍵を #key= URL・QRコード・JSONで安全に共有し、サーバー送信なしでSHA-256フィンガープリントをローカル検証・信頼登録できます。',
      keywords:
        'CHM-Exchange, Ed25519 公開鍵交換, フィンガープリント検証, QR公開鍵共有, 完全ローカル',
    },
    keys: {
      title: 'ローカル署名鍵管理＆AES-256-GCM暗号化バックアップ | Certified Handmade',
      description:
        'Ed25519作家鍵をブラウザ内で完結生成し、パスフレーズを用いたPBKDF2-SHA256 + AES-256-GCM暗号化バックアップ（.chkey.json）として安全に保存・復元できます。',
      keywords:
        'Ed25519 署名鍵, AES-256-GCM 暗号化バックアップ, ローカル鍵管理, スタンドアローンDRM',
    },
    docs: {
      title: '暗号仕様・SPEC・ライセンス＆アーキテクチャドキュメント | Certified Handmade',
      description:
        'Certified Handmade技術資料：RFC 8949 CBOR証明フォーマット、RGBA8正規化SHA-256検証、プロトコルv1/v2マスク仕様、AES-256-GCM暗号化、ライセンス一覧を公開。',
      keywords:
        '手描きDRM 仕様, RFC 8949 CBOR, AES-256-GCM, Ed25519 暗号署名, プロトコル仕様',
    },
    privacy: {
      title: 'プライバシーポリシー & GDPR完全ローカル処理方針 | Certified Handmade',
      description:
        'GDPR準拠のプライバシー開示：解析タグ・追跡Cookieゼロ、CSP connect-src self制限、作品画像・秘密鍵の完全ローカル端末内処理について。',
      keywords: 'プライバシーポリシー, GDPR, 完全ローカル, トラッキングなし, スタンドアローン',
    },
    homeFaqTitle: 'よくある質問（FAQ）— ローカル駆動・スタンドアローン手描きDRM',
    homeFaqSubtitle:
      'サーバー不要の暗号署名・オフライン動作・プラットフォームに依存しない長期証明についての解説です。',
    homeFaqs: [
      {
        q: '手描きDRM（ローカル暗号署名）とは？クラウドサービスやNFTと何が違いますか？',
        a: 'Certified Handmadeは、手描きアーティストのための完全ローカル駆動・スタンドアローン型DRM／来歴証明ツールです。作品をクラウドや独自ブロックチェーンに預ける必要がなく、Ed25519電子署名・ライセンス条件・SHA-256ピクセルハッシュを可逆PNGとQRコード自体に自己完結で埋め込みます。',
      },
      {
        q: '本当に画像や秘密鍵をサーバーへ送信せず、完全オフラインで動作しますか？',
        a: 'はい。鍵生成、SHA-256計算、Ed25519署名、AES-256-GCM暗号化バックアップ、QR生成・読取まですべてブラウザ内で完結します。CSP（connect-src \'self\'）により外部通信を遮断しており、PWAとして端末に保存すればインターネット接続なしでも動作します。',
      },
      {
        q: '秘密鍵の暗号化バックアップにはどの暗号方式が使われていますか？',
        a: '署名鍵にはEd25519を採用しています。.chkey.json形式のバックアップ書き出し時は、パスフレーズからPBKDF2-SHA256（310,000回反復）で導出した鍵を使い、AES-256-GCMで強固に暗号化されるため、アカウント登録なしで安全に鍵を保管できます。',
      },
      {
        q: '「あなたの作品は、それを証明するプラットフォームより長く生き続けるべきだ」の意図は？',
        a: 'WebサービスやSNSは終了や仕様変更で検証リンクが失われるリスクがあります。本ツールは公開仕様（SPEC.md / MIT）に基づくRFC 8949 CBORバイナリ証明をPNG内部（tEXtチャンク）とQR/#proof= URLに自己保持するため、仮に本サイトが将来無くなっても互換仕様で半永久的に検証できます。',
      },
      {
        q: '外枠QR（v1）と半透明インイメージQRスタジオ（v2）の違いは何ですか？',
        a: '外枠QR（v1）は作品領域の外側の余白にQRを配置します。一方インイメージQRスタジオ（v2）では画像内の半透明QR領域だけをqrMaskで除外してSHA-256ハッシュを計算するため、QR入りPNGでも未加工の元イラストでも1ビット単位で一致検証できます。',
      },
    ],
  },
  'zh-CN': {
    home: {
      title: 'Certified Handmade — 手绘艺术家本地 DRM 与加密溯源工具',
      description:
        '开源、100% 本地驱动与独立运行的离线手绘 DRM 工具。使用 Ed25519 签名、SHA-256 与 AES-256-GCM 加密保护无损 PNG 作品，零服务器上传。',
      keywords: '手绘DRM, Hand-drawing Artist, 本地驱动, 独立运行, 加密, Ed25519, AES-256-GCM, 离线PWA',
    },
    create: {
      title: '创建手绘作品加密证书与 QR 码 | Certified Handmade',
      description: '在浏览器本地生成 Ed25519 签名与 SHA-256 哈希，导出带外框或内嵌 QR 码的无损 PNG。',
      keywords: '创建作品证书, 手绘DRM, Ed25519, 无损PNG, 本地加密',
    },
    createStudio: {
      title: '图内半透明 QR 工作室 | Certified Handmade',
      description: '在插画画布上自由调整半透明防伪 QR 码的位置、大小与透明度，并实时检查可扫描性。',
      keywords: '图内QR工作室, 半透明二维码, 手绘DRM, 独立签名',
    },
    verify: {
      title: '离线验证手绘证明、Ed25519 签名与像素完整性 | Certified Handmade',
      description: '在本地离线校验 Ed25519 签名、SHA-256 像素完整性、#proof= 链接及本地受信任作者密钥。',
      keywords: '作品验真, Ed25519校验, SHA-256像素验证, 离线验证, 二维码校验',
    },
    tutorial: {
      title: '手绘 DRM 新手分步教程 | Certified Handmade',
      description: '零基础入门指南：创建本地加密密钥、为手绘作品嵌入 QR 证书并选择合适的版权许可。',
      keywords: '手绘DRM教程, 密钥生成, 版权许可指南',
    },
    keys: {
      title: '本地签名密钥与 AES-256-GCM 加密备份 | Certified Handmade',
      description: '本地生成 Ed25519 密钥对，并通过 AES-256-GCM 与 PBKDF2-SHA256 密码加密导出备份。',
      keywords: 'Ed25519密钥, AES-256-GCM加密备份, 本地密钥管理',
    },
    docs: {
      title: '加密架构、协议规范与许可指南文档 | Certified Handmade',
      description: '技术文档：RFC 8949 CBOR 架构、SHA-256 像素摘要、Protocol v1/v2 掩码机制与加密备份说明。',
      keywords: 'DRM规范, RFC 8949 CBOR, AES-256-GCM, 加密架构',
    },
    privacy: {
      title: '隐私政策与 GDPR 纯本地架构说明 | Certified Handmade',
      description: '符合 GDPR 的隐私声明：零追踪、零外部请求，所有画作与密钥均在设备本地处理。',
      keywords: '隐私政策, GDPR, 纯本地应用, 零追踪',
    },
    homeFaqTitle: '常见问题 — 本地独立手绘 DRM',
    homeFaqSubtitle: '关于无服务器加密、离线溯源及长期防伪验证的常见解答。',
    homeFaqs: [
      {
        q: '什么是本地手绘 DRM？与云平台或区块链有何不同？',
        a: 'Certified Handmade 是完全本地驱动、独立运行的开源版权溯源工具。无需依赖第三方云数据库或上链，即可将 Ed25519 签名、授权许可和 SHA-256 像素摘要直接写入无损 PNG 和二维码中。',
      },
      {
        q: '作品和私钥真的不会上传到任何服务器吗？',
        a: '是的。所有计算均在浏览器内执行，严格受 CSP connect-src \'self\' 限制。安装 PWA 后可彻底离线运行。',
      },
      {
        q: '密钥备份如何加密保存？',
        a: '备份文件（.chkey.json）使用您设置的口令经 PBKDF2-SHA256（310,000 次迭代）派生密钥，并通过 AES-256-GCM 在本地加密。',
      },
      {
        q: '为什么说“你的作品应当比认证它的平台更长久”？',
        a: '证明载荷基于开放的 MIT 规范（SPEC.md）以 RFC 8949 CBOR 格式自包含存储，即使未来本站不再运行，任何兼容工具仍可验证您的作品。',
      },
      {
        q: '外框二维码 (v1) 与图内半透明二维码工作室 (v2) 有何区别？',
        a: 'v1 将二维码放在作品外框边距；v2（图内 QR 工作室）会在计算 SHA-256 前通过 qrMask 排除半透明二维码区域，使带二维码 PNG 与原始未修改作品都能精确验证通过。',
      },
    ],
  },
  'zh-TW': {
    home: {
      title: 'Certified Handmade — 手繪創作者本地 DRM 與加密溯源工具',
      description:
        '開源、100% 本地驅動且可獨立離線運行的手繪 DRM 工具。使用 Ed25519 簽章、SHA-256 與 AES-256-GCM 加密保護無損 PNG 作品，零伺服器上傳。',
      keywords: '手繪DRM, Hand-drawing Artist, 本地驅動, 獨立運行, 加密, Ed25519, AES-256-GCM, 離線PWA',
    },
    create: {
      title: '建立手繪作品加密憑證與 QR Code | Certified Handmade',
      description: '在瀏覽器本地產生 Ed25519 數位簽章與 SHA-256 雜湊，匯出附帶 QR 碼的無損 PNG。',
      keywords: '建立作品憑證, 手繪DRM, Ed25519, 無損PNG, 本地加密',
    },
    createStudio: {
      title: '圖內半透明 QR 工作室 | Certified Handmade',
      description: '在插畫畫布上自由調整半透明驗證 QR Code 的位置、大小與透明度，並即時檢測可掃描性。',
      keywords: '圖內QR工作室, 半透明QR碼, 手繪DRM, 獨立簽章',
    },
    verify: {
      title: '離線驗證手繪證明、Ed25519 簽章與像素完整性 | Certified Handmade',
      description: '於裝置本地離線驗證 Ed25519 簽章、SHA-256 像素完整性、#proof= 連結與本地信任的創作者金鑰。',
      keywords: '作品驗證, Ed25519簽章, SHA-256驗證, 離線驗證',
    },
    tutorial: {
      title: '手繪 DRM 新手步驟教學 | Certified Handmade',
      description: '初學者指南：建立本地加密金鑰、為手繪作品嵌入 QR 憑證與選擇授權條款。',
      keywords: '手繪DRM教學, 金鑰建立, 授權條款指南',
    },
    keys: {
      title: '本地簽章金鑰與 AES-256-GCM 加密備份 | Certified Handmade',
      description: '在瀏覽器內生成 Ed25519 金鑰對，並以 AES-256-GCM 與 PBKDF2-SHA256 加密匯出備份檔。',
      keywords: 'Ed25519金鑰, AES-256-GCM加密備份, 本地金鑰管理',
    },
    docs: {
      title: '加密架構、協議規格與授權文件 | Certified Handmade',
      description: '技術參考：RFC 8949 CBOR 結構、SHA-256 像素摘要、Protocol v1/v2 遮罩設計與 AES-256-GCM 備份說明。',
      keywords: 'DRM規格, RFC 8949 CBOR, AES-256-GCM, 加密架構',
    },
    privacy: {
      title: '隱私權政策與 GDPR 純本地處理聲明 | Certified Handmade',
      description: '符合 GDPR 的隱私宣告：零追蹤、零外部網路請求，所有畫作與私鑰皆於本機裝置處理。',
      keywords: '隱私權政策, GDPR, 純本地應用, 零追蹤',
    },
    homeFaqTitle: '常見問題 — 本地獨立手繪 DRM',
    homeFaqSubtitle: '解答無伺服器加密簽章、離線驗證與跨時代作品存證相關疑問。',
    homeFaqs: [
      {
        q: '什麼是本地手繪 DRM？與雲端平台或區塊鏈有何不同？',
        a: 'Certified Handmade 是完全本地驅動、獨立運作的開源溯源工具。不需帳號或雲端資料庫，直接將 Ed25519 簽章、授權標記與 SHA-256 像素雜湊嵌入無損 PNG 與 QR Code 中。',
      },
      {
        q: '作品與私鑰真的完全不會上傳伺服器嗎？',
        a: '是的。所有運算皆於瀏覽器本地執行，並透過 CSP connect-src \'self\' 封鎖外部傳輸。安裝 PWA 後可完全離線使用。',
      },
      {
        q: '金鑰備份是如何加密的？',
        a: '.chkey.json 備份檔會利用密碼與 PBKDF2-SHA256（310,000 次疊代）衍生金鑰，再以 AES-256-GCM 本機加密。',
      },
      {
        q: '為何強調「您的作品應該比認證它的平台更長久」？',
        a: '依循開放 MIT 規格（SPEC.md）以 RFC 8949 CBOR 自包含格式儲存證明，即使本網站未來下線，相容工具依然能獨立驗證。',
      },
      {
        q: '外框 QR（v1）與圖內半透明 QR 工作室（v2）有什麼差別？',
        a: 'v1 會將 QR 碼置於作品外框邊距；v2（圖內 QR 工作室）在計算 SHA-256 前僅透過 qrMask 排除半透明 QR 區域，因此匯出的 PNG 與原始插畫檔案都能精確比對驗證。',
      },
    ],
  },
  ko: {
    home: {
      title: 'Certified Handmade — 손그림 아티스트용 로컬 DRM 및 암호화 증명 도구',
      description:
        '오픈소스 100% 로컬 구동·스탠드얼론 오프라인 손그림 DRM 툴킷. 서버 업로드 없이 Ed25519 전자서명, SHA-256, AES-256-GCM 암호화로 무손실 PNG 작품을 보호하세요.',
      keywords: '손그림 DRM, Hand-drawing Artist, 로컬 구동, 스탠드얼론, 암호화, Ed25519, AES-256-GCM, 오프라인 PWA',
    },
    create: {
      title: '손그림 DRM 인증서 생성 및 QR 삽입 | Certified Handmade',
      description: '브라우저 로컬에서 Ed25519 서명과 SHA-256 해시를 생성해 QR 코드가 포함된 무손실 PNG로 저장합니다.',
      keywords: '작품 인증서 생성, 손그림 DRM, Ed25519, 무손실 PNG',
    },
    createStudio: {
      title: '인이미지 반투명 QR 스튜디오 | Certified Handmade',
      description: '일러스트 위에 반투명 암호화 QR 코드를 직접 배치·크기 조절·회전하고 스캔 가능 여부를 실시간으로 확인하세요.',
      keywords: '인이미지 QR 스튜디오, 반투명 QR, 손그림 DRM',
    },
    verify: {
      title: '오프라인 작품 검증, Ed25519 서명 및 QR 확인 | Certified Handmade',
      description: 'Ed25519 서명, SHA-256 픽셀 무결성, #proof= URL 및 로컬 신뢰 작가 키를 100% 로컬 오프라인에서 검증합니다.',
      keywords: '작품 검증, Ed25519 서명, 픽셀 무결성, 오프라인 검증',
    },
    tutorial: {
      title: '초보자를 위한 로컬 손그림 DRM 튜토리얼 | Certified Handmade',
      description: '단계별 가이드: 로컬 서명 키 생성, PNG QR 인증서 발급, 저작권 라이선스 선택 방법을 안내합니다.',
      keywords: '손그림 DRM 튜토리얼, 키 생성, 저작권 라이선스',
    },
    keys: {
      title: '로컬 서명 키 관리 및 AES-256-GCM 암호화 백업 | Certified Handmade',
      description: '브라우저에서 Ed25519 키를 생성하고 PBKDF2-SHA256 + AES-256-GCM 암호화 백업(.chkey.json)으로 안전하게 보관하세요.',
      keywords: 'Ed25519 키, AES-256-GCM 백업, 로컬 키 관리',
    },
    docs: {
      title: '암호화 아키텍처, SPEC 및 라이선스 문서 | Certified Handmade',
      description: '기술 문서: RFC 8949 CBOR 증명 스키마, SHA-256 무결성 검증, Protocol v1/v2 마스크 규격 및 AES-256-GCM 백업.',
      keywords: 'DRM 규격, RFC 8949 CBOR, AES-256-GCM, 암호화 아키텍처',
    },
    privacy: {
      title: '개인정보 처리방침 및 GDPR 로컬 전용 안내 | Certified Handmade',
      description: 'GDPR 준수 고지: 추적 및 외부 통신 제로, 모든 작품과 암호 키를 기기 내부에서만 처리합니다.',
      keywords: '개인정보 처리방침, GDPR, 로컬 전용 웹앱',
    },
    homeFaqTitle: '자주 묻는 질문 — 스탠드얼론 로컬 아트 DRM',
    homeFaqSubtitle: '서버 없는 암호화 서명, 오프라인 검증, 장기 보존 증명에 대한 안내입니다.',
    homeFaqs: [
      {
        q: '로컬 손그림 DRM은 클라우드 서비스나 NFT와 무엇이 다른가요?',
        a: 'Certified Handmade는 외부 서버나 계정 없이 독립 실행되는 오픈소스 DRM 도구입니다. Ed25519 서명과 라이선스, SHA-256 픽셀 해시를 무손실 PNG와 QR 코드 안에 자체 내장합니다.',
      },
      {
        q: '정말 작품과 개인 키가 서버로 전송되지 않나요?',
        a: '네. CSP connect-src \'self\' 정책으로 외부 통신을 차단하며, PWA 설치 후 완전히 오프라인으로 작동합니다.',
      },
      {
        q: '서명 키 백업은 어떻게 암호화되나요?',
        a: '.chkey.json 백업은 입력한 암호로부터 PBKDF2-SHA256(310,000회)로 키를 유도한 뒤 AES-256-GCM으로 로컬 암호화합니다.',
      },
      {
        q: '“작품은 그것을 인증하는 플랫폼보다 오래 살아남아야 합니다”의 의미는 무엇인가요?',
        a: '공개 MIT 사양(SPEC.md) 기반의 RFC 8949 CBOR 포맷으로 증명이 자체 포함되므로, 향후 플랫폼이 사라져도 호환 도구로 검증할 수 있습니다.',
      },
      {
        q: '외곽 여백 QR(v1)과 인이미지 반투명 QR 스튜디오(v2)는 어떻게 다른가요?',
        a: 'v1은 작품 바깥 여백에 QR을 배치하며, v2(인이미지 스튜디오)는 SHA-256 계산 시 qrMask 영역만 제외해 QR이 삽입된 PNG와 원본 그림 모두 비트 단위로 무결성 검증이 가능합니다.',
      },
    ],
  },
  ru: {
    home: {
      title: 'Certified Handmade — Локальный DRM и криптографическая защита для художников',
      description:
        'Открытый, 100% локальный и автономный офлайн-DRM инструмент для художников-иллюстраторов. Подписывайте PNG-работы через Ed25519, SHA-256 и AES-256-GCM без отправки на сервер.',
      keywords: 'Hand-drawing Artist, DRM для иллюстраций, шифрование, локальный DRM, автономный PWA, Ed25519, AES-256-GCM',
    },
    create: {
      title: 'Создать локальный DRM-сертификат и QR для PNG | Certified Handmade',
      description: 'Локальная генерация подписи Ed25519 и хеша SHA-256 с экспортом PNG без потерь и QR-кодом.',
      keywords: 'создать сертификат, DRM для арта, Ed25519, локальное шифрование',
    },
    createStudio: {
      title: 'Студия полупрозрачных QR-кодов внутри изображения | Certified Handmade',
      description: 'Настраивайте позицию, масштаб и прозрачность DRM QR-кода прямо на холсте с проверкой читаемости.',
      keywords: 'QR студия, полупрозрачный QR, DRM для рисунков',
    },
    verify: {
      title: 'Офлайн-проверка подписи Ed25519, QR и целостности PNG | Certified Handmade',
      description: 'Проверяйте подпись Ed25519, целостность пикселей SHA-256, ссылки #proof= и доверенные ключи полностью локально.',
      keywords: 'проверка подлинности, Ed25519, SHA-256, офлайн проверка',
    },
    tutorial: {
      title: 'Пошаговое руководство по локальному DRM для художников | Certified Handmade',
      description: 'Простое руководство: создание ключа, встраивание QR-сертификата в PNG и выбор лицензии.',
      keywords: 'руководство DRM, ключи Ed25519, лицензии для художников',
    },
    keys: {
      title: 'Локальные ключи и резервные копии AES-256-GCM | Certified Handmade',
      description: 'Создавайте ключи Ed25519 в браузере и сохраняйте зашифрованные AES-256-GCM / PBKDF2-SHA256 резервные копии.',
      keywords: 'ключи Ed25519, шифрование AES-256-GCM, локальное хранение ключей',
    },
    docs: {
      title: 'Спецификация, криптография и лицензии | Certified Handmade',
      description: 'Техническая документация: RFC 8949 CBOR, SHA-256 хеш пикселей RGBA8, маски Protocol v1/v2 и AES-256-GCM.',
      keywords: 'спецификация DRM, RFC 8949 CBOR, AES-256-GCM, Ed25519',
    },
    privacy: {
      title: 'Политика конфиденциальности и GDPR (только локально) | Certified Handmade',
      description: 'Уведомление GDPR: нулевая телеметрия, строгий CSP и 100% локальная обработка файлов на устройстве.',
      keywords: 'политика конфиденциальности, GDPR, без телеметрии',
    },
    homeFaqTitle: 'Частые вопросы — Автономный локальный DRM',
    homeFaqSubtitle: 'Ответы о бессерверном шифровании, офлайн-проверке и долговечности доказательств.',
    homeFaqs: [
      {
        q: 'Чем локальный DRM отличается от облачных платформ и NFT?',
        a: 'Certified Handmade работает автономно в браузере без серверов и баз данных, встраивая подпись Ed25519, лицензию и хеш SHA-256 прямо в PNG и QR-код.',
      },
      {
        q: 'Изображения и приватные ключи точно никуда не отправляются?',
        a: 'Да. Политика CSP connect-src \'self\' блокирует внешние запросы, а PWA-версия работает полностью офлайн.',
      },
      {
        q: 'Как шифруются резервные копии ключей?',
        a: 'Файлы .chkey.json шифруются локально алгоритмом AES-256-GCM с ключом из пароля через PBKDF2-SHA256 (310 000 итераций).',
      },
      {
        q: 'Что означает девиз о том, что работа переживёт платформу?',
        a: 'Открытый формат RFC 8949 CBOR (SPEC.md) хранит всё необходимое внутри самого файла и QR, позволяя проверять подпись даже без этого сайта.',
      },
      {
        q: 'Чем внешняя рамка QR (v1) отличается от студии QR внутри изображения (v2)?',
        a: 'В v1 QR размещается на внешней рамке, а в v2 (Студия QR) маска qrMask исключает только зону полупрозрачного QR перед расчётом SHA-256 — поэтому проверяются и PNG с QR, и оригинал.',
      },
    ],
  },
  uk: {
    home: {
      title: 'Certified Handmade — Локальний DRM і криптографічний захист для художників',
      description:
        'Відкритий, 100% локальний і автономний офлайн-DRM інструмент для художників. Підписуйте PNG за допомогою Ed25519, SHA-256 та шифрування AES-256-GCM без жодного сервера.',
      keywords: 'Hand-drawing Artist, DRM для ілюстрацій, шифрування, локальний DRM, автономний PWA, Ed25519, AES-256-GCM',
    },
    create: {
      title: 'Створити локальний DRM-сертифікат і QR у PNG | Certified Handmade',
      description: 'Підписуйте малюнки локально за допомогою Ed25519 і SHA-256 з експортом PNG без втрат та QR-кодом.',
      keywords: 'створити сертифікат, DRM для арту, Ed25519, локальне шифрування',
    },
    createStudio: {
      title: 'Студія напівпрозорих QR-кодів у зображенні | Certified Handmade',
      description: 'Розміщуйте й налаштовуйте напівпрозорі DRM QR-коди безпосередньо на ілюстрації з перевіркою зчитуваності.',
      keywords: 'QR студія, напівпрозорий QR, DRM для малюнків',
    },
    verify: {
      title: 'Офлайн-перевірка підпису Ed25519, QR та цілісності PNG | Certified Handmade',
      description: 'Перевіряйте підпис Ed25519, цілісність пікселів SHA-256, посилання #proof= і довірені ключі повністю локально.',
      keywords: 'перевірка автентичності, Ed25519, SHA-256, офлайн перевірка',
    },
    tutorial: {
      title: 'Покроковий туторіал з локального DRM для художників | Certified Handmade',
      description: 'Зрозумілий гід: створення ключа Ed25519, додавання QR-сертифіката у PNG та вибір ліцензії.',
      keywords: 'туторіал DRM, ключі Ed25519, ліцензії для митців',
    },
    keys: {
      title: 'Локальні ключі та зашифровані бекапи AES-256-GCM | Certified Handmade',
      description: 'Генеруйте ключі Ed25519 у браузері та експортуйте бекапи з шифруванням AES-256-GCM і PBKDF2-SHA256.',
      keywords: 'ключі Ed25519, шифрування AES-256-GCM, локальне керування ключами',
    },
    docs: {
      title: 'Криптоархітектура, SPEC та довідник ліцензій | Certified Handmade',
      description: 'Технічна документація: схема RFC 8949 CBOR, хеш RGBA8 SHA-256, маски Protocol v1/v2 та AES-256-GCM.',
      keywords: 'специфікація DRM, RFC 8949 CBOR, AES-256-GCM, Ed25519',
    },
    privacy: {
      title: 'Політика конфіденційності та GDPR (лише локально) | Certified Handmade',
      description: 'Повідомлення GDPR: без аналітики й трекерів, суворий CSP і повністю локальна обробка файлів на пристрої.',
      keywords: 'політика конфіденційності, GDPR, без трекінгу',
    },
    homeFaqTitle: 'Поширені запитання — Автономний локальний DRM',
    homeFaqSubtitle: 'Відповіді про безсерверне шифрування, офлайн-перевірку та довговічність доказів.',
    homeFaqs: [
      {
        q: 'Чим локальний DRM відрізняється від хмарних платформ і NFT?',
        a: 'Certified Handmade працює автономно без серверів і баз даних, зберігаючи підпис Ed25519, ліцензію та хеш SHA-256 безпосередньо в PNG і QR-коді.',
      },
      {
        q: 'Чи справді зображення та ключі не передаються на сервер?',
        a: 'Так. Політика CSP connect-src \'self\' забороняє зовнішні запити, а PWA працює повністю офлайн.',
      },
      {
        q: 'Як шифруються резервні копії ключів?',
        a: 'Файли .chkey.json шифруються локально за допомогою AES-256-GCM з ключем, отриманим із парольної фрази через PBKDF2-SHA256 (310 000 ітерацій).',
      },
      {
        q: 'Чому робота має пережити платформу, що її засвідчує?',
        a: 'Відкритий формат RFC 8949 CBOR (SPEC.md) є самодостатнім, тому підпис можна перевірити через роки навіть за відсутності цього сайту.',
      },
      {
        q: 'Чим зовнішня рамка QR (v1) відрізняється від студії QR у зображенні (v2)?',
        a: 'У v1 QR розташовано на зовнішньому полі, а у v2 (Студія QR) маска qrMask виключає лише область напівпрозорого QR перед обчисленням SHA-256, тому перевіряються і PNG з QR, і оригінал.',
      },
    ],
  },
  es: {
    home: {
      title: 'Certified Handmade — DRM Local, Cifrado y Procedencia Offline para Ilustradores',
      description:
        'Herramienta DRM de código abierto, 100% local y autónoma para artistas de dibujo a mano. Firma PNG sin pérdida con Ed25519, SHA-256 y respaldo cifrado AES-256-GCM sin servidores.',
      keywords: 'Hand-drawing Artist, DRM artístico, cifrado local, aplicación autónoma, Ed25519, AES-256-GCM, PWA offline',
    },
    create: {
      title: 'Crear Certificado DRM y QR PNG | Certified Handmade',
      description: 'Firma tus ilustraciones localmente con Ed25519 y SHA-256 y exporta un PNG con QR verificable.',
      keywords: 'crear certificado artístico, DRM local, Ed25519, PNG sin pérdida',
    },
    createStudio: {
      title: 'Estudio QR Translúcido en Imagen | Certified Handmade',
      description: 'Coloca, escala y ajusta códigos QR DRM translúcidos dentro de tu ilustración con lectura en tiempo real.',
      keywords: 'Estudio QR, QR translúcido, DRM ilustración',
    },
    verify: {
      title: 'Verificar Obra, Firma Ed25519 y Prueba QR | Certified Handmade',
      description: 'Verifica firmas Ed25519, integridad de píxeles SHA-256, enlaces #proof= y claves locales de confianza sin conexión.',
      keywords: 'verificar obra, firma Ed25519, integridad SHA-256, verificación offline',
    },
    tutorial: {
      title: 'Guía Paso a Paso de DRM Local para Artistas | Certified Handmade',
      description: 'Aprende a generar tu clave cifrada, incrustar un QR de autenticidad y elegir licencias Creative Commons o ARR.',
      keywords: 'tutorial DRM arte, guía artistas, claves Ed25519',
    },
    keys: {
      title: 'Claves Locales y Respaldo Cifrado AES-256-GCM | Certified Handmade',
      description: 'Genera claves Ed25519 en tu navegador y guarda copias cifradas .chkey.json con AES-256-GCM y PBKDF2-SHA256.',
      keywords: 'claves Ed25519, cifrado AES-256-GCM, gestión local de claves',
    },
    docs: {
      title: 'Arquitectura Criptográfica, SPEC y Guía de Licencias | Certified Handmade',
      description: 'Referencia técnica: esquema RFC 8949 CBOR, hash RGBA8 SHA-256, máscaras Protocol v1/v2 y cifrado AES-256-GCM.',
      keywords: 'especificación DRM, RFC 8949 CBOR, AES-256-GCM, Ed25519',
    },
    privacy: {
      title: 'Política de Privacidad y Arquitectura Local GDPR | Certified Handmade',
      description: 'Aviso GDPR: cero rastreadores, cero analíticas y procesamiento 100% local en tu dispositivo.',
      keywords: 'política de privacidad, GDPR, aplicación local',
    },
    homeFaqTitle: 'Preguntas Frecuentes — DRM Artístico Local y Autónomo',
    homeFaqSubtitle: 'Respuestas claras sobre cifrado sin servidores, verificación offline y durabilidad.',
    homeFaqs: [
      {
        q: '¿Qué es el DRM local para dibujo a mano y en qué se diferencia de la nube?',
        a: 'Es una herramienta autónoma que incrusta tu firma Ed25519, licencia y hash SHA-256 directamente en un PNG sin pérdida y un código QR sin depender de bases de datos externas.',
      },
      {
        q: '¿Funciona realmente 100% local y sin conexión?',
        a: 'Sí. Toda la criptografía se ejecuta en el navegador bajo CSP connect-src \'self\' y funciona offline como PWA.',
      },
      {
        q: '¿Cómo se cifran las copias de seguridad de las claves?',
        a: 'Los respaldos .chkey.json se cifran localmente con AES-256-GCM usando derivación PBKDF2-SHA256 de 310,000 iteraciones.',
      },
      {
        q: '¿Por qué la obra debe sobrevivir a la plataforma que la certifica?',
        a: 'Al usar RFC 8949 CBOR bajo especificación abierta MIT (SPEC.md), cualquier herramienta compatible podrá verificar tu obra incluso si este sitio cierra.',
      },
      {
        q: '¿En qué se diferencian el marco QR exterior (v1) y el Estudio QR en imagen (v2)?',
        a: 'En v1 el QR va en el margen exterior; en v2 (Estudio QR) una máscara qrMask excluye solo el QR translúcido antes del SHA-256, permitiendo verificar tanto el PNG firmado como el original.',
      },
    ],
  },
  fr: {
    home: {
      title: 'Certified Handmade — DRM Local, Chiffrement et Provenance Hors-Ligne pour Dessinateurs',
      description:
        'Boîte à outils DRM open-source, 100% locale et autonome pour artistes. Signez vos PNG sans perte avec Ed25519, SHA-256 et sauvegarde chiffrée AES-256-GCM sans serveur.',
      keywords: 'Hand-drawing Artist, DRM artistique, chiffrement local, outil autonome, Ed25519, AES-256-GCM, PWA hors-ligne',
    },
    create: {
      title: 'Créer un Certificat DRM et QR PNG | Certified Handmade',
      description: 'Signez vos dessins localement avec Ed25519 et SHA-256 et exportez un PNG avec code QR intégré.',
      keywords: 'certificat artistique, DRM local, Ed25519, PNG sans perte',
    },
    createStudio: {
      title: 'Studio QR Translucide Intégré | Certified Handmade',
      description: 'Positionnez et ajustez un QR code DRM translucide directement sur votre illustration avec test de lecture en direct.',
      keywords: 'Studio QR, QR translucide, DRM dessin',
    },
    verify: {
      title: 'Vérifier une Œuvre, Signature Ed25519 et Preuve QR | Certified Handmade',
      description: 'Vérifiez signatures Ed25519, intégrité SHA-256 des pixels, liens #proof= et clés locales de confiance hors-ligne.',
      keywords: 'vérifier œuvre, signature Ed25519, intégrité SHA-256, vérification hors-ligne',
    },
    tutorial: {
      title: 'Tutoriel Pas à Pas du DRM Artistique Local | Certified Handmade',
      description: 'Guide débutant : créer une clé chiffrée, intégrer un QR de preuve et choisir une licence.',
      keywords: 'tutoriel DRM art, guide dessinateur, clés Ed25519',
    },
    keys: {
      title: 'Clés Locales et Sauvegarde Chiffrée AES-256-GCM | Certified Handmade',
      description: 'Générez des clés Ed25519 dans le navigateur et exportez des sauvegardes chiffrées AES-256-GCM / PBKDF2-SHA256.',
      keywords: 'clés Ed25519, chiffrement AES-256-GCM, gestion locale des clés',
    },
    docs: {
      title: 'Architecture Cryptographique, SPEC et Licences | Certified Handmade',
      description: 'Documentation technique : schéma RFC 8949 CBOR, condensé SHA-256 RGBA8, masques Protocol v1/v2 et AES-256-GCM.',
      keywords: 'spécification DRM, RFC 8949 CBOR, AES-256-GCM, Ed25519',
    },
    privacy: {
      title: 'Politique de Confidentialité et RGPD Local | Certified Handmade',
      description: 'Notice RGPD : aucun traceur, aucune télémétrie et traitement 100% local sur votre appareil.',
      keywords: 'politique de confidentialité, RGPD, application locale',
    },
    homeFaqTitle: 'Questions Fréquentes — DRM Artistique Local et Autonome',
    homeFaqSubtitle: 'Tout savoir sur le chiffrement sans serveur, la vérification hors-ligne et la pérennité.',
    homeFaqs: [
      {
        q: 'En quoi ce DRM local diffère-t-il des plateformes cloud ou NFT ?',
        a: 'Il fonctionne de façon autonome dans votre navigateur en intégrant la signature Ed25519, la licence et le hash SHA-256 directement dans le PNG et le QR.',
      },
      {
        q: 'Est-ce vraiment 100% local et utilisable hors connexion ?',
        a: 'Oui, grâce à la politique CSP connect-src \'self\' et au Service Worker PWA, aucune donnée ne quitte votre appareil.',
      },
      {
        q: 'Comment les sauvegardes de clés sont-elles chiffrées ?',
        a: 'Les fichiers .chkey.json sont chiffrés localement en AES-256-GCM avec dérivation PBKDF2-SHA256 (310 000 itérations).',
      },
      {
        q: 'Pourquoi votre œuvre doit-elle survivre à la plateforme ?',
        a: 'Le format ouvert RFC 8949 CBOR (SPEC.md) est autonome : la preuve reste vérifiable même si le site disparaît un jour.',
      },
      {
        q: 'Quelle différence entre la bordure QR (v1) et le Studio QR dans l’image (v2) ?',
        a: 'En v1 le QR est placé dans la marge extérieure ; en v2 (Studio QR) un masque qrMask exclut uniquement le QR translucide avant le calcul SHA-256, permettant de vérifier le PNG signé comme l’original.',
      },
    ],
  },
  de: {
    home: {
      title: 'Certified Handmade — Lokales DRM, Verschlüsselung & Offline-Herkunftsnachweis',
      description:
        'Open-Source, 100% lokal betriebenes & eigenständiges DRM-Toolkit für Zeichner. Signieren Sie verlustfreie PNGs mit Ed25519, SHA-256 und AES-256-GCM-Verschlüsselung ohne Server.',
      keywords: 'Hand-drawing Artist, Kunst-DRM, Verschlüsselung, Lokal betrieben, Eigenständig, Offline PWA, Ed25519, AES-256-GCM',
    },
    create: {
      title: 'Lokales Kunst-DRM-Zertifikat & QR-PNG erstellen | Certified Handmade',
      description: 'Signieren Sie Handzeichnungen lokal mit Ed25519 & SHA-256 und exportieren Sie verlustfreie QR-PNGs.',
      keywords: 'Zertifikat erstellen, Kunst DRM, Ed25519, lokale Verschlüsselung',
    },
    createStudio: {
      title: 'Manuelles In-Image QR-Studio | Certified Handmade',
      description: 'Platzieren und blenden Sie halbtransparente DRM-QR-Codes direkt in Ihre Illustration mit Live-Scan-Test ein.',
      keywords: 'QR Studio, transparenter QR-Code, Kunst-DRM',
    },
    verify: {
      title: 'Werk, Ed25519-Signatur & QR-Nachweis offline prüfen | Certified Handmade',
      description: 'Prüfen Sie Ed25519-Signaturen, SHA-256-Pixelintegrität, #proof=-Links und lokal vertraute Schlüssel komplett offline.',
      keywords: 'Werk prüfen, Ed25519 Signatur, Pixelintegrität, Offline-Verifizierung',
    },
    tutorial: {
      title: 'Schritt-für-Schritt-Anleitung für lokales Kunst-DRM | Certified Handmade',
      description: 'Einsteiger-Guide: Schlüssel erzeugen, QR-Zertifikat einbetten und passende Lizenz wählen.',
      keywords: 'Kunst-DRM Anleitung, Ed25519 Schlüssel, Lizenzen',
    },
    keys: {
      title: 'Lokale Signaturschlüssel & AES-256-GCM-Backup | Certified Handmade',
      description: 'Erstellen Sie Ed25519-Schlüssel im Browser und sichern Sie diese lokal mit AES-256-GCM und PBKDF2-SHA256.',
      keywords: 'Ed25519 Schlüssel, AES-256-GCM Backup, lokale Schlüsselverwaltung',
    },
    docs: {
      title: 'Kryptografie-Architektur, SPEC & Lizenz-Doku | Certified Handmade',
      description: 'Technische Spezifikation: RFC 8949 CBOR, RGBA8 SHA-256, Protocol v1/v2 Masken und AES-256-GCM.',
      keywords: 'DRM Spezifikation, RFC 8949 CBOR, AES-256-GCM, Ed25519',
    },
    privacy: {
      title: 'Datenschutz & DSGVO Local-Only Architektur | Certified Handmade',
      description: 'DSGVO-Hinweis: kein Tracking, keine Analysen, strikte CSP und 100% lokale Verarbeitung auf dem Gerät.',
      keywords: 'Datenschutz, DSGVO, kein Tracking, lokal',
    },
    homeFaqTitle: 'Häufige Fragen — Eigenständiges lokales Kunst-DRM',
    homeFaqSubtitle: 'Antworten zu serverloser Verschlüsselung, Offline-Prüfung und langfristiger Unabhängigkeit.',
    homeFaqs: [
      {
        q: 'Was unterscheidet lokales Handzeichnungs-DRM von Cloud-Plattformen?',
        a: 'Certified Handmade arbeitet eigenständig ohne Server oder Datenbanken und bettet Ed25519-Signatur, Lizenz und SHA-256 direkt in PNG und QR-Code ein.',
      },
      {
        q: 'Läuft wirklich alles zu 100% lokal und offline?',
        a: 'Ja. Durch CSP connect-src \'self\' und PWA-Service-Worker verlassen weder Bilder noch Schlüssel Ihr Gerät.',
      },
      {
        q: 'Wie werden Schlüssel-Backups verschlüsselt?',
        a: '.chkey.json-Backups werden lokal mit AES-256-GCM und 310.000 PBKDF2-SHA256-Iterationen geschützt.',
      },
      {
        q: 'Warum sollte das Kunstwerk die Plattform überdauern?',
        a: 'Dank offenem RFC 8949 CBOR-Schema (SPEC.md) bleibt der Nachweis dauerhaft prüfbar, selbst wenn diese Website nicht mehr existiert.',
      },
      {
        q: 'Wie unterscheiden sich Außenrand-QR (v1) und das In-Image QR-Studio (v2)?',
        a: 'In v1 liegt der QR außerhalb der Grafik; in v2 (In-Image Studio) schließt eine qrMask vor dem SHA-256 nur den halbtransparenten QR-Bereich aus, sodass sowohl signiertes PNG als auch Original prüfbar bleiben.',
      },
    ],
  },
  pt: {
    home: {
      title: 'Certified Handmade — DRM Local, Criptografia e Proveniência Offline para Artistas',
      description:
        'Toolkit DRM de código aberto, 100% local e autônomo para artistas de desenho à mão. Assine PNGs sem perdas com Ed25519, SHA-256 e backup criptografado AES-256-GCM sem servidor.',
      keywords: 'Hand-drawing Artist, DRM artístico, criptografia local, ferramenta autônoma, Ed25519, AES-256-GCM, PWA offline',
    },
    create: {
      title: 'Criar Certificado DRM e QR em PNG | Certified Handmade',
      description: 'Assine suas ilustrações localmente com Ed25519 e SHA-256 e exporte PNG sem perdas com QR verificável.',
      keywords: 'criar certificado, DRM artístico, Ed25519, criptografia local',
    },
    createStudio: {
      title: 'Estúdio QR Translúcido na Imagem | Certified Handmade',
      description: 'Posicione e ajuste QR codes DRM translúcidos dentro da sua arte com teste de leitura em tempo real.',
      keywords: 'Estúdio QR, QR translúcido, DRM desenho',
    },
    verify: {
      title: 'Verificar Arte, Assinatura Ed25519 e Prova QR | Certified Handmade',
      description: 'Valide assinaturas Ed25519, integridade de pixels SHA-256, links #proof= e chaves confiáveis 100% offline.',
      keywords: 'verificar obra, assinatura Ed25519, integridade SHA-256, verificação offline',
    },
    tutorial: {
      title: 'Guia Passo a Passo de DRM Artístico Local | Certified Handmade',
      description: 'Aprenda a gerar chaves criptográficas, incorporar QR na arte e selecionar licenças.',
      keywords: 'tutorial DRM arte, chaves Ed25519, licenças',
    },
    keys: {
      title: 'Chaves Locais e Backup Criptografado AES-256-GCM | Certified Handmade',
      description: 'Crie chaves Ed25519 no navegador e exporte backups .chkey.json protegidos por AES-256-GCM e PBKDF2-SHA256.',
      keywords: 'chaves Ed25519, backup AES-256-GCM, gestão local de chaves',
    },
    docs: {
      title: 'Arquitetura Criptográfica, SPEC e Licenças | Certified Handmade',
      description: 'Documentação técnica: esquema RFC 8949 CBOR, hash SHA-256 RGBA8, máscaras Protocol v1/v2 e AES-256-GCM.',
      keywords: 'especificação DRM, RFC 8949 CBOR, AES-256-GCM',
    },
    privacy: {
      title: 'Política de Privacidade e Arquitetura Local GDPR | Certified Handmade',
      description: 'Aviso GDPR: zero rastreamento, zero telemetria e processamento 100% local no dispositivo.',
      keywords: 'política de privacidade, GDPR, aplicativo local',
    },
    homeFaqTitle: 'Perguntas Frequentes — DRM Artístico Local e Autônomo',
    homeFaqSubtitle: 'Respostas sobre criptografia sem servidor, verificação offline e longevidade.',
    homeFaqs: [
      {
        q: 'O que diferencia este DRM local de plataformas na nuvem ou NFTs?',
        a: 'Funciona de modo autônomo no navegador sem servidor ou banco de dados, embutindo assinatura Ed25519, licença e hash SHA-256 diretamente no PNG e no QR.',
      },
      {
        q: 'Tudo roda mesmo 100% local e offline?',
        a: 'Sim. Com CSP connect-src \'self\' e cache PWA, nenhuma imagem ou chave sai do seu dispositivo.',
      },
      {
        q: 'Como os backups de chave são criptografados?',
        a: 'Os arquivos .chkey.json usam AES-256-GCM com derivação PBKDF2-SHA256 de 310.000 iterações.',
      },
      {
        q: 'Por que a obra deve durar mais que a plataforma certificadora?',
        a: 'O padrão aberto RFC 8949 CBOR (SPEC.md) torna a prova autossuficiente mesmo que este site deixe de existir.',
      },
      {
        q: 'Qual a diferença entre a borda QR (v1) e o Estúdio QR na imagem (v2)?',
        a: 'Na v1 o QR fica na margem externa; na v2 (Estúdio QR) uma máscara qrMask exclui apenas a área translúcida antes do SHA-256, verificando tanto o PNG assinado quanto o original.',
      },
    ],
  },
  it: {
    home: {
      title: 'Certified Handmade — DRM Locale, Crittografia e Provenienza Offline per Artisti',
      description:
        'Toolkit DRM open-source, 100% locale e autonomo per disegnatori. Firma PNG senza perdita con Ed25519, SHA-256 e backup crittografato AES-256-GCM senza server.',
      keywords: 'Hand-drawing Artist, DRM artistico, crittografia locale, app autonoma, Ed25519, AES-256-GCM, PWA offline',
    },
    create: {
      title: 'Crea Certificato DRM e QR PNG | Certified Handmade',
      description: 'Firma le tue opere localmente con Ed25519 e SHA-256 ed esporta PNG lossless con codice QR verificabile.',
      keywords: 'crea certificato, DRM locale, Ed25519, PNG lossless',
    },
    createStudio: {
      title: 'Studio QR Traslucido nell’Immagine | Certified Handmade',
      description: 'Posiziona e regola codici QR DRM traslucidi sull’illustrazione con verifica di leggibilità dal vivo.',
      keywords: 'Studio QR, QR traslucido, DRM disegno',
    },
    verify: {
      title: 'Verifica Opera, Firma Ed25519 e Prova QR | Certified Handmade',
      description: 'Verifica firme Ed25519, integrità SHA-256 dei pixel, link #proof= e chiavi fidate locali interamente offline.',
      keywords: 'verifica opera, firma Ed25519, integrità SHA-256, verifica offline',
    },
    tutorial: {
      title: 'Guida Passo-Passo al DRM Locale per Artisti | Certified Handmade',
      description: 'Guida semplice: crea una chiave crittografata, inserisci il QR nel PNG e scegli la licenza.',
      keywords: 'tutorial DRM arte, chiavi Ed25519, licenze',
    },
    keys: {
      title: 'Chiavi Locali e Backup Crittografato AES-256-GCM | Certified Handmade',
      description: 'Genera chiavi Ed25519 nel browser ed esporta backup .chkey.json cifrati con AES-256-GCM e PBKDF2-SHA256.',
      keywords: 'chiavi Ed25519, cifratura AES-256-GCM, gestione chiavi locale',
    },
    docs: {
      title: 'Architettura Crittografica, SPEC e Licenze | Certified Handmade',
      description: 'Riferimento tecnico: schema RFC 8949 CBOR, digest SHA-256 RGBA8, maschere Protocol v1/v2 e AES-256-GCM.',
      keywords: 'specifica DRM, RFC 8949 CBOR, AES-256-GCM',
    },
    privacy: {
      title: 'Informativa Privacy e Architettura Locale GDPR | Certified Handmade',
      description: 'Nota GDPR: zero tracciamento, zero telemetria ed elaborazione 100% locale sul dispositivo.',
      keywords: 'privacy policy, GDPR, app locale',
    },
    homeFaqTitle: 'Domande Frequenti — DRM Artistico Locale e Autonomo',
    homeFaqSubtitle: 'Risposte chiare su crittografia senza server, verifica offline e durata nel tempo.',
    homeFaqs: [
      {
        q: 'In cosa si differenzia questo DRM locale dalle piattaforme cloud o NFT?',
        a: 'Funziona in modo autonomo nel browser senza server né database, incorporando firma Ed25519, licenza e hash SHA-256 direttamente nel PNG e nel QR.',
      },
      {
        q: 'Funziona davvero al 100% in locale e offline?',
        a: 'Sì. Grazie a CSP connect-src \'self\' e al Service Worker PWA, nessun file o chiave lascia il dispositivo.',
      },
      {
        q: 'Come vengono cifrati i backup delle chiavi?',
        a: 'I file .chkey.json usano AES-256-GCM con derivazione PBKDF2-SHA256 a 310.000 iterazioni.',
      },
      {
        q: 'Perché l’opera deve sopravvivere alla piattaforma che la certifica?',
        a: 'Lo standard aperto RFC 8949 CBOR (SPEC.md) rende la prova verificabile anche se questo sito dovesse chiudere.',
      },
      {
        q: 'Qual è la differenza tra bordo QR esterno (v1) e Studio QR nell’immagine (v2)?',
        a: 'In v1 il QR sta sul margine esterno; in v2 (Studio QR) una maschera qrMask esclude solo l’area QR traslucida prima dell’hash SHA-256, verificando sia il PNG firmato che l’originale.',
      },
    ],
  },
  ar: {
    home: {
      title: 'Certified Handmade — حماية DRM محلية مشفرة وتوثيق مستقل للرسامين اليدويين',
      description:
        'أداة مفتوحة المصدر تعمل محلياً 100% وبشكل مستقل دون اتصال للرسامين اليدويين. وقّع صور PNG عبر Ed25519 وSHA-256 ونسخ احتياطي مشفر AES-256-GCM دون خوادم.',
      keywords: 'Hand-drawing Artist, حماية DRM للرسم اليدوي, تشفير محلي, تطبيق مستقل, Ed25519, AES-256-GCM, PWA بدون إنترنت',
    },
    create: {
      title: 'إنشاء شهادة DRM ورمز QR لصور PNG | Certified Handmade',
      description: 'وقّع رسوماتك محلياً بتشفير Ed25519 وSHA-256 وصدّر صورة PNG مع رمز QR للتحقق دون رفعها لأي خادم.',
      keywords: 'إنشاء شهادة فنية, DRM محلي, Ed25519, تشفير محلي',
    },
    createStudio: {
      title: 'استوديو رمز QR الشفاف داخل الصورة | Certified Handmade',
      description: 'ضع رمز QR الشفاف داخل الرسم واضبط حجمه وشفافيته مع فحص فوري لإمكانية المسح.',
      keywords: 'استوديو QR, رمز QR شفاف, حماية الرسم اليدوي',
    },
    verify: {
      title: 'التحقق من العمل الفني وتوقيع Ed25519 ورمز QR محلياً | Certified Handmade',
      description: 'تحقق من توقيع Ed25519 وسلامة البكسل SHA-256 وروابط #proof= ومفاتيح الثقة المحلية دون اتصال.',
      keywords: 'التحقق من الرسم, توقيع Ed25519, سلامة SHA-256, تحقق بدون إنترنت',
    },
    tutorial: {
      title: 'دليل خطوة بخطوة لحماية الرسم اليدوي محلياً | Certified Handmade',
      description: 'دليل مبسط: أنشئ مفتاح التشفير، أدرج رمز QR في الرسم، واختر رخصة الحقوق المناسبة.',
      keywords: 'دليل DRM, مفاتيح Ed25519, رخص حقوق النشر',
    },
    keys: {
      title: 'إدارة المفاتيح المحلية والنسخ المشفر AES-256-GCM | Certified Handmade',
      description: 'أنشئ مفاتيح Ed25519 في متصفحك واحفظ نسخاً احتياطية مشفرة بواسطة AES-256-GCM وPBKDF2-SHA256.',
      keywords: 'مفاتيح Ed25519, تشفير AES-256-GCM, إدارة المفاتيح المحلية',
    },
    docs: {
      title: 'البنية التشفيرية ومواصفات SPEC ودليل الرخص | Certified Handmade',
      description: 'المرجع التقني: مخطط RFC 8949 CBOR وتجزئة SHA-256 وأقنعة Protocol v1/v2 وتشفير AES-256-GCM.',
      keywords: 'مواصفات DRM, RFC 8949 CBOR, AES-256-GCM',
    },
    privacy: {
      title: 'سياسة الخصوصية والامتثال لـ GDPR محلياً | Certified Handmade',
      description: 'إشعار GDPR: بدون تتبع أو تحليلات، ومعالجة محلية بالكامل على جهازك.',
      keywords: 'سياسة الخصوصية, GDPR, تطبيق محلي',
    },
    homeFaqTitle: 'الأسئلة الشائعة — حماية DRM محلية ومستقلة للرسم اليدوي',
    homeFaqSubtitle: 'إجابات حول التشفير دون خوادم، التحقق دون إنترنت، واستدامة التوثيق.',
    homeFaqs: [
      {
        q: 'ما الذي يميز حماية DRM المحلية عن المنصات السحابية أو NFT؟',
        a: 'تعمل الأداة باستقلالية تامة داخل المتصفح دون خادم أو قاعدة بيانات، وتدمج توقيع Ed25519 والرخصة وتجزئة SHA-256 مباشرة داخل PNG ورمز QR.',
      },
      {
        q: 'هل يعمل التطبيق محلياً 100% ودون إنترنت فعلاً؟',
        a: 'نعم. تمنع سياسة CSP connect-src \'self\' أي اتصال خارجي، ويعمل التطبيق كـ PWA بالكامل دون إنترنت.',
      },
      {
        q: 'كيف يتم تشفير النسخ الاحتياطية للمفاتيح؟',
        a: 'تُشفر ملفات .chkey.json محلياً بخوارزمية AES-256-GCM مع اشتقاق PBKDF2-SHA256 بـ 310,000 تكرار.',
      },
      {
        q: 'لماذا يجب أن يعيش عملك الفني أطول من المنصة التي توثقه؟',
        a: 'لأن الصيغة المفتوحة RFC 8949 CBOR (SPEC.md) تحفظ الإثبات بشكل ذاتي، ما يسمح بالتحقق حتى لو توقف الموقع مستقبلاً.',
      },
      {
        q: 'ما الفرق بين الإطار الخارجي لـ QR (v1) واستوديو QR داخل الصورة (v2)؟',
        a: 'يضع الإصدار v1 الرمز في الهامش الخارجي، بينما يستبعد استوديو QR (v2) منطقة الرمز الشفاف عبر qrMask قبل حساب SHA-256، ليتحقق كل من PNG الموقّع والرسم الأصلي بدقة البت.',
      },
    ],
  },
};
