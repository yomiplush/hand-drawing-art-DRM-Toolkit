import type { Locale } from './context';

export interface A11yTranslations {
  skipToMain: string;
  primaryNavAria: string;
  advancedNavAria: string;
  footerNavAria: string;
  navCreate: string;
  navVerify: string;
  navKeysExchange: string;
  changelogLabel: string;
  closeLabel: string;
  routeAnnouncePrefix: string;
  qrCanvasAria: string;
  qrCanvasKeyboardHint: string;
  qrPositionAnnounce: string;
  qrXNumberAria: string;
  qrYNumberAria: string;
  qrSizeNumberAria: string;
  qrOpacityNumberAria: string;
  verificationCompleteAnnounce: string;
  verificationErrorAnnounce: string;
}

const en: A11yTranslations = {
  skipToMain: 'Skip to main content',
  primaryNavAria: 'Primary navigation',
  advancedNavAria: 'Advanced workspace navigation',
  footerNavAria: 'Footer navigation',
  navCreate: 'Create',
  navVerify: 'Verify',
  navKeysExchange: 'Keys & Exchange',
  changelogLabel: 'Changelog',
  closeLabel: 'Close',
  routeAnnouncePrefix: 'Navigated to',
  qrCanvasAria:
    'Interactive QR placement preview. Use arrow keys to move the QR code, or hold Shift with arrow keys to move faster.',
  qrCanvasKeyboardHint:
    'Keyboard: Arrow keys move QR by 2px (Shift + Arrow for 20px). You can also use the sliders and number inputs below.',
  qrPositionAnnounce: 'QR position updated to X {x}px, Y {y}px',
  qrXNumberAria: 'QR horizontal position X in pixels',
  qrYNumberAria: 'QR vertical position Y in pixels',
  qrSizeNumberAria: 'QR box size in pixels',
  qrOpacityNumberAria: 'QR opacity percentage',
  verificationCompleteAnnounce: 'Verification completed.',
  verificationErrorAnnounce: 'Verification error occurred.',
};

const ja: A11yTranslations = {
  skipToMain: 'メインコンテンツへ移動',
  primaryNavAria: 'メインナビゲーション',
  advancedNavAria: '詳細ワークスペースナビゲーション',
  footerNavAria: 'フッターナビゲーション',
  navCreate: '作成',
  navVerify: '検証',
  navKeysExchange: '鍵・交換',
  changelogLabel: '更新履歴',
  closeLabel: '閉じる',
  routeAnnouncePrefix: 'ページを移動しました:',
  qrCanvasAria:
    'QRコード配置プレビュー。矢印キーでQRコードを移動でき、Shiftキーを押しながら矢印キーで大きく移動できます。',
  qrCanvasKeyboardHint:
    'キーボード操作: 矢印キーで2px移動（Shift+矢印で20px移動）。下のスライダーや数値入力でも調整できます。',
  qrPositionAnnounce: 'QRコード位置を X {x}px、Y {y}px に更新しました',
  qrXNumberAria: 'QRコードのX座標（ピクセル）',
  qrYNumberAria: 'QRコードのY座標（ピクセル）',
  qrSizeNumberAria: 'QRコードのサイズ（ピクセル）',
  qrOpacityNumberAria: 'QRコードの不透明度（パーセント）',
  verificationCompleteAnnounce: '検証が完了しました。',
  verificationErrorAnnounce: '検証中にエラーが発生しました。',
};

export const A11Y_I18N: Partial<Record<Locale, A11yTranslations>> & { en: A11yTranslations } = {
  en,
  ja,
};
