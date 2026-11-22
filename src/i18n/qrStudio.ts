import type { SupportedLocale } from '../core/storage/consent';

export interface QrStudioTranslations {
  navLabel: string;
  title: string;
  subtitle: string;
  createBannerTitle: string;
  createBannerDesc: string;
  createBannerBtn: string;
  backToMarginCreate: string;
  previewTitle: string;
  previewHint: string;
  presetsLabel: string;
  presets: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    center: string;
  };
  controlsTitle: string;
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  opacityLabel: string;
  styleLabel: string;
  eccLabel: string;
  styles: {
    'frosted-light': string;
    'frosted-dark': string;
    'modules-dark': string;
    'modules-light': string;
  };
  eccOptions: {
    M: string;
    Q: string;
    H: string;
  };
  readabilityLabel: string;
  readabilityOk: string;
  readabilityWarn: string;
  readabilityHint: string;
  maskRegionLabel: string;
  signInImageBtn: string;
  signingBusy: string;
  maskedDigestNote: string;
}

export const QR_STUDIO_I18N: Record<SupportedLocale, QrStudioTranslations> = {
  ja: {
    navLabel: 'QRスタジオ',
    title: '半透明QR 手動埋め込みスタジオ',
    subtitle:
      'イラストの内側に半透明やスタイル付きのQRコードを直接ドラッグ配置します。QRボックス以外の全ピクセルはSHA-256で厳密に保護されます。',
    createBannerTitle: '絵の中に半透明QRを直接埋め込みたいですか？',
    createBannerDesc:
      '専用のQRスタジオで、ドラッグ配置・サイズ調整・不透明度（半透明）・リアルタイム読取テストをしながら埋め込めます。',
    createBannerBtn: 'QRスタジオを開く',
    backToMarginCreate: '余白フレーム版（/create）を使う',
    previewTitle: 'プレビュー＆ドラッグ配置キャンバス',
    previewHint:
      '画像上のQRボックスを直接ドラッグするか、下のプリセットとスライダーで微調整できます。破線枠の外側のピクセルはすべてビット単位で検証対象になります。',
    presetsLabel: 'かんたん配置プリセット',
    presets: {
      topLeft: '左上',
      topRight: '右上',
      bottomLeft: '左下',
      bottomRight: '右下',
      center: '中央',
    },
    controlsTitle: '位置・サイズ・半透明・スタイル調整',
    xLabel: '横位置 X (px)',
    yLabel: '縦位置 Y (px)',
    sizeLabel: 'QRサイズ (px)',
    opacityLabel: '不透明度 (半透明)',
    styleLabel: 'QR埋め込みスタイル',
    eccLabel: '誤り訂正レベル (ECC)',
    styles: {
      'frosted-light': 'すりガラス白（半透明・おすすめ）',
      'frosted-dark': 'すりガラス黒（半透明・反転）',
      'modules-dark': '背景なし・黒モジュールのみ',
      'modules-light': '背景なし・白モジュールのみ',
    },
    eccOptions: {
      M: 'M (標準 15% — 小さめ・高密度向け)',
      Q: 'Q (高め 25% — 半透明におすすめ)',
      H: 'H (最高 30% — 複雑な背景向け)',
    },
    readabilityLabel: 'ローカル読取テスト',
    readabilityOk: 'プレビューでQR読取OK',
    readabilityWarn: '読み取りにくい設定です — 不透明度やサイズを上げるか「すりガラス白」をお試しください',
    readabilityHint: '合成後ピクセルに対してブラウザ内でjsQRスキャンを実行しています。',
    maskRegionLabel: '署名済みQRマスク領域 [x, y, w, h]',
    signInImageBtn: 'ローカル署名して半透明QR入りPNGを保存',
    signingBusy: 'マスク外ハッシュ計算・署名・合成中…',
    maskedDigestNote:
      'Protocol v2: QR枠の外側の全ピクセルをSHA-256保護します。このQR入りPNGとQR合成前の元画像のどちらでも検証が一致します。',
  },
  en: {
    navLabel: 'QR Studio',
    title: 'Manual In-Image QR Studio',
    subtitle:
      'Drag, resize, and blend a semi-transparent or styled QR code directly inside your artwork. Every pixel outside the QR mask remains SHA-256 verified.',
    createBannerTitle: 'Want to embed a semi-transparent QR directly inside the artwork?',
    createBannerDesc:
      'Open the dedicated Manual QR Studio to drag position, tune size & opacity, and test live QR readability without adding an outer border.',
    createBannerBtn: 'Open QR Studio',
    backToMarginCreate: 'Use Margin Frame Mode (/create)',
    previewTitle: 'Interactive Placement Canvas (Drag the QR Box)',
    previewHint:
      'Drag the QR box directly on the canvas or fine-tune with the presets and sliders below. Every pixel outside the dashed QR mask is verified bit-for-bit.',
    presetsLabel: 'Quick Position Presets',
    presets: {
      topLeft: 'Top-Left',
      topRight: 'Top-Right',
      bottomLeft: 'Bottom-Left',
      bottomRight: 'Bottom-Right',
      center: 'Center',
    },
    controlsTitle: 'QR Position, Size, Opacity & Style',
    xLabel: 'X Position (px)',
    yLabel: 'Y Position (px)',
    sizeLabel: 'QR Box Size (px)',
    opacityLabel: 'Opacity (Translucency)',
    styleLabel: 'Overlay Style',
    eccLabel: 'Error Correction (ECC)',
    styles: {
      'frosted-light': 'Frosted Light Plate (Recommended)',
      'frosted-dark': 'Frosted Dark Plate (Inverted)',
      'modules-dark': 'Dark Modules Only (No Plate)',
      'modules-light': 'Light Modules Only (No Plate)',
    },
    eccOptions: {
      M: 'M (15% — Compact matrix)',
      Q: 'Q (25% — Balanced for translucency)',
      H: 'H (30% — Max resilience on busy art)',
    },
    readabilityLabel: 'Live Local Readability Check',
    readabilityOk: 'Scannable in live preview',
    readabilityWarn: 'Low contrast / hard to scan — increase opacity, enlarge box size, or use Frosted Light',
    readabilityHint: 'Tested 100% locally with jsQR against the blended preview raster.',
    maskRegionLabel: 'Signed QR Mask Region [x, y, w, h]',
    signInImageBtn: 'Sign & Export In-Image QR PNG',
    signingBusy: 'Hashing Outside Mask, Signing & Embedding…',
    maskedDigestNote:
      'Protocol v2: All pixels outside the QR box are protected by SHA-256. Both this PNG and your clean pre-QR original verify cleanly.',
  },
  'zh-CN': {
    navLabel: 'QR 工作室',
    title: '半透明二维码手动嵌入工作室',
    subtitle:
      '直接在画作内部拖动、缩放并调节半透明二维码。二维码遮罩区域以外的所有像素均受 SHA-256 严格保护。',
    createBannerTitle: '想把半透明二维码直接嵌进画作内部吗？',
    createBannerDesc:
      '使用专用二维码工作室，可拖动位置、调节大小与不透明度，并实时测试本地扫码可读性，无需外加边框。',
    createBannerBtn: '打开 QR 工作室',
    backToMarginCreate: '使用外边框模式 (/create)',
    previewTitle: '交互式画布预览（拖动二维码框）',
    previewHint:
      '可直接在画布上拖动二维码，或使用下方预设与滑块微调。虚线框以外的所有像素均会按位校验。',
    presetsLabel: '快速位置预设',
    presets: {
      topLeft: '左上角',
      topRight: '右上角',
      bottomLeft: '左下角',
      bottomRight: '右下角',
      center: '居中',
    },
    controlsTitle: '位置、尺寸、透明度与样式控制',
    xLabel: 'X 坐标 (px)',
    yLabel: 'Y 坐标 (px)',
    sizeLabel: '二维码大小 (px)',
    opacityLabel: '不透明度（半透明）',
    styleLabel: '叠加样式',
    eccLabel: '纠错等级 (ECC)',
    styles: {
      'frosted-light': '浅色磨砂底板（推荐）',
      'frosted-dark': '深色磨砂底板（反色）',
      'modules-dark': '仅深色码点（无底板）',
      'modules-light': '仅浅色码点（无底板）',
    },
    eccOptions: {
      M: 'M (15% — 矩阵更紧凑)',
      Q: 'Q (25% — 适合半透明叠加)',
      H: 'H (30% — 适合复杂画面)',
    },
    readabilityLabel: '本地实时扫码检测',
    readabilityOk: '实时预览可正常识别',
    readabilityWarn: '对比度偏低，可能难以识别 — 请提高透明度、增大尺寸或改用浅色磨砂样式',
    readabilityHint: '直接在浏览器内使用 jsQR 对合成后的预览像素进行本地扫描检测。',
    maskRegionLabel: '已签名二维码遮罩区域 [x, y, w, h]',
    signInImageBtn: '本地签名并导出内嵌二维码 PNG',
    signingBusy: '正在计算遮罩外哈希、签名并合成…',
    maskedDigestNote:
      'Protocol v2：二维码框以外的所有像素均受 SHA-256 保护。导出的 PNG 与未叠加二维码的原图均可验证通过。',
  },
  'zh-TW': {
    navLabel: 'QR 工作室',
    title: '半透明 QR 手動嵌入工作室',
    subtitle:
      '直接在畫作內部拖曳、縮放並調整半透明 QR Code。QR 遮罩範圍以外的所有像素均受 SHA-256 嚴密保護。',
    createBannerTitle: '想把半透明 QR Code 直接嵌入畫作內部嗎？',
    createBannerDesc:
      '前往專屬 QR 工作室，即可拖曳位置、調整尺寸與不透明度，並即時測試本地掃碼可讀性，無需額外邊框。',
    createBannerBtn: '開啟 QR 工作室',
    backToMarginCreate: '使用外邊框模式 (/create)',
    previewTitle: '互動式畫布預覽（可直接拖曳 QR 框）',
    previewHint:
      '直接在畫布上拖曳 QR 框，或使用下方預設位置與滑桿微調。虛線框以外的所有像素都會進行逐位元雜湊驗證。',
    presetsLabel: '快速位置預設',
    presets: {
      topLeft: '左上',
      topRight: '右上',
      bottomLeft: '左下',
      bottomRight: '右下',
      center: '置中',
    },
    controlsTitle: '位置、尺寸、不透明度與樣式設定',
    xLabel: 'X 座標 (px)',
    yLabel: 'Y 座標 (px)',
    sizeLabel: 'QR 尺寸 (px)',
    opacityLabel: '不透明度（半透明）',
    styleLabel: '嵌入樣式',
    eccLabel: '容錯等級 (ECC)',
    styles: {
      'frosted-light': '霧面淺底（半透明・推薦）',
      'frosted-dark': '霧面深底（半透明・反色）',
      'modules-dark': '僅深色方塊（無底色）',
      'modules-light': '僅淺色方塊（無底色）',
    },
    eccOptions: {
      M: 'M (15% — 矩陣較精簡)',
      Q: 'Q (25% — 推薦用於半透明)',
      H: 'H (30% — 適合複雜背景)',
    },
    readabilityLabel: '本地即時掃碼測試',
    readabilityOk: '即時預覽掃碼成功',
    readabilityWarn: '辨識度偏低 — 請調高不透明度、放大尺寸或改用霧面淺底樣式',
    readabilityHint: '於瀏覽器本地端使用 jsQR 直接測試疊合後的預覽像素。',
    maskRegionLabel: '已簽署 QR 遮罩區域 [x, y, w, h]',
    signInImageBtn: '本地簽署並匯出內嵌 QR 的 PNG',
    signingBusy: '正在計算遮罩外雜湊、簽署並疊合…',
    maskedDigestNote:
      'Protocol v2：QR 框以外的所有像素皆受 SHA-256 保護，匯出後的 PNG 與未含 QR 的原圖皆可通過驗證。',
  },
  ko: {
    navLabel: 'QR 스튜디오',
    title: '반투명 QR 수동 삽입 스튜디오',
    subtitle:
      '작품 이미지 안쪽에 반투명 또는 스타일이 적용된 QR 코드를 직접 드래그해 배치하세요. QR 영역 바깥의 모든 픽셀은 SHA-256으로 무결성이 보호됩니다.',
    createBannerTitle: '그림 안쪽에 반투명 QR 코드를 직접 넣고 싶으신가요?',
    createBannerDesc:
      '전용 QR 스튜디오에서 드래그 위치 지정, 크기/투명도 조절, 실시간 스캔 테스트까지 외곽 여백 없이 설정할 수 있습니다.',
    createBannerBtn: 'QR 스튜디오 열기',
    backToMarginCreate: '여백 프레임 방식 (/create) 사용',
    previewTitle: '인터랙티브 배치 캔버스 (QR 상자를 드래그하세요)',
    previewHint:
      '캔버스에서 QR 상자를 직접 끌어다 놓거나 아래 프리셋과 슬라이더로 미세 조정하세요. 점선 상자 바깥쪽 픽셀은 모두 비트 단위로 검증됩니다.',
    presetsLabel: '빠른 위치 프리셋',
    presets: {
      topLeft: '좌상단',
      topRight: '우상단',
      bottomLeft: '좌하단',
      bottomRight: '우하단',
      center: '중앙',
    },
    controlsTitle: '위치 · 크기 · 투명도 · 스타일 설정',
    xLabel: 'X 좌표 (px)',
    yLabel: 'Y 좌표 (px)',
    sizeLabel: 'QR 크기 (px)',
    opacityLabel: '불투명도 (반투명)',
    styleLabel: '오버레이 스타일',
    eccLabel: '오류 복원 등급 (ECC)',
    styles: {
      'frosted-light': '반투명 밝은 유리판 (추천)',
      'frosted-dark': '반투명 어두운 유리판 (반전)',
      'modules-dark': '어두운 모듈만 (배경 없음)',
      'modules-light': '밝은 모듈만 (배경 없음)',
    },
    eccOptions: {
      M: 'M (15% — 콤팩트한 밀도)',
      Q: 'Q (25% — 반투명 균형 추천)',
      H: 'H (30% — 복잡한 배경용)',
    },
    readabilityLabel: '로컬 실시간 스캔 테스트',
    readabilityOk: '실시간 미리보기에서 QR 인식 성공',
    readabilityWarn: '인식이 어려움 — 불투명도나 크기를 높이거나 밝은 유리판 스타일을 사용하세요',
    readabilityHint: '합성된 미리보기 픽셀을 브라우저 내 jsQR로 즉시 테스트합니다.',
    maskRegionLabel: '서명된 QR 마스크 영역 [x, y, w, h]',
    signInImageBtn: '로컬 서명 후 반투명 QR PNG 저장',
    signingBusy: '마스크 외부 해시 계산 · 서명 · 합성 중…',
    maskedDigestNote:
      'Protocol v2: QR 상자 바깥의 모든 픽셀이 SHA-256으로 보호되며, 저장된 PNG와 원본 이미지 모두 검증이 일치합니다.',
  },
  ru: {
    navLabel: 'QR-студия',
    title: 'Студия ручного встраивания QR-кода',
    subtitle:
      'Перетаскивайте, масштабируйте и настраивайте полупрозрачный QR-код прямо поверх иллюстрации. Все пиксели вне области QR защищены SHA-256.',
    createBannerTitle: 'Хотите встроить полупрозрачный QR-код прямо внутрь рисунка?',
    createBannerDesc:
      'Откройте специальную QR-студию: перетащите QR мышью, настройте прозрачность и сразу проверьте считываемость без добавления рамки.',
    createBannerBtn: 'Открыть QR-студию',
    backToMarginCreate: 'Режим внешней рамки (/create)',
    previewTitle: 'Интерактивный холст (перетащите рамку QR)',
    previewHint:
      'Перетаскивайте QR-область прямо на изображении или используйте пресеты и ползунки ниже. Каждый пиксель вне пунктирной рамки проверяется побитово.',
    presetsLabel: 'Быстрые пресеты положения',
    presets: {
      topLeft: 'Сверху слева',
      topRight: 'Сверху справа',
      bottomLeft: 'Снизу слева',
      bottomRight: 'Снизу справа',
      center: 'По центру',
    },
    controlsTitle: 'Позиция, размер, прозрачность и стиль',
    xLabel: 'Координата X (px)',
    yLabel: 'Координата Y (px)',
    sizeLabel: 'Размер QR (px)',
    opacityLabel: 'Непрозрачность',
    styleLabel: 'Стиль наложения',
    eccLabel: 'Коррекция ошибок (ECC)',
    styles: {
      'frosted-light': 'Светлое матовое стекло (рекомендуется)',
      'frosted-dark': 'Тёмное матовое стекло (инверсия)',
      'modules-dark': 'Только тёмные модули (без подложки)',
      'modules-light': 'Только светлые модули (без подложки)',
    },
    eccOptions: {
      M: 'M (15% — компактная матрица)',
      Q: 'Q (25% — баланс для полупрозрачности)',
      H: 'H (30% — максимум надёжности на сложном фоне)',
    },
    readabilityLabel: 'Локальная проверка считываемости',
    readabilityOk: 'QR-код уверенно считывается на превью',
    readabilityWarn: 'Слабый контраст — увеличьте непрозрачность, размер или выберите светлую подложку',
    readabilityHint: 'Локальное тестирование через jsQR по итоговым смешанным пикселям.',
    maskRegionLabel: 'Подписанная маска QR [x, y, w, h]',
    signInImageBtn: 'Подписать и сохранить PNG с QR внутри',
    signingBusy: 'Хеширование вне маски, подпись и наложение…',
    maskedDigestNote:
      'Protocol v2: Все пиксели вне области QR защищены SHA-256. Проверку пройдёт как этот PNG, так и чистый оригинал без QR.',
  },
  uk: {
    navLabel: 'QR-студія',
    title: 'Студія ручного вбудовування QR-коду',
    subtitle:
      'Перетягуйте, масштабуйте та налаштовуйте напівпрозорий QR-код безпосередньо всередині ілюстрації. Усі пікселі поза областю QR захищені SHA-256.',
    createBannerTitle: 'Хочете вбудувати напівпрозорий QR-код прямо всередину малюнка?',
    createBannerDesc:
      'Відкрийте спеціальну QR-студію: перетягніть QR, налаштуйте прозорість та перевірте зчитуваність наживо без зовнішньої рамки.',
    createBannerBtn: 'Відкрити QR-студію',
    backToMarginCreate: 'Режим зовнішньої рамки (/create)',
    previewTitle: 'Інтерактивне полотно (перетягуйте рамку QR)',
    previewHint:
      'Перетягуйте QR-блок прямо по зображенню або скористайтеся пресетами й повзунками нижче. Кожен піксель за межами пунктирної рамки перевіряється побітово.',
    presetsLabel: 'Швидкі пресети положення',
    presets: {
      topLeft: 'Зверху ліворуч',
      topRight: 'Зверху праворуч',
      bottomLeft: 'Знизу ліворуч',
      bottomRight: 'Знизу праворуч',
      center: 'У центрі',
    },
    controlsTitle: 'Позиція, розмір, прозорість і стиль',
    xLabel: 'Позиція X (px)',
    yLabel: 'Позиція Y (px)',
    sizeLabel: 'Розмір QR (px)',
    opacityLabel: 'Непрозорість',
    styleLabel: 'Стиль накладання',
    eccLabel: 'Корекція помилок (ECC)',
    styles: {
      'frosted-light': 'Світле матове скло (рекомендовано)',
      'frosted-dark': 'Темне матове скло (інверсія)',
      'modules-dark': 'Лише темні модулі (без фону)',
      'modules-light': 'Лише світлі модулі (без фону)',
    },
    eccOptions: {
      M: 'M (15% — компактна матриця)',
      Q: 'Q (25% — баланс для напівпрозорості)',
      H: 'H (30% — максимум стійкості на складному тлі)',
    },
    readabilityLabel: 'Локальна перевірка зчитуваності',
    readabilityOk: 'QR-код зчитується на прев’ю',
    readabilityWarn: 'Низький контраст — збільште непрозорість, розмір або оберіть світлу підкладку',
    readabilityHint: 'Тестується локально через jsQR на змішаному растрі попереднього перегляду.',
    maskRegionLabel: 'Підписана маска QR [x, y, w, h]',
    signInImageBtn: 'Підписати та зберегти PNG із вбудованим QR',
    signingBusy: 'Хешування поза маскою, підпис та накладання…',
    maskedDigestNote:
      'Protocol v2: Усі пікселі поза рамкою QR захищені SHA-256. Перевірку пройдуть і цей PNG, і чистий оригінал без QR.',
  },
  es: {
    navLabel: 'Estudio QR',
    title: 'Estudio Manual de QR en Imagen',
    subtitle:
      'Arrastra, redimensiona y mezcla un código QR semitransparente directamente dentro de tu obra. Cada píxel fuera de la máscara QR mantiene su verificación SHA-256.',
    createBannerTitle: '¿Quieres incrustar un QR semitransparente dentro de la ilustración?',
    createBannerDesc:
      'Abre el Estudio QR dedicado para moverlo con el cursor, ajustar tamaño y opacidad y probar su lectura en vivo sin añadir bordes externos.',
    createBannerBtn: 'Abrir Estudio QR',
    backToMarginCreate: 'Usar modo con marco (/create)',
    previewTitle: 'Lienzo interactivo (arrastra el recuadro QR)',
    previewHint:
      'Arrastra el QR sobre tu imagen o ajústalo con los preajustes y controles deslizantes. Todo píxel fuera del borde discontinuo se verifica bit a bit.',
    presetsLabel: 'Posiciones rápidas',
    presets: {
      topLeft: 'Arriba izq.',
      topRight: 'Arriba der.',
      bottomLeft: 'Abajo izq.',
      bottomRight: 'Abajo der.',
      center: 'Centro',
    },
    controlsTitle: 'Posición, tamaño, opacidad y estilo',
    xLabel: 'Posición X (px)',
    yLabel: 'Posición Y (px)',
    sizeLabel: 'Tamaño QR (px)',
    opacityLabel: 'Opacidad (Transparencia)',
    styleLabel: 'Estilo de superposición',
    eccLabel: 'Corrección de errores (ECC)',
    styles: {
      'frosted-light': 'Placa esmerilada clara (Recomendado)',
      'frosted-dark': 'Placa esmerilada oscura (Invertida)',
      'modules-dark': 'Solo módulos oscuros (Sin placa)',
      'modules-light': 'Solo módulos claros (Sin placa)',
    },
    eccOptions: {
      M: 'M (15% — Matriz compacta)',
      Q: 'Q (25% — Equilibrado para transparencia)',
      H: 'H (30% — Máxima resistencia en fondos complejos)',
    },
    readabilityLabel: 'Prueba local de lectura en vivo',
    readabilityOk: 'Legible en la vista previa',
    readabilityWarn: 'Difícil de escanear — sube la opacidad, aumenta el tamaño o usa Placa clara',
    readabilityHint: 'Probado 100% en local con jsQR sobre el ráster combinado.',
    maskRegionLabel: 'Máscara QR firmada [x, y, w, h]',
    signInImageBtn: 'Firmar y exportar PNG con QR incrustado',
    signingBusy: 'Calculando hash fuera de la máscara, firmando…',
    maskedDigestNote:
      'Protocol v2: Todos los píxeles fuera del QR están protegidos con SHA-256. Tanto este PNG como el original limpio pasan la verificación.',
  },
  fr: {
    navLabel: 'Studio QR',
    title: 'Studio QR Manuel dans l’Image',
    subtitle:
      'Glissez, redimensionnez et fondez un QR code semi-transparent directement dans votre illustration. Chaque pixel hors du masque QR reste vérifié par SHA-256.',
    createBannerTitle: 'Intégrer un QR semi-transparent directement dans l’illustration ?',
    createBannerDesc:
      'Ouvrez le Studio QR dédié pour déplacer le QR à la main, régler taille et opacité, et tester sa lisibilité en direct sans marge extérieure.',
    createBannerBtn: 'Ouvrir le Studio QR',
    backToMarginCreate: 'Utiliser le mode marge (/create)',
    previewTitle: 'Canevas interactif (glissez le cadre QR)',
    previewHint:
      'Déplacez le cadre QR directement sur l’image ou utilisez les préréglages et curseurs ci-dessous. Tout pixel hors du cadre pointillé est vérifié bit à bit.',
    presetsLabel: 'Positions rapides',
    presets: {
      topLeft: 'Haut gauche',
      topRight: 'Haut droite',
      bottomLeft: 'Bas gauche',
      bottomRight: 'Bas droite',
      center: 'Centre',
    },
    controlsTitle: 'Position, taille, opacité et style',
    xLabel: 'Position X (px)',
    yLabel: 'Position Y (px)',
    sizeLabel: 'Taille QR (px)',
    opacityLabel: 'Opacité (Transparence)',
    styleLabel: 'Style de superposition',
    eccLabel: 'Correction d’erreurs (ECC)',
    styles: {
      'frosted-light': 'Verre dépoli clair (Recommandé)',
      'frosted-dark': 'Verre dépoli sombre (Inversé)',
      'modules-dark': 'Modules sombres seuls (Sans fond)',
      'modules-light': 'Modules clairs seuls (Sans fond)',
    },
    eccOptions: {
      M: 'M (15% — Matrice compacte)',
      Q: 'Q (25% — Équilibré pour semi-transparence)',
      H: 'H (30% — Résistance max sur fond chargé)',
    },
    readabilityLabel: 'Test local de lisibilité',
    readabilityOk: 'QR lisible sur l’aperçu en direct',
    readabilityWarn: 'Contraste faible — augmentez l’opacité, la taille ou choisissez Dépoli clair',
    readabilityHint: 'Testé 100 % localement via jsQR sur l’image fusionnée.',
    maskRegionLabel: 'Masque QR signé [x, y, w, h]',
    signInImageBtn: 'Signer et exporter le PNG avec QR intégré',
    signingBusy: 'Hachage hors masque, signature et fusion…',
    maskedDigestNote:
      'Protocol v2 : Tous les pixels hors de la zone QR sont protégés par SHA-256. Ce PNG comme l’original sans QR passent la vérification.',
  },
  de: {
    navLabel: 'QR-Studio',
    title: 'Manuelles In-Image QR-Studio',
    subtitle:
      'Ziehe einen halbtransparenten QR-Code direkt in dein Kunstwerk, skaliere ihn und passe die Deckkraft an. Alle Pixel außerhalb der QR-Maske bleiben per SHA-256 geschützt.',
    createBannerTitle: 'Halbtransparenten QR-Code direkt im Bild einbetten?',
    createBannerDesc:
      'Öffne das manuelle QR-Studio, um Position, Größe und Deckkraft per Drag & Drop anzupassen und die Lesbarkeit live ohne Außenrahmen zu testen.',
    createBannerBtn: 'QR-Studio öffnen',
    backToMarginCreate: 'Rahmen-Modus nutzen (/create)',
    previewTitle: 'Interaktive Vorschau (QR-Box ziehen)',
    previewHint:
      'Ziehe die QR-Box direkt auf dem Bild oder nutze die Presets und Regler unten. Jeder Pixel außerhalb des gestrichelten Rahmens wird bitgenau geprüft.',
    presetsLabel: 'Schnellpositionen',
    presets: {
      topLeft: 'Oben links',
      topRight: 'Oben rechts',
      bottomLeft: 'Unten links',
      bottomRight: 'Unten rechts',
      center: 'Mitte',
    },
    controlsTitle: 'Position, Größe, Deckkraft & Stil',
    xLabel: 'X-Position (px)',
    yLabel: 'Y-Position (px)',
    sizeLabel: 'QR-Größe (px)',
    opacityLabel: 'Deckkraft (Transparenz)',
    styleLabel: 'Overlay-Stil',
    eccLabel: 'Fehlerkorrektur (ECC)',
    styles: {
      'frosted-light': 'Milchglas Hell (Empfohlen)',
      'frosted-dark': 'Milchglas Dunkel (Invertiert)',
      'modules-dark': 'Nur dunkle Module (Ohne Platte)',
      'modules-light': 'Nur helle Module (Ohne Platte)',
    },
    eccOptions: {
      M: 'M (15% — Kompakte Matrix)',
      Q: 'Q (25% — Ideal für Transparenz)',
      H: 'H (30% — Maximale Reserve bei Details)',
    },
    readabilityLabel: 'Lokaler Lesbarkeitstest',
    readabilityOk: 'In der Live-Vorschau lesbar',
    readabilityWarn: 'Schwer lesbar — Deckkraft oder Größe erhöhen oder Milchglas Hell wählen',
    readabilityHint: 'Wird 100 % lokal per jsQR auf dem überlagerten Raster geprüft.',
    maskRegionLabel: 'Signierte QR-Maske [x, y, w, h]',
    signInImageBtn: 'Signieren & In-Image-QR-PNG exportieren',
    signingBusy: 'Berechne Hash außerhalb der Maske, signiere…',
    maskedDigestNote:
      'Protocol v2: Alle Pixel außerhalb der QR-Box sind SHA-256-geschützt. Sowohl dieses PNG als auch das saubere Original bestehen die Prüfung.',
  },
  pt: {
    navLabel: 'Estúdio QR',
    title: 'Estúdio Manual de QR na Imagem',
    subtitle:
      'Arraste, redimensione e misture um QR code semitransparente diretamente dentro da arte. Todos os pixels fora da máscara QR permanecem verificados por SHA-256.',
    createBannerTitle: 'Quer incorporar um QR semitransparente dentro da ilustração?',
    createBannerDesc:
      'Abra o Estúdio QR dedicado para arrastar a posição, ajustar tamanho e opacidade e testar a leitura ao vivo sem borda externa.',
    createBannerBtn: 'Abrir Estúdio QR',
    backToMarginCreate: 'Usar modo com moldura (/create)',
    previewTitle: 'Tela interativa (arraste a caixa do QR)',
    previewHint:
      'Arraste o QR diretamente sobre a imagem ou ajuste pelos atalhos e controles abaixo. Cada pixel fora da caixa tracejada é verificado bit a bit.',
    presetsLabel: 'Posições rápidas',
    presets: {
      topLeft: 'Sup. Esq.',
      topRight: 'Sup. Dir.',
      bottomLeft: 'Inf. Esq.',
      bottomRight: 'Inf. Dir.',
      center: 'Centro',
    },
    controlsTitle: 'Posição, tamanho, opacidade e estilo',
    xLabel: 'Posição X (px)',
    yLabel: 'Posição Y (px)',
    sizeLabel: 'Tamanho QR (px)',
    opacityLabel: 'Opacidade (Transparência)',
    styleLabel: 'Estilo de sobreposição',
    eccLabel: 'Correção de erro (ECC)',
    styles: {
      'frosted-light': 'Vidro fosco claro (Recomendado)',
      'frosted-dark': 'Vidro fosco escuro (Invertido)',
      'modules-dark': 'Apenas módulos escuros (Sem fundo)',
      'modules-light': 'Apenas módulos claros (Sem fundo)',
    },
    eccOptions: {
      M: 'M (15% — Matriz compacta)',
      Q: 'Q (25% — Equilibrado para transparência)',
      H: 'H (30% — Máxima resistência em fundos complexos)',
    },
    readabilityLabel: 'Teste local de leitura',
    readabilityOk: 'QR legível na prévia ao vivo',
    readabilityWarn: 'Contraste baixo — aumente a opacidade, o tamanho ou use Vidro fosco claro',
    readabilityHint: 'Testado 100% localmente com jsQR sobre os pixels combinados.',
    maskRegionLabel: 'Máscara QR assinada [x, y, w, h]',
    signInImageBtn: 'Assinar e exportar PNG com QR interno',
    signingBusy: 'Calculando hash fora da máscara, assinando…',
    maskedDigestNote:
      'Protocol v2: Todos os pixels fora do QR são protegidos por SHA-256. Tanto este PNG quanto o original limpo passam na verificação.',
  },
  it: {
    navLabel: 'Studio QR',
    title: 'Studio QR Manuale nell’Immagine',
    subtitle:
      'Trascina, ridimensiona e fondi un codice QR semitrasparente direttamente dentro la tua opera. Ogni pixel esterno alla maschera QR resta verificato via SHA-256.',
    createBannerTitle: 'Vuoi incorporare un QR semitrasparente direttamente nell’illustrazione?',
    createBannerDesc:
      'Apri lo Studio QR dedicato per trascinare il QR, regolare dimensioni e opacità e testare la scansione dal vivo senza cornici esterne.',
    createBannerBtn: 'Apri Studio QR',
    backToMarginCreate: 'Usa modalità cornice (/create)',
    previewTitle: 'Area interattiva (trascina il riquadro QR)',
    previewHint:
      'Trascina il riquadro QR sull’immagine oppure usa i preset e i cursori qui sotto. Tutti i pixel fuori dal riquadro tratteggiato sono verificati bit per bit.',
    presetsLabel: 'Posizioni rapide',
    presets: {
      topLeft: 'Alto sin.',
      topRight: 'Alto des.',
      bottomLeft: 'Basso sin.',
      bottomRight: 'Basso des.',
      center: 'Centro',
    },
    controlsTitle: 'Posizione, dimensione, opacità e stile',
    xLabel: 'Posizione X (px)',
    yLabel: 'Posizione Y (px)',
    sizeLabel: 'Dimensione QR (px)',
    opacityLabel: 'Opacità (Trasparenza)',
    styleLabel: 'Stile sovrapposizione',
    eccLabel: 'Correzione errori (ECC)',
    styles: {
      'frosted-light': 'Vetro satinato chiaro (Consigliato)',
      'frosted-dark': 'Vetro satinato scuro (Invertito)',
      'modules-dark': 'Solo moduli scuri (Senza sfondo)',
      'modules-light': 'Solo moduli chiari (Senza sfondo)',
    },
    eccOptions: {
      M: 'M (15% — Matrice compatta)',
      Q: 'Q (25% — Bilanciato per semitrasparenza)',
      H: 'H (30% — Massima tenuta su sfondi complessi)',
    },
    readabilityLabel: 'Test locale di leggibilità',
    readabilityOk: 'Leggibile nell’anteprima dal vivo',
    readabilityWarn: 'Contrasto basso — aumenta opacità, dimensione o usa Satinato chiaro',
    readabilityHint: 'Testato localmente al 100% con jsQR sui pixel fusi.',
    maskRegionLabel: 'Maschera QR firmata [x, y, w, h]',
    signInImageBtn: 'Firma ed esporta PNG con QR interno',
    signingBusy: 'Calcolo hash fuori maschera, firma e fusione…',
    maskedDigestNote:
      'Protocol v2: Tutti i pixel fuori dal riquadro QR sono protetti da SHA-256. Sia questo PNG sia l’originale pulito superano la verifica.',
  },
  ar: {
    navLabel: 'استوديو QR',
    title: 'استوديو تضمين رمز QR شبه الشفاف يدويًا',
    subtitle:
      'اسحب رمز QR شبه الشفاف وغيّر حجمه وشفافيته مباشرة داخل العمل الفني. تبقى كل وحدات البكسل خارج قناع QR محمية بتجزئة SHA-256.',
    createBannerTitle: 'هل تريد تضمين رمز QR شبه شفاف مباشرة داخل الرسم؟',
    createBannerDesc:
      'افتح استوديو QR المخصص لسحب الموضع وتعديل الحجم والشفافية واختبار قابلية المسح فورًا دون إضافة إطار خارجي.',
    createBannerBtn: 'فتح استوديو QR',
    backToMarginCreate: 'استخدام وضع الإطار الخارجي (/create)',
    previewTitle: 'لوحة معاينة تفاعلية (اسحب مربع QR)',
    previewHint:
      'اسحب مربع QR مباشرة فوق الصورة أو استخدم الأزرار السريعة وأشرطة التمرير أدناه. يتم التحقق من كل بكسل خارج الإطار المتقطع بدقة بت مقابل بت.',
    presetsLabel: 'مواضع سريعة',
    presets: {
      topLeft: 'أعلى اليسار',
      topRight: 'أعلى اليمين',
      bottomLeft: 'أسفل اليسار',
      bottomRight: 'أسفل اليمين',
      center: 'الوسط',
    },
    controlsTitle: 'الموضع والحجم والشفافية والنمط',
    xLabel: 'الموضع X (بكسل)',
    yLabel: 'الموضع Y (بكسل)',
    sizeLabel: 'حجم QR (بكسل)',
    opacityLabel: 'العتامة (الشفافية)',
    styleLabel: 'نمط التراكب',
    eccLabel: 'تصحيح الأخطاء (ECC)',
    styles: {
      'frosted-light': 'زجاج ضبابي فاتح (موصى به)',
      'frosted-dark': 'زجاج ضبابي داكن (معكوس)',
      'modules-dark': 'نقاط داكنة فقط (دون خلفية)',
      'modules-light': 'نقاط فاتحة فقط (دون خلفية)',
    },
    eccOptions: {
      M: 'M (15% — مصفوفة مضغوطة)',
      Q: 'Q (25% — متوازن للشفافية)',
      H: 'H (30% — أعلى مقاومة للخلفيات المعقدة)',
    },
    readabilityLabel: 'اختبار القراءة المحلي المباشر',
    readabilityOk: 'قابل للمسح في المعاينة المباشرة',
    readabilityWarn: 'تباين منخفض — ارفع العتامة أو الحجم أو استخدم النمط الضبابي الفاتح',
    readabilityHint: 'يتم اختباره محليًا بنسبة 100% عبر jsQR على البكسلات المدمجة.',
    maskRegionLabel: 'منطقة قناع QR الموقّع [x, y, w, h]',
    signInImageBtn: 'توقيع وتصدير PNG مع QR مدمج',
    signingBusy: 'جارٍ حساب التجزئة خارج القناع والتوقيع والدمج…',
    maskedDigestNote:
      'Protocol v2: جميع وحدات البكسل خارج مربع QR محمية بـ SHA-256. ينجح التحقق لكل من ملف PNG هذا والملف الأصلي النظيف.',
  },
};
