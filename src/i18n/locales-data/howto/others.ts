import type { HowToTranslations } from '../../howto';

export const ZH_CN: HowToTranslations = {
  homeTitle: '三步轻松上手',
  homeSubtitle: '无需注册或复杂配置，在浏览器本地即可完成。',
  steps: [
    { title: '1. 选择你的画作', desc: '打开“创建证书”，拖入 PNG/JPEG/WebP 作品。文件绝不会上传至服务器。' },
    { title: '2. 一键创建签名印章并选定许可', desc: '首次使用可在同页面一键生成创作者密钥；不确定时保留默认的 All Rights Reserved 即可。' },
    { title: '3. 保存带二维码的 PNG 并分享', desc: '下载边缘烧录有二维码的无损 PNG，任何人都能在“验证”页离线核对。' },
  ],
  simpleFlowHint: '只需三步：①选图 → ②确认许可规则 → ③点击下方生成按钮。',
  quickKeyTitle: '首次使用？一键创建本地创作者签名密钥',
  quickKeyBody: '为作品签名需要在当前浏览器本地生成专属 Ed25519 密钥，全程不联网上传。',
  quickKeyBtn: '一键创建本地签名密钥',
  quickKeyBusy: '正在创建…',
  quickKeyTip: '提示：之后可随时在“密钥管理”页面下载加密备份 (.chkey.json)。',
  advancedToggle: '高级二维码布局与网址设置（可选，通常保持默认即可）',
  docsUsageTitle: '画师新手三步使用指南',
};

export const ZH_TW: HowToTranslations = {
  homeTitle: '三步驟輕鬆上手',
  homeSubtitle: '無須註冊或複雜設定，在瀏覽器本地即可完成。',
  steps: [
    { title: '1. 選擇你的畫作', desc: '開啟「建立憑證」並拖入作品影像，檔案絕不會上傳至任何伺服器。' },
    { title: '2. 一鍵建立簽署金鑰並選授權', desc: '初次使用可在同畫面一鍵建立創作者金鑰；不確定時維持預設 All Rights Reserved 即可。' },
    { title: '3. 下載含 QR 的 PNG 並分享', desc: '下載邊緣嵌入 QR Code 的無損 PNG，任何人都能在「驗證」頁離線查驗。' },
  ],
  simpleFlowHint: '只需三步：①選圖 → ②確認授權規則 → ③點擊下方建立按鈕。',
  quickKeyTitle: '初次使用？一鍵建立本地創作者簽署金鑰',
  quickKeyBody: '替畫作簽章需要在此瀏覽器本地建立專屬 Ed25519 金鑰，全程不會上傳網路。',
  quickKeyBtn: '一鍵建立本地簽署金鑰',
  quickKeyBusy: '建立中…',
  quickKeyTip: '提示：之後可隨時至「金鑰管理」下載加密備份 (.chkey.json)。',
  advancedToggle: '進階 QR 版面與網址設定（選填，一般維持預設即可）',
  docsUsageTitle: '繪師新手三步驟使用指南',
};

export const KO: HowToTranslations = {
  homeTitle: '누구나 따라 하는 3단계 사용법',
  homeSubtitle: '복잡한 가입이나 설정 없이 브라우저 안에서 바로 끝납니다.',
  steps: [
    { title: '1. 그림 파일 올리기', desc: '‘인증서 생성’에서 그림을 선택하세요. 그림은 외부 서버로 절대 전송되지 않습니다.' },
    { title: '2. 버튼 한 번으로 도장(키) 만들기 & 규칙 선택', desc: '처음이라면 화면에서 바로 클릭 한 번으로 서명 키를 만들 수 있습니다. 잘 모르면 기본값(All Rights Reserved) 그대로 두세요.' },
    { title: '3. QR 포함 PNG 저장 및 공유', desc: '여백에 QR 코드가 들어간 PNG를 저장하면 누구나 ‘검증’ 화면에서 오프라인으로 확인할 수 있습니다.' },
  ],
  simpleFlowHint: '기본 순서: ① 그림 선택 → ② 규칙 확인 → ③ 아래 서명 버튼 클릭!',
  quickKeyTitle: '처음이신가요? 클릭 1번으로 내 서명 키 만들기',
  quickKeyBody: '작품에 서명하려면 이 브라우저 안에만 저장되는 개인 Ed25519 키가 필요합니다. 서버로 업로드되지 않습니다.',
  quickKeyBtn: '클릭 1번으로 작가 키 만들기',
  quickKeyBusy: '생성 중…',
  quickKeyTip: '참고: 나중에 ‘키 관리’ 페이지에서 암호화 백업(.chkey.json)을 저장할 수 있습니다.',
  advancedToggle: '자세한 QR 위치 및 URL 설정 (선택 사항 — 기본값 권장)',
  docsUsageTitle: '그림 작가를 위한 3단계 초간단 가이드',
};

