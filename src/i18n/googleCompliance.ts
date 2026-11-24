import type { SupportedLocale } from '../core/storage/consent';

export interface GoogleComplianceTranslations {
  homeOverview: {
    appPurposeTitle: string;
    appPurposeBody: string;
    drivePurposeTitle: string;
    drivePurposeBody: string;
    privacyLinkLabel: string;
    storageLinkLabel: string;
    docsLinkLabel: string;
  };
  privacyPolicyGoogle: {
    sectionTitle: string;
    sectionBody: string;
    tableRowName: string;
    tableRowCategory: string;
    tableRowPurpose: string;
    tableRowRetention: string;
  };
}

export const GOOGLE_COMPLIANCE_I18N: Record<SupportedLocale, GoogleComplianceTranslations> = {
  en: {
    homeOverview: {
      appPurposeTitle: 'Local-First Artwork Provenance & Offline QR Verification',
      appPurposeBody:
        'Certified Handmade is a free, MIT open-source toolkit that signs digital artwork locally in your browser using Ed25519 keys and SHA-256 pixel hashing, embedding a self-contained verification QR code into lossless PNGs—no login, no servers, and no artwork uploads.',
      drivePurposeTitle: 'Optional Google Drive Encrypted Vault (drive.file)',
      drivePurposeBody:
        'Signing and verification work 100% offline without any account. Only if you choose to connect Google Drive in Storage, Certified Handmade requests the minimal drive.file scope strictly to store client-side AES-256-GCM encrypted proof records, profiles, and backups inside your own My Drive/Certified Handmade folder—never accessing other Drive files or uploading artwork images.',
      privacyLinkLabel: 'Privacy Policy & Google Data Notice',
      storageLinkLabel: 'Storage & Google Drive Sync',
      docsLinkLabel: 'Technical Docs',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Optional Google OAuth 2.0 & Google Drive API (drive.file) Disclosure',
      sectionBody:
        '• Strictly Optional & User-Initiated: Certified Handmade works completely without a Google account. Only when you explicitly click "Connect Google Account" on /storage does your browser load Google Identity Services (accounts.google.com/gsi/client) and request the narrow https://www.googleapis.com/auth/drive.file scope.\n• RAM-Only OAuth Tokens: Access tokens are held strictly in volatile memory (RAM) and are never written to localStorage, IndexedDB, URLs, or logs. Disconnecting or revoking Google access never deletes local proofs or keys.\n• Client-Side Encrypted Vault Only: Certified Handmade accesses only app-created files inside your personal "My Drive/Certified Handmade" folder (e.g., encrypted keyring.chmk, manifest.chme, and encrypted proof/profile/policy snapshots encrypted locally with AES-256-GCM before upload). Original artworks, PSD/KRA/CLIP project files, Ed25519 private signing keys, Nostr private keys, and plaintext personal data are NEVER uploaded to Google Drive.\n• Google API Services User Data Policy (Limited Use): Certified Handmade’s use and transfer to any other app of information received from Google APIs strictly adhere to the Google API Services User Data Policy, including the Limited Use requirements. Data is used solely to provide user-facing personal encrypted vault sync in your own Drive and is never sold, used for ads, shared with third parties, or used to train AI/ML models.',
      tableRowName: 'Google OAuth Access Token (RAM only)',
      tableRowCategory: 'Optional User Consent (Art. 6(1)(a))',
      tableRowPurpose:
        'Authorizes access solely to app-created AES-256-GCM encrypted vault files in your own My Drive/Certified Handmade folder (drive.file).',
      tableRowRetention: 'RAM only during active session; cleared on reload or disconnect',
    },
  },
  ja: {
    homeOverview: {
      appPurposeTitle: '完全ローカル駆動の作品来歴証明・オフラインQR検証',
      appPurposeBody:
        'Certified Handmadeは、手描き作品などの画像にブラウザ内のEd25519鍵とSHA-256ピクセルハッシュで署名し、無劣化PNGへ自己完結型の検証QRコードを埋め込める完全無料・MITライセンスのオープンソースツールです。ログイン不要・サーバー送信なし・完全オフラインで動作します。',
      drivePurposeTitle: '任意の Google ドライブ暗号化保管庫（drive.file）',
      drivePurposeBody:
        '署名・検証はアカウントなしで100%完結します。ストレージ設定（/storage）から任意でGoogleドライブ連携を有効にした場合のみ、最小権限の drive.file スコープを使用し、ご自身のマイドライブ内「Certified Handmade」フォルダへ端末側でAES-256-GCM暗号化した証明データ・設定・バックアップのみを保存します（他ファイルへのアクセスや作品画像の送信は一切行いません）。',
      privacyLinkLabel: 'プライバシーポリシー・Googleデータ利用開示',
      storageLinkLabel: 'ストレージ・Googleドライブ連携',
      docsLinkLabel: '技術ドキュメント',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. 任意の Google OAuth 2.0・Google Drive API（drive.file）に関する開示',
      sectionBody:
        '• 完全任意・利用者操作による接続: Certified HandmadeはGoogleアカウントなしですべての基本機能を利用できます。/storage 画面で「Googleアカウントで接続」を明示的に押した場合に限り、Google Identity Services（accounts.google.com/gsi/client）を読み込み、最小権限スコープ https://www.googleapis.com/auth/drive.file のみを要求します。\n• アクセストークンのメモリ限定保持: 取得したOAuthアクセストークンはメモリ（RAM）内のみで保持され、localStorage・IndexedDB・URL・ログには一切保存しません。接続解除や権限取り消しを行ってもローカルの作品証明や署名鍵は削除されません。\n• クライアント側AES-256-GCM暗号化データのみ保存: アクセス対象は利用者本人のGoogleドライブ内「マイドライブ/Certified Handmade」フォルダに本アプリが作成したファイル（暗号化済み keyring.chmk、manifest.chme、暗号化済み証明・プロフィール・ポリシースナップショット等）に限られます。作品画像本体、PSD/KRA/CLIP等の制作ファイル、Ed25519署名秘密鍵、Nostr秘密鍵、平文の個人情報はGoogleドライブへ一切保存・送信しません。\n• Google API Services User Data Policy（Limited Use）準拠: Google APIから取得した情報の利用および他アプリへの移転は、Google API Services User Data Policy（Limited Use要件を含む）に厳格に準拠します。データは利用者自身の個人ドライブ上での暗号化同期機能提供のためだけに使用され、第三者への提供・販売、広告配信、AI/MLモデルの学習には一切使用しません。',
      tableRowName: 'Google OAuth アクセストークン（RAMのみ）',
      tableRowCategory: '任意の利用者同意（GDPR第6条1項(a)）',
      tableRowPurpose:
        '本人ドライブ内の専用フォルダ（Certified Handmade）に本アプリが作成したAES-256-GCM暗号化保管庫ファイルへのアクセスのみを認可（drive.file）。',
      tableRowRetention: 'セッション中のメモリ内のみ保持（再読み込み・切断で即時消去）',
    },
  },
  'zh-CN': {
    homeOverview: {
      appPurposeTitle: '本地优先的作品来源证明与离线二维码验证',
      appPurposeBody:
        'Certified Handmade 是一款免费开源（MIT）工具包，可在浏览器本地使用 Ed25519 密钥和 SHA-256 像素哈希为作品签名，并将自包含验证二维码无损嵌入 PNG——无需登录、无需服务器、不上传作品。',
      drivePurposeTitle: '可选 Google Drive 加密保管库 (drive.file)',
      drivePurposeBody:
        '签名与验证无需任何账号即可 100% 离线运行。仅当您在存储页面 (/storage) 主动连接 Google Drive 时，应用才会请求最小权限 drive.file，仅在您个人云盘的 Certified Handmade 文件夹中保存经客户端 AES-256-GCM 加密的证明记录、资料与备份，绝不访问其他文件或上传原图。',
      privacyLinkLabel: '隐私政策与 Google 数据说明',
      storageLinkLabel: '存储与 Google Drive 同步',
      docsLinkLabel: '技术文档',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. 可选 Google OAuth 2.0 与 Google Drive API (drive.file) 披露',
      sectionBody:
        '• 完全可选且由用户主动触发：无需 Google 账号即可使用所有核心功能。仅当您在 /storage 点击连接 Google 账号时，才会加载 Google Identity Services 并仅请求 https://www.googleapis.com/auth/drive.file 最小权限。\n• 仅内存保存令牌：OAuth 访问令牌仅保留在内存 (RAM) 中，绝不写入 localStorage、IndexedDB、URL 或日志。断开连接或撤销授权不会删除本地数据。\n• 仅保存客户端加密数据：仅访问您个人「我的云端硬盘/Certified Handmade」文件夹中本应用创建的 AES-256-GCM 加密文件，绝不上传作品原图、工程文件、Ed25519/Nostr 私钥或明文个人数据。\n• 遵循 Google API Services User Data Policy (Limited Use)：严格遵守限制使用要求，数据仅用于您个人云端加密同步，绝不出售、共享或用于广告及 AI/ML 训练。',
      tableRowName: 'Google OAuth 访问令牌（仅内存）',
      tableRowCategory: '可选用户同意（GDPR 第6条第1款(a)）',
      tableRowPurpose: '仅授权访问您个人云端硬盘 Certified Handmade 文件夹中本应用创建的加密文件 (drive.file)。',
      tableRowRetention: '仅会话期间保留于内存；刷新或断开即清除',
    },
  },
  'zh-TW': {
    homeOverview: {
      appPurposeTitle: '本地優先的作品來源證明與離線 QR 驗證',
      appPurposeBody:
        'Certified Handmade 是免費開源（MIT）工具組，可在瀏覽器本地使用 Ed25519 金鑰與 SHA-256 像素雜湊為作品簽章，並將自包含驗證 QR 碼無損嵌入 PNG——無需登入、無需伺服器、不上傳作品。',
      drivePurposeTitle: '可選 Google Drive 加密保管庫 (drive.file)',
      drivePurposeBody:
        '簽章與驗證無需任何帳號即可 100% 離線運作。僅當您在儲存設定 (/storage) 主動連接 Google Drive 時，應用程式才會請求最小權限 drive.file，僅在您個人雲端硬碟的 Certified Handmade 資料夾中儲存經用戶端 AES-256-GCM 加密的證明與備份，絕不存取其他檔案或上傳作品原圖。',
      privacyLinkLabel: '隱私權政策與 Google 資料說明',
      storageLinkLabel: '儲存空間與 Google Drive 同步',
      docsLinkLabel: '技術文件',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. 可選 Google OAuth 2.0 與 Google Drive API (drive.file) 揭露聲明',
      sectionBody:
        '• 完全可選且由使用者主動觸發：無需 Google 帳號即可使用全部核心功能。僅在 /storage 點擊連接時載入 Google Identity Services，並僅請求 https://www.googleapis.com/auth/drive.file 最小權限。\n• 權杖僅存於記憶體：OAuth 存取權杖僅存於 RAM 中，絕不寫入 localStorage、IndexedDB、URL 或紀錄。中斷連線或撤銷授權不會刪除本地資料。\n• 僅儲存用戶端加密檔案：僅存取個人「我的雲端硬碟/Certified Handmade」資料夾中由本應用建立的 AES-256-GCM 加密保管庫檔案，絕不上傳作品原圖、工程檔、Ed25519/Nostr 私鑰或明文個資。\n• 遵循 Google API Services User Data Policy (Limited Use)：嚴格符合有限使用規定，資料僅用於個人加密同步，絕不販售、廣告利用或用於 AI/ML 訓練。',
      tableRowName: 'Google OAuth 存取權杖（僅 RAM）',
      tableRowCategory: '可選使用者同意（GDPR 第6條第1項(a)）',
      tableRowPurpose: '僅授權存取個人雲端硬碟 Certified Handmade 資料夾中由本應用建立的加密檔案 (drive.file)。',
      tableRowRetention: '僅於工作階段存於記憶體；重新整理或中斷即清除',
    },
  },
  ko: {
    homeOverview: {
      appPurposeTitle: '로컬 우선 작품 출처 증명 및 오프라인 QR 검증',
      appPurposeBody:
        'Certified Handmade는 브라우저 내에서 Ed25519 서명과 SHA-256 픽셀 해시로 작품에 서명하고 무손실 PNG에 자체 검증 QR 코드를 삽입하는 무료 오픈소스(MIT) 툴킷입니다. 로그인, 서버, 작품 업로드가 전혀 필요 없습니다.',
      drivePurposeTitle: '선택적 Google Drive 암호화 보관함 (drive.file)',
      drivePurposeBody:
        '서명 및 검증은 계정 없이 100% 오프라인으로 동작합니다. 저장소 설정(/storage)에서 Google Drive 연결을 직접 선택한 경우에만 최소 권한인 drive.file 범위를 요청하여 개인 드라이브의 Certified Handmade 폴더에 클라이언트 측 AES-256-GCM 암호화 기록과 백업만 저장합니다.',
      privacyLinkLabel: '개인정보 처리방침 및 Google 데이터 안내',
      storageLinkLabel: '저장소 및 Google Drive 동기화',
      docsLinkLabel: '기술 문서',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. 선택적 Google OAuth 2.0 및 Google Drive API (drive.file) 공개',
      sectionBody:
        '• 완전 선택형 사용자 주도 연결: Google 계정 없이도 모든 핵심 기능을 사용할 수 있습니다. /storage에서 Google 계정 연결을 누른 경우에만 Google Identity Services를 로드하고 https://www.googleapis.com/auth/drive.file 범위만 요청합니다.\n• RAM 전용 토큰 보관: OAuth 액세스 토큰은 휘발성 메모리(RAM)에만 유지되며 localStorage, IndexedDB, URL, 로그에 저장되지 않습니다.\n• 클라이언트 측 암호화 보관함 전용: 개인 드라이브의 Certified Handmade 폴더 내 앱이 생성한 AES-256-GCM 암호화 파일만 접근하며, 원본 작품, 작업 파일, Ed25519/Nostr 개인키 및 평문 개인정보는 절대 업로드되지 않습니다.\n• Google API Services User Data Policy(Limited Use) 준수: 데이터는 사용자 본인의 암호화 동기화 제공 목적으로만 사용되며 판매, 광고, 제3자 공유 또는 AI/ML 학습에 사용되지 않습니다.',
      tableRowName: 'Google OAuth 액세스 토큰 (RAM 전용)',
      tableRowCategory: '선택적 사용자 동의 (GDPR 제6조 제1항(a))',
      tableRowPurpose: '개인 드라이브 Certified Handmade 폴더 내 앱 생성 AES-256-GCM 암호화 보관함 파일 접근 승인 (drive.file).',
      tableRowRetention: '세션 중 메모리에만 보관, 새로고침 또는 연결 해제 시 즉시 삭제',
    },
  },
  ru: {
    homeOverview: {
      appPurposeTitle: 'Локальное подтверждение авторства и офлайн QR-проверка',
      appPurposeBody:
        'Certified Handmade — бесплатный инструмент с открытым исходным кодом (MIT), который локально в браузере подписывает работы ключом Ed25519 и хешем пикселей SHA-256, встраивая автономный проверочный QR-код в PNG без потерь — без входа, серверов и загрузки работ.',
      drivePurposeTitle: 'Опциональное зашифрованное хранилище Google Диска (drive.file)',
      drivePurposeBody:
        'Подпись и проверка работают на 100% офлайн без аккаунта. Только если вы сами подключите Google Диск в /storage, приложение запросит минимальное разрешение drive.file исключительно для хранения зашифрованных на устройстве (AES-256-GCM) записей, профилей и резервных копий в вашей папке «Мой диск/Certified Handmade».',
      privacyLinkLabel: 'Политика конфиденциальности и данные Google',
      storageLinkLabel: 'Хранилище и синхронизация Google Диска',
      docsLinkLabel: 'Документация',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Раскрытие сведений о Google OAuth 2.0 и Google Drive API (drive.file)',
      sectionBody:
        '• Полностью опционально: все основные функции работают без аккаунта Google. Только при нажатии кнопки подключения на /storage загружается Google Identity Services и запрашивается минимальная область https://www.googleapis.com/auth/drive.file.\n• Токены только в ОЗУ: токен доступа хранится исключительно в оперативной памяти (RAM) и никогда не записывается в localStorage, IndexedDB, URL или журналы.\n• Только зашифрованное хранилище: доступ ограничен файлами, созданными приложением в вашей папке Certified Handmade (зашифрованные AES-256-GCM данные). Оригиналы работ, исходники и приватные ключи Ed25519/Nostr никогда не отправляются на Google Диск.\n• Соответствие Google API Services User Data Policy (Limited Use): данные используются только для синхронизации вашего личного зашифрованного хранилища и никогда не продаются, не передаются для рекламы и не используются для обучения ИИ.',
      tableRowName: 'Токен доступа Google OAuth (только RAM)',
      tableRowCategory: 'Опциональное согласие (ст. 6(1)(a) GDPR)',
      tableRowPurpose: 'Доступ только к созданным приложением зашифрованным файлам AES-256-GCM в папке Certified Handmade (drive.file).',
      tableRowRetention: 'Только в памяти во время сеанса; очищается при обновлении или отключении',
    },
  },
  uk: {
    homeOverview: {
      appPurposeTitle: 'Локальне підтвердження походження та офлайн QR-перевірка',
      appPurposeBody:
        'Certified Handmade — безкоштовний інструмент із відкритим кодом (MIT), що локально в браузері підписує твори ключем Ed25519 та хешем пікселів SHA-256, вбудовуючи автономний QR-код перевірки у PNG без втрат — без входу, серверів і завантаження робіт.',
      drivePurposeTitle: 'Опціональне зашифроване сховище Google Диска (drive.file)',
      drivePurposeBody:
        'Підпис і перевірка працюють на 100% офлайн без облікового запису. Лише якщо ви самостійно підключите Google Диск у /storage, застосунок запитає мінімальний дозвіл drive.file виключно для зберігання зашифрованих на пристрої (AES-256-GCM) записів, профілів і резервних копій у вашій теці «Мій диск/Certified Handmade».',
      privacyLinkLabel: 'Політика конфіденційності та дані Google',
      storageLinkLabel: 'Сховище та синхронізація Google Диска',
      docsLinkLabel: 'Технічна документація',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Розкриття інформації про Google OAuth 2.0 та Google Drive API (drive.file)',
      sectionBody:
        '• Повністю опціонально: усі основні функції працюють без облікового запису Google. Лише після натискання кнопки підключення на /storage завантажується Google Identity Services із запитом мінімальної області https://www.googleapis.com/auth/drive.file.\n• Токени лише в ОЗП: токен доступу зберігається тільки в оперативній пам’яті (RAM) і ніколи не записується в localStorage, IndexedDB, URL чи журнали.\n• Лише зашифроване сховище: доступ обмежений файлами, створеними застосунком у вашій теці Certified Handmade (зашифровані AES-256-GCM). Оригінали творів, вихідні файли та приватні ключі Ed25519/Nostr ніколи не завантажуються на Google Диск.\n• Відповідність Google API Services User Data Policy (Limited Use): дані використовуються виключно для вашої особистої зашифрованої синхронізації та ніколи не продаються, не використовуються для реклами чи навчання ШІ.',
      tableRowName: 'Токен доступу Google OAuth (лише RAM)',
      tableRowCategory: 'Опціональна згода (ст. 6(1)(a) GDPR)',
      tableRowPurpose: 'Доступ лише до створених застосунком зашифрованих файлів AES-256-GCM у теці Certified Handmade (drive.file).',
      tableRowRetention: 'Лише в пам’яті під час сеансу; очищається при оновленні або відключенні',
    },
  },
  es: {
    homeOverview: {
      appPurposeTitle: 'Procedencia Criptográfica Local y Verificación QR Sin Conexión',
      appPurposeBody:
        'Certified Handmade es un kit gratuito y de código abierto (MIT) que firma obras digitales localmente en tu navegador mediante claves Ed25519 y hash SHA-256 de píxeles, incrustando un código QR autónomo en PNG sin pérdidas: sin cuentas, sin servidores y sin subir obras.',
      drivePurposeTitle: 'Bóveda Cifrada Opcional en Google Drive (drive.file)',
      drivePurposeBody:
        'La firma y verificación funcionan 100% sin conexión ni cuenta. Solo si eliges conectar Google Drive en /storage, Certified Handmade solicita el alcance mínimo drive.file únicamente para guardar copias, perfiles y registros cifrados en el cliente (AES-256-GCM) dentro de tu propia carpeta My Drive/Certified Handmade.',
      privacyLinkLabel: 'Política de Privacidad y Uso de Datos de Google',
      storageLinkLabel: 'Almacenamiento y Google Drive',
      docsLinkLabel: 'Documentación',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Divulgación Opcional de Google OAuth 2.0 y Google Drive API (drive.file)',
      sectionBody:
        '• Totalmente opcional e iniciado por el usuario: todas las funciones principales operan sin cuenta de Google. Solo cuando pulsas Conectar en /storage se carga Google Identity Services con el alcance mínimo https://www.googleapis.com/auth/drive.file.\n• Tokens solo en RAM: el token OAuth permanece exclusivamente en memoria volátil y nunca se guarda en localStorage, IndexedDB, URL ni registros.\n• Solo datos cifrados en el cliente: solo accede a archivos creados por la app en tu carpeta Certified Handmade cifrados con AES-256-GCM. Nunca se suben obras originales ni claves privadas Ed25519/Nostr.\n• Cumplimiento de Google API Services User Data Policy (Limited Use): los datos se usan únicamente para ofrecer sincronización cifrada personal en tu propio Drive; nunca se venden ni se usan para publicidad o entrenamiento de IA.',
      tableRowName: 'Token de acceso Google OAuth (solo RAM)',
      tableRowCategory: 'Consentimiento opcional (Art. 6(1)(a) RGPD)',
      tableRowPurpose: 'Autoriza acceso exclusivo a archivos cifrados AES-256-GCM creados por la app en Certified Handmade (drive.file).',
      tableRowRetention: 'Solo en memoria durante la sesión activa; se borra al recargar o desconectar',
    },
  },
  fr: {
    homeOverview: {
      appPurposeTitle: 'Provenance Cryptographique Locale & Vérification QR Hors Ligne',
      appPurposeBody:
        'Certified Handmade est une boîte à outils libre et gratuite (MIT) qui signe vos œuvres localement dans le navigateur avec Ed25519 et SHA-256, en intégrant un QR code autonome dans un PNG sans perte — sans compte, sans serveur et sans envoi d’œuvres.',
      drivePurposeTitle: 'Coffre Chiffré Optionnel sur Google Drive (drive.file)',
      drivePurposeBody:
        'La signature et la vérification fonctionnent 100 % hors ligne sans compte. Uniquement si vous connectez Google Drive dans /storage, l’application demande la portée minimale drive.file pour stocker vos preuves, profils et sauvegardes chiffrés côté client (AES-256-GCM) dans votre dossier Mon Drive/Certified Handmade.',
      privacyLinkLabel: 'Politique de confidentialité & données Google',
      storageLinkLabel: 'Stockage & synchronisation Google Drive',
      docsLinkLabel: 'Documentation',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Divulgation Google OAuth 2.0 & Google Drive API (drive.file)',
      sectionBody:
        '• Strictement optionnel : toutes les fonctions essentielles fonctionnent sans compte Google. Google Identity Services n’est chargé que lorsque vous cliquez sur Connecter dans /storage avec la portée minimale https://www.googleapis.com/auth/drive.file.\n• Jetons uniquement en RAM : le jeton d’accès reste en mémoire vive et n’est jamais écrit dans localStorage, IndexedDB, les URL ou les journaux.\n• Coffre chiffré côté client uniquement : l’accès est limité aux fichiers AES-256-GCM créés par l’application dans votre dossier Certified Handmade. Aucune œuvre originale ni clé privée Ed25519/Nostr n’est envoyée.\n• Conformité Google API Services User Data Policy (Limited Use) : les données servent uniquement à synchroniser votre coffre personnel chiffré et ne sont jamais vendues ni utilisées pour la publicité ou l’entraînement d’IA.',
      tableRowName: 'Jeton d’accès Google OAuth (RAM uniquement)',
      tableRowCategory: 'Consentement optionnel (Art. 6(1)(a) RGPD)',
      tableRowPurpose: 'Autorise uniquement l’accès aux fichiers chiffrés AES-256-GCM créés dans Certified Handmade (drive.file).',
      tableRowRetention: 'En mémoire uniquement pendant la session ; effacé au rechargement ou à la déconnexion',
    },
  },
  de: {
    homeOverview: {
      appPurposeTitle: 'Lokale Herkunftsnachweise & Offline-QR-Verifizierung',
      appPurposeBody:
        'Certified Handmade ist ein kostenloses MIT-Open-Source-Toolkit, das Kunstwerke lokal im Browser mit Ed25519-Schlüsseln und SHA-256-Pixel-Hashing signiert und einen eigenständigen Prüf-QR-Code verlustfrei in PNGs einbettet – ohne Login, ohne Server und ohne Bildupload.',
      drivePurposeTitle: 'Optionaler verschlüsselter Google Drive Tresor (drive.file)',
      drivePurposeBody:
        'Signieren und Prüfen funktionieren 100 % offline ohne Konto. Nur wenn Sie unter /storage freiwillig Google Drive verbinden, fordert Certified Handmade den minimalen Scope drive.file an, um clientseitig mit AES-256-GCM verschlüsselte Nachweise, Profile und Backups in Ihrem Ordner „Meine Ablage/Certified Handmade“ zu speichern.',
      privacyLinkLabel: 'Datenschutz & Google-Datenhinweis',
      storageLinkLabel: 'Speicher & Google Drive Sync',
      docsLinkLabel: 'Dokumentation',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Hinweise zu optionalem Google OAuth 2.0 & Google Drive API (drive.file)',
      sectionBody:
        '• Freiwillig & nutzerinitiiert: Alle Kernfunktionen arbeiten ohne Google-Konto. Erst beim Klick auf Verbinden unter /storage wird Google Identity Services mit dem minimalen Scope https://www.googleapis.com/auth/drive.file geladen.\n• Token nur im RAM: OAuth-Zugriffstoken werden ausschließlich im Arbeitsspeicher gehalten und nie in localStorage, IndexedDB, URLs oder Logs gespeichert.\n• Nur clientseitig verschlüsselte Daten: Der Zugriff beschränkt sich auf von der App erstellte AES-256-GCM-Dateien im Ordner Certified Handmade. Originalwerke und private Ed25519-/Nostr-Schlüssel werden niemals hochgeladen.\n• Google API Services User Data Policy (Limited Use): Daten werden ausschließlich für Ihre persönliche verschlüsselte Synchronisation genutzt und niemals verkauft, für Werbung verwendet oder zum Training von KI-Modellen genutzt.',
      tableRowName: 'Google OAuth Access Token (nur RAM)',
      tableRowCategory: 'Optionale Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)',
      tableRowPurpose: 'Berechtigt nur zum Zugriff auf eigene AES-256-GCM-Tresordateien im Ordner Certified Handmade (drive.file).',
      tableRowRetention: 'Nur im Arbeitsspeicher während der Sitzung; bei Reload oder Trennung gelöscht',
    },
  },
  pt: {
    homeOverview: {
      appPurposeTitle: 'Proveniência Criptográfica Local e Verificação QR Offline',
      appPurposeBody:
        'Certified Handmade é um kit gratuito e de código aberto (MIT) que assina obras digitais localmente no navegador com chaves Ed25519 e hash SHA-256 dos pixels, incorporando um QR code autônomo em PNG sem perdas — sem login, sem servidores e sem envio de obras.',
      drivePurposeTitle: 'Cofre Criptografado Opcional no Google Drive (drive.file)',
      drivePurposeBody:
        'Assinatura e verificação funcionam 100% offline sem conta. Somente se você optar por conectar o Google Drive em /storage, o aplicativo solicita o escopo mínimo drive.file apenas para armazenar registros, perfis e backups criptografados no cliente (AES-256-GCM) na sua pasta Meu Drive/Certified Handmade.',
      privacyLinkLabel: 'Política de Privacidade e Dados Google',
      storageLinkLabel: 'Armazenamento e Google Drive',
      docsLinkLabel: 'Documentação',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Divulgação Opcional do Google OAuth 2.0 e Google Drive API (drive.file)',
      sectionBody:
        '• Totalmente opcional: todos os recursos principais funcionam sem conta Google. O Google Identity Services só é carregado quando você clica em Conectar em /storage com o escopo mínimo https://www.googleapis.com/auth/drive.file.\n• Tokens apenas na RAM: o token de acesso permanece somente na memória volátil e nunca é gravado em localStorage, IndexedDB, URLs ou logs.\n• Somente dados criptografados no cliente: acessa apenas arquivos AES-256-GCM criados pelo app na pasta Certified Handmade. Obras originais e chaves privadas Ed25519/Nostr nunca são enviadas.\n• Conformidade com Google API Services User Data Policy (Limited Use): os dados são usados exclusivamente para sincronização pessoal criptografada e nunca são vendidos ou usados para anúncios ou treinamento de IA.',
      tableRowName: 'Token de acesso Google OAuth (somente RAM)',
      tableRowCategory: 'Consentimento opcional (Art. 6(1)(a) GDPR)',
      tableRowPurpose: 'Autoriza acesso apenas a arquivos criptografados AES-256-GCM criados pelo app em Certified Handmade (drive.file).',
      tableRowRetention: 'Somente na memória durante a sessão; apagado ao recarregar ou desconectar',
    },
  },
  it: {
    homeOverview: {
      appPurposeTitle: 'Provenienza Crittografica Locale e Verifica QR Offline',
      appPurposeBody:
        'Certified Handmade è un toolkit gratuito e open source (MIT) che firma le opere localmente nel browser con chiavi Ed25519 e hash SHA-256 dei pixel, incorporando un QR code autonomo in PNG senza perdite — senza login, senza server e senza caricamento delle opere.',
      drivePurposeTitle: 'Archivio Crittografato Opzionale su Google Drive (drive.file)',
      drivePurposeBody:
        'Firma e verifica funzionano al 100% offline senza account. Solo se scegli di collegare Google Drive in /storage, l’app richiede lo scope minimo drive.file esclusivamente per salvare prove, profili e backup crittografati lato client (AES-256-GCM) nella tua cartella Il mio Drive/Certified Handmade.',
      privacyLinkLabel: 'Privacy Policy e Dati Google',
      storageLinkLabel: 'Archiviazione e Google Drive',
      docsLinkLabel: 'Documentazione',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. Informativa Opzionale su Google OAuth 2.0 e Google Drive API (drive.file)',
      sectionBody:
        '• Totalmente opzionale: tutte le funzioni principali funzionano senza account Google. Google Identity Services viene caricato solo quando selezioni Connetti in /storage con lo scope minimo https://www.googleapis.com/auth/drive.file.\n• Token solo in RAM: il token di accesso resta in memoria volatile e non viene mai salvato in localStorage, IndexedDB, URL o log.\n• Solo dati crittografati lato client: l’accesso riguarda solo i file AES-256-GCM creati dall’app nella cartella Certified Handmade. Opere originali e chiavi private Ed25519/Nostr non vengono mai caricate.\n• Conformità Google API Services User Data Policy (Limited Use): i dati servono esclusivamente per la sincronizzazione personale crittografata e non vengono mai venduti né usati per pubblicità o addestramento AI.',
      tableRowName: 'Token di accesso Google OAuth (solo RAM)',
      tableRowCategory: 'Consenso opzionale (Art. 6(1)(a) GDPR)',
      tableRowPurpose: 'Autorizza l’accesso solo ai file crittografati AES-256-GCM creati dall’app in Certified Handmade (drive.file).',
      tableRowRetention: 'Solo in memoria durante la sessione; cancellato al ricaricamento o disconnessione',
    },
  },
  ar: {
    homeOverview: {
      appPurposeTitle: 'إثبات مصدر الأعمال محليًا والتحقق عبر QR دون اتصال',
      appPurposeBody:
        'Certified Handmade أداة مجانية ومفتوحة المصدر (MIT) توقّع الأعمال الفنية محليًا في متصفحك باستخدام مفاتيح Ed25519 وتجزئة SHA-256 للبكسلات، وتدمج رمز QR مستقل للتحقق داخل ملف PNG دون فقدان — دون تسجيل دخول أو خوادم أو رفع للأعمال.',
      drivePurposeTitle: 'خزنة Google Drive مشفّرة اختيارية (drive.file)',
      drivePurposeBody:
        'يعمل التوقيع والتحقق دون اتصال بنسبة 100% ودون أي حساب. فقط إذا اخترت ربط Google Drive من صفحة التخزين (/storage)، يطلب التطبيق أقل صلاحية ممكنة (drive.file) لحفظ السجلات والنسخ الاحتياطية المشفّرة محليًا (AES-256-GCM) داخل مجلد My Drive/Certified Handmade الخاص بك فقط.',
      privacyLinkLabel: 'سياسة الخصوصية وإفصاح بيانات Google',
      storageLinkLabel: 'التخزين ومزامنة Google Drive',
      docsLinkLabel: 'الوثائق التقنية',
    },
    privacyPolicyGoogle: {
      sectionTitle: '8. إفصاح Google OAuth 2.0 وواجهة Google Drive API (drive.file) الاختياري',
      sectionBody:
        '• اختياري تمامًا وبمبادرة المستخدم: تعمل جميع الميزات الأساسية دون حساب Google. يتم تحميل Google Identity Services فقط عند النقر على ربط الحساب في /storage مع طلب النطاق الأدنى https://www.googleapis.com/auth/drive.file فقط.\n• رموز الوصول في الذاكرة المؤقتة (RAM) فقط: لا تُحفظ رموز OAuth أبدًا في localStorage أو IndexedDB أو الروابط أو السجلات.\n• بيانات مشفّرة من جهة العميل فقط: يقتصر الوصول على الملفات المشفّرة بـ AES-256-GCM التي ينشئها التطبيق داخل مجلد Certified Handmade الخاص بك. لا يتم رفع الأعمال الأصلية أو مفاتيح Ed25519/Nostr الخاصة أبدًا.\n• الالتزام بسياسة Google API Services User Data Policy (Limited Use): تُستخدم البيانات حصريًا لتوفير المزامنة المشفّرة الشخصية ولا تُباع أو تُستخدم للإعلانات أو تدريب نماذج الذكاء الاصطناعي.',
      tableRowName: 'رمز وصول Google OAuth (في RAM فقط)',
      tableRowCategory: 'موافقة اختيارية من المستخدم (المادة 6(1)(أ) GDPR)',
      tableRowPurpose: 'يسمح بالوصول فقط إلى ملفات الخزنة المشفّرة AES-256-GCM المنشأة داخل مجلد Certified Handmade (drive.file).',
      tableRowRetention: 'في الذاكرة فقط أثناء الجلسة النشطة؛ يُمسح عند التحديث أو فصل الحساب',
    },
  },
};
