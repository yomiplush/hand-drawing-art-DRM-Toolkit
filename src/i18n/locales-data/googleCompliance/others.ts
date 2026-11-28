import type { GoogleComplianceTranslations } from '../../googleCompliance';

export const ZH_CN: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: '本地优先的作品来源证明与离线二维码验证',
    appPurposeBody:
      'Certified Handmade 是一款免费开源（MIT）工具包，可在浏览器本地使用 Ed25519 密钥和 SHA-256 像素哈希为作品签名，并将自包含验证二维码无损嵌入 PNG——无需登录、无需服务器、不上传作品。',
    drivePurposeTitle: '可选 Google Drive 应用专属加密保管库 (drive.appdata)',
    drivePurposeBody:
      '签名与验证无需任何账号即可 100% 离线运行。仅当您在存储页面 (/storage) 主动连接 Google Drive 时，应用才会请求最小权限 drive.appdata，仅在隐藏的应用专属空间 appDataFolder 中保存经客户端 AES-256-GCM 加密的证明记录、公开身份、设备认证及可选加密恢复备份，绝不访问可见云盘文件或上传原图。',
    privacyLinkLabel: '隐私政策与 Google 数据说明',
    storageLinkLabel: '同步与存储设置',
    docsLinkLabel: '技术文档',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. 可选 Google OAuth 2.0 与 Google Drive API (drive.appdata) 披露',
    sectionBody:
      '• 完全可选且由用户主动触发：无需 Google 账号即可使用所有核心功能。仅当您在 /storage 点击连接 Google 账号时，才会加载 Google Identity Services 并仅请求 https://www.googleapis.com/auth/drive.appdata 最小权限。\n• 仅内存保存令牌：OAuth 访问令牌仅保留在内存 (RAM) 中，绝不写入 localStorage、IndexedDB、URL 或日志。断开连接或撤销授权不会删除本地数据。\n• 仅访问隐藏 appDataFolder 加密数据：仅访问本应用专属隐藏空间 appDataFolder 中经客户端 AES-256-GCM 加密的文件，绝不上传作品原图、工程文件、未加密私钥或明文个人数据。\n• 遵循 Google API Services User Data Policy (Limited Use)：严格遵守限制使用要求，数据仅用于您个人的跨设备加密同步，绝不出售、共享或用于广告及 AI/ML 训练。',
    tableRowName: 'Google OAuth 访问令牌（仅内存）',
    tableRowCategory: '可选用户同意（GDPR 第6条第1款(a)）',
    tableRowPurpose: '仅授权访问隐藏的应用专属 appDataFolder 中由本应用创建的加密保管库 (drive.appdata)。',
    tableRowRetention: '仅会话期间保留于内存；刷新或断开即清除',
  },
};

export const ZH_TW: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: '本地優先的作品來源證明與離線 QR 驗證',
    appPurposeBody:
      'Certified Handmade 是免費開源（MIT）工具組，可在瀏覽器本地使用 Ed25519 金鑰與 SHA-256 像素雜湊為作品簽章，並將自包含驗證 QR 碼無損嵌入 PNG——無需登入、無需伺服器、不上傳作品。',
    drivePurposeTitle: '可選 Google Drive 應用專屬加密保管庫 (drive.appdata)',
    drivePurposeBody:
      '簽章與驗證無需任何帳號即可 100% 離線運作。僅當您在儲存設定 (/storage) 主動連接 Google Drive 時，應用程式才會請求最小權限 drive.appdata，僅在隱藏的 appDataFolder 中儲存經用戶端 AES-256-GCM 加密的證明、公開身分、裝置授權與選用加密復原備份，絕不存取一般雲端檔案或上傳作品原圖。',
    privacyLinkLabel: '隱私權政策與 Google 資料說明',
    storageLinkLabel: '同步與儲存設定',
    docsLinkLabel: '技術文件',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. 可選 Google OAuth 2.0 與 Google Drive API (drive.appdata) 揭露聲明',
    sectionBody:
      '• 完全可選且由使用者主動觸發：無需 Google 帳號即可使用全部核心功能。僅在 /storage 點擊連接時載入 Google Identity Services，並僅請求 https://www.googleapis.com/auth/drive.appdata 最小權限。\n• 權杖僅存於記憶體：OAuth 存取權杖僅存於 RAM 中，絕不寫入 localStorage、IndexedDB、URL 或紀錄。中斷連線或撤銷授權不會刪除本地資料。\n• 僅儲存於隱藏的 appDataFolder：僅存取專屬隱藏空間 appDataFolder 中的用戶端 AES-256-GCM 加密檔案，絕不上傳作品原圖、工程檔、未加密私鑰或明文個資。\n• 遵循 Google API Services User Data Policy (Limited Use)：嚴格符合有限使用規定，資料僅用於跨裝置加密同步，絕不販售、廣告利用或用於 AI/ML 訓練。',
    tableRowName: 'Google OAuth 存取權杖（僅 RAM）',
    tableRowCategory: '可選使用者同意（GDPR 第6條第1項(a)）',
    tableRowPurpose: '僅授權存取隱藏的應用專屬空間 appDataFolder 中的加密檔案 (drive.appdata)。',
    tableRowRetention: '僅於工作階段存於記憶體；重新整理或中斷即清除',
  },
};

