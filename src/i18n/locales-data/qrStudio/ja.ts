import type { QrStudioTranslations } from '../../qrStudio';

export const JA: QrStudioTranslations = {
  navLabel: 'QRスタジオ',
  title: '半透明QR 手動埋め込みスタジオ',
  subtitle:
    'イラストの内側に半透明やスタイル付きのQRコードを直接ドラッグ配置します。QRボックス以外の全ピクセルはSHA-256で厳密に保護されます。',
  modeSectionTitle: 'QRコードの配置方法を選択',
  modeOuterLabel: '外枠フレーム配置（かんたん・標準）',
  modeOuterDesc: '画像の外側に余白を追加してQRを配置します（元絵を一切隠しません）。',
  modeStudioLabel: '絵の中に半透明QRを埋め込む（QRスタジオ）',
  modeStudioDesc: 'ドラッグ配置・サイズ・不透明度（半透明）を手動調整して直接合成します。',
  uploadFirstHint: 'ステップ1で作品画像を読み込むと、ここに半透明QRのドラッグ調整プレビューが表示されます。',
  createBannerTitle: '絵の中に半透明QRを直接埋め込みたいですか？',
  createBannerDesc:
    '専用のQRスタジオで、ドラッグ配置・サイズ調整・不透明度（半透明）・リアルタイム読取テストをしながら埋め込めます。',
  createBannerBtn: 'QRスタジオを開く',
  backToMarginCreate: '余白フレーム版（/create）を使う',
  previewTitle: 'プレビュー＆ドラッグ配置キャンバス',
  previewHint:
    '画像上のQRボックスを直接ドラッグするか、下のプリセットとスライダーで微調整できます。破線枠の外側のピクセルはすべてビット単位で検証対象になります。',
  presetsLabel: 'かんたん配置プリセット',
  presets: {
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    center: '中央',
  },
  controlsTitle: '位置・サイズ・半透明・スタイル調整',
  xLabel: '横位置 X (px)',
  yLabel: '縦位置 Y (px)',
  sizeLabel: 'QRサイズ (px)',
  opacityLabel: '不透明度 (半透明)',
  styleLabel: 'QR埋め込みスタイル',
  eccLabel: '誤り訂正レベル (ECC)',
  styles: {
    'frosted-light': 'すりガラス白（半透明・おすすめ）',
    'frosted-dark': 'すりガラス黒（半透明・反転）',
    'modules-dark': '背景なし・黒モジュールのみ',
    'modules-light': '背景なし・白モジュールのみ',
  },
  eccOptions: {
    M: 'M (標準 15% — 小さめ・高密度向け)',
    Q: 'Q (高め 25% — 半透明におすすめ)',
    H: 'H (最高 30% — 複雑な背景向け)',
  },
  readabilityLabel: 'ローカル読取テスト',
  readabilityOk: 'プレビューでQR読取OK',
  readabilityWarn: '読み取りにくい設定です — 不透明度やサイズを上げるか「すりガラス白」をお試しください',
  readabilityHint: '合成後ピクセルに対してブラウザ内でjsQRスキャンを実行しています。',
  maskRegionLabel: '署名済みQRマスク領域 [x, y, w, h]',
  signInImageBtn: 'ローカル署名して半透明QR入りPNGを保存',
  signingBusy: 'マスク外ハッシュ計算・署名・合成中…',
  maskedDigestNote:
    'Protocol v2: QR枠の外側の全ピクセルをSHA-256保護します。このQR入りPNGとQR合成前の元画像のどちらでも検証が一致します。',
};
