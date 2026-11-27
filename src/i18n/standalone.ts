import type { SupportedLocale } from '../core/storage/consent';

export interface StandaloneTranslations {
  badge: string;
  title: string;
  subtitle: string;
  downloadCta: string;
  docsCta: string;
  originNoteTitle: string;
  originNoteBody: string;
  checksumLabel: string;
  modes: readonly {
    name: string;
    desc: string;
    badge: string;
  }[];
  platforms: readonly {
    os: string;
    artifact: string;
    notes: string;
  }[];
}

const EN_STANDALONE: StandaloneTranslations = {
  badge: 'Offline First · Zero Installer · Zero Cost',
  title: 'Standalone Edition (Linux, Windows & macOS)',
  subtitle:
    'Run Certified Handmade on air-gapped or USB-portable PCs without internet access—even on first launch. Powered by a lightweight Go loopback server (127.0.0.1:43777) with zero Node.js, Go, or browser extensions required.',
  downloadCta: 'Download on GitHub Releases',
  docsCta: 'Read Technical Details',
  originNoteTitle: 'Key Portability Between Web & Standalone',
  originNoteBody:
    'The online web edition (certified-handmade.com) and Standalone Edition (http://127.0.0.1:43777) use separate browser IndexedDB storage. Export an encrypted .chkey.json backup from Identity / Keys and restore it to carry your signing keys offline.',
  checksumLabel:
    'Always verify downloaded archives against SHA256SUMS.txt (`sha256sum -c SHA256SUMS.txt` on Linux, `shasum -a 256 -c SHA256SUMS.txt` on macOS, `CertUtil -hashfile ... SHA256` on Windows).',
  modes: [
    {
      name: 'Web Edition',
      badge: 'Online / Any Browser',
      desc: 'Runs immediately at certified-handmade.com on desktop, iOS, iPadOS, and Android with local Web Crypto signing.',
    },
    {
      name: 'Offline PWA',
      badge: 'Mobile & Desktop Cache',
      desc: 'Installable via browser after first HTTPS load. Service Worker caches assets for offline field verification.',
    },
    {
      name: 'Standalone Binary',
      badge: 'USB / Air-Gapped PC',
      desc: 'Single portable executable for Linux x86_64, Windows x86_64 & macOS (Apple Silicon / Intel). Works offline from launch #1 with zero setup.',
    },
  ],
  platforms: [
    {
      os: 'Linux x86_64 (CachyOS / Arch / Debian / Fedora)',
      artifact: 'certified-handmade-standalone-*-linux-amd64.tar.gz',
      notes: 'Static binary + .desktop launcher. Run directly from terminal or file manager.',
    },
    {
      os: 'Windows x86_64 (Portable .exe)',
      artifact: 'certified-handmade-standalone-*-windows-amd64.zip',
      notes: 'No installer or admin rights needed. Double-click to open in your default browser.',
    },
    {
      os: 'macOS Apple Silicon (M1 / M2 / M3 / M4)',
      artifact: 'certified-handmade-standalone-*-darwin-arm64.tar.gz',
      notes: 'Native arm64 binary verified on macOS CI. Extract and run from Terminal.',
    },
    {
      os: 'macOS Intel (x86_64)',
      artifact: 'certified-handmade-standalone-*-darwin-amd64.tar.gz',
      notes: 'Native amd64 binary for Intel Macs. Extract and run from Terminal.',
    },
  ],
};

