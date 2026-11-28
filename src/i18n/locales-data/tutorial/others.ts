import type { TutorialTranslations } from '../../tutorial';

export const ZH_CN: TutorialTranslations = {
  navLabel: '使用教程',
  homeCta: '查看新手教程',
  title: '简单上手教程（面向创作者）',
  subtitle: '无需懂密码学，按下面几步操作即可完成本地签名与验证。',
  reassuranceItems: [
    '100% 免费，无需注册账号',
    '作品与密钥绝不会上传至任何服务器',
    '加载一次后即可完全离线运行',
  ],
  stepsTitle: '按顺序操作即可',
  steps: [
    {
      title: '1. 打开“创建证书”并选择画作',
      desc: '将 PNG/JPEG/WebP 作品拖入上传区，文件全程留在你的设备本地。',
      ctaLabel: '前往创建页面',
      to: '/create',
    },
    {
      title: '2. 一键创建作者印章（密钥）并选规则',
      desc: '首次使用在同页面点击一键生成密钥即可；版权许可拿不准时保留默认的 All Rights Reserved 即可。',
      ctaLabel: '去页面试试',
      to: '/create',
    },
    {
      title: '3. 保存带二维码的 PNG 并测试验证',
      desc: '点击生成并下载带有边缘二维码的 PNG，随时拖到“验证”页即可离线检查签名与像素一致性。',
      ctaLabel: '前往验证页面',
      to: '/verify',
    },
    {
      title: '4. 建议：为密钥保存加密备份',
      desc: '密钥保存在浏览器本地。建议偶尔在“密钥管理”下载 .chkey.json 备份，防止清理浏览器数据时丢失。',
      ctaLabel: '前往密钥备份',
      to: '/keys',
    },
  ],
  cheatTitle: '许可怎么选？快速对照表',
  cheatItems: [
    { scenario: '常规插画（禁止未经授权转载、商用或修改）', recommended: 'ARR (All Rights Reserved)', note: '默认推荐设置。' },
    { scenario: '允许非商业原样转发并标明作者', recommended: 'CC BY-NC-ND 4.0', note: '不可修改、不可商用。' },
    { scenario: '署名即可商用或二次创作', recommended: 'CC BY 4.0', note: '适合开放素材。' },
    { scenario: '完全放弃版权，免署名自由使用', recommended: 'CC0 1.0', note: '公共领域共享。' },
  ],
  cheatDocsLink: '查看全部 8 种许可详细说明（文档）',
  snsTipTitle: '发布到社交平台的小贴士',
  snsTipBody: '社交平台常会重新压缩图片导致像素哈希变化。建议保留原始 .certified-handmade.png，或附带生成的验证链接 (#proof=...)。',
  faqTitle: '常见问题',
  faqs: [
    { q: '需要区块链、NFT 或付费吗？', a: '完全不需要。100% 免费开源，无 NFT 与账号体系。' },
    { q: '签名能绝对证明未用 AI 吗？', a: '不能。签名仅证明该密钥持有人签署了此声明且像素未被篡改；建议在个人主页公开你的公钥以建立信任。' },
    { q: '清除浏览器缓存后，旧二维码会失效吗？', a: '不会！验证信息完全包含在二维码内，旧图依然可永久离线验证。' },
  ],
  bottomTitle: '现在就开始第一张吧',
  bottomStartBtn: '去创建签名 PNG',
  bottomVerifyBtn: '去验证页面',
};

