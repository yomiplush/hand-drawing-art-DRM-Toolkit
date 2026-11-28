import type { SupportedLocale } from '../storage/consent';

export interface FriendlyErrorCopy {
  title: string;
  whatHappened: string;
  dataSafe: string;
  nextAction: string;
  technicalDetail: string;
}

type ErrorCategory =
  | 'passphrase'
  | 'image-decode'
  | 'image-size'
  | 'qr-not-found'
  | 'google-auth'
  | 'network'
  | 'storage'
  | 'unknown';

function detectCategory(raw: string): ErrorCategory {
  const lower = raw.toLowerCase();
  if (
    lower.includes('passphrase') ||
    lower.includes('decrypt') ||
    lower.includes('gcm') ||
    lower.includes('operationerror')
  ) {
    return 'passphrase';
  }
  if (lower.includes('too large') || lower.includes('dimension') || lower.includes('pixel')) {
    return 'image-size';
  }
  if (
    lower.includes('qr') &&
    (lower.includes('not found') ||
      lower.includes('no qr') ||
      lower.includes('no readable') ||
      lower.includes('not detect') ||
      lower.includes('detected') ||
      lower.includes('scan'))
  ) {
    return 'qr-not-found';
  }
  if (
    lower.includes('png') ||
    lower.includes('image') ||
    lower.includes('decode') ||
    lower.includes('canvas') ||
    lower.includes('corrupt')
  ) {
    return 'image-decode';
  }
  if (
    lower.includes('google') ||
    lower.includes('oauth') ||
    lower.includes('gis') ||
    lower.includes('token') ||
    lower.includes('drive')
  ) {
    return 'google-auth';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('offline') ||
    lower.includes('timeout') ||
    lower.includes('websocket') ||
    lower.includes('relay')
  ) {
    return 'network';
  }
  if (lower.includes('quota') || lower.includes('indexeddb') || lower.includes('storage')) {
    return 'storage';
  }
  return 'unknown';
}

const JA_COPY: Record<ErrorCategory, Omit<FriendlyErrorCopy, 'technicalDetail'>> = {
  passphrase: {
    title: 'パスフレーズが一致しませんでした',
    whatHappened: '暗号化されたバックアップまたは保管庫のロックを解除できませんでした。',
    dataSafe: '元の鍵や作品データは変更・削除されていません。',
    nextAction: '大文字・小文字や全角・半角を確認して、もう一度入力してください。',
  },
  'image-decode': {
    title: '画像を読み込めませんでした',
    whatHappened: '選択されたファイルが破損しているか、このブラウザで読み込めない形式です。',
    dataSafe: '元の画像ファイルは変更されておらず、外部へも送信されていません。',
    nextAction: 'PNG、JPEG、または WebP 形式で保存し直してから、もう一度お試しください。',
  },
  'image-size': {
    title: '画像サイズが大きすぎるため処理できませんでした',
    whatHappened: 'お使いの端末のメモリ制限を超える解像度の画像が選択されました。',
    dataSafe: '元の画像はそのまま安全に残っています。',
    nextAction: '少し解像度を下げた画像を選ぶか、他のアプリを閉じてからお試しください。',
  },
  'qr-not-found': {
    title: '画像から証明QRコードが見つかりませんでした',
    whatHappened: 'SNSなどで再圧縮・トリミングされたか、QRコードが含まれていない可能性があります。',
    dataSafe: '画像は端末内だけで確認されており、外部には送信されていません。',
    nextAction: '証明リンク（#proof=...）や .chproof.json をお持ちの場合は、リンク・ファイル確認から開けます。',
  },
  'google-auth': {
    title: 'Googleドライブとの同期を完了できませんでした',
    whatHappened: 'Googleへの接続がキャンセルされたか、接続の有効期限が切れました。',
    dataSafe: 'お使いの端末にある署名鍵や作品証明はすべてそのまま安全に残っています。',
    nextAction: 'インターネット接続を確認のうえ、必要なときに再度「Googleで接続」をお試しください。',
  },
  network: {
    title: '通信に接続できませんでした',
    whatHappened: '現在オフラインであるか、接続先への通信がタイムアウトしました。',
    dataSafe: '作品の署名・画像確認などの基本機能はオフラインのまま安全に続けられます。',
    nextAction: '端末のネット接続を確認するか、ローカル機能のまま作業を続けてください。',
  },
  storage: {
    title: '端末の保存容量がいっぱいの可能性があります',
    whatHappened: 'ブラウザ内の保存領域に書き込むことができませんでした。',
    dataSafe: 'すでに保存済みの鍵や証明は消えていません。',
    nextAction: '不要なタブや履歴を整理し、大切な鍵のバックアップ（.chkey.json）を保存してください。',
  },
  unknown: {
    title: '処理を完了できませんでした',
    whatHappened: '予期しない理由により操作を中断しました。',
    dataSafe: '元の画像や端末内の署名データは保護されています。',
    nextAction: '別のファイルでお試しいただくか、内容を確認してやり直してください。',
  },
};

