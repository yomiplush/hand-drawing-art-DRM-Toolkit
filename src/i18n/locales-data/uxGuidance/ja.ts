import type { UxGuidanceTranslations } from '../../uxGuidance';

export const JA: UxGuidanceTranslations = {
  snsRecompression: {
    createTitle: 'オリジナルPNG配布向け',
    createBody:
      'X・Instagram・Discord などのSNSへ直接アップロードすると再圧縮やリサイズが行われ、厳密な RGBA8 ピクセル一致（Artwork Integrity）の検証が壊れます。完全な検証には書き出したオリジナルPNGをそのまま配布してください。',
    verifyTitle: 'SNS再圧縮に関するご注意',
    verifyBody:
      'X・Instagram・Discord などのSNSから保存した画像は再圧縮・リサイズされていることが多く、厳密な RGBA8 ピクセル一致検証が不一致になります。可能な限りオリジナルのPNGファイルをご使用ください。',
  },
  qrReadability: {
    tooSmallWarning:
      'QRの1モジュールが 2px 未満と小さすぎるため、カメラでの読み取りに失敗しやすくなります。QRサイズを大きくするか「サイズ最適化」をお試しください。',
    lowContrastWarning:
      'QRモジュールと背景のコントラストが低め（3.0:1 未満）です。不透明度を上げるか「すりガラス」系スタイルへの変更、背景が均一な位置への移動をおすすめします。',
    moduleSizeLabel: 'モジュール幅',
    contrastRatioLabel: 'コントラスト比',
  },
};