export const RU: HowToTranslations = {
  homeTitle: 'Как пользоваться за 3 простых шага',
  homeSubtitle: 'Без регистрации и сложных настроек — всё работает прямо в браузере.',
  steps: [
    { title: '1. Выберите рисунок', desc: 'Откройте «Создать сертификат» и перетащите изображение. Файл не покидает ваше устройство.' },
    { title: '2. Создайте ключ в 1 клик и выберите лицензию', desc: 'Если ключа ещё нет, создайте его прямо на странице одним нажатием. По умолчанию выбрана строгая защита All Rights Reserved.' },
    { title: '3. Сохраните PNG с QR и делитесь', desc: 'Скачайте PNG со встроенным QR на полях. Любой сможет проверить подпись и пиксели в разделе «Проверить».' },
  ],
  simpleFlowHint: 'Всё просто: 1. Выберите рисунок → 2. Проверьте права → 3. Нажмите кнопку подписи внизу.',
  quickKeyTitle: 'Впервые здесь? Создайте локальный ключ автора в 1 клик',
  quickKeyBody: 'Для подписи нужен личный ключ Ed25519 в хранилище браузера. Ничего никуда не загружается.',
  quickKeyBtn: 'Создать ключ автора в 1 клик',
  quickKeyBusy: 'Создание ключа…',
  quickKeyTip: 'Совет: резервную копию (.chkey.json) всегда можно скачать в разделе «Ключи».',
  advancedToggle: 'Дополнительные настройки макета QR и URL (необязательно)',
  docsUsageTitle: 'Простое руководство из 3 шагов для художников',
};

export const UK: HowToTranslations = {
  homeTitle: 'Як користуватися за 3 прості кроки',
  homeSubtitle: 'Без реєстрації та складних налаштувань — усе працює прямо у браузері.',
  steps: [
    { title: '1. Оберіть малюнок', desc: 'Відкрийте «Створити сертифікат» і перетягніть зображення. Файл залишається лише на вашому пристрої.' },
    { title: '2. Ключ в 1 клік і вибір ліцензії', desc: 'Якщо ключа ще немає, створіть його прямо на сторінці одним натисканням. У разі сумнівів залиште All Rights Reserved.' },
    { title: '3. Збережіть PNG із QR та діліться', desc: 'Завантажте PNG із QR на полях. Будь-хто зможе перевірити підпис і пікселі офлайн на сторінці «Перевірити».' },
  ],
  simpleFlowHint: 'Усе просто: 1. Оберіть файл → 2. Перевірте права → 3. Натисніть кнопку підпису нижче.',
  quickKeyTitle: 'Вперше тут? Створіть локальний ключ автора в 1 клік',
  quickKeyBody: 'Для підпису потрібен особистий ключ Ed25519 у цьому браузері. Дані не надсилаються на сервер.',
  quickKeyBtn: 'Створити ключ автора в 1 клік',
  quickKeyBusy: 'Створення ключа…',
  quickKeyTip: 'Порада: резервну копію (.chkey.json) можна будь-коли зберегти в розділі «Ключі».',
  advancedToggle: 'Додаткові параметри макета QR і URL (необов’язково)',
  docsUsageTitle: 'Простий 3-кроковий посібник для художників',
};

export const ES: HowToTranslations = {
  homeTitle: 'Cómo usarlo en 3 pasos sencillos',
  homeSubtitle: 'Sin cuentas ni configuraciones complejas. Todo ocurre en tu navegador.',
  steps: [
    { title: '1. Sube tu ilustración', desc: 'Abre «Crear certificado» y arrastra tu imagen. Nunca se sube a ningún servidor.' },
    { title: '2. Crea tu clave en 1 clic y elige licencia', desc: 'Si aún no tienes clave, créala al instante ahí mismo. Si dudas, deja «All Rights Reserved».' },
    { title: '3. Descarga el PNG con QR', desc: 'Guarda el PNG con el código QR en el margen; cualquiera podrá verificarlo sin conexión en «Verificar».' },
  ],
  simpleFlowHint: 'Flujo rápido: 1. Elige obra → 2. Revisa licencia → 3. Pulsa firmar abajo.',
  quickKeyTitle: '¿Primera vez? Crea tu clave de artista en 1 clic',
  quickKeyBody: 'Necesitas una clave local Ed25519 guardada en tu navegador. Nada sale de tu dispositivo.',
  quickKeyBtn: 'Crear mi clave de artista en 1 clic',
  quickKeyBusy: 'Creando clave…',
  quickKeyTip: 'Consejo: puedes descargar una copia cifrada (.chkey.json) en «Claves».',
  advancedToggle: 'Ajustes avanzados de diseño QR y URL (opcional)',
  docsUsageTitle: 'Guía rápida en 3 pasos para artistas',
};

