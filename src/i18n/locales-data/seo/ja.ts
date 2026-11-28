import type { SeoTranslations } from '../../seo';

export const JA: SeoTranslations = {
  home: {
    title: 'Certified Handmade — 手描きアーティスト向け 完全ローカル暗号来歴証明＆QR証明書（手描きDRM）',
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
      'GDPR準拠のプライバシー開示：解析タグ・追跡Cookieゼロ、作品画像・秘密鍵の完全ローカル処理および任意オプトイン同期時の wss:// 通信開示について。',
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
      a: 'はい。鍵生成、SHA-256計算、Ed25519署名、AES-256-GCM暗号化バックアップ、QR生成・読取まですべてブラウザ内で完結します。既定では外部通信を行わず（CSP connect-src \'self\' wss: wss: は任意オプトインの分散型同期リレー用）、PWAとして保存すれば完全オフラインでも全機能が動作します。',
    },
    {
      q: '秘密鍵の暗号化バックアップにはどの暗号方式が使われていますか？',
      a: '署名鍵にはEd25519を採用しています。.chkey.json形式のバックアップ書き出し時は、パスフレーズからPBKDF2-SHA256（600,000回反復）で導出した鍵を使い、AES-256-GCMで強固に暗号化されるため、アカウント登録なしで安全に鍵を保管できます。',
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
};