export const ZH_TW: TutorialTranslations = {
  navLabel: '使用教學',
  homeCta: '新手使用教學',
  title: '簡單上手教學（繪師指南）',
  subtitle: '不必懂密碼學名詞，照著以下步驟即可在瀏覽器本地完成簽署與驗證。',
  reassuranceItems: [
    '100% 免費，免註冊登入',
    '畫作與金鑰絕不會上傳到任何伺服器',
    '載入後即可完全離線使用',
  ],
  stepsTitle: '依序操作即可完成',
  steps: [
    {
      title: '1. 開啟「建立憑證」並放入畫作',
      desc: '將 PNG／JPEG／WebP 作品拖入區塊即可，所有處理都在本機進行。',
      ctaLabel: '前往建立頁面',
      to: '/create',
    },
    {
      title: '2. 一鍵建立創作者金鑰並選擇規則',
      desc: '第一次使用可直接在同畫面按一下建立金鑰；授權不確定時維持預設 All Rights Reserved 即可。',
      ctaLabel: '立即前往操作',
      to: '/create',
    },
    {
      title: '3. 下載含 QR 的 PNG 並測試驗證',
      desc: '下載邊緣帶有 QR Code 的無損 PNG，拖進「驗證」頁就能離線確認簽章與像素一致。',
      ctaLabel: '前往驗證頁面',
      to: '/verify',
    },
    {
      title: '4. 建議：定期備份本地金鑰',
      desc: '金鑰存放在瀏覽器中，建議至「金鑰管理」下載加密備份 (.chkey.json) 妥善保存。',
      ctaLabel: '管理與備份金鑰',
      to: '/keys',
    },
  ],
  cheatTitle: '授權怎麼選？快速對照表',
  cheatItems: [
    { scenario: '一般插畫（未經許可禁止轉載、商用與改作）', recommended: 'ARR (All Rights Reserved)', note: '預設選項，最安全的起步設定。' },
    { scenario: '標示作者即可非商業原樣分享', recommended: 'CC BY-NC-ND 4.0', note: '禁止改作、禁止商用。' },
    { scenario: '只要標示作者，可商用與改作', recommended: 'CC BY 4.0', note: '適合公開素材。' },
    { scenario: '完全放棄著作財產權，免署名自由使用', recommended: 'CC0 1.0', note: '公眾領域釋出。' },
  ],
  cheatDocsLink: '檢視全部 8 種授權詳細說明（技術文件）',
  snsTipTitle: '上傳至社群媒體的小提醒',
  snsTipBody: '社群平台常會壓縮圖片導致像素雜湊改變。建議保留原檔 .certified-handmade.png，或一併附上生成的驗證連結 (#proof=...)。',
  faqTitle: '常見問答',
  faqs: [
    { q: '需要加密貨幣、NFT 或付費訂閱嗎？', a: '完全不需要，本工具 100% 免費且開源。' },
    { q: '簽章能單獨證明絕對是手繪無 AI 嗎？', a: '不能。簽章僅能證明「特定金鑰持有人簽署了這份聲明且像素未被更動」，建議在個人頁面公開公鑰來連結現實身分。' },
    { q: '清除瀏覽器資料後，以前做好的 QR 圖會失效嗎？', a: '不會！驗證資料全都包含在 QR Code 裡，任何人都能永久離線驗證。' },
  ],
  bottomTitle: '現在就來試試看吧',
  bottomStartBtn: '建立簽署 PNG',
  bottomVerifyBtn: '前往驗證',
};

export const KO: TutorialTranslations = {
  navLabel: '튜토리얼',
  homeCta: '쉬운 사용 가이드',
  title: '그림 작가를 위한 쉬운 튜토리얼',
  subtitle: '어려운 암호 지식이 없어도 괜찮습니다. 순서대로 따라 해보세요.',
  reassuranceItems: [
    '회원가입·로그인 없이 100% 무료',
    '그림과 개인 키는 서버로 절대 전송되지 않음',
    '한 번 불러오면 오프라인에서도 작동',
  ],
  stepsTitle: '순서대로 따라 하기',
  steps: [
    {
      title: '1. ‘인증서 생성’에서 그림 고르기',
      desc: 'PNG / JPEG / WebP 그림을 끌어다 놓으세요. 모든 처리는 내 기기 안에서만 실행됩니다.',
      ctaLabel: '생성 화면 열기',
      to: '/create',
    },
    {
      title: '2. 클릭 1번으로 작가 키 만들고 규칙 고르기',
      desc: '처음이라면 화면의 버튼 한 번만 눌러 키를 만들 수 있습니다. 잘 모르겠으면 기본값(All Rights Reserved)을 유지하세요.',
      ctaLabel: '지금 해보기',
      to: '/create',
    },
    {
      title: '3. QR 포함 PNG 저장 후 검증해 보기',
      desc: '여백에 QR이 들어간 PNG를 내려받아 ‘검증’ 화면에 올리면 서명과 픽셀 일치를 바로 확인할 수 있습니다.',
      ctaLabel: '검증 화면 열기',
      to: '/verify',
    },
    {
      title: '4. 선택: 내 서명 키 백업해 두기',
      desc: '키는 브라우저에 저장됩니다. 기기 변경이나 데이터 삭제에 대비해 ‘키 관리’에서 .chkey.json 백업을 받아 두면 안전합니다.',
      ctaLabel: '키 백업하러 가기',
      to: '/keys',
    },
  ],
  cheatTitle: '어떤 라이선스를 고를까? 빠른 가이드',
  cheatItems: [
    { scenario: '일반 일러스트 (무단 전재·상업적 이용·수정 모두 금지)', recommended: 'ARR (All Rights Reserved)', note: '기본값이자 가장 안전한 선택입니다.' },
    { scenario: '출처만 밝히면 비상업적 원본 공유 허용', recommended: 'CC BY-NC-ND 4.0', note: '수정 불가·상업적 이용 불가.' },
    { scenario: '출처만 표기하면 상업적 이용과 수정도 허용', recommended: 'CC BY 4.0', note: '오픈 리소스 배포에 적합합니다.' },
    { scenario: '저작권을 포기하고 출처 없이도 자유 이용 허용', recommended: 'CC0 1.0', note: '퍼블릭 도메인 공개용입니다.' },
  ],
  cheatDocsLink: '8가지 라이선스 전체 설명 보기 (문서)',
  snsTipTitle: 'SNS 업로드 시 참고 팁',
  snsTipBody: 'SNS는 이미지를 재압축하는 경우가 많아 원본 픽셀 해시가 달라질 수 있습니다. 원본 .certified-handmade.png를 보관하거나 생성된 검증 링크(#proof=...)를 함께 공유하세요.',
  faqTitle: '자주 묻는 질문',
  faqs: [
    { q: '결제나 코인·NFT가 필요한가요?', a: '전혀 필요 없습니다. 100% 무료 오픈소스 도구입니다.' },
    { q: '서명만으로 AI가 아닌 손그림임이 100% 증명되나요?', a: '아닙니다. 서명은 특정 키 보유자가 해당 시점에 이미지를 서명했고 픽셀이 변하지 않았음을 증명할 뿐입니다. 공식 프로필에 공개 키를 공개해 신뢰를 연결하세요.' },
    { q: '브라우저 데이터를 지우면 예전에 만든 QR 이미지도 못 쓰나요?', a: '아닙니다! 검증 정보는 QR 자체에 들어 있으므로 누구나 계속 오프라인 검증이 가능합니다.' },
  ],
  bottomTitle: '지금 바로 첫 작품을 서명해 보세요',
  bottomStartBtn: '서명된 PNG 만들기',
  bottomVerifyBtn: '검증 화면으로 이동',
};