export const FR: HowToTranslations = {
  homeTitle: 'Mode d’emploi en 3 étapes simples',
  homeSubtitle: 'Aucune inscription ni réglage compliqué. Tout se passe dans votre navigateur.',
  steps: [
    { title: '1. Déposez votre dessin', desc: 'Ouvrez « Créer un certificat » et sélectionnez votre image. Rien n’est envoyé sur un serveur.' },
    { title: '2. Clé en 1 clic et choix de licence', desc: 'Créez votre clé locale en un clic sur place si besoin. Par défaut, « All Rights Reserved » protège tout.' },
    { title: '3. Téléchargez le PNG avec QR', desc: 'Enregistrez le PNG doté du QR en marge ; chacun peut le vérifier hors ligne dans « Vérifier ».' },
  ],
  simpleFlowHint: 'Simple : 1. Choisir l’image → 2. Vérifier la licence → 3. Cliquer sur signer ci-dessous.',
  quickKeyTitle: 'Première visite ? Créez votre clé d’artiste en 1 clic',
  quickKeyBody: 'Une clé locale Ed25519 dans votre navigateur suffit pour signer vos œuvres sans envoi serveur.',
  quickKeyBtn: 'Créer ma clé d’artiste en 1 clic',
  quickKeyBusy: 'Création…',
  quickKeyTip: 'Astuce : sauvegardez votre copie chiffrée (.chkey.json) à tout moment dans « Clés ».',
  advancedToggle: 'Réglages avancés du QR et de l’URL (facultatif)',
  docsUsageTitle: 'Guide débutant en 3 étapes pour artistes',
};

export const DE: HowToTranslations = {
  homeTitle: 'In 3 einfachen Schritten nutzen',
  homeSubtitle: 'Kein Konto, keine Vorkenntnisse nötig. Alles läuft direkt im Browser.',
  steps: [
    { title: '1. Kunstwerk wählen', desc: 'Öffnen Sie „Zertifikat erstellen“ und wählen Sie Ihr Bild. Nichts wird hochgeladen.' },
    { title: '2. Schlüssel per 1-Klick & Lizenz wählen', desc: 'Noch kein Schlüssel? Direkt auf der Seite mit 1 Klick erstellen. „All Rights Reserved“ ist sicher voreingestellt.' },
    { title: '3. Signiertes PNG speichern & teilen', desc: 'Das PNG enthält den QR-Code sauber im Rand und lässt sich unter „Prüfen“ offline kontrollieren.' },
  ],
  simpleFlowHint: 'Kurzablauf: 1. Bild wählen → 2. Lizenz prüfen → 3. Unten signieren.',
  quickKeyTitle: 'Neu hier? Lokalen Künstlerschlüssel mit 1 Klick anlegen',
  quickKeyBody: 'Zum Signieren benötigt Ihr Browser einen lokalen Ed25519-Schlüssel. Es werden keine Daten versendet.',
  quickKeyBtn: 'Künstlerschlüssel mit 1 Klick erstellen',
  quickKeyBusy: 'Wird erstellt…',
  quickKeyTip: 'Tipp: Unter „Schlüssel“ können Sie jederzeit ein verschlüsseltes Backup (.chkey.json) laden.',
  advancedToggle: 'Erweiterte QR-Layout- & URL-Optionen (optional)',
  docsUsageTitle: 'Einsteiger-Anleitung in 3 Schritten',
};

export const PT: HowToTranslations = {
  homeTitle: 'Como usar em 3 passos simples',
  homeSubtitle: 'Sem cadastro nem configurações difíceis. Tudo funciona direto no navegador.',
  steps: [
    { title: '1. Escolha sua arte', desc: 'Abra «Criar Certificado» e solte sua imagem. O arquivo nunca sai do dispositivo.' },
    { title: '2. Crie a chave em 1 clique e escolha a licença', desc: 'Se ainda não tiver chave, crie ali mesmo em 1 clique. Na dúvida, mantenha «All Rights Reserved».' },
    { title: '3. Baixe o PNG com QR', desc: 'Salve o PNG com o QR na margem e compartilhe; qualquer pessoa verifica offline em «Verificar».' },
  ],
  simpleFlowHint: 'Passo a passo: 1. Escolher imagem → 2. Conferir licença → 3. Clicar em assinar abaixo.',
  quickKeyTitle: 'Primeira vez? Crie sua chave de artista em 1 clique',
  quickKeyBody: 'Para assinar, basta uma chave Ed25519 salva localmente neste navegador.',
  quickKeyBtn: 'Criar chave de artista em 1 clique',
  quickKeyBusy: 'Criando…',
  quickKeyTip: 'Dica: baixe o backup criptografado (.chkey.json) quando quiser em «Chaves».',
  advancedToggle: 'Configurações avançadas de layout QR e URL (opcional)',
  docsUsageTitle: 'Guia rápido em 3 passos para artistas',
};