export const KO: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: '로컬 우선 작품 출처 증명 및 오프라인 QR 검증',
    appPurposeBody:
      'Certified Handmade는 브라우저 내에서 Ed25519 서명과 SHA-256 픽셀 해시로 작품에 서명하고 무손실 PNG에 자체 검증 QR 코드를 삽입하는 무료 오픈소스(MIT) 툴킷입니다. 로그인, 서버, 작품 업로드가 전혀 필요 없습니다.',
    drivePurposeTitle: '선택적 Google Drive 앱 전용 암호화 보관함 (drive.appdata)',
    drivePurposeBody:
      '서명 및 검증은 계정 없이 100% 오프라인으로 동작합니다. 저장소 설정(/storage)에서 Google Drive 연결을 직접 선택한 경우에만 최소 권한인 drive.appdata 범위를 요청하여 숨겨진 appDataFolder 공간에 클라이언트 측 AES-256-GCM 암호화 기록, 공개 ID, 기기 인증 및 선택적 암호화 복구 백업만 저장합니다.',
    privacyLinkLabel: '개인정보 처리방침 및 Google 데이터 안내',
    storageLinkLabel: '동기화 및 저장소 설정',
    docsLinkLabel: '기술 문서',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. 선택적 Google OAuth 2.0 및 Google Drive API (drive.appdata) 공개',
    sectionBody:
      '• 완전 선택형 사용자 주도 연결: Google 계정 없이도 모든 핵심 기능을 사용할 수 있습니다. /storage에서 Google 계정 연결을 누른 경우에만 Google Identity Services를 로드하고 https://www.googleapis.com/auth/drive.appdata 범위만 요청합니다.\n• RAM 전용 토큰 보관: OAuth 액세스 토큰은 휘발성 메모리(RAM)에만 유지되며 localStorage, IndexedDB, URL, 로그에 저장되지 않습니다.\n• 숨겨진 appDataFolder 암호화 보관함 전용: 앱 전용 숨김 공간(appDataFolder)의 클라이언트 측 AES-256-GCM 암호화 파일만 접근하며, 원본 작품, 작업 파일, 암호화되지 않은 개인키 및 평문 개인정보는 절대 업로드되지 않습니다.\n• Google API Services User Data Policy(Limited Use) 준수: 데이터는 기기 간 암호화 동기화 제공 목적으로만 사용되며 판매, 광고, 제3자 공유 또는 AI/ML 학습에 사용되지 않습니다.',
    tableRowName: 'Google OAuth 액세스 토큰 (RAM 전용)',
    tableRowCategory: '선택적 사용자 동의 (GDPR 제6조 제1항(a))',
    tableRowPurpose: '숨겨진 앱 전용 appDataFolder 내 AES-256-GCM 암호화 보관함 파일 접근 승인 (drive.appdata).',
    tableRowRetention: '세션 중 메모리에만 보관, 새로고침 또는 연결 해제 시 즉시 삭제',
  },
};