const JA_STANDALONE: StandaloneTranslations = {
  badge: '完全オフライン・インストーラー不要・完全無料',
  title: 'スタンドアローン版（Linux / Windows / macOS）',
  subtitle:
    '初回起動時からインターネット接続なしで動作するポータブル版です。Go標準ライブラリによる軽量ローカルサーバー（127.0.0.1:43777）で完結し、Node.js や Go の事前インストールは不要です。',
  downloadCta: 'GitHub Releases からダウンロード',
  docsCta: '技術仕様と検証方法を見る',
  originNoteTitle: 'Web版とスタンドアローン版間の鍵移行について',
  originNoteBody:
    'Web版（certified-handmade.com）とスタンドアローン版（http://127.0.0.1:43777）ではブラウザのIndexedDB保存領域が分離されています。「鍵管理」で .chkey.json 暗号化バックアップを書き出して復元することで安全に鍵を移行できます。',
  checksumLabel:
    'ダウンロード後は必ず SHA256SUMS.txt で整合性を検証してください（Linux: `sha256sum -c SHA256SUMS.txt` / macOS: `shasum -a 256 -c SHA256SUMS.txt` / Windows: `CertUtil -hashfile ... SHA256`）。',
  modes: [
    {
      name: 'Web版',
      badge: 'ブラウザ即時利用',
      desc: 'PC・iPhone・iPad・Androidのブラウザからアクセスしてすぐにローカル署名・検証できます。',
    },
    {
      name: 'オフラインPWA',
      badge: '初回読込後オフライン対応',
      desc: '一度Web版を開いて端末にインストールすると、以降は機内モードでも署名・検証が可能です。',
    },
    {
      name: 'スタンドアローン実行ファイル',
      badge: 'USBポータブル / 完全隔離PC',
      desc: 'Linux x86_64・Windows x86_64・macOS (Apple Silicon / Intel) 向けの単体バイナリ。ネット未接続のPCでも初回起動から動作します。',
    },
  ],
  platforms: [
    {
      os: 'Linux x86_64（CachyOS / Arch / Debian / Fedora）',
      artifact: 'certified-handmade-standalone-*-linux-amd64.tar.gz',
      notes: '静的リンク済み単体バイナリと .desktop ランチャーを同梱。展開してすぐ実行できます。',
    },
    {
      os: 'Windows x86_64（ポータブル .exe）',
      artifact: 'certified-handmade-standalone-*-windows-amd64.zip',
      notes: 'インストーラーや管理者権限不要。ダブルクリックで既定のブラウザが開きます。',
    },
    {
      os: 'macOS Apple Silicon（M1 / M2 / M3 / M4）',
      artifact: 'certified-handmade-standalone-*-darwin-arm64.tar.gz',
      notes: 'macOS CI で動作確認済みの arm64 ネイティブバイナリ。展開してターミナルから起動できます。',
    },
    {
      os: 'macOS Intel（x86_64）',
      artifact: 'certified-handmade-standalone-*-darwin-amd64.tar.gz',
      notes: 'Intel Mac 向けの amd64 ネイティブバイナリ。展開してターミナルから起動できます。',
    },
  ],
};