export const RU: TutorialTranslations = {
  navLabel: 'Обучение',
  homeCta: 'Простое руководство',
  title: 'Простой пошаговый туториал',
  subtitle: 'Знания криптографии не нужны — просто следуйте шагам по порядку.',
  reassuranceItems: [
    '100% бесплатно, без регистрации и аккаунтов',
    'Рисунки и ключи не отправляются на сервер',
    'После загрузки работает полностью офлайн',
  ],
  stepsTitle: 'Делайте по шагам',
  steps: [
    {
      title: '1. Откройте «Создать сертификат» и выберите рисунок',
      desc: 'Перетащите PNG, JPEG или WebP. Файл обрабатывается только в вашем браузере.',
      ctaLabel: 'Перейти к созданию',
      to: '/create',
    },
    {
      title: '2. Создайте ключ в 1 клик и выберите права',
      desc: 'При первом запуске нажмите кнопку создания ключа прямо на странице. Если сомневаетесь — оставьте «All Rights Reserved».',
      ctaLabel: 'Попробовать сейчас',
      to: '/create',
    },
    {
      title: '3. Сохраните PNG с QR и проверьте его',
      desc: 'Скачайте PNG с QR на полях и загрузите на страницу «Проверить», чтобы убедиться, что подпись и пиксели сходятся.',
      ctaLabel: 'Открыть проверку',
      to: '/verify',
    },
    {
      title: '4. Совет: сделайте резервную копию ключа',
      desc: 'Ключ хранится в браузере. Сохраните зашифрованный файл .chkey.json в разделе «Ключи», чтобы не потерять его при очистке кэша.',
      ctaLabel: 'Управление ключами',
      to: '/keys',
    },
  ],
  cheatTitle: 'Какую лицензию выбрать? Шпаргалка',
  cheatItems: [
    { scenario: 'Обычный арт (запретить копирование, правки и коммерцию без разрешения)', recommended: 'ARR (All Rights Reserved)', note: 'Настройка по умолчанию — самый надёжный вариант.' },
    { scenario: 'Разрешить некоммерческий репост оригинала с указанием автора', recommended: 'CC BY-NC-ND 4.0', note: 'Без правок и коммерции.' },
    { scenario: 'Можно всё (даже коммерцию и правки), если указан автор', recommended: 'CC BY 4.0', note: 'Подходит для открытых материалов.' },
    { scenario: 'Полный отказ от прав — свободное использование без авторства', recommended: 'CC0 1.0', note: 'Общественное достояние.' },
  ],
  cheatDocsLink: 'Подробное описание всех 8 лицензий (Документация)',
  snsTipTitle: 'Полезный совет для соцсетей',
  snsTipBody: 'Соцсети часто пережимают картинки, изменяя пиксели. Храните исходный .certified-handmade.png или прикрепляйте ссылку проверки (#proof=...) в описании.',
  faqTitle: 'Частые вопросы',
  faqs: [
    { q: 'Нужны ли криптовалюты, NFT или подписка?', a: 'Нет. Это 100% бесплатный проект с открытым исходным кодом без NFT и блокчейна.' },
    { q: 'Доказывает ли подпись, что рисунок точно нарисован без ИИ?', a: 'Нет. Подпись доказывает, что владелец конкретного ключа подписал изображение и пиксели не были изменены. Привяжите свой публичный ключ к профилю автора.' },
    { q: 'Если очистить браузер, старые QR-картинки перестанут проверяться?', a: 'Нет! Все данные находятся внутри самого QR-кода, поэтому проверка продолжит работать всегда.' },
  ],
  bottomTitle: 'Готовы попробовать на первом рисунке?',
  bottomStartBtn: 'Создать подписанный PNG',
  bottomVerifyBtn: 'Перейти к проверке',
};