export const RU: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Локальное подтверждение авторства и офлайн QR-проверка',
    appPurposeBody:
      'Certified Handmade — бесплатный инструмент с открытым исходным кодом (MIT), который локально в браузере подписывает работы ключом Ed25519 и хешем пикселей SHA-256, встраивая автономный проверочный QR-код в PNG без потерь — без входа, серверов и загрузки работ.',
    drivePurposeTitle: 'Опциональное скрытое хранилище Google Диска (drive.appdata)',
    drivePurposeBody:
      'Подпись и проверка работают на 100% офлайн без аккаунта. Только если вы сами подключите Google Диск в /storage, приложение запросит минимальное разрешение drive.appdata исключительно для хранения зашифрованных на устройстве (AES-256-GCM) записей, профилей, устройств и опциональных резервных копий в скрытой области appDataFolder.',
    privacyLinkLabel: 'Политика конфиденциальности и данные Google',
    storageLinkLabel: 'Синхронизация и хранилище',
    docsLinkLabel: 'Документация',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Раскрытие сведений о Google OAuth 2.0 и Google Drive API (drive.appdata)',
    sectionBody:
      '• Полностью опционально: все основные функции работают без аккаунта Google. Только при нажатии кнопки подключения на /storage загружается Google Identity Services и запрашивается минимальная область https://www.googleapis.com/auth/drive.appdata.\n• Токены только в ОЗУ: токен доступа хранится исключительно в оперативной памяти (RAM) и никогда не записывается в localStorage, IndexedDB, URL или журналы.\n• Только скрытая область appDataFolder: доступ ограничен зашифрованными AES-256-GCM файлами приложения в скрытой области appDataFolder. Оригиналы работ и незашифрованные приватные ключи никогда не отправляются на Google Диск.\n• Соответствие Google API Services User Data Policy (Limited Use): данные используются только для синхронизации вашего личного зашифрованного хранилища и никогда не продаются, не передаются для рекламы и не используются для обучения ИИ.',
    tableRowName: 'Токен доступа Google OAuth (только RAM)',
    tableRowCategory: 'Опциональное согласие (ст. 6(1)(a) GDPR)',
    tableRowPurpose: 'Доступ только к скрытой области appDataFolder с зашифрованными файлами AES-256-GCM (drive.appdata).',
    tableRowRetention: 'Только в памяти во время сеанса; очищается при обновлении или отключении',
  },
};

export const UK: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Локальне підтвердження походження та офлайн QR-перевірка',
    appPurposeBody:
      'Certified Handmade — безкоштовний інструмент із відкритим кодом (MIT), що локально в браузері підписує твори ключем Ed25519 та хешем пікселів SHA-256, вбудовуючи автономний QR-код перевірки у PNG без втрат — без входу, серверів і завантаження робіт.',
    drivePurposeTitle: 'Опціональне приховане сховище Google Диска (drive.appdata)',
    drivePurposeBody:
      'Підпис і перевірка працюють на 100% офлайн без облікового запису. Лише якщо ви самостійно підключите Google Диск у /storage, застосунок запитає мінімальний дозвіл drive.appdata виключно для зберігання зашифрованих на пристрої (AES-256-GCM) записів, профілів і пристроїв у прихованій області appDataFolder.',
    privacyLinkLabel: 'Політика конфіденційності та дані Google',
    storageLinkLabel: 'Синхронізація та сховище',
    docsLinkLabel: 'Технічна документація',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Розкриття інформації про Google OAuth 2.0 та Google Drive API (drive.appdata)',
    sectionBody:
      '• Повністю опціонально: усі основні функції працюють без облікового запису Google. Лише після натискання кнопки підключення на /storage завантажується Google Identity Services із запитом мінімальної області https://www.googleapis.com/auth/drive.appdata.\n• Токени лише в ОЗП: токен доступу зберігається тільки в оперативній пам’яті (RAM) і ніколи не записується в localStorage, IndexedDB, URL чи журнали.\n• Лише прихована область appDataFolder: доступ обмежений зашифрованими AES-256-GCM файлами в appDataFolder. Оригінали творів і незашифровані приватні ключі ніколи не завантажуються на Google Диск.\n• Відповідність Google API Services User Data Policy (Limited Use): дані використовуються виключно для вашої особистої зашифрованої синхронізації та ніколи не продаються, не використовуються для реклами чи навчання ШІ.',
    tableRowName: 'Токен доступу Google OAuth (лише RAM)',
    tableRowCategory: 'Опціональна згода (ст. 6(1)(a) GDPR)',
    tableRowPurpose: 'Доступ лише до прихованої області appDataFolder із зашифрованими файлами AES-256-GCM (drive.appdata).',
    tableRowRetention: 'Лише в пам’яті під час сеансу; очищається при оновленні або відключенні',
  },
};

