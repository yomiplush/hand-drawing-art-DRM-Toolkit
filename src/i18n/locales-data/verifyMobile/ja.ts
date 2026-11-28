import type { VerifyMobileTranslations } from '../../verifyMobile';

export const JA: VerifyMobileTranslations = {
  proofStep2Title: '次のステップ：作品画像を読み込んで一致を検証',
  proofStep2Desc:
    'QRコードの署名は確認できました。スマホの写真・ファイルから画像を選ぶか、画像をコピーして「クリップボードから貼り付け」を押してください。',
  pasteImageBtn: 'クリップボードから画像を貼り付け',
  pasteBusy: 'クリップボードを読み込み中…',
  pasteNoImage: 'クリップボードに画像が見つかりませんでした。画像をコピーするかファイル選択をご利用ください。',
  pasteUnsupported:
    'このブラウザではボタンからの貼り付けが制限されています。入力欄や画面上で「ペースト」するかファイル選択をご利用ください。',
  pasteHint: 'ヒント：SNSや画像ビューアで画像を長押しコピーして、そのまま貼り付けできます（Ctrl+V / ペースト対応）。',
  rawProofToggle: '読み込んだ署名URL / トークンを確認・編集する',
  attachedReadyBadge: '照合中の画像',
  sharedImageVerifiedNote: '共有された画像内のQRコードから自動検証しました',
  sharedImageNoQrNote:
    '共有画像を読み込みました（画像内にQRが見つかりませんでした）。QRコードを読み取るか署名URLを貼り付けるとピクセル一致を検証できます。',
  cameraFollowUpHint: 'QR読み取り完了！続けて作品画像を選択または貼り付けするとピクセル一致を検証できます。',
};