export const UK: TutorialTranslations = {
  navLabel: 'Посібник',
  homeCta: 'Простий посібник',
  title: 'Простий покроковий туторіал',
  subtitle: 'Знання криптографії не потрібні — просто виконайте кроки по черзі.',
  reassuranceItems: [
    '100% безкоштовно, без реєстрації та акаунтів',
    'Зображення й ключі ніколи не надсилаються на сервер',
    'Працює повністю офлайн після першого відкриття',
  ],
  stepsTitle: 'Кроки по порядку',
  steps: [
    {
      title: '1. Відкрийте «Створити сертифікат» і виберіть малюнок',
      desc: 'Перетягніть PNG, JPEG або WebP. Уся обробка відбувається лише у вашому браузері.',
      ctaLabel: 'Відкрити створення',
      to: '/create',
    },
    {
      title: '2. Створіть ключ в 1 клік та оберіть ліцензію',
      desc: 'Уперше просто натисніть кнопку створення ключа на сторінці. Якщо не впевнені — залиште «All Rights Reserved».',
      ctaLabel: 'Спробувати зараз',
      to: '/create',
    },
    {
      title: '3. Збережіть PNG із QR та перевірте його',
      desc: 'Завантажте PNG із QR на полях і перевірте його в розділі «Перевірити», щоб упевнитися у збігу підпису й пікселів.',
      ctaLabel: 'Відкрити перевірку',
      to: '/verify',
    },
    {
      title: '4. Порада: збережіть резервну копію ключа',
      desc: 'Ключ зберігається у браузері. Завантажте зашифрований файл .chkey.json у розділі «Ключі», щоб мати копію про запас.',
      ctaLabel: 'Керування ключами',
      to: '/keys',
    },
  ],
  cheatTitle: 'Яку ліцензію обрати? Шпаргалка',
  cheatItems: [
    { scenario: 'Звичайна ілюстрація (заборонити копіювання, зміни й комерцію)', recommended: 'ARR (All Rights Reserved)', note: 'Типове значення — найнадійніший вибір.' },
    { scenario: 'Дозволити некомерційний репост оригіналу із вказанням автора', recommended: 'CC BY-NC-ND 4.0', note: 'Без змін і без комерції.' },
    { scenario: 'Можна змінювати й використовувати комерційно за вказання автора', recommended: 'CC BY 4.0', note: 'Добре для відкритих ресурсів.' },
    { scenario: 'Повна відмова від прав — вільне використання без атрибуції', recommended: 'CC0 1.0', note: 'Суспільне надбання.' },
  ],
  cheatDocsLink: 'Детальний опис усіх 8 ліцензій (Документація)',
  snsTipTitle: 'Порада перед публікацією в соцмережах',
  snsTipBody: 'Соцмережі часто перестискають зображення, змінюючи пікселі. Зберігайте оригінальний .certified-handmade.png або додавайте посилання перевірки (#proof=...).',
  faqTitle: 'Часті запитання',
  faqs: [
    { q: 'Чи потрібні криптовалюти, NFT або оплата?', a: 'Ні. Інструмент на 100% безкоштовний і відкритий, без NFT чи блокчейну.' },
    { q: 'Чи гарантує підпис, що робота створена без ШІ?', a: 'Ні. Підпис підтверджує лише те, що власник ключа підписав файл і пікселі не змінювались. Оприлюдніть свій публічний ключ у профілі для прив’язки до себе.' },
    { q: 'Якщо очистити браузер, старі QR-файли перестануть перевірятися?', a: 'Ні! Усі дані містяться всередині самого QR-коду, тож перевірка працюватиме й надалі.' },
  ],
  bottomTitle: 'Спробуймо на вашому першому малюнку?',
  bottomStartBtn: 'Створити підписаний PNG',
  bottomVerifyBtn: 'Перейти до перевірки',
};