export const STANDALONE_I18N: Record<SupportedLocale, StandaloneTranslations> = {
  en: EN_STANDALONE,
  ja: JA_STANDALONE,
  'zh-CN': {
    ...EN_STANDALONE,
    badge: '离线优先 · 无需安装器 · 完全免费',
    title: '独立离线版 (Linux & Windows)',
    subtitle:
      '无需联网（包括首次启动）即可在隔离电脑或 U 盘中运行的便携可执行程序。内置本地回环服务器 (127.0.0.1:43777)，无需安装 Node.js 或 Go。',
    downloadCta: '前往 GitHub Releases 下载',
    docsCta: '查看技术详情',
  },
  'zh-TW': {
    ...EN_STANDALONE,
    badge: '離線優先 · 無需安裝程式 · 完全免費',
    title: '獨立離線版 (Linux & Windows)',
    subtitle:
      '無需網路連線（包含首次啟動）即可在離線電腦或隨身碟執行的可攜式程式。內建本機迴環伺服器 (127.0.0.1:43777)，免安裝 Node.js 或 Go。',
    downloadCta: '前往 GitHub Releases 下載',
    docsCta: '查看技術詳情',
  },
  ko: {
    ...EN_STANDALONE,
    badge: '오프라인 우선 · 설치 불필요 · 100% 무료',
    title: '스탠드얼론 에디션 (Linux & Windows)',
    subtitle:
      '첫 실행부터 인터넷 연결 없이 USB 또는 오프라인 PC에서 실행되는 휴대용 바이너리입니다. 로컬 루프백 서버(127.0.0.1:43777)를 내장해 Node.js나 Go 설치가 필요 없습니다.',
    downloadCta: 'GitHub Releases에서 다운로드',
    docsCta: '기술 세부 정보 보기',
  },
  ru: {
    ...EN_STANDALONE,
    badge: 'Офлайн-первый · Без установщика · Бесплатно',
    title: 'Автономная версия (Linux и Windows)',
    subtitle:
      'Портативный бинарный файл для работы без интернета с первого запуска (включая USB и изолированные ПК). Использует локальный loopback-сервер 127.0.0.1:43777 без установки Node.js или Go.',
    downloadCta: 'Скачать на GitHub Releases',
    docsCta: 'Технические подробности',
  },
  uk: {
    ...EN_STANDALONE,
    badge: 'Офлайн-перший · Без інсталятора · Безкоштовно',
    title: 'Автономна версія (Linux та Windows)',
    subtitle:
      'Портативний виконуваний файл для роботи без інтернету з першого запуску. Локальний loopback-сервер 127.0.0.1:43777 не потребує встановлення Node.js чи Go.',
    downloadCta: 'Завантажити з GitHub Releases',
    docsCta: 'Технічні деталі',
  },
  es: {
    ...EN_STANDALONE,
    badge: 'Offline primero · Sin instalador · 100% Gratis',
    title: 'Edición Standalone (Linux y Windows)',
    subtitle:
      'Ejecutable portátil que funciona sin internet desde el primer inicio. Servidor local 127.0.0.1:43777 integrado sin necesidad de Node.js ni Go.',
    downloadCta: 'Descargar en GitHub Releases',
    docsCta: 'Ver detalles técnicos',
  },
  fr: {
    ...EN_STANDALONE,
    badge: 'Hors ligne · Sans installateur · 100% Gratuit',
    title: 'Édition Standalone (Linux & Windows)',
    subtitle:
      'Exécutable portable fonctionnant sans connexion dès le premier lancement sur 127.0.0.1:43777, sans installer Node.js ni Go.',
    downloadCta: 'Télécharger sur GitHub Releases',
    docsCta: 'Détails techniques',
  },
  de: {
    ...EN_STANDALONE,
    badge: 'Offline-First · Ohne Installer · 100% Kostenlos',
    title: 'Standalone-Edition (Linux & Windows)',
    subtitle:
      'Portables Programm für den Betrieb ohne Internetverbindung ab dem ersten Start über 127.0.0.1:43777 — ohne Node.js oder Go.',
    downloadCta: 'Auf GitHub Releases herunterladen',
    docsCta: 'Technische Details lesen',
  },
  pt: {
    ...EN_STANDALONE,
    badge: 'Offline-First · Sem instalador · 100% Gratuito',
    title: 'Edição Standalone (Linux e Windows)',
    subtitle:
      'Executável portátil que funciona sem internet desde a primeira execução em 127.0.0.1:43777, sem exigir Node.js ou Go.',
    downloadCta: 'Baixar no GitHub Releases',
    docsCta: 'Ver detalhes técnicos',
  },
  it: {
    ...EN_STANDALONE,
    badge: 'Offline-First · Senza installer · 100% Gratuito',
    title: 'Edizione Standalone (Linux e Windows)',
    subtitle:
      'Eseguibile portatile utilizzabile senza connessione internet fin dal primo avvio su 127.0.0.1:43777, senza Node.js o Go.',
    downloadCta: 'Scarica da GitHub Releases',
    docsCta: 'Dettagli tecnici',
  },
  ar: {
    ...EN_STANDALONE,
    badge: 'دون اتصال أولاً · بدون مثبّت · مجاني 100%',
    title: 'الإصدار المستقل (Linux و Windows)',
    subtitle:
      'ملف تنفيذي محمول يعمل دون إنترنت منذ التشغيل الأول عبر العنوان المحلي 127.0.0.1:43777 دون الحاجة لتثبيت Node.js أو Go.',
    downloadCta: 'التنزيل من GitHub Releases',
    docsCta: 'عرض التفاصيل التقنية',
  },
};
