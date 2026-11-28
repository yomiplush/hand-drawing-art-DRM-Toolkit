import type { HardeningTranslations } from '../../hardening';

export const JA: HardeningTranslations = {
  passphraseStrength: {
    label: 'パスフレーズ強度',
    tooShort: '短すぎます（8文字未満）',
    fair: '利用可能（8〜11文字・12文字以上推奨）',
    strong: '強力（12文字以上）',
    guidance: '最低8文字が必要です。オフライン保護のため12文字以上の十分な長さを強く推奨します。',
  },
  fingerprint: {
    label: '公開鍵 SHA-256 フィンガープリント',
    fullHexLabel: '完全な SHA-256 Hex',
    shortLabel: '短縮ID',
    copyFullBtn: '完全フィンガープリントをコピー',
    copiedFull: 'コピーしました',
    showQrBtn: 'フィンガープリントQR',
    hideQrBtn: 'QRを閉じる',
    qrCaption: '信頼登録する前に、別経路（公式サイトやSNSプロフィール等）で完全フィンガープリントを照合してください。',
  },
  trust: {
    outOfBandNote:
      '受信・読み取った公開鍵が即座に「信頼済み」になることはありません。公式サイトや別経路で完全な SHA-256 フィンガープリントを確認してから信頼確定してください。',
    confirmCheckbox: '別経路でこの公開鍵フィンガープリントを本人確認しました',
    unconfirmedBadge: '未確認（フィンガープリント要確認）',
    confirmNowBtn: 'フィンガープリントを確認済みにする',
    saveUnconfirmedBtn: '未確認として仮保存のみ',
    unconfirmedHelp: 'メモとしてローカル保存されますが、確認完了までは「未確認」扱いになります。',
  },
  challenge: {
    sectionTitle: 'オフライン鍵保有チャレンジ＆レスポンス',
    sectionSubtitle:
      '中央サーバーやアカウントを使わず、相手が現在その秘密鍵を保有していることをオフラインで確かめます。',
    createTitle: '1. チャレンジを作成',
    targetPubLabel: '検証対象の公開鍵（base64url または JSON）',
    noteLabel: '任意メモ（最大96バイト）',
    notePlaceholder: '例：本人確認 2026-11',
    createBtn: 'チャレンジを生成',
    challengeTokenLabel: 'チャレンジトークン（相手へ渡す）',
    signTitle: '2. 自分の鍵でチャレンジに署名',
    challengeInputLabel: '受け取ったチャレンジトークン / JSON',
    signKeySelectLabel: '署名に使用するローカル鍵',
    signPassLabel: 'パスフレーズ（暗号化シードの場合）',
    signBtn: 'チャレンジに署名',
    responseTokenLabel: '署名済みレスポンストークン',
    verifyTitle: '3. レスポンスをオフライン検証',
    responseInputLabel: 'レスポンストークン / JSON',
    verifyBtn: 'レスポンスを検証',
    validResult: 'このナンスと公開鍵に対する秘密鍵保有がオフラインで確認されました。',
    invalidResult: 'チャレンジ・レスポンスの検証に失敗しました。',
    scopeDisclaimer:
      '注意：この検証が証明するのは「このナンス生成時に該当秘密鍵を持っていたこと」のみです。現実世界の氏名本人性・著作権帰属・手描き制作を保証するものではありません。',
  },
  notices: {
    sectionTitle: '鍵失効・鍵ローテーション通知（オフライン）',
    sectionSubtitle:
      '鍵の引退・移行・漏洩疑いを署名付き通知（.chnotice.json / chm-notice:）として生成・ローカル読み込みします。',
    createTitle: '署名付き通知を作成',
    subjectKeyLabel: '対象の公開鍵',
    typeLabel: '通知の種類',
    typeRevocation: '鍵失効通知（単一署名）',
    typeRotation: '鍵ローテーション通知（旧鍵＋新鍵の二重署名）',
    replacementKeyLabel: '移行先の新鍵（ローテーション時）',
    reasonLabel: '理由',
    reasons: {
      'key-compromise': '秘密鍵漏洩の疑い',
      'key-superseded': '新鍵への計画的移行',
      retired: '利用終了・引退',
      other: 'その他',
    },
    noteLabel: '補足メモ（最大160バイト）',
    passLabel: 'パスフレーズ（暗号化シード鍵の場合）',
    createBtn: '署名付き通知を作成',
    downloadBtn: '.chnotice.json を保存',
    copyBtn: 'chm-notice: トークンをコピー',
    compromiseWarning:
      '仕様上の限界：流出した旧秘密鍵を持つ攻撃者自身も失効通知や過去日付の署名を発行し得ます。また中央失効サーバーがないため、各検証者がローカルに取り込んだ通知のみが参照されます。',
    importTitle: '通知をオフラインで検証・取り込み',
    importPlaceholder: 'chm-notice:... トークンまたは .chnotice.json を貼り付け',
    importBtn: '署名を検証してローカル保存',
    importFileBtn: '.chnotice.json ファイルを読込',
    listTitle: 'この端末に取り込み済みの通知',
    noNotices: 'この端末に保存されている失効・ローテーション通知はありません。',
    revokeBadge: '失効通知あり',
    rotateBadge: 'ローテーション通知あり',
    issuedAtLabel: '通知の自己申告時刻',
    noneLocalInfo:
      'ローカル失効確認：この端末には該当通知がありません（「他所で失効していない」ことまでは保証しません）。',
    localMatchBannerRevoked:
      'ローカル失効通知を検出：この署名鍵に対する失効通知がこの端末に取り込まれています。別経路でも状況を確認してください。',
    localMatchBannerRotated:
      'ローカル鍵ローテーション通知を検出：この鍵には新鍵への移行通知が取り込まれています。',
    historicalValidNote:
      '過去の証明書の暗号署名自体の数学的妥当性は独立して維持され、事後的に書き換えられることはありません。',
  },
  similarity: {
    sectionTitle: 'SNS再圧縮向け 視覚的類似度チェック（補助機能）',
    badgeNonCrypto: '非暗号・補助参考値のみ',
    subtitle:
      'SNS投稿で再圧縮・リサイズされた画像と元画像を端末内で視覚比較します。暗号学的な改ざん検証（SHA-256）の代替にはなりません。',
    dropTitle: '比較したい別画像をドロップまたは選択',
    compareBtn: '視覚ハッシュを比較',
    clearBtn: '比較をクリア',
    combinedLabel: '総合視覚類似度 (dHash + pHash)',
    dHashLabel: 'dHash (64-bit)',
    pHashLabel: 'pHash DCT (64-bit)',
    bandHigh: '高い視覚的類似性（非暗号参考値）',
    bandModerate: '中程度の視覚的類似性（非暗号参考値）',
    bandLow: '視覚的類似性が低い',
    disclaimer:
      '厳密な暗号整合性検証は SHA-256 のみです。dHash / pHash は SNS 再圧縮等の確認補助用であり、別絵での誤一致や微細改変の見逃しが起こり得ます。',
    noBaseline: '視覚比較を行うには、先に検証対象となる画像を1枚読み込んでください。',
  },
  qrMaskSafety: {
    coverageLabel: 'qrMask 除外面積率',
    tierOk: '低除外率 (<= 15%)',
    tierCaution: '中除外率 (> 15%)',
    tierHigh: '高除外率 (> 30%)',
    warnCaution:
      '注意：作品面積の15%超が qrMask により SHA-256 検証から除外されます。可能であれば QR サイズを小さくしてください。',
    warnHigh:
      '警告：作品面積の30%超が SHA-256 整合性チェックから除外されます。QR を縮小するか Protocol v1 外枠モードをご検討ください。',
    highlightToggle: 'SHA-256 除外領域 (qrMask) を強調表示',
    optimizeSizeBtn: 'QRサイズを最小最適化',
    appliedHint: '読み取り可能な最小整数モジュール基準に調整しました。',
  },
  docsAddendum: {
    cliTitle: '独立オフライン検証 CLI',
    cliBody:
      'ブラウザ外でも src/ に一切依存しない独立検証ツール Go版（tools/chm-verify）と Node.js版（tools/chm-verify.mjs）で署名付きPNG・#proof=・.chproof.json・.chnotice.json を検証できます。',
    noticesTitle: '失効通知・鍵交換・チャレンジの設計範囲',
    noticesBody:
      'オフライン失効／ローテーション通知（CHM-NOTICE1）と鍵保有チャレンジ（CHM-CHALLENGE1）はドメイン分離された Ed25519 署名でローカル完結し、中央CAを必要としません。',
  },
};