export const ES: TutorialTranslations = {
  navLabel: 'Tutorial',
  homeCta: 'Tutorial sencillo',
  title: 'Tutorial sencillo paso a paso',
  subtitle: 'Sin conocimientos técnicos previos. Sigue estos pasos en orden.',
  reassuranceItems: [
    '100% gratis, sin cuentas ni registros',
    'Tus imágenes y claves nunca salen de tu dispositivo',
    'Funciona totalmente sin conexión tras cargarse',
  ],
  stepsTitle: 'Pasos a seguir',
  steps: [
    { title: '1. Abre «Crear certificado» y elige tu dibujo', desc: 'Arrastra un PNG, JPEG o WebP. No se sube a ningún servidor.', ctaLabel: 'Ir a Crear', to: '/create' },
    { title: '2. Crea tu clave en 1 clic y elige licencia', desc: 'Si es tu primera vez, créala ahí mismo en 1 clic. Si dudas, deja «All Rights Reserved».', ctaLabel: 'Probar ahora', to: '/create' },
    { title: '3. Guarda el PNG con QR y verifícalo', desc: 'Descarga el PNG con el QR en el margen y suéltalo en «Verificar» para comprobar firma y píxeles.', ctaLabel: 'Ir a Verificar', to: '/verify' },
    { title: '4. Consejo: haz copia de seguridad de tu clave', desc: 'Guarda el archivo cifrado .chkey.json en «Claves» por si cambias de navegador o borras datos.', ctaLabel: 'Gestionar claves', to: '/keys' },
  ],
  cheatTitle: '¿Qué licencia elegir? Guía rápida',
  cheatItems: [
    { scenario: 'Ilustración normal (sin copias, ediciones ni uso comercial)', recommended: 'ARR (All Rights Reserved)', note: 'Opción predeterminada recomendada.' },
    { scenario: 'Permitir compartir sin cambios y sin fines comerciales con crédito', recommended: 'CC BY-NC-ND 4.0', note: 'Sin ediciones ni monetización.' },
    { scenario: 'Uso libre (incluso comercial y derivadas) con atribución', recommended: 'CC BY 4.0', note: 'Ideal para recursos abiertos.' },
    { scenario: 'Dominio público total sin necesidad de crédito', recommended: 'CC0 1.0', note: 'Máxima libertad.' },
  ],
  cheatDocsLink: 'Ver explicación completa de las 8 licencias (Docs)',
  snsTipTitle: 'Consejo para redes sociales',
  snsTipBody: 'Las redes suelen recomprimir imágenes y alterar los píxeles. Conserva el archivo original .certified-handmade.png o comparte también el enlace #proof=...',
  faqTitle: 'Preguntas frecuentes',
  faqs: [
    { q: '¿Usa NFT, cripto o suscripciones?', a: 'No. Es 100% gratuito y código abierto MIT.' },
    { q: '¿Prueba por sí solo que no se usó IA?', a: 'No. Prueba que el titular de esa clave firmó la imagen y que los píxeles no cambiaron.' },
    { q: '¿Si borro el navegador se rompen mis QR antiguos?', a: 'No; los datos van dentro del propio código QR.' },
  ],
  bottomTitle: '¿Listo para probar con tu primera obra?',
  bottomStartBtn: 'Crear PNG firmado',
  bottomVerifyBtn: 'Ir a Verificar',
};

export const FR: TutorialTranslations = {
  navLabel: 'Tutoriel',
  homeCta: 'Tutoriel simple',
  title: 'Tutoriel simple étape par étape',
  subtitle: 'Aucune connaissance technique requise. Suivez simplement l’ordre des étapes.',
  reassuranceItems: [
    '100 % gratuit, sans compte ni inscription',
    'Vos images et clés restent sur votre appareil',
    'Fonctionne hors ligne une fois chargé',
  ],
  stepsTitle: 'Étapes à suivre',
  steps: [
    { title: '1. Ouvrez « Créer un certificat »', desc: 'Déposez votre PNG, JPEG ou WebP. Rien n’est envoyé sur Internet.', ctaLabel: 'Aller à Créer', to: '/create' },
    { title: '2. Clé en 1 clic et choix de licence', desc: 'Créez votre clé locale sur place en 1 clic si besoin. Gardez « All Rights Reserved » en cas de doute.', ctaLabel: 'Essayer maintenant', to: '/create' },
    { title: '3. Enregistrez le PNG avec QR et testez-le', desc: 'Téléchargez le PNG muni du QR et glissez-le dans « Vérifier ».', ctaLabel: 'Aller à Vérifier', to: '/verify' },
    { title: '4. Astuce : sauvegardez votre clé', desc: 'Téléchargez une copie chiffrée (.chkey.json) dans « Clés » pour ne pas la perdre.', ctaLabel: 'Gérer les clés', to: '/keys' },
  ],
  cheatTitle: 'Quelle licence choisir ? Mémo rapide',
  cheatItems: [
    { scenario: 'Illustration standard (aucune copie ou exploitation sans accord)', recommended: 'ARR (All Rights Reserved)', note: 'Option par défaut la plus sûre.' },
    { scenario: 'Partage non commercial à l’identique avec mention d’auteur', recommended: 'CC BY-NC-ND 4.0', note: 'Sans modification ni usage commercial.' },
    { scenario: 'Usage libre (y compris commercial) avec crédit', recommended: 'CC BY 4.0', note: 'Idéal pour des ressources ouvertes.' },
    { scenario: 'Domaine public complet sans crédit exigé', recommended: 'CC0 1.0', note: 'Renonciation maximale aux droits.' },
  ],
  cheatDocsLink: 'Voir le détail des 8 licences (Documentation)',
  snsTipTitle: 'Astuce pour les réseaux sociaux',
  snsTipBody: 'Les réseaux recompressent souvent les images. Conservez l’original .certified-handmade.png ou joignez le lien #proof=... à votre publication.',
  faqTitle: 'Questions fréquentes',
  faqs: [
    { q: 'Faut-il des NFT ou un portefeuille crypto ?', a: 'Non, jamais. Outil 100 % gratuit sous licence MIT.' },
    { q: 'La signature prouve-t-elle qu’aucune IA n’a été utilisée ?', a: 'Non. Elle prouve uniquement que le détenteur de la clé a signé ces pixels à l’état intact.' },
    { q: 'Si j’efface mon navigateur, mes anciens QR deviennent-ils invalides ?', a: 'Non ! Toutes les données sont contenues dans le QR code lui-même.' },
  ],
  bottomTitle: 'Prêt à essayer sur votre premier dessin ?',
  bottomStartBtn: 'Créer un PNG signé',
  bottomVerifyBtn: 'Aller à Vérifier',
};

