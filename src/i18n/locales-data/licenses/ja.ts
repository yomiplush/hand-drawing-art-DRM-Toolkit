import type { LicenseGuideTranslations } from '../../licenses';

export const JA: LicenseGuideTranslations = {
  guideTitle: '作品ライセンスと利用ルールのわかりやすい説明',
  guideSubtitle:
    'QR証明書に書き込める8種類のライセンスの意味と、追加の意思表示（商用・転載・AI学習）についての解説です。',
  selectedLabel: 'いま選んでいるルールの意味',
  appLicenseTitle: 'このアプリ自体のライセンス（MIT License）',
  appLicenseBody:
    'Certified Handmade というアプリ本体は MIT ライセンスの無料オープンソースです。あなたが描いた絵の権利はすべてあなたのものです。',
  signalGuideTitle: '商用利用・再配布・AI学習の意思表示について',
  signalGuideBody:
    '迷ったら「All Rights Reserved（無断使用NG）」のままでOKです。Creative Commons（CC）は世界共通の利用ルールです。下の「AI学習を許可しない」などの選択は、作者の希望をはっきり証明データに書き残す機能です（技術的なブロック機能ではなく、法的効力は国やサービスの規約によります）。',
  badges: {
    commercialYes: '商用利用: OK',
    commercialNo: '商用利用: NG',
    derivativesYes: '改変・二次創作: OK',
    derivativesNo: '改変・加工: NG',
    shareAlikeYes: '同じルールを継承',
    attributionYes: '作者名の記載: 必要',
    attributionNo: '作者名の記載: 不要',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved（無断使用すべてNG・おすすめ初期値）',
      summary:
        'いちばん一般的な設定です。あなたの許可なく画像を転載・販売・加工・商用利用することを禁止する通常の著作権表示です。',
    },
    'CC0-1.0': {
      name: 'CC0 1.0（著作権放棄・パブリックドメイン）',
      summary:
        '著作権を最大限放棄し、クレジット表記なし・商用可・改変可で誰でも自由に使ってよいことを宣言します。',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0（作者名を書けば商用・改変もOK）',
      summary:
        'あなたの名前（クレジット）を正しく記載すれば、営利目的や加工・二次創作を含めて誰でも自由に利用・共有できます。',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0（作者名記載＋改変作品も同じCC BY-SAで公開）',
      summary:
        '作者名を記載すれば商用・改変OKですが、アレンジした作品も必ず同じ CC BY-SA 4.0 で公開する必要があります。',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0（非営利のみOK・作者名記載）',
      summary:
        '作者名を記載すれば非営利での共有や二次創作はOKですが、グッズ販売や広告収益などの商用利用はできません。',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0（非営利のみ＋改変作品も同じルール継承）',
      summary:
        '作者名記載のうえ非営利のみ利用・改変でき、改変した作品も同じ CC BY-NC-SA 4.0 で公開するルールです。',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0（そのまま転載のみOK・加工改変NG）',
      summary:
        '画像をトリミングや加工せずそのまま紹介・転載することは（作者名記載のうえ商用含め）許可しますが、改変作品の配布は不可です。',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0（非営利・無改変の紹介のみOK）',
      summary:
        'CCの中で最も制限が厳しいルールです。作者名を表記し、営利目的でなく、一切加工しない状態でのみ共有できます。',
    },
  },
};