export const ES: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Procedencia Criptográfica Local y Verificación QR Sin Conexión',
    appPurposeBody:
      'Certified Handmade es un kit gratuito y de código abierto (MIT) que firma obras digitales localmente en tu navegador mediante claves Ed25519 y hash SHA-256 de píxeles, incrustando un código QR autónomo en PNG sin pérdidas: sin cuentas, sin servidores y sin subir obras.',
    drivePurposeTitle: 'Bóveda Privada Opcional en Google Drive (drive.appdata)',
    drivePurposeBody:
      'La firma y verificación funcionan 100% sin conexión ni cuenta. Solo si eliges conectar Google Drive en /storage, Certified Handmade solicita el alcance mínimo drive.appdata únicamente para guardar copias, perfiles, dispositivos y respaldos cifrados en el cliente (AES-256-GCM) dentro de tu espacio oculto appDataFolder.',
    privacyLinkLabel: 'Política de Privacidad y Uso de Datos de Google',
    storageLinkLabel: 'Sincronización y Almacenamiento',
    docsLinkLabel: 'Documentación',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Divulgación Opcional de Google OAuth 2.0 y Google Drive API (drive.appdata)',
    sectionBody:
      '• Totalmente opcional e iniciado por el usuario: todas las funciones principales operan sin cuenta de Google. Solo cuando pulsas Conectar en /storage se carga Google Identity Services con el alcance mínimo https://www.googleapis.com/auth/drive.appdata.\n• Tokens solo en RAM: el token OAuth permanece exclusivamente en memoria volátil y nunca se guarda en localStorage, IndexedDB, URL ni registros.\n• Solo datos cifrados en el espacio oculto appDataFolder: solo accede al espacio privado appDataFolder cifrado con AES-256-GCM. Nunca se suben obras originales ni claves privadas sin cifrar.\n• Cumplimiento de Google API Services User Data Policy (Limited Use): los datos se usan únicamente para ofrecer sincronización cifrada personal en tu propio Drive; nunca se venden ni se usan para publicidad o entrenamiento de IA.',
    tableRowName: 'Token de acceso Google OAuth (solo RAM)',
    tableRowCategory: 'Consentimiento opcional (Art. 6(1)(a) RGPD)',
    tableRowPurpose: 'Autoriza acceso exclusivo al espacio oculto appDataFolder cifrado con AES-256-GCM (drive.appdata).',
    tableRowRetention: 'Solo en memoria durante la sesión activa; se borra al recargar o desconectar',
  },
};

export const FR: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Provenance Cryptographique Locale & Vérification QR Hors Ligne',
    appPurposeBody:
      'Certified Handmade est une boîte à outils libre et gratuite (MIT) qui signe vos œuvres localement dans le navigateur avec Ed25519 et SHA-256, en intégrant un QR code autonome dans un PNG sans perte — sans compte, sans serveur et sans envoi d’œuvres.',
    drivePurposeTitle: 'Coffre Privé Optionnel sur Google Drive (drive.appdata)',
    drivePurposeBody:
      'La signature et la vérification fonctionnent 100 % hors ligne sans compte. Uniquement si vous connectez Google Drive dans /storage, l’application demande la portée minimale drive.appdata pour stocker vos preuves, profils, appareils et sauvegardes chiffrés côté client (AES-256-GCM) dans votre espace caché appDataFolder.',
    privacyLinkLabel: 'Politique de confidentialité & données Google',
    storageLinkLabel: 'Synchronisation & stockage',
    docsLinkLabel: 'Documentation',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Divulgation Google OAuth 2.0 & Google Drive API (drive.appdata)',
    sectionBody:
      '• Strictement optionnel : toutes les fonctions essentielles fonctionnent sans compte Google. Google Identity Services n’est chargé que lorsque vous cliquez sur Connecter dans /storage avec la portée minimale https://www.googleapis.com/auth/drive.appdata.\n• Jetons uniquement en RAM : le jeton d’accès reste en mémoire vive et n’est jamais écrit dans localStorage, IndexedDB, les URL ou les journaux.\n• Coffre chiffré dans l’espace caché appDataFolder uniquement : l’accès est limité aux fichiers AES-256-GCM de l’espace privé appDataFolder. Aucune œuvre originale ni clé privée non chiffrée n’est envoyée.\n• Conformité Google API Services User Data Policy (Limited Use) : les données servent uniquement à synchroniser votre coffre personnel chiffré et ne sont jamais vendues ni utilisées pour la publicité ou l’entraînement d’IA.',
    tableRowName: 'Jeton d’accès Google OAuth (RAM uniquement)',
    tableRowCategory: 'Consentement optionnel (Art. 6(1)(a) RGPD)',
    tableRowPurpose: 'Autorise uniquement l’accès à l’espace caché appDataFolder chiffré en AES-256-GCM (drive.appdata).',
    tableRowRetention: 'En mémoire uniquement pendant la session ; effacé au rechargement ou à la déconnexion',
  },
};