export const DE: TutorialTranslations = {
  navLabel: 'Tutorial',
  homeCta: 'Kurze Anleitung',
  title: 'Einfaches Schritt-für-Schritt-Tutorial',
  subtitle: 'Kein Vorwissen nötig. Folgen Sie einfach den vier Schritten.',
  reassuranceItems: [
    '100 % kostenlos, kein Konto erforderlich',
    'Bilder und Schlüssel verlassen niemals Ihr Gerät',
    'Nach dem ersten Laden komplett offline nutzbar',
  ],
  stepsTitle: 'So gehen Sie vor',
  steps: [
    { title: '1. „Zertifikat erstellen“ öffnen & Bild wählen', desc: 'PNG, JPEG oder WebP ablegen – alles bleibt lokal im Browser.', ctaLabel: 'Zur Erstellung', to: '/create' },
    { title: '2. 1-Klick-Schlüssel & Lizenz wählen', desc: 'Falls nötig direkt dort mit 1 Klick einen Schlüssel erzeugen. „All Rights Reserved“ ist sicher voreingestellt.', ctaLabel: 'Jetzt testen', to: '/create' },
    { title: '3. Signiertes PNG speichern & prüfen', desc: 'PNG mit QR im Rand herunterladen und unter „Prüfen“ sofort verifizieren.', ctaLabel: 'Zur Prüfung', to: '/verify' },
    { title: '4. Tipp: Schlüssel-Backup sichern', desc: 'Unter „Schlüssel“ ein verschlüsseltes Backup (.chkey.json) herunterladen.', ctaLabel: 'Schlüssel verwalten', to: '/keys' },
  ],
  cheatTitle: 'Welche Lizenz wählen? Schnellübersicht',
  cheatItems: [
    { scenario: 'Standard-Schutz (keine Kopie/Kommerz/Änderung ohne Erlaubnis)', recommended: 'ARR (All Rights Reserved)', note: 'Empfohlener Standard.' },
    { scenario: 'Nicht-kommerzielle unveränderte Weitergabe mit Namensnennung', recommended: 'CC BY-NC-ND 4.0', note: 'Keine Änderungen, kein Kommerz.' },
    { scenario: 'Freie Nutzung inkl. Kommerz mit Namensnennung', recommended: 'CC BY 4.0', note: 'Ideal für freie Assets.' },
    { scenario: 'Komplett gemeinfrei ohne Namensnennung', recommended: 'CC0 1.0', note: 'Maximaler Rechteverzicht.' },
  ],
  cheatDocsLink: 'Alle 8 Lizenzen im Detail ansehen (Doku)',
  snsTipTitle: 'Tipp für Social Media',
  snsTipBody: 'Plattformen komprimieren Bilder oft neu. Bewahren Sie die Originaldatei .certified-handmade.png auf oder teilen Sie den #proof=-Link.',
  faqTitle: 'Häufige Fragen',
  faqs: [
    { q: 'Sind NFTs oder Gebühren nötig?', a: 'Nein. 100 % kostenlos und Open Source (MIT).' },
    { q: 'Beweist die Signatur allein, dass keine KI genutzt wurde?', a: 'Nein. Sie beweist, dass der Schlüsselinhaber das Bild signiert hat und die Pixel unverändert sind.' },
    { q: 'Werden alte QR-Bilder ungültig, wenn ich Browserdaten lösche?', a: 'Nein, alle Prüfdaten stecken direkt im QR-Code.' },
  ],
  bottomTitle: 'Bereit für das erste Kunstwerk?',
  bottomStartBtn: 'Signiertes PNG erstellen',
  bottomVerifyBtn: 'Zur Prüfung',
};

