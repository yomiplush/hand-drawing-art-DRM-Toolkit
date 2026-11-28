import type { InteractiveTutorialTranslations } from '../../interactiveTutorial';

export const JA: InteractiveTutorialTranslations = {
  dialogAria: 'インタラクティブ3Dチュートリアル',
  headerButtonLabel: 'チュートリアル',
  headerButtonTooltip: 'インタラクティブ3Dチュートリアルを開く',
  launchFromPageBtn: '3Dインタラクティブガイドを開く',
  dragHint: 'ドラッグ・スワイプで3D回転できます',
  stepCounterLabel: 'ステップ',
  backBtn: '戻る',
  nextBtn: '次へ',
  skipBtn: 'スキップ',
  doneBtn: 'はじめる',
  steps: [
    {
      badge: '100% ローカル完結',
      title: '登録なし・送信なしで作品を証明',
      body: 'アカウント作成もサーバーへのアップロードも不要。イラストも署名鍵も、すべてあなたのブラウザ内だけで安全に処理されます。',
      highlight: '外部送信ゼロ · オフライン動作',
    },
    {
      badge: 'Step 1 · ローカル鍵',
      title: '自分だけの署名鍵を作成',
      body: '最初にブラウザ内であなた専用の Ed25519 署名鍵を作ります。機種変更や履歴削除に備えて、あとから鍵ファイルをバックアップしておくと安心です。',
      highlight: 'Ed25519 ローカル鍵 · バックアップ推奨',
    },
    {
      badge: 'Step 2 · シンプルモード',
      title: 'イラストを選んで簡単署名',
      body: 'Simple Mode なら、イラストを選んでQR証明書を焼き込むだけで完了。もっと細かい設定が必要になったら、いつでも Advanced Mode に切り替えられます。',
      highlight: 'Simple Mode 標準 · いつでも詳細切替',
    },
    {
      badge: 'Step 3 · オフライン検証',
      title: '誰でもオフラインで検証できる',
      body: 'QRコードを読み取るか、署名済み画像を検証画面にドロップするだけで、作者の署名と改ざんの有無をいつでも確認できます。',
      highlight: 'QR・画像から即座にオフライン検証',
    },
  ],
};