export const DE: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Lokale Herkunftsnachweise & Offline-QR-Verifizierung',
    appPurposeBody:
      'Certified Handmade ist ein kostenloses MIT-Open-Source-Toolkit, das Kunstwerke lokal im Browser mit Ed25519-Schlüsseln und SHA-256-Pixel-Hashing signiert und einen eigenständigen Prüf-QR-Code verlustfrei in PNGs einbettet – ohne Login, ohne Server und ohne Bildupload.',
    drivePurposeTitle: 'Optionaler privater Google-Drive-Tresor (drive.appdata)',
    drivePurposeBody:
      'Signieren und Prüfen funktionieren 100 % offline ohne Konto. Nur wenn Sie unter /storage freiwillig Google Drive verbinden, fordert Certified Handmade den minimalen Scope drive.appdata an, um clientseitig mit AES-256-GCM verschlüsselte Nachweise, Profile, Geräte und optionale Backups im versteckten appDataFolder zu speichern.',
    privacyLinkLabel: 'Datenschutz & Google-Datenhinweis',
    storageLinkLabel: 'Synchronisation & Speicher',
    docsLinkLabel: 'Dokumentation',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Hinweise zu optionalem Google OAuth 2.0 & Google Drive API (drive.appdata)',
    sectionBody:
      '• Freiwillig & nutzerinitiiert: Alle Kernfunktionen arbeiten ohne Google-Konto. Erst beim Klick auf Verbinden unter /storage wird Google Identity Services mit dem minimalen Scope https://www.googleapis.com/auth/drive.appdata geladen.\n• Token nur im RAM: OAuth-Zugriffstoken werden ausschließlich im Arbeitsspeicher gehalten und nie in localStorage, IndexedDB, URLs oder Logs gespeichert.\n• Nur versteckter appDataFolder: Der Zugriff beschränkt sich auf clientseitig mit AES-256-GCM verschlüsselte Dateien im versteckten appDataFolder. Originalwerke und unverschlüsselte private Schlüssel werden niemals hochgeladen.\n• Google API Services User Data Policy (Limited Use): Daten werden ausschließlich für Ihre persönliche verschlüsselte Synchronisation genutzt und niemals verkauft, für Werbung verwendet oder zum Training von KI-Modellen genutzt.',
    tableRowName: 'Google OAuth Access Token (nur RAM)',
    tableRowCategory: 'Optionale Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)',
    tableRowPurpose: 'Berechtigt nur zum Zugriff auf den versteckten AES-256-GCM-Tresor im appDataFolder (drive.appdata).',
    tableRowRetention: 'Nur im Arbeitsspeicher während der Sitzung; bei Reload oder Trennung gelöscht',
  },
};