export const PT: TutorialTranslations = {
  navLabel: 'Tutorial',
  homeCta: 'Tutorial simples',
  title: 'Tutorial simples passo a passo',
  subtitle: 'Sem termos complicados. Basta seguir estes passos na ordem.',
  reassuranceItems: [
    '100% gratuito, sem conta ou login',
    'Suas imagens e chaves nunca saem do dispositivo',
    'Funciona totalmente offline após carregar',
  ],
  stepsTitle: 'Siga na ordem',
  steps: [
    { title: '1. Abra «Criar Certificado» e escolha a arte', desc: 'Solte um PNG, JPEG ou WebP. Nada vai para servidores.', ctaLabel: 'Ir para Criar', to: '/create' },
    { title: '2. Crie sua chave em 1 clique e escolha a licença', desc: 'Na primeira vez, crie ali mesmo em 1 clique. Na dúvida, deixe «All Rights Reserved».', ctaLabel: 'Testar agora', to: '/create' },
    { title: '3. Salve o PNG com QR e teste', desc: 'Baixe o PNG com QR na margem e teste em «Verificar».', ctaLabel: 'Ir para Verificar', to: '/verify' },
    { title: '4. Dica: salve um backup da chave', desc: 'Baixe o arquivo .chkey.json em «Chaves» para não perder sua identidade local.', ctaLabel: 'Gerenciar chaves', to: '/keys' },
  ],
  cheatTitle: 'Qual licença escolher? Resumo rápido',
  cheatItems: [
    { scenario: 'Arte padrão (sem cópia, edição ou uso comercial sem autorização)', recommended: 'ARR (All Rights Reserved)', note: 'Padrão mais seguro.' },
    { scenario: 'Compartilhamento não comercial sem alterações, com crédito', recommended: 'CC BY-NC-ND 4.0', note: 'Sem edições nem vendas.' },
    { scenario: 'Uso livre (inclusive comercial) dando crédito', recommended: 'CC BY 4.0', note: 'Ótimo para recursos abertos.' },
    { scenario: 'Domínio público total sem exigir crédito', recommended: 'CC0 1.0', note: 'Liberdade máxima.' },
  ],
  cheatDocsLink: 'Ver explicação das 8 licenças (Docs)',
  snsTipTitle: 'Dica ao postar nas redes sociais',
  snsTipBody: 'Redes sociais recomprimem imagens e mudam os pixels. Guarde o arquivo .certified-handmade.png original ou compartilhe o link #proof=...',
  faqTitle: 'Perguntas frequentes',
  faqs: [
    { q: 'Usa NFT ou criptomoedas?', a: 'Não. 100% gratuito e open-source (MIT).' },
    { q: 'Isso prova sozinho que não houve IA?', a: 'Não; prova que o dono da chave assinou aquela imagem e que os pixels não foram alterados.' },
    { q: 'Se limpar o navegador, os QRs antigos param de funcionar?', a: 'Não! Toda a prova fica no próprio QR.' },
  ],
  bottomTitle: 'Pronto para testar sua primeira arte?',
  bottomStartBtn: 'Criar PNG Assinado',
  bottomVerifyBtn: 'Ir para Verificar',
};

export const IT: TutorialTranslations = {
  navLabel: 'Tutorial',
  homeCta: 'Tutorial semplice',
  title: 'Tutorial semplice passo dopo passo',
  subtitle: 'Nessuna competenza tecnica richiesta: segui questi passaggi in ordine.',
  reassuranceItems: [
    '100% gratuito, senza registrazione',
    'Opere e chiavi restano sempre sul tuo dispositivo',
    'Funziona completamente offline dopo il caricamento',
  ],
  stepsTitle: 'Segui i passaggi in ordine',
  steps: [
    { title: '1. Apri «Crea Certificato» e scegli l’opera', desc: 'Trascina un PNG, JPEG o WebP: nulla viene inviato a server esterni.', ctaLabel: 'Vai a Crea', to: '/create' },
    { title: '2. Chiave in 1 clic e scelta licenza', desc: 'Alla prima visita crea la chiave lì in 1 clic. Nel dubbio lascia «All Rights Reserved».', ctaLabel: 'Prova subito', to: '/create' },
    { title: '3. Salva il PNG con QR e verificalo', desc: 'Scarica il PNG con QR nel margine e provalo in «Verifica».', ctaLabel: 'Vai a Verifica', to: '/verify' },
    { title: '4. Consiglio: fai il backup della chiave', desc: 'Scarica il file .chkey.json in «Chiavi» per conservarla al sicuro.', ctaLabel: 'Gestisci chiavi', to: '/keys' },
  ],
  cheatTitle: 'Quale licenza scegliere? Guida rapida',
  cheatItems: [
    { scenario: 'Opera standard (nessuna copia, modifica o uso commerciale senza permesso)', recommended: 'ARR (All Rights Reserved)', note: 'Scelta predefinita consigliata.' },
    { scenario: 'Condivisione non commerciale senza modifiche, con credito', recommended: 'CC BY-NC-ND 4.0', note: 'Vietate modifiche e fini commerciali.' },
    { scenario: 'Uso libero (anche commerciale) citando l’autore', recommended: 'CC BY 4.0', note: 'Ottima per risorse aperte.' },
    { scenario: 'Pubblico dominio totale senza obbligo di credito', recommended: 'CC0 1.0', note: 'Massima libertà.' },
  ],
  cheatDocsLink: 'Leggi la guida completa alle 8 licenze (Documenti)',
  snsTipTitle: 'Consiglio per i social network',
  snsTipBody: 'I social ricomprimono spesso le immagini modificando i pixel. Conserva il file originale .certified-handmade.png o allega il link #proof=...',
  faqTitle: 'Domande frequenti',
  faqs: [
    { q: 'Servono NFT o criptovalute?', a: 'No, mai. 100% gratuito e open source MIT.' },
    { q: 'La firma dimostra da sola l’assenza di IA?', a: 'No: dimostra che il titolare della chiave ha firmato quei pixel e che non sono cambiati.' },
    { q: 'Se cancello i dati del browser i vecchi QR smettono di funzionare?', a: 'No, tutti i dati di verifica sono dentro il QR stesso.' },
  ],
  bottomTitle: 'Pronto a provare con la tua prima opera?',
  bottomStartBtn: 'Crea PNG Firmato',
  bottomVerifyBtn: 'Vai a Verifica',
};

