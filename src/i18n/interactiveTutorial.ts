import type { SupportedLocale } from '../core/storage/consent';

export interface InteractiveTutorialStepCopy {
  badge: string;
  title: string;
  body: string;
  highlight: string;
}

export interface InteractiveTutorialTranslations {
  dialogAria: string;
  headerButtonLabel: string;
  headerButtonTooltip: string;
  launchFromPageBtn: string;
  dragHint: string;
  stepCounterLabel: string;
  backBtn: string;
  nextBtn: string;
  skipBtn: string;
  doneBtn: string;
  steps: readonly [
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
  ];
}

export const INTERACTIVE_TUTORIAL_I18N: Record<SupportedLocale, InteractiveTutorialTranslations> = {
  en: {
    dialogAria: 'Interactive 3D tutorial',
    headerButtonLabel: 'Tutorial',
    headerButtonTooltip: 'Open interactive 3D tutorial',
    launchFromPageBtn: 'Launch 3D Interactive Tour',
    dragHint: 'Drag or swipe to tilt in 3D',
    stepCounterLabel: 'Step',
    backBtn: 'Back',
    nextBtn: 'Next',
    skipBtn: 'Skip',
    doneBtn: 'Get Started',
    steps: [
      {
        badge: '100% Local & Offline',
        title: 'Proof made entirely on your device',
        body: 'No account, no cloud upload, and no servers. Your artwork and signing keys stay inside your browser at all times.',
        highlight: 'Zero uploads · Works offline',
      },
      {
        badge: 'Step 1 · Local Key',
        title: 'Create your own signing key',
        body: 'Start by generating your personal Ed25519 key right in this browser. Save a backup file whenever you are ready so you never lose it.',
        highlight: 'Ed25519 local key · Easy backup',
      },
      {
        badge: 'Step 2 · Simple Mode',
        title: 'Sign artwork in just a few clicks',
        body: 'In Simple Mode, just pick your illustration and burn a tamper-evident QR certificate into it. You can switch to Advanced Mode anytime.',
        highlight: 'Simple Mode default · Switch anytime',
      },
      {
        badge: 'Step 3 · Offline Verify',
        title: 'Anyone can verify offline',
        body: 'Scan the QR code or drop the signed image into Verify to check authenticity and pixel integrity anywhere—even without internet.',
        highlight: 'Instant QR & image verification',
      },
    ],
  },
  ja: {
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
  },
  'zh-CN': {
    dialogAria: '交互式 3D 教程',
    headerButtonLabel: '教程',
    headerButtonTooltip: '打开交互式 3D 教程',
    launchFromPageBtn: '启动 3D 交互式指南',
    dragHint: '拖动或滑动以 3D 旋转',
    stepCounterLabel: '步骤',
    backBtn: '上一步',
    nextBtn: '下一步',
    skipBtn: '跳过',
    doneBtn: '开始使用',
    steps: [
      {
        badge: '100% 本地离线',
        title: '完全在本地设备完成的证明',
        body: '无需注册账号，无需上传服务器。您的画作和签名密钥始终保留在浏览器本地处理。',
        highlight: '零上传 · 支持离线运行',
      },
      {
        badge: '步骤 1 · 本地密钥',
        title: '创建专属签名密钥',
        body: '首先在浏览器中生成您的个人 Ed25519 签名密钥。建议随时保存密钥备份文件，以防更换设备时丢失。',
        highlight: 'Ed25519 本地密钥 · 轻松备份',
      },
      {
        badge: '步骤 2 · 简洁模式',
        title: '在 Simple Mode 中轻松签名',
        body: '在简洁模式下，只需选择插画即可嵌入防篡改二维码证书。需要更多功能时，随时可切换到 Advanced Mode。',
        highlight: '默认简洁模式 · 随时切换高级模式',
      },
      {
        badge: '步骤 3 · 离线验证',
        title: '任何人都能随时离线验证',
        body: '扫描二维码或将已签名图片拖入验证页面，即使没有网络也能立即核对作者签名与像素完整性。',
        highlight: '二维码与图片即时离线验证',
      },
    ],
  },
  'zh-TW': {
    dialogAria: '互動式 3D 教學',
    headerButtonLabel: '教學',
    headerButtonTooltip: '開啟互動式 3D 教學',
    launchFromPageBtn: '啟動 3D 互動導覽',
    dragHint: '拖曳或滑動以 3D 旋轉',
    stepCounterLabel: '步驟',
    backBtn: '上一步',
    nextBtn: '下一步',
    skipBtn: '略過',
    doneBtn: '開始使用',
    steps: [
      {
        badge: '100% 本機離線',
        title: '完全在裝置內完成的創作證明',
        body: '免註冊帳號、免上傳伺服器。您的作品與簽章金鑰全程僅在瀏覽器本機端處理。',
        highlight: '零上傳 · 支援離線運作',
      },
      {
        badge: '步驟 1 · 本機金鑰',
        title: '建立專屬的簽章金鑰',
        body: '先在瀏覽器內產生您的個人 Ed25519 簽章金鑰。別忘了適時匯出備份檔，避免換機或清除資料時遺失。',
        highlight: 'Ed25519 本機金鑰 · 輕鬆備份',
      },
      {
        badge: '步驟 2 · 簡易模式',
        title: '用 Simple Mode 輕鬆簽章',
        body: '在簡易模式中，只要選取插畫就能嵌入防竄改 QR 憑證。日後有進階需求時，隨時可切換至 Advanced Mode。',
        highlight: '預設簡易模式 · 隨時切換進階模式',
      },
      {
        badge: '步驟 3 · 離線驗證',
        title: '任何人都能離線驗證真偽',
        body: '掃描 QR 碼或將簽章圖片拖入驗證頁面，即使離線也能立即確認作者簽章與像素完整性。',
        highlight: 'QR 碼與圖片即時離線驗證',
      },
    ],
  },
  ko: {
    dialogAria: '인터랙티브 3D 튜토리얼',
    headerButtonLabel: '튜토리얼',
    headerButtonTooltip: '인터랙티브 3D 튜토리얼 열기',
    launchFromPageBtn: '3D 인터랙티브 가이드 열기',
    dragHint: '드래그하거나 스와이프해 3D로 돌려보세요',
    stepCounterLabel: '단계',
    backBtn: '이전',
    nextBtn: '다음',
    skipBtn: '건너뛰기',
    doneBtn: '시작하기',
    steps: [
      {
        badge: '100% 로컬 · 오프라인',
        title: '내 기기 안에서 완결되는 증명',
        body: '회원가입도 서버 업로드도 필요 없습니다. 작품과 서명 키는 모두 브라우저 안에서만 안전하게 처리됩니다.',
        highlight: '외부 전송 없음 · 오프라인 동작',
      },
      {
        badge: 'Step 1 · 로컬 키',
        title: '나만의 서명 키 만들기',
        body: '먼저 브라우저에서 개인 Ed25519 서명 키를 생성합니다. 기기 변경에 대비해 백업 파일을 저장해 두면 안전합니다.',
        highlight: 'Ed25519 로컬 키 · 간편 백업',
      },
      {
        badge: 'Step 2 · 심플 모드',
        title: 'Simple Mode로 간편하게 서명',
        body: '심플 모드에서는 일러스트를 선택해 QR 증명서를 새기기만 하면 끝입니다. 필요하면 언제든 Advanced Mode로 전환할 수 있습니다.',
        highlight: 'Simple Mode 기본 · 언제든 모드 전환',
      },
      {
        badge: 'Step 3 · 오프라인 검증',
        title: '누구나 오프라인으로 검증',
        body: 'QR 코드를 스캔하거나 서명된 이미지를 검증 화면에 올리면 인터넷 없이도 서명과 위변조 여부를 바로 확인할 수 있습니다.',
        highlight: 'QR 및 이미지 즉시 오프라인 검증',
      },
    ],
  },
  ru: {
    dialogAria: 'Интерактивный 3D-учебник',
    headerButtonLabel: 'Обучение',
    headerButtonTooltip: 'Открыть интерактивный 3D-учебник',
    launchFromPageBtn: 'Запустить 3D-тур',
    dragHint: 'Потяните или смахните для 3D-поворота',
    stepCounterLabel: 'Шаг',
    backBtn: 'Назад',
    nextBtn: 'Далее',
    skipBtn: 'Пропустить',
    doneBtn: 'Начать',
    steps: [
      {
        badge: '100% локально',
        title: 'Подтверждение полностью в браузере',
        body: 'Без аккаунтов и загрузки на сервер. Ваши иллюстрации и ключи подписи никогда не покидают устройство.',
        highlight: 'Без загрузок · Работает офлайн',
      },
      {
        badge: 'Шаг 1 · Локальный ключ',
        title: 'Создайте свой ключ подписи',
        body: 'Сгенерируйте личный ключ Ed25519 прямо в браузере. Сохраните резервную копию ключа, чтобы не потерять его.',
        highlight: 'Локальный ключ Ed25519 · Резервная копия',
      },
      {
        badge: 'Шаг 2 · Простой режим',
        title: 'Подпись в Simple Mode за пару кликов',
        body: 'Выберите иллюстрацию и встройте QR-сертификат. При необходимости в любой момент можно переключиться в Advanced Mode.',
        highlight: 'Simple Mode по умолчанию · Гибкий переход',
      },
      {
        badge: 'Шаг 3 · Офлайн-проверка',
        title: 'Проверка доступна каждому офлайн',
        body: 'Отсканируйте QR-код или загрузите подписанное изображение в раздел проверки — подлинность подтверждается без интернета.',
        highlight: 'Мгновенная офлайн-проверка QR и PNG',
      },
    ],
  },
  uk: {
    dialogAria: 'Інтерактивний 3D-посібник',
    headerButtonLabel: 'Посібник',
    headerButtonTooltip: 'Відкрити інтерактивний 3D-посібник',
    launchFromPageBtn: 'Запустити 3D-тур',
    dragHint: 'Перетягніть або проведіть для 3D-обертання',
    stepCounterLabel: 'Крок',
    backBtn: 'Назад',
    nextBtn: 'Далі',
    skipBtn: 'Пропустити',
    doneBtn: 'Почати',
    steps: [
      {
        badge: '100% локально',
        title: 'Доказ створюється лише на вашому пристрої',
        body: 'Без акаунтів і завантаження на сервери. Ваші ілюстрації та ключі підпису завжди залишаються у браузері.',
        highlight: 'Нуль завантажень · Працює офлайн',
      },
      {
        badge: 'Крок 1 · Локальний ключ',
        title: 'Створіть власний ключ підпису',
        body: 'Згенеруйте персональний ключ Ed25519 прямо у браузері та збережіть резервну копію, щоб не втратити доступ.',
        highlight: 'Локальний ключ Ed25519 · Резервна копія',
      },
      {
        badge: 'Крок 2 · Простий режим',
        title: 'Підписуйте у Simple Mode за мить',
        body: 'Оберіть ілюстрацію та додайте QR-сертифікат. За потреби ви завжди зможете перейти до Advanced Mode.',
        highlight: 'Simple Mode за замовчуванням · Легкий перехід',
      },
      {
        badge: 'Крок 3 · Офлайн-перевірка',
        title: 'Будь-хто може перевірити офлайн',
        body: 'Відскануйте QR-код або відкрийте підписане зображення у розділі перевірки — автентичність підтверджується без інтернету.',
        highlight: 'Миттєва офлайн-перевірка QR і зображення',
      },
    ],
  },
  es: {
    dialogAria: 'Tutorial interactivo 3D',
    headerButtonLabel: 'Tutorial',
    headerButtonTooltip: 'Abrir tutorial interactivo 3D',
    launchFromPageBtn: 'Iniciar guía 3D interactiva',
    dragHint: 'Arrastra o desliza para girar en 3D',
    stepCounterLabel: 'Paso',
    backBtn: 'Atrás',
    nextBtn: 'Siguiente',
    skipBtn: 'Omitir',
    doneBtn: 'Comenzar',
    steps: [
      {
        badge: '100% local y sin conexión',
        title: 'Prueba generada en tu propio dispositivo',
        body: 'Sin cuentas ni subidas a servidores. Tus ilustraciones y claves permanecen siempre dentro de tu navegador.',
        highlight: 'Cero subidas · Funciona sin conexión',
      },
      {
        badge: 'Paso 1 · Clave local',
        title: 'Crea tu propia clave de firma',
        body: 'Genera primero tu clave personal Ed25519 en el navegador. Guarda una copia de seguridad cuando puedas para protegerla.',
        highlight: 'Clave local Ed25519 · Respaldo sencillo',
      },
      {
        badge: 'Paso 2 · Modo Simple',
        title: 'Firma tu arte en segundos',
        body: 'En Simple Mode solo eliges tu ilustración y grabas el certificado QR. Si necesitas más opciones, cambia a Advanced Mode cuando quieras.',
        highlight: 'Simple Mode por defecto · Cambio instantáneo',
      },
      {
        badge: 'Paso 3 · Verificación offline',
        title: 'Cualquiera puede verificar sin internet',
        body: 'Escanea el código QR o arrastra la imagen firmada a Verificar para comprobar la autoría e integridad en cualquier momento.',
        highlight: 'Verificación offline por QR o imagen',
      },
    ],
  },
  fr: {
    dialogAria: 'Tutoriel interactif 3D',
    headerButtonLabel: 'Tutoriel',
    headerButtonTooltip: 'Ouvrir le tutoriel interactif 3D',
    launchFromPageBtn: 'Lancer le guide 3D interactif',
    dragHint: 'Glissez pour faire pivoter en 3D',
    stepCounterLabel: 'Étape',
    backBtn: 'Retour',
    nextBtn: 'Suivant',
    skipBtn: 'Passer',
    doneBtn: 'Commencer',
    steps: [
      {
        badge: '100 % local et hors ligne',
        title: 'Une preuve créée sur votre appareil',
        body: 'Aucun compte, aucun envoi vers un serveur. Vos illustrations et clés de signature restent entièrement dans votre navigateur.',
        highlight: 'Zéro envoi · Fonctionne hors ligne',
      },
      {
        badge: 'Étape 1 · Clé locale',
        title: 'Créez votre clé de signature',
        body: 'Générez votre clé personnelle Ed25519 dans le navigateur. Pensez à sauvegarder le fichier de secours pour la protéger.',
        highlight: 'Clé locale Ed25519 · Sauvegarde facile',
      },
      {
        badge: 'Étape 2 · Mode Simple',
        title: 'Signez facilement en Simple Mode',
        body: 'Choisissez simplement votre illustration pour intégrer un certificat QR. Vous pouvez passer en Advanced Mode à tout moment.',
        highlight: 'Simple Mode par défaut · Mode avancé libre',
      },
      {
        badge: 'Étape 3 · Vérification hors ligne',
        title: 'Vérifiable hors ligne par tous',
        body: 'Scannez le QR code ou déposez l’image signée dans Vérifier pour contrôler l’authenticité, même sans connexion.',
        highlight: 'Vérification instantanée par QR ou image',
      },
    ],
  },
  de: {
    dialogAria: 'Interaktives 3D-Tutorial',
    headerButtonLabel: 'Tutorial',
    headerButtonTooltip: 'Interaktives 3D-Tutorial öffnen',
    launchFromPageBtn: 'Interaktive 3D-Tour starten',
    dragHint: 'Ziehen oder wischen für 3D-Ansicht',
    stepCounterLabel: 'Schritt',
    backBtn: 'Zurück',
    nextBtn: 'Weiter',
    skipBtn: 'Überspringen',
    doneBtn: 'Loslegen',
    steps: [
      {
        badge: '100 % lokal & offline',
        title: 'Nachweis direkt auf deinem Gerät',
        body: 'Kein Konto, kein Server-Upload. Deine Illustrationen und Signaturschlüssel bleiben jederzeit lokal in deinem Browser.',
        highlight: 'Keine Uploads · Offline nutzbar',
      },
      {
        badge: 'Schritt 1 · Lokaler Schlüssel',
        title: 'Eigenen Signaturschlüssel erstellen',
        body: 'Erstelle zuerst deinen persönlichen Ed25519-Schlüssel im Browser und sichere bei Gelegenheit eine Backup-Datei.',
        highlight: 'Ed25519-Schlüssel · Einfaches Backup',
      },
      {
        badge: 'Schritt 2 · Simple Mode',
        title: 'Einfach signieren im Simple Mode',
        body: 'Wähle dein Bild aus und brenne das QR-Zertifikat ein. Bei Bedarf kannst du jederzeit in den Advanced Mode wechseln.',
        highlight: 'Simple Mode Standard · Jederzeit erweiterbar',
      },
      {
        badge: 'Schritt 3 · Offline prüfen',
        title: 'Jeder kann offline verifizieren',
        body: 'QR-Code scannen oder signiertes Bild in „Prüfen“ ziehen, um Echtheit und Pixel-Integrität jederzeit ohne Internet zu bestätigen.',
        highlight: 'Sofortige Offline-Prüfung per QR & Bild',
      },
    ],
  },
  pt: {
    dialogAria: 'Tutorial interativo 3D',
    headerButtonLabel: 'Tutorial',
    headerButtonTooltip: 'Abrir tutorial interativo 3D',
    launchFromPageBtn: 'Iniciar tour 3D interativo',
    dragHint: 'Arraste ou deslize para girar em 3D',
    stepCounterLabel: 'Etapa',
    backBtn: 'Voltar',
    nextBtn: 'Avançar',
    skipBtn: 'Pular',
    doneBtn: 'Começar',
    steps: [
      {
        badge: '100% local e offline',
        title: 'Prova feita totalmente no seu dispositivo',
        body: 'Sem conta e sem envio para servidores. Suas artes e chaves de assinatura permanecem sempre no navegador.',
        highlight: 'Zero envios · Funciona offline',
      },
      {
        badge: 'Etapa 1 · Chave local',
        title: 'Crie sua chave de assinatura',
        body: 'Gere sua chave pessoal Ed25519 direto no navegador e guarde um arquivo de backup para nunca perdê-la.',
        highlight: 'Chave local Ed25519 · Backup fácil',
      },
      {
        badge: 'Etapa 2 · Modo Simples',
        title: 'Assine facilmente no Simple Mode',
        body: 'Escolha sua ilustração e grave o certificado QR em poucos cliques. Quando precisar, alterne para o Advanced Mode.',
        highlight: 'Simple Mode padrão · Troque quando quiser',
      },
      {
        badge: 'Etapa 3 · Verificação offline',
        title: 'Qualquer pessoa verifica offline',
        body: 'Escaneie o QR code ou solte a imagem assinada em Verificar para confirmar autoria e integridade sem internet.',
        highlight: 'Verificação offline por QR e imagem',
      },
    ],
  },
  it: {
    dialogAria: 'Tutorial interattivo 3D',
    headerButtonLabel: 'Tutorial',
    headerButtonTooltip: 'Apri il tutorial interattivo 3D',
    launchFromPageBtn: 'Avvia tour 3D interattivo',
    dragHint: 'Trascina o scorri per ruotare in 3D',
    stepCounterLabel: 'Passaggio',
    backBtn: 'Indietro',
    nextBtn: 'Avanti',
    skipBtn: 'Salta',
    doneBtn: 'Inizia',
    steps: [
      {
        badge: '100% locale e offline',
        title: 'Prova creata solo sul tuo dispositivo',
        body: 'Nessun account e nessun caricamento su server. Le tue illustrazioni e chiavi restano sempre nel browser.',
        highlight: 'Zero upload · Funziona offline',
      },
      {
        badge: 'Passaggio 1 · Chiave locale',
        title: 'Crea la tua chiave di firma',
        body: 'Genera la tua chiave personale Ed25519 nel browser e salva un backup quando vuoi per tenerla al sicuro.',
        highlight: 'Chiave locale Ed25519 · Backup semplice',
      },
      {
        badge: 'Passaggio 2 · Simple Mode',
        title: 'Firma in pochi clic con Simple Mode',
        body: 'Scegli l’illustrazione e applica il certificato QR. Se ti servono funzioni extra, passa ad Advanced Mode in qualsiasi momento.',
        highlight: 'Simple Mode predefinito · Cambio rapido',
      },
      {
        badge: 'Passaggio 3 · Verifica offline',
        title: 'Chiunque può verificare offline',
        body: 'Scansiona il codice QR o trascina l’immagine firmata in Verifica per controllare autenticità e integrità anche senza rete.',
        highlight: 'Verifica offline immediata via QR o immagine',
      },
    ],
  },
  ar: {
    dialogAria: 'دليل تفاعلي ثلاثي الأبعاد',
    headerButtonLabel: 'الدليل',
    headerButtonTooltip: 'افتح الدليل التفاعلي ثلاثي الأبعاد',
    launchFromPageBtn: 'بدء الجولة التفاعلية ثلاثية الأبعاد',
    dragHint: 'اسحب أو مرّر لتدوير البطاقة ثلاثياً',
    stepCounterLabel: 'الخطوة',
    backBtn: 'السابق',
    nextBtn: 'التالي',
    skipBtn: 'تخطي',
    doneBtn: 'ابدأ الآن',
    steps: [
      {
        badge: 'محلي 100% دون اتصال',
        title: 'إثبات ملكية كامل داخل جهازك',
        body: 'لا حاجة لحساب ولا رفع إلى أي خادم. تبقى رسوماتك ومفاتيح التوقيع داخل متصفحك طوال الوقت.',
        highlight: 'دون رفع للملفات · يعمل دون اتصال',
      },
      {
        badge: 'الخطوة 1 · مفتاح محلي',
        title: 'أنشئ مفتاح التوقيع الخاص بك',
        body: 'ابدأ بإنشاء مفتاح Ed25519 الشخصي داخل المتصفح، واحفظ نسخة احتياطية منه متى شئت لحمايته من الفقدان.',
        highlight: 'مفتاح Ed25519 محلي · نسخ احتياطي سهل',
      },
      {
        badge: 'الخطوة 2 · الوضع البسيط',
        title: 'وقّع أعمالك بسهولة في Simple Mode',
        body: 'اختر رسمتك فقط لدمج شهادة QR مقاومة للتلاعب. ويمكنك التبديل إلى Advanced Mode في أي وقت تحتاج فيه لإعدادات إضافية.',
        highlight: 'Simple Mode افتراضياً · تبديل فوري',
      },
      {
        badge: 'الخطوة 3 · تحقق دون اتصال',
        title: 'يمكن لأي شخص التحقق دون إنترنت',
        body: 'امسح رمز QR أو اسحب الصورة الموقّعة إلى صفحة التحقق للتأكد من الأصالة وسلامة البكسلات في أي وقت.',
        highlight: 'تحقق فوري عبر QR أو الصورة دون اتصال',
      },
    ],
  },
};