export const PT: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Proveniência Criptográfica Local e Verificação QR Offline',
    appPurposeBody:
      'Certified Handmade é um kit gratuito e de código aberto (MIT) que assina obras digitais localmente no navegador com chaves Ed25519 e hash SHA-256 dos pixels, incorporando um QR code autônomo em PNG sem perdas — sem login, sem servidores e sem envio de obras.',
    drivePurposeTitle: 'Cofre Privado Opcional no Google Drive (drive.appdata)',
    drivePurposeBody:
      'Assinatura e verificação funcionam 100% offline sem conta. Somente se você optar por conectar o Google Drive em /storage, o aplicativo solicita o escopo mínimo drive.appdata apenas para armazenar registros, perfis, dispositivos e backups criptografados no cliente (AES-256-GCM) dentro do espaço oculto appDataFolder.',
    privacyLinkLabel: 'Política de Privacidade e Dados Google',
    storageLinkLabel: 'Sincronização e Armazenamento',
    docsLinkLabel: 'Documentação',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Divulgação Opcional do Google OAuth 2.0 e Google Drive API (drive.appdata)',
    sectionBody:
      '• Totalmente opcional: todos os recursos principais funcionam sem conta Google. O Google Identity Services só é carregado quando você clica em Conectar em /storage com o escopo mínimo https://www.googleapis.com/auth/drive.appdata.\n• Tokens apenas na RAM: o token de acesso permanece somente na memória volátil e nunca é gravado em localStorage, IndexedDB, URLs ou logs.\n• Somente dados criptografados no appDataFolder oculto: acessa apenas o espaço privado appDataFolder criptografado com AES-256-GCM. Obras originais e chaves privadas sem criptografia nunca são enviadas.\n• Conformidade com Google API Services User Data Policy (Limited Use): os dados são usados exclusivamente para sincronização pessoal criptografada e nunca são vendidos ou usados para anúncios ou treinamento de IA.',
    tableRowName: 'Token de acesso Google OAuth (somente RAM)',
    tableRowCategory: 'Consentimento opcional (Art. 6(1)(a) GDPR)',
    tableRowPurpose: 'Autoriza acesso apenas ao espaço oculto appDataFolder criptografado com AES-256-GCM (drive.appdata).',
    tableRowRetention: 'Somente na memória durante a sessão; apagado ao recarregar ou desconectar',
  },
};

export const IT: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'Provenienza Crittografica Locale e Verifica QR Offline',
    appPurposeBody:
      'Certified Handmade è un toolkit gratuito e open source (MIT) che firma le opere localmente nel browser con chiavi Ed25519 e hash SHA-256 dei pixel, incorporando un QR code autonomo in PNG senza perdite — senza login, senza server e senza caricamento delle opere.',
    drivePurposeTitle: 'Archivio Privato Opzionale su Google Drive (drive.appdata)',
    drivePurposeBody:
      'Firma e verifica funzionano al 100% offline senza account. Solo se scegli di collegare Google Drive in /storage, l’app richiede lo scope minimo drive.appdata esclusivamente per salvare prove, profili, dispositivi e backup crittografati lato client (AES-256-GCM) nello spazio nascosto appDataFolder.',
    privacyLinkLabel: 'Privacy Policy e Dati Google',
    storageLinkLabel: 'Sincronizzazione e Archiviazione',
    docsLinkLabel: 'Documentazione',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. Informativa Opzionale su Google OAuth 2.0 e Google Drive API (drive.appdata)',
    sectionBody:
      '• Totalmente opzionale: tutte le funzioni principali funzionano senza account Google. Google Identity Services viene caricato solo quando selezioni Connetti in /storage con lo scope minimo https://www.googleapis.com/auth/drive.appdata.\n• Token solo in RAM: il token di accesso resta in memoria volatile e non viene mai salvato in localStorage, IndexedDB, URL o log.\n• Solo dati crittografati nello spazio nascosto appDataFolder: l’accesso riguarda solo i file AES-256-GCM nello spazio privato appDataFolder. Opere originali e chiavi private non crittografate non vengono mai caricate.\n• Conformità Google API Services User Data Policy (Limited Use): i dati servono esclusivamente per la sincronizzazione personale crittografata e non vengono mai venduti né usati per pubblicità o addestramento AI.',
    tableRowName: 'Token di accesso Google OAuth (solo RAM)',
    tableRowCategory: 'Consenso opzionale (Art. 6(1)(a) GDPR)',
    tableRowPurpose: 'Autorizza l’accesso solo allo spazio nascosto appDataFolder crittografato AES-256-GCM (drive.appdata).',
    tableRowRetention: 'Solo in memoria durante la sessione; cancellato al ricaricamento o disconnessione',
  },
};