export const AR: TutorialTranslations = {
  navLabel: 'الدليل',
  homeCta: 'دليل الاستخدام البسيط',
  title: 'دليل خطوة بخطوة للفنانين',
  subtitle: 'لا تحتاج لأي خبرة تقنية؛ اتبع الخطوات بالترتيب فقط.',
  reassuranceItems: [
    'مجاني 100% دون حسابات أو تسجيل',
    'لوحاتك ومفاتيحك لا تغادر جهازك أبداً',
    'يعمل بالكامل دون إنترنت بعد التحميل',
  ],
  stepsTitle: 'اتبع الخطوات بالترتيب',
  steps: [
    { title: '1. افتح «إنشاء شهادة» واختر لوحتك', desc: 'اسحب صورة PNG أو JPEG أو WebP؛ كل شيء يعالج محلياً في متصفحك.', ctaLabel: 'افتح الإنشاء', to: '/create' },
    { title: '2. أنشئ مفتاحك بنقرة واحدة واختر القواعد', desc: 'للمرة الأولى أنشئ مفتاحك من نفس الصفحة بنقرة واحدة، وأبقِ All Rights Reserved إن كنت غير متأكد.', ctaLabel: 'جرّب الآن', to: '/create' },
    { title: '3. احفظ PNG مع رمز QR وجرّب التحقق', desc: 'نزّل ملف PNG المدمج به QR وأسقطه في «تحقق» للتأكد من التوقيع وتطابق البكسلات.', ctaLabel: 'افتح التحقق', to: '/verify' },
    { title: '4. نصيحة: احتفظ بنسخة احتياطية للمفتاح', desc: 'احفظ ملف .chkey.json المشفر من صفحة «المفاتيح» لحمايته عند مسح بيانات المتصفح.', ctaLabel: 'إدارة المفاتيح', to: '/keys' },
  ],
  cheatTitle: 'أي ترخيص أختار؟ دليل سريع',
  cheatItems: [
    { scenario: 'عمل فني قياسي (منع النسخ والتعديل والاستخدام التجاري دون إذن)', recommended: 'ARR (All Rights Reserved)', note: 'الخيار الافتراضي الأكثر أماناً.' },
    { scenario: 'مشاركة غير تجارية دون تعديل مع ذكر اسمك', recommended: 'CC BY-NC-ND 4.0', note: 'يمنع التعديل والاستغلال التجاري.' },
    { scenario: 'استخدام حر (بما فيه تجاري) مع ذكر اسمك', recommended: 'CC BY 4.0', note: 'مناسب للمواد المفتوحة.' },
    { scenario: 'تنازل كامل للملكية العامة دون إلزام بذكر الاسم', recommended: 'CC0 1.0', note: 'أقصى حرية استخدام.' },
  ],
  cheatDocsLink: 'اطلع على شرح جميع التراخيص الثمانية (الوثائق)',
  snsTipTitle: 'نصيحة عند النشر في شبكات التواصل',
  snsTipBody: 'غالباً ما تعيد الشبكات ضغط الصور فتتغير البكسلات. احتفظ بالملف الأصلي .certified-handmade.png أو شارك رابط #proof=...',
  faqTitle: 'أسئلة شائعة',
  faqs: [
    { q: 'هل يتطلب NFT أو عملات رقمية أو دفعاً؟', a: 'لا مطلقاً. الأداة مجانية ومفتوحة المصدر 100%.' },
    { q: 'هل يثبت التوقيع وحده أن العمل بلا ذكاء اصطناعي؟', a: 'لا؛ يثبت فقط أن صاحب المفتاح وقّع هذه الصورة وأن البكسلات لم تتغير بعد التوقيع.' },
    { q: 'هل تتوقف صور QR القديمة عن العمل إذا مسحت بيانات المتصفح؟', a: 'لا! جميع بيانات التحقق محفوظة داخل رمز QR نفسه.' },
  ],
  bottomTitle: 'جاهز لتجربة أول لوحة؟',
  bottomStartBtn: 'إنشاء PNG موقّع',
  bottomVerifyBtn: 'الانتقال إلى التحقق',
};

export interface TutorialTranslationsOthers {
  'zh-CN': TutorialTranslations;
  'zh-TW': TutorialTranslations;
  'ko': TutorialTranslations;
  'ru': TutorialTranslations;
  'uk': TutorialTranslations;
  'es': TutorialTranslations;
  'fr': TutorialTranslations;
  'de': TutorialTranslations;
  'pt': TutorialTranslations;
  'it': TutorialTranslations;
  'ar': TutorialTranslations;
}

export const OTHERS: TutorialTranslationsOthers = {
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