const EN_COPY: Record<ErrorCategory, Omit<FriendlyErrorCopy, 'technicalDetail'>> = {
  passphrase: {
    title: 'Passphrase did not match',
    whatHappened: 'Could not unlock the encrypted backup or vault with that passphrase.',
    dataSafe: 'Your local keys and artworks remain untouched.',
    nextAction: 'Check spelling, capitalization, and keyboard layout, then try again.',
  },
  'image-decode': {
    title: 'Could not open this image',
    whatHappened: 'The selected file may be corrupted or in a format this browser cannot read.',
    dataSafe: 'Your original file was not modified or uploaded anywhere.',
    nextAction: 'Please try a standard PNG, JPEG, or WebP image file.',
  },
  'image-size': {
    title: 'Image is too large for this device’s memory',
    whatHappened: 'The artwork resolution exceeded safe browser memory limits.',
    dataSafe: 'Your original artwork file stays completely intact.',
    nextAction: 'Try a slightly smaller export or close other heavy browser tabs.',
  },
  'qr-not-found': {
    title: 'No certificate QR code found in this image',
    whatHappened: 'The image may not have a Certified Handmade QR code, or social-media compression damaged it.',
    dataSafe: 'Your file stayed strictly on your device.',
    nextAction: 'If you have a proof link (#proof=...) or .chproof.json file, try the Link / Bundle option.',
  },
  'google-auth': {
    title: 'Could not finish Google Drive sync',
    whatHappened: 'The Google sign-in window was closed or the temporary session expired.',
    dataSafe: 'All local keys, profiles, and proofs on this device remain safe and untouched.',
    nextAction: 'You can keep signing offline, or reconnect Google Drive whenever you are ready.',
  },
  network: {
    title: 'Could not reach the network',
    whatHappened: 'You appear to be offline or the remote service did not respond in time.',
    dataSafe: 'Signing and verification continue to work 100% locally without a connection.',
    nextAction: 'Check your connection to retry syncing, or continue working offline.',
  },
  storage: {
    title: 'Device storage may be full',
    whatHappened: 'Your browser could not write more local data to storage.',
    dataSafe: 'Existing saved keys were not deleted.',
    nextAction: 'Free a little storage space and download a .chkey.json backup of your signing key.',
  },
  unknown: {
    title: 'Something went wrong',
    whatHappened: 'The current step could not be completed as expected.',
    dataSafe: 'Your original artwork and saved local keys remain untouched.',
    nextAction: 'Please review your selection and try again.',
  },
};

export function toFriendlyError(err: unknown, locale: SupportedLocale | string): FriendlyErrorCopy {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
  const category = detectCategory(raw);
  const base = locale === 'ja' ? JA_COPY[category] : EN_COPY[category];
  return {
    ...base,
    technicalDetail: raw,
  };
}