export const AR: GoogleComplianceTranslations = {
  homeOverview: {
    appPurposeTitle: 'إثبات مصدر الأعمال محليًا والتحقق عبر QR دون اتصال',
    appPurposeBody:
      'Certified Handmade أداة مجانية ومفتوحة المصدر (MIT) توقّع الأعمال الفنية محليًا في متصفحك باستخدام مفاتيح Ed25519 وتجزئة SHA-256 للبكسلات، وتدمج رمز QR مستقل للتحقق داخل ملف PNG دون فقدان — دون تسجيل دخول أو خوادم أو رفع للأعمال.',
    drivePurposeTitle: 'خزنة Google Drive خاصة ومشفّرة اختيارية (drive.appdata)',
    drivePurposeBody:
      'يعمل التوقيع والتحقق دون اتصال بنسبة 100% ودون أي حساب. فقط إذا اخترت ربط Google Drive من صفحة التخزين (/storage)، يطلب التطبيق أقل صلاحية ممكنة (drive.appdata) لحفظ السجلات والنسخ الاحتياطية المشفّرة محليًا (AES-256-GCM) داخل مساحة appDataFolder المخفية فقط.',
    privacyLinkLabel: 'سياسة الخصوصية وإفصاح بيانات Google',
    storageLinkLabel: 'المزامنة والتخزين',
    docsLinkLabel: 'الوثائق التقنية',
  },
  privacyPolicyGoogle: {
    sectionTitle: '8. إفصاح Google OAuth 2.0 وواجهة Google Drive API (drive.appdata) الاختياري',
    sectionBody:
      '• اختياري تمامًا وبمبادرة المستخدم: تعمل جميع الميزات الأساسية دون حساب Google. يتم تحميل Google Identity Services فقط عند النقر على ربط الحساب في /storage مع طلب النطاق الأدنى https://www.googleapis.com/auth/drive.appdata فقط.\n• رموز الوصول في الذاكرة المؤقتة (RAM) فقط: لا تُحفظ رموز OAuth أبدًا في localStorage أو IndexedDB أو الروابط أو السجلات.\n• مساحة appDataFolder المخفية والمشفّرة فقط: يقتصر الوصول على الملفات المشفّرة بـ AES-256-GCM داخل مساحة appDataFolder المخفية. لا يتم رفع الأعمال الأصلية أو المفاتيح الخاصة غير المشفّرة أبدًا.\n• الالتزام بسياسة Google API Services User Data Policy (Limited Use): تُستخدم البيانات حصريًا لتوفير المزامنة المشفّرة الشخصية ولا تُباع أو تُستخدم للإعلانات أو تدريب نماذج الذكاء الاصطناعي.',
    tableRowName: 'رمز وصول Google OAuth (في RAM فقط)',
    tableRowCategory: 'موافقة اختيارية من المستخدم (المادة 6(1)(أ) GDPR)',
    tableRowPurpose: 'يسمح بالوصول فقط إلى مساحة appDataFolder المخفية والمشفّرة بـ AES-256-GCM (drive.appdata).',
    tableRowRetention: 'في الذاكرة فقط أثناء الجلسة النشطة؛ يُمسح عند التحديث أو فصل الحساب',
  },
};

export interface GoogleComplianceTranslationsOthers {
  'zh-CN': GoogleComplianceTranslations;
  'zh-TW': GoogleComplianceTranslations;
  'ko': GoogleComplianceTranslations;
  'ru': GoogleComplianceTranslations;
  'uk': GoogleComplianceTranslations;
  'es': GoogleComplianceTranslations;
  'fr': GoogleComplianceTranslations;
  'de': GoogleComplianceTranslations;
  'pt': GoogleComplianceTranslations;
  'it': GoogleComplianceTranslations;
  'ar': GoogleComplianceTranslations;
}

export const OTHERS: GoogleComplianceTranslationsOthers = {
  'zh-CN': ZH_CN,
  'zh-TW': ZH_TW,
  'ko': KO,
  'ru': RU,
  'uk': UK,
  'es': ES,
  'fr': FR,
  'de': DE,
  'pt': PT,
  'it': IT,
  'ar': AR,
};