export const IT: HowToTranslations = {
  homeTitle: 'Come usarlo in 3 semplici passaggi',
  homeSubtitle: 'Nessun account né impostazioni complicate. Tutto avviene nel browser.',
  steps: [
    { title: '1. Scegli la tua opera', desc: 'Apri «Crea Certificato» e seleziona l’immagine. Il file resta sul tuo dispositivo.' },
    { title: '2. Chiave in 1 clic e scelta licenza', desc: 'Se non hai ancora una chiave, creala subito con 1 clic. Nel dubbio lascia «All Rights Reserved».' },
    { title: '3. Salva il PNG con QR', desc: 'Scarica il PNG con il QR nel margine: chiunque può verificarlo offline su «Verifica».' },
  ],
  simpleFlowHint: 'In breve: 1. Scegli immagine → 2. Controlla licenza → 3. Premi firma in basso.',
  quickKeyTitle: 'Prima volta? Crea la tua chiave artista in 1 clic',
  quickKeyBody: 'Per firmare serve una chiave locale Ed25519 salvata solo in questo browser.',
  quickKeyBtn: 'Crea chiave artista in 1 clic',
  quickKeyBusy: 'Creazione…',
  quickKeyTip: 'Consiglio: puoi scaricare un backup cifrato (.chkey.json) in «Chiavi».',
  advancedToggle: 'Impostazioni avanzate layout QR e URL (opzionale)',
  docsUsageTitle: 'Guida semplice in 3 passaggi per artisti',
};

export const AR: HowToTranslations = {
  homeTitle: 'كيف تستخدم الأداة في 3 خطوات بسيطة',
  homeSubtitle: 'لا حاجة لحسابات أو إعدادات معقدة؛ كل شيء يعمل محلياً داخل المتصفح.',
  steps: [
    { title: '1. اختر لوحتك', desc: 'افتح «إنشاء شهادة» واسحب الصورة. لن تغادر صورتك جهازك أبداً.' },
    { title: '2. أنشئ مفتاحك بنقرة واحدة واختر الترخيص', desc: 'إن لم يكن لديك مفتاح بعد، أنشئه فوراً من نفس الصفحة بنقرة واحدة، وأبقِ All Rights Reserved إذا كنت غير متأكد.' },
    { title: '3. احفظ ملف PNG وشاركه', desc: 'نزّل ملف PNG المدمج به رمز QR في الهامش؛ يمكن لأي شخص التحقق منه دون إنترنت عبر «تحقق».' },
  ],
  simpleFlowHint: 'الطريقة السريعة: 1. اختر الصورة ← 2. راجع الترخيص ← 3. اضغط زر التوقيع أدناه.',
  quickKeyTitle: 'أول مرة؟ أنشئ مفتاح الفنان المحلي بنقرة واحدة',
  quickKeyBody: 'لتوقيع أعمالك، يحفظ المتصفح مفتاح Ed25519 خاصاً بك على جهازك فقط دون أي رفع.',
  quickKeyBtn: 'إنشاء مفتاح الفنان بنقرة واحدة',
  quickKeyBusy: 'جارٍ الإنشاء…',
  quickKeyTip: 'تلميح: يمكنك تنزيل نسخة احتياطية مشفرة (.chkey.json) في أي وقت من صفحة «المفاتيح».',
  advancedToggle: 'إعدادات متقدمة لموضع QR والرابط (اختياري)',
  docsUsageTitle: 'دليل الفنان السريع في 3 خطوات',
};

export interface HowToTranslationsOthers {
  'zh-CN': HowToTranslations;
  'zh-TW': HowToTranslations;
  'ko': HowToTranslations;
  'ru': HowToTranslations;
  'uk': HowToTranslations;
  'es': HowToTranslations;
  'fr': HowToTranslations;
  'de': HowToTranslations;
  'pt': HowToTranslations;
  'it': HowToTranslations;
  'ar': HowToTranslations;
}

export const OTHERS: HowToTranslationsOthers = {
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
