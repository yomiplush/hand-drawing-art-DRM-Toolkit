import type { GoogleComplianceTranslations } from '../../googleCompliance';

export const JA: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: '完全ローカル駆動の作品来歴証明・オフラインQR検証',
    appPurposeBody:
      'Certified Handmadeは、手描き作品などの画像にブラウザ内のEd25519鍵とSHA-256ピクセルハッシュで署名し、無劣化PNGへ自己完結型の検証QRコードを埋め込める完全無料・MITライセンスのオープンソースツールです。ログイン不要・サーバー送信なし・完全オフラインで動作します。',
    drivePurposeTitle: '任意の Google ドライブアプリ専用暗号化保管庫（drive.appdata）',
    drivePurposeBody:
      '署名・検証はアカウントなしで100%完結します。設定・ストレージ画面（/storage）から任意でGoogleドライブ連携を有効にした場合のみ、最小権限の drive.appdata スコープを使用し、アプリ専用の隠し領域（appDataFolder）へ端末側でAES-256-GCM暗号化した証明・公開ID・端末認証・任意の暗号化済み復旧データのみを保存します（普段のマイドライブのファイル閲覧や作品画像の送信は一切行いません）。',
    privacyLinkLabel: 'プライバシーポリシー・Googleデータ利用開示',
    storageLinkLabel: '端末同期・Googleドライブ設定',
    docsLinkLabel: '技術ドキュメント',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. 任意の Google OAuth 2.0・Google Drive API（drive.appdata）に関する開示',
    sectionBody:
      '• 完全任意・利用者操作による接続: Certified HandmadeはGoogleアカウントなしですべての基本機能を利用できます。/storage 画面で「Googleアカウントで接続」を明示的に押した場合に限り、Google Identity Services（accounts.google.com/gsi/client）を読み込み、最小権限スコープ https://www.googleapis.com/auth/drive.appdata のみを要求します。\n• アクセストークンのメモリ限定保持: 取得したOAuthアクセストークンはメモリ（RAM）内のみで保持され、localStorage・IndexedDB・URL・ログには一切保存しません。接続解除や権限取り消しを行ってもローカルの作品証明や署名鍵は削除されません。\n• アプリ専用隠しフォルダ（appDataFolder）のクライアント側暗号化データのみ保存: アクセス対象は利用者本人のGoogleドライブ内にある本アプリ専用の非表示領域（appDataFolder）内のAES-256-GCM暗号化ファイル（keyring.chmk、manifest.chme、同期済み公開ID・端末承認/失効・証明/設定スナップショット、任意で有効化した場合の暗号化済み復旧バックアップ等）に限られます。作品画像本体、PSD/KRA/CLIP等の制作ファイル、生の署名秘密鍵、平文の個人情報はGoogleドライブへ一切保存・送信しません。\n• Google API Services User Data Policy（Limited Use）準拠: Google APIから取得した情報の利用および他アプリへの移転は、Google API Services User Data Policy（Limited Use要件を含む）に厳格に準拠します。データは利用者自身の端末間暗号化同期のためだけに使用され、第三者への提供・販売、広告配信、AI/MLモデルの学習には一切使用しません。',
    tableRowName: 'Google OAuth アクセストークン（RAMのみ）',
    tableRowCategory: '任意の利用者同意（GDPR第6条1項(a)）',
    tableRowPurpose:
      '本人ドライブ内のアプリ専用非表示領域（appDataFolder）にあるAES-256-GCM暗号化保管庫へのアクセスのみを認可（drive.appdata）。',
    tableRowRetention: 'セッション中のメモリ内のみ保持（再読み込み・切断で即時消去）',
  },
};
