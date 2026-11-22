import type { SupportedLocale } from '../core/storage/consent';

export interface AssessmentTranslations {
  badgeNotAssessed: string;
  badgeLocalSignals: string;
  badgeAiMetadataDetected: string;
  badgeAiPixelSignalsDetected: string;
  badgeInconclusive: string;
  cardTitle: string;
  cardDisclaimer: string;
  preSignAiWarningTitle: string;
  outcomes: {
    'no-image': string;
    'insufficient-visual-signal': string;
    'ai-metadata-detected': string;
    'ai-pixel-signals-detected': string;
    'local-signals-clean': string;
  };
  labels: {
    metadataScan: string;
    pixelForensicsScan: string;
    artworkArea: string;
    transparency: string;
    visualDetail: string;
    colorVariety: string;
    toolHints: string;
  };
  values: {
    noAiTags: string;
    noPixelAiTags: string;
    aiTagsDetectedPrefix: string;
    pixelAiTagsDetectedPrefix: string;
    reencodedNote: string;
    noneDetected: string;
    fullyOpaque: string;
    hasSoftAlpha: string;
    hasTransparency: string;
    detailRich: string;
    detailFlat: string;
    edgeDensityLabel: string;
    bucketsLabel: string;
  };
}

export const ASSESSMENT_I18N: Record<SupportedLocale, AssessmentTranslations> = {
  ja: {
    badgeNotAssessed: 'Not Assessed（画像未読込）',
    badgeLocalSignals: 'ローカル信号検査済み（AI痕跡未検出・参考値）',
    badgeAiMetadataDetected: 'AI生成メタデータ検出（要注意）',
    badgeAiPixelSignalsDetected: 'AI特有のピクセル／周波数信号を検出（要注意）',
    badgeInconclusive: 'Inconclusive（信号不足・判定不能）',
    cardTitle: 'D. ローカル補助解析の内訳（完全無料・オフライン処理）',
    cardDisclaimer:
      '※ 完成画像とメタデータだけでは「手描き」か「AI生成」かを100%確定証明できません。高ノイズ写真や圧縮画像でも反応する可能性があるため、A・Bとあわせた参考シグナルとしてご利用ください。',
    preSignAiWarningTitle: '注意：アップロード画像から AI 生成ツール特有のメタデータ／画像信号を検出しました（ローカル検査）',
    outcomes: {
      'no-image': '画像が読み込まれていないため未評価です。署名付きPNGまたは元画像を追加するとローカル解析を実行します。',
      'insufficient-visual-signal': '画像サイズが小さすぎる（32px未満）か単色に近いため、十分な特徴を抽出できませんでした。',
      'ai-metadata-detected': 'ファイル内のメタデータに AI 画像生成ツール由来の記述が見つかりました。作者への確認を推奨します。',
      'ai-pixel-signals-detected':
        'AI メタデータは未検出ですが、平坦部の拡散/VAEマイクロノイズやアップサンプリング特有の周波数相関など、生成AI画像（ChatGPT / Diffusion 等）に多いピクセル信号が複数検出されました（参考警告・確定判定ではありません）。',
      'local-signals-clean':
        '明確な AI メタデータや典型的な拡散ノイズ異常は検出されませんでした（参考情報のみ — 人間の手描きを証明するものではありません）。',
    },
    labels: {
      metadataScan: 'ファイル内メタデータ検査（C2PA / EXIF / PNG）',
      pixelForensicsScan: 'ピクセル・周波数フォレンジック検査',
      artworkArea: '解析した作品領域',
      transparency: '透過・ブラシ境界の割合',
      visualDetail: '線画・質感のディテール',
      colorVariety: '色分布の広がり',
      toolHints: '制作ソフト等の痕跡',
    },
    values: {
      noAiTags: 'AI生成ツールのメタデータ未検出',
      noPixelAiTags: '強い AI 特有のピクセル／周波数信号は未検出',
      aiTagsDetectedPrefix: '検出されたマーカー:',
      pixelAiTagsDetectedPrefix: '検出されたピクセル／周波数信号:',
      reencodedNote: '（Certified Handmade 生成PNGは署名時に再エンコードされます。元ファイルのタグ確認は未加工PNGを照合してください）',
      noneDetected: '特定のソフト記載なし',
      fullyOpaque: '完全不透明（アルファ透過なし）',
      hasSoftAlpha: '半透明・ブラシ境界アンチエイリアスあり',
      hasTransparency: '透過領域を含む',
      detailRich: '輪郭・階調の変化あり',
      detailFlat: 'ほぼ均一・平坦な塗り',
      edgeDensityLabel: 'エッジ密度',
      bucketsLabel: 'サンプル色数',
    },
  },
  en: {
    badgeNotAssessed: 'Not Assessed (No Image)',
    badgeLocalSignals: 'Local Signals Checked (No AI Anomaly · Ref)',
    badgeAiMetadataDetected: 'AI Metadata Detected (Warning)',
    badgeAiPixelSignalsDetected: 'AI-Like Pixel / Spectral Signals Detected (Warning)',
    badgeInconclusive: 'Inconclusive (Low Visual Signal)',
    cardTitle: 'D. Local Heuristic & Forensic Breakdown (Free · Offline)',
    cardDisclaimer:
      'Note: Pixels and file metadata alone can never prove human-only drawing or 100% guarantee AI origin (noisy photos or heavy recompression can overlap). Use strictly as reference alongside A & B.',
    preSignAiWarningTitle: 'Notice: AI generator metadata or pixel/spectral signals were detected in the uploaded image',
    outcomes: {
      'no-image': 'No artwork pixels were loaded yet. Drop a signed PNG or attach the artwork image to run local inspection.',
      'insufficient-visual-signal': 'The image region is very small (<32 px) or visually uniform, so visual signals are inconclusive.',
      'ai-metadata-detected': 'AI-generation metadata markers were detected inside the image file container. Verify provenance details carefully.',
      'ai-pixel-signals-detected':
        'No AI metadata tag was present, but multiple pixel/spectral signals common in generative AI outputs (e.g., ChatGPT/diffusion smooth-area micro-grain, latent upsampling grid correlation, or stealth LSB watermarks) were observed (reference warning, not proof).',
      'local-signals-clean':
        'No AI generator metadata or strong diffusion/upsampling anomalies were detected (reference only — does NOT prove human-made origin).',
    },
    labels: {
      metadataScan: 'Container Metadata Scan (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Pixel & Spectral Forensics Scan',
      artworkArea: 'Analyzed Artwork Region',
      transparency: 'Alpha / Soft Edge Profile',
      visualDetail: 'Line & Texture Detail',
      colorVariety: 'Color Distribution',
      toolHints: 'Authoring Tool Hints',
    },
    values: {
      noAiTags: 'No AI generator metadata tags found',
      noPixelAiTags: 'No strong AI-like pixel or spectral anomaly observed',
      aiTagsDetectedPrefix: 'Detected markers:',
      pixelAiTagsDetectedPrefix: 'Observed pixel/spectral signals:',
      reencodedNote: '(Signed .certified-handmade.png files are freshly encoded; attach pre-signed original file to inspect original tags)',
      noneDetected: 'None recorded',
      fullyOpaque: 'Fully opaque (no transparency)',
      hasSoftAlpha: 'Contains semi-transparent brush/AA edges',
      hasTransparency: 'Contains transparent pixels',
      detailRich: 'Active contour & tonal detail',
      detailFlat: 'Mostly flat / uniform fill',
      edgeDensityLabel: 'edge density',
      bucketsLabel: 'sampled color buckets',
    },
  },
  'zh-CN': {
    badgeNotAssessed: '未评估（未加载图片）',
    badgeLocalSignals: '本地信号已检查（未见明显 AI 异常 · 仅供参考）',
    badgeAiMetadataDetected: '检测到 AI 生成元数据（警告）',
    badgeAiPixelSignalsDetected: '检测到疑似 AI 像素/频谱特征（警告）',
    badgeInconclusive: '无法判定（视觉信息不足）',
    cardTitle: 'D. 本地启发式与图像取证详情（免费 · 纯离线）',
    cardDisclaimer:
      '提示：仅凭成品像素或文件元数据无法 100% 证明为纯人工手绘或绝对判定 AI。高噪点照片或多次压缩也可能触发特征，请仅作辅助参考。',
    preSignAiWarningTitle: '提示：检测到上传图像包含 AI 生成器元数据或疑似扩散/重采样像素特征',
    outcomes: {
      'no-image': '尚未加载作品图像。上传带二维码的 PNG 或关联原图后将自动执行本地检测。',
      'insufficient-visual-signal': '图像尺寸过小（<32 px）或画面几乎纯色，无法提取足够的视觉特征。',
      'ai-metadata-detected': '在文件元数据中检测到 AI 生成工具标记，建议进一步向作者核实创作过程。',
      'ai-pixel-signals-detected':
        '未发现元数据标签，但检测到多项常见于 AI 生图（如 ChatGPT / Diffusion 等）的像素与频谱特征（平坦区微噪、隐式上采样相关性或隐写水印），仅供参考。',
      'local-signals-clean': '未发现 AI 元数据或明显的扩散/上采样像素异常（仅供参考，不构成手绘绝对证明）。',
    },
    labels: {
      metadataScan: '容器元数据扫描 (C2PA / EXIF / PNG)',
      pixelForensicsScan: '像素与频谱取证扫描',
      artworkArea: '已分析作品区域',
      transparency: '透明与柔边分布',
      visualDetail: '线条与纹理细节',
      colorVariety: '色彩分布复杂度',
      toolHints: '绘图软件痕迹',
    },
    values: {
      noAiTags: '未检测到 AI 生成器元数据',
      noPixelAiTags: '未观察到明显 AI 像素或频谱异常',
      aiTagsDetectedPrefix: '检测到标记：',
      pixelAiTagsDetectedPrefix: '检测到的像素/频谱特征：',
      reencodedNote: '（签名输出的 PNG 经本地重新编码；若需检查原软件标签，可附加原始未签名文件）',
      noneDetected: '无记录',
      fullyOpaque: '完全不透明',
      hasSoftAlpha: '包含半透明笔刷或抗锯齿边缘',
      hasTransparency: '包含透明像素区域',
      detailRich: '存在明确轮廓与明暗层次',
      detailFlat: '画面偏平坦/单调',
      edgeDensityLabel: '边缘密度',
      bucketsLabel: '采样色彩分桶',
    },
  },
  'zh-TW': {
    badgeNotAssessed: '未評估（未載入圖片）',
    badgeLocalSignals: '本機訊號已檢查（未見明顯 AI 異常 · 僅供參考）',
    badgeAiMetadataDetected: '偵測到 AI 生成中繼資料（警示）',
    badgeAiPixelSignalsDetected: '偵測到疑似 AI 像素/頻譜訊號（警示）',
    badgeInconclusive: '無法判定（視覺訊號不足）',
    cardTitle: 'D. 本機啟發式與像素鑑識明細（免費 · 離線）',
    cardDisclaimer:
      '注意：僅靠完稿像素與中繼資料無法 100% 證明人工手繪或絕對判定 AI。請搭配 A 與 B 的加密驗證作為輔助參考。',
    preSignAiWarningTitle: '提示：偵測到上傳圖片帶有 AI 生成器中繼資料或疑似擴散/取樣像素特徵',
    outcomes: {
      'no-image': '尚未載入作品圖片。請上傳含 QR 的 PNG 或附加原圖以執行本機檢查。',
      'insufficient-visual-signal': '圖片區域過小（<32 px）或過於單一，視覺訊號不足以分析。',
      'ai-metadata-detected': '檔案容器中偵測到 AI 圖像生成工具標記，建議進一步確認作品來源。',
      'ai-pixel-signals-detected':
        '雖無中繼資料標籤，但偵測到多項常見於生成式 AI（如 ChatGPT / Diffusion 等）的平滑區微噪點、上採樣頻譜相關性或隱形浮水印訊號（僅供警示參考）。',
      'local-signals-clean': '未偵測到 AI 中繼資料或明顯擴散異常（僅供參考，非手繪絕對證明）。',
    },
    labels: {
      metadataScan: '容器中繼資料掃描 (C2PA / EXIF / PNG)',
      pixelForensicsScan: '像素與頻譜鑑識掃描',
      artworkArea: '分析的作品區域',
      transparency: '透明度與筆刷邊緣',
      visualDetail: '線條與質感細節',
      colorVariety: '色彩分布豐富度',
      toolHints: '繪圖軟體線索',
    },
    values: {
      noAiTags: '未偵測到 AI 生成器中繼資料',
      noPixelAiTags: '未發現明顯 AI 像素或頻譜異常',
      aiTagsDetectedPrefix: '偵測到標記：',
      pixelAiTagsDetectedPrefix: '觀察到的像素/頻譜訊號：',
      reencodedNote: '（簽署後的 PNG 為重新編碼輸出；若要檢查原標籤，可附加簽署前原圖）',
      noneDetected: '未記錄',
      fullyOpaque: '完全不透明',
      hasSoftAlpha: '含有半透明筆刷或反鋸齒邊緣',
      hasTransparency: '含有透明區域',
      detailRich: '具備輪廓與階調層次',
      detailFlat: '大多為平坦單色填滿',
      edgeDensityLabel: '邊緣密度',
      bucketsLabel: '取樣色彩數',
    },
  },
  ko: {
    badgeNotAssessed: '미평가 (이미지 없음)',
    badgeLocalSignals: '로컬 신호 검사됨 (AI 이상 미검출 · 참고용)',
    badgeAiMetadataDetected: 'AI 생성 메타데이터 감지 (주의)',
    badgeAiPixelSignalsDetected: 'AI 특유의 픽셀/주파수 신호 감지 (주의)',
    badgeInconclusive: '판정 불가 (시각 신호 부족)',
    cardTitle: 'D. 로컬 휴리스틱 및 포렌식 분석 상세 (무료 · 오프라인)',
    cardDisclaimer:
      '참고: 완성된 픽셀과 메타데이터만으로는 100% 손그림 증명이나 AI 단정을 내릴 수 없습니다. A·B 검증과 함께 보조 참고 지표로만 활용하세요.',
    preSignAiWarningTitle: '주의: 업로드한 이미지에서 AI 생성기 메타데이터 또는 AI 유사 픽셀 신호가 감지되었습니다',
    outcomes: {
      'no-image': '작품 이미지가 아직 불러와지지 않았습니다. 서명된 PNG 또는 원본 이미지를 넣으면 로컬 검사를 실행합니다.',
      'insufficient-visual-signal': '이미지 영역이 너무 작거나(<32 px) 단색에 가까워 시각적 신호를 충분히 판단할 수 없습니다.',
      'ai-metadata-detected': '파일 컨테이너에서 AI 이미지 생성 도구 관련 메타데이터가 발견되었습니다. 출처를 확인하세요.',
      'ai-pixel-signals-detected':
        '메타데이터는 없지만 생성형 AI(ChatGPT / Diffusion 등)에서 흔히 나타나는 평탄 영역 미세 노이즈, 업샘플링 격자 상관성 또는 스텔스 워터마크 신호가 감지되었습니다 (참고 경고).',
      'local-signals-clean': 'AI 생성기 메타데이터나 뚜렷한 확산/업샘플링 이상이 발견되지 않았습니다 (참고용이며 손그림 확정 증명이 아님).',
    },
    labels: {
      metadataScan: '컨테이너 메타데이터 검사 (C2PA / EXIF / PNG)',
      pixelForensicsScan: '픽셀 및 주파수 포렌식 검사',
      artworkArea: '분석된 작품 영역',
      transparency: '투명도 및 브러시 경계',
      visualDetail: '선화 및 질감 디테일',
      colorVariety: '색상 분포',
      toolHints: '제작 소프트웨어 흔적',
    },
    values: {
      noAiTags: 'AI 생성기 메타데이터 미검출',
      noPixelAiTags: '강한 AI 특유 픽셀/주파수 이상 미검출',
      aiTagsDetectedPrefix: '감지된 마커:',
      pixelAiTagsDetectedPrefix: '관찰된 픽셀/주파수 신호:',
      reencodedNote: '(서명된 PNG는 새로 인코딩되므로 원본 태그 확인이 필요하면 서명 전 원본 파일을 첨부하세요)',
      noneDetected: '기록 없음',
      fullyOpaque: '완전 불투명',
      hasSoftAlpha: '반투명 브러시/안티앨리어싱 경계 포함',
      hasTransparency: '투명 영역 포함',
      detailRich: '윤곽선 및 명암 변화 있음',
      detailFlat: '단조롭거나 평면적인 채움',
      edgeDensityLabel: '윤곽 밀도',
      bucketsLabel: '샘플 색상 그룹',
    },
  },
  ru: {
    badgeNotAssessed: 'Не оценено (нет изображения)',
    badgeLocalSignals: 'Локальные сигналы проверены (без аномалий ИИ)',
    badgeAiMetadataDetected: 'Найдены метаданные ИИ (внимание)',
    badgeAiPixelSignalsDetected: 'Обнаружены пиксельные/спектральные сигналы ИИ (внимание)',
    badgeInconclusive: 'Неопределённо (мало деталей)',
    cardTitle: 'D. Локальный разбор метаданных и пиксельной криминалистики (Офлайн)',
    cardDisclaimer:
      'Примечание: пиксели и метаданные сами по себе не доказывают на 100% ручное создание или ИИ-происхождение. Используйте это как справочный сигнал рядом с A и B.',
    preSignAiWarningTitle: 'Внимание: в загруженном изображении обнаружены метаданные ИИ или характерные пиксельные сигналы',
    outcomes: {
      'no-image': 'Изображение ещё не загружено. Загрузите подписанный PNG или оригинал для локального анализа.',
      'insufficient-visual-signal': 'Изображение слишком маленькое (<32 px) или однотонное — недостаточно визуальных данных.',
      'ai-metadata-detected': 'Внутри файла обнаружены метаданные генератора ИИ. Рекомендуется дополнительная проверка.',
      'ai-pixel-signals-detected':
        'Метаданные ИИ не найдены, но обнаружены пиксельные/частотные признаки, характерные для генераторов ИИ (ChatGPT / диффузионный микрошум, корреляция апсемплинга или скрытые водяные знаки).',
      'local-signals-clean': 'Метаданные ИИ и явные диффузионные/спектральные аномалии не выявлены (справочно, не доказательство ручной работы).',
    },
    labels: {
      metadataScan: 'Проверка метаданных (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Пиксельный и спектральный анализ',
      artworkArea: 'Проверенная область',
      transparency: 'Прозрачность и мягкие края',
      visualDetail: 'Контуры и детализация',
      colorVariety: 'Разнообразие оттенков',
      toolHints: 'Следы редактора',
    },
    values: {
      noAiTags: 'Метаданные ИИ-генераторов не найдены',
      noPixelAiTags: 'Сильных пиксельных/частотных сигналов ИИ не выявлено',
      aiTagsDetectedPrefix: 'Обнаружены метки:',
      pixelAiTagsDetectedPrefix: 'Зафиксированные сигналы:',
      reencodedNote: '(Подписанный PNG перекодируется заново; для проверки исходных тегов приложите оригинал)',
      noneDetected: 'Не указаны',
      fullyOpaque: 'Полностью непрозрачное',
      hasSoftAlpha: 'Есть полупрозрачные мазки / сглаживание',
      hasTransparency: 'Содержит прозрачные области',
      detailRich: 'Выраженные контуры и тональные переходы',
      detailFlat: 'Преимущественно однотонная заливка',
      edgeDensityLabel: 'плотность краёв',
      bucketsLabel: 'цветовых корзин',
    },
  },
  uk: {
    badgeNotAssessed: 'Не оцінено (немає зображення)',
    badgeLocalSignals: 'Локальні сигнали перевірено (без аномалій ШІ)',
    badgeAiMetadataDetected: 'Виявлено метадані ШІ (увага)',
    badgeAiPixelSignalsDetected: 'Виявлено піксельні/спектральні сигнали ШІ (увага)',
    badgeInconclusive: 'Невизначено (мало деталей)',
    cardTitle: 'D. Локальний розбір метаданих і піксельної криміналістики (Офлайн)',
    cardDisclaimer:
      'Примітка: самі пікселі та метадані не можуть на 100% довести ручне малювання або генерацію ШІ. Використовуйте лише як орієнтир поруч із A та B.',
    preSignAiWarningTitle: 'Увага: у завантаженому зображенні виявлено метадані ШІ або характерні піксельні сигнали',
    outcomes: {
      'no-image': 'Зображення ще не додано. Завантажте підписаний PNG або оригінал для локальної перевірки.',
      'insufficient-visual-signal': 'Зображення занадто мале (<32 px) або майже суцільно однотонне.',
      'ai-metadata-detected': 'У контейнері файлу виявлено маркери генератора ШІ. Перевірте походження роботи.',
      'ai-pixel-signals-detected':
        'Метаданих ШІ не знайдено, але виявлено піксельні/частотні ознаки, властиві генераторам ШІ (дифузійний мікрошум у гладких зонах, кореляція апсемплінгу або прихований водяний знак).',
      'local-signals-clean': 'Метаданих ШІ та явних дифузійних/спектральних аномалій не виявлено (довідково, не доказ рукотворності).',
    },
    labels: {
      metadataScan: 'Перевірка метаданих (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Піксельний та спектральний аналіз',
      artworkArea: 'Перевірена ділянка',
      transparency: 'Прозорість і краї пензля',
      visualDetail: 'Лінії та деталізація',
      colorVariety: 'Колірне різноманіття',
      toolHints: 'Сліди графічного редактора',
    },
    values: {
      noAiTags: 'Метаданих ШІ-генераторів не виявлено',
      noPixelAiTags: 'Сильних піксельних/спектральних сигналів ШІ не виявлено',
      aiTagsDetectedPrefix: 'Виявлені маркери:',
      pixelAiTagsDetectedPrefix: 'Виявлені сигнали:',
      reencodedNote: '(Підписаний PNG перекодовується; щоб перевірити теги редактора, додайте вихідний файл)',
      noneDetected: 'Не зазначено',
      fullyOpaque: 'Повністю непрозоре',
      hasSoftAlpha: 'Є напівпрозорі мазки / згладжування',
      hasTransparency: 'Містить прозорі пікселі',
      detailRich: 'Чіткі контури та переходи тонів',
      detailFlat: 'Переважно плоске заповнення',
      edgeDensityLabel: 'щільність країв',
      bucketsLabel: 'колірних груп',
    },
  },
  es: {
    badgeNotAssessed: 'Sin evaluar (sin imagen)',
    badgeLocalSignals: 'Señales locales revisadas (sin anomalía IA · Ref)',
    badgeAiMetadataDetected: 'Metadatos de IA detectados (aviso)',
    badgeAiPixelSignalsDetected: 'Señales de píxel / espectro tipo IA detectadas (aviso)',
    badgeInconclusive: 'No concluyente (señal insuficiente)',
    cardTitle: 'D. Análisis local de metadatos y píxeles (Gratis · Sin conexión)',
    cardDisclaimer:
      'Nota: Los píxeles o metadatos por sí solos no demuestran autoría 100% manual ni origen IA absoluto. Úsalo solo como referencia junto a A y B.',
    preSignAiWarningTitle: 'Aviso: se detectaron metadatos o señales de píxeles compatibles con generadores de IA',
    outcomes: {
      'no-image': 'Aún no se cargó ninguna imagen. Carga un PNG firmado o adjunta la obra para analizarla localmente.',
      'insufficient-visual-signal': 'La región es demasiado pequeña (<32 px) o uniforme para obtener señales visuales claras.',
      'ai-metadata-detected': 'Se detectaron metadatos de generadores de IA dentro del archivo.',
      'ai-pixel-signals-detected':
        'No había etiquetas de IA, pero se observaron señales de píxeles/espectro frecuentes en IA generativa (microrruido difusivo en zonas lisas, correlación de sobremuestreo o marca LSB).',
      'local-signals-clean': 'No se hallaron metadatos de IA ni anomalías espectrales fuertes (solo referencia, no prueba dibujo manual).',
    },
    labels: {
      metadataScan: 'Escaneo de metadatos (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Análisis forense de píxeles y espectro',
      artworkArea: 'Región analizada',
      transparency: 'Transparencia y bordes',
      visualDetail: 'Detalle de trazos y textura',
      colorVariety: 'Variedad cromática',
      toolHints: 'Indicios de software creativo',
    },
    values: {
      noAiTags: 'Sin etiquetas de generadores de IA',
      noPixelAiTags: 'Sin señales fuertes de píxel o espectro tipo IA',
      aiTagsDetectedPrefix: 'Marcadores detectados:',
      pixelAiTagsDetectedPrefix: 'Señales observadas:',
      reencodedNote: '(Los PNG firmados se recodifican; adjunta el archivo original si deseas revisar etiquetas del editor)',
      noneDetected: 'Ninguno registrado',
      fullyOpaque: 'Totalmente opaco',
      hasSoftAlpha: 'Contiene bordes semitransparentes / suavizado',
      hasTransparency: 'Contiene zonas transparentes',
      detailRich: 'Contornos y variación tonal activos',
      detailFlat: 'Relleno mayormente plano',
      edgeDensityLabel: 'densidad de bordes',
      bucketsLabel: 'grupos de color muestreados',
    },
  },
  fr: {
    badgeNotAssessed: 'Non évalué (aucune image)',
    badgeLocalSignals: 'Signaux locaux vérifiés (aucune anomalie IA · Réf)',
    badgeAiMetadataDetected: 'Métadonnées IA détectées (alerte)',
    badgeAiPixelSignalsDetected: 'Signaux pixels / spectraux de type IA détectés (alerte)',
    badgeInconclusive: 'Non concluant (signal faible)',
    cardTitle: 'D. Analyse locale des métadonnées et pixels (Gratuit · Hors ligne)',
    cardDisclaimer:
      'Note : les pixels ou métadonnées seuls ne prouvent jamais une création 100 % manuelle. À consulter uniquement comme indice avec A et B.',
    preSignAiWarningTitle: 'Attention : des métadonnées ou signaux pixels typiques d’IA générative ont été détectés',
    outcomes: {
      'no-image': 'Aucune image chargée pour le moment. Importez un PNG signé ou l’image d’origine pour lancer l’analyse locale.',
      'insufficient-visual-signal': 'Zone trop petite (<32 px) ou trop uniforme pour extraire des signaux visuels fiables.',
      'ai-metadata-detected': 'Des marqueurs de génération par IA ont été détectés dans les métadonnées du fichier.',
      'ai-pixel-signals-detected':
        'Aucune balise IA trouvée, mais plusieurs signaux pixels/spectraux courants dans l’IA générative (micro-grain de diffusion, corrélation de suréchantillonnage ou filigrane LSB) ont été relevés.',
      'local-signals-clean': 'Aucune métadonnée IA ni anomalie spectrale marquée détectée (indicatif uniquement, ne prouve pas un dessin manuel).',
    },
    labels: {
      metadataScan: 'Analyse des métadonnées (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Analyse forensique pixels & spectre',
      artworkArea: 'Zone analysée',
      transparency: 'Transparence et bords doux',
      visualDetail: 'Détail des contours et textures',
      colorVariety: 'Richesse des couleurs',
      toolHints: 'Indices de logiciel créatif',
    },
    values: {
      noAiTags: 'Aucune balise de générateur IA trouvée',
      noPixelAiTags: 'Aucun signal fort de type IA détecté dans les pixels',
      aiTagsDetectedPrefix: 'Marqueurs détectés :',
      pixelAiTagsDetectedPrefix: 'Signaux observés :',
      reencodedNote: '(Le PNG signé est réencodé ; joignez l’original pour inspecter les balises du logiciel)',
      noneDetected: 'Aucun détecté',
      fullyOpaque: 'Totalement opaque',
      hasSoftAlpha: 'Contient des contours semi-transparents',
      hasTransparency: 'Contient des zones transparentes',
      detailRich: 'Contours et nuances actifs',
      detailFlat: 'Aplat majoritairement uniforme',
      edgeDensityLabel: 'densité de bords',
      bucketsLabel: 'groupes de couleurs',
    },
  },
  de: {
    badgeNotAssessed: 'Nicht geprüft (kein Bild)',
    badgeLocalSignals: 'Lokale Signale geprüft (keine KI-Anomalie · Ref)',
    badgeAiMetadataDetected: 'KI-Metadaten erkannt (Hinweis)',
    badgeAiPixelSignalsDetected: 'KI-typische Pixel-/Spektralsignale erkannt (Hinweis)',
    badgeInconclusive: 'Unklar (zu wenig Bildsignal)',
    cardTitle: 'D. Lokale Metadaten- & Pixel-Forensik (Kostenlos · Offline)',
    cardDisclaimer:
      'Hinweis: Pixel und Metadaten allein beweisen niemals zu 100 % eine Handzeichnung oder KI-Herkunft. Nur als Referenz neben A & B nutzen.',
    preSignAiWarningTitle: 'Hinweis: Im hochgeladenen Bild wurden KI-Metadaten oder KI-typische Pixelsignale erkannt',
    outcomes: {
      'no-image': 'Noch kein Bild geladen. Laden Sie ein signiertes PNG oder das Originalbild für die lokale Prüfung.',
      'insufficient-visual-signal': 'Der Bildbereich ist sehr klein (<32 px) oder einfarbig; keine ausreichenden Signale.',
      'ai-metadata-detected': 'In den Dateimetadaten wurden Hinweise auf KI-Bildgeneratoren gefunden.',
      'ai-pixel-signals-detected':
        'Keine KI-Metadaten gefunden, aber mehrere bei KI-Bildgeneratoren häufige Pixel-/Frequenzsignale (Diffusions-Mikrorauschen, Upsampling-Korrelation oder LSB-Wasserzeichen) erkannt.',
      'local-signals-clean': 'Keine KI-Metadaten oder deutlichen Diffusions-/Upsampling-Anomalien gefunden (nur Referenz, kein Beweis für Handarbeit).',
    },
    labels: {
      metadataScan: 'Container-Metadaten-Scan (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Pixel- & Spektral-Forensik',
      artworkArea: 'Geprüfter Bildbereich',
      transparency: 'Transparenz & Pinselkanten',
      visualDetail: 'Linien- & Texturdetails',
      colorVariety: 'Farbverteilung',
      toolHints: 'Hinweise auf Zeichensoftware',
    },
    values: {
      noAiTags: 'Keine KI-Generator-Metadaten gefunden',
      noPixelAiTags: 'Keine starken KI-typischen Pixel-/Spektralsignale gefunden',
      aiTagsDetectedPrefix: 'Erkannte Marker:',
      pixelAiTagsDetectedPrefix: 'Beobachtete Signale:',
      reencodedNote: '(Signierte PNGs werden neu kodiert; für Original-Tags fügen Sie die unsignierte Datei an)',
      noneDetected: 'Keine gefunden',
      fullyOpaque: 'Vollständig deckend',
      hasSoftAlpha: 'Enthält halbtransparente Kanten / Glättung',
      hasTransparency: 'Enthält transparente Bereiche',
      detailRich: 'Aktive Konturen & Tonwertdetails',
      detailFlat: 'Überwiegend flächige Füllung',
      edgeDensityLabel: 'Kantendichte',
      bucketsLabel: 'Farb-Buckets',
    },
  },
  pt: {
    badgeNotAssessed: 'Não avaliado (sem imagem)',
    badgeLocalSignals: 'Sinais locais verificados (sem anomalia IA · Ref)',
    badgeAiMetadataDetected: 'Metadados de IA detectados (aviso)',
    badgeAiPixelSignalsDetected: 'Sinais de pixel/espectro semelhantes a IA (aviso)',
    badgeInconclusive: 'Inconclusivo (pouco sinal visual)',
    cardTitle: 'D. Detalhamento local de metadados e pixels (Grátis · Offline)',
    cardDisclaimer:
      'Nota: apenas pixels e metadados não garantem autoria 100% manual ou IA absoluta. Use como sinal auxiliar junto às verificações A e B.',
    preSignAiWarningTitle: 'Aviso: metadados ou sinais de pixels típicos de geradores de IA detectados na imagem',
    outcomes: {
      'no-image': 'Nenhuma imagem carregada ainda. Envie o PNG assinado ou a arte original para inspeção local.',
      'insufficient-visual-signal': 'Região muito pequena (<32 px) ou uniforme demais para análise visual.',
      'ai-metadata-detected': 'Foram encontrados metadados de geradores de IA no arquivo.',
      'ai-pixel-signals-detected':
        'Sem tags de IA nos metadados, mas foram observados sinais em pixels/frequência comuns em geradores de IA (microrruído de difusão, correlação de upsampling ou marca LSB).',
      'local-signals-clean': 'Nenhum metadado de IA ou anomalia espectral forte encontrada (apenas referência, não prova desenho manual).',
    },
    labels: {
      metadataScan: 'Leitura de metadados (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Análise forense de pixels e espectro',
      artworkArea: 'Área analisada',
      transparency: 'Transparência e bordas suaves',
      visualDetail: 'Detalhes de traço e textura',
      colorVariety: 'Distribuição de cores',
      toolHints: 'Indícios de software criativo',
    },
    values: {
      noAiTags: 'Nenhum metadado de IA encontrado',
      noPixelAiTags: 'Nenhum sinal forte semelhante a IA observado nos pixels',
      aiTagsDetectedPrefix: 'Marcadores encontrados:',
      pixelAiTagsDetectedPrefix: 'Sinais observados:',
      reencodedNote: '(PNGs assinados são recodificados; anexe o original se quiser checar metadados do editor)',
      noneDetected: 'Nenhum registrado',
      fullyOpaque: 'Totalmente opaco',
      hasSoftAlpha: 'Contém bordas semitransparentes',
      hasTransparency: 'Contém pixels transparentes',
      detailRich: 'Contornos e variação tonal ativos',
      detailFlat: 'Preenchimento majoritariamente plano',
      edgeDensityLabel: 'densidade de bordas',
      bucketsLabel: 'grupos de cores',
    },
  },
  it: {
    badgeNotAssessed: 'Non valutato (nessuna immagine)',
    badgeLocalSignals: 'Segnali locali verificati (nessuna anomalia IA · Rif)',
    badgeAiMetadataDetected: 'Metadati IA rilevati (avviso)',
    badgeAiPixelSignalsDetected: 'Segnali pixel / spettrali tipo IA rilevati (avviso)',
    badgeInconclusive: 'Inconcludente (segnale scarso)',
    cardTitle: 'D. Analisi locale metadati e pixel (Gratuita · Offline)',
    cardDisclaimer:
      'Nota: pixel e metadati da soli non provano al 100% esecuzione manuale o origine IA. Da usare solo come supporto insieme ad A e B.',
    preSignAiWarningTitle: 'Avviso: nell’immagine caricata sono stati rilevati metadati o segnali pixel tipici di generatori IA',
    outcomes: {
      'no-image': 'Nessuna immagine caricata. Carica un PNG firmato o l’opera originale per l’analisi locale.',
      'insufficient-visual-signal': 'Area troppo piccola (<32 px) o uniforme per un’analisi significativa.',
      'ai-metadata-detected': 'Nel file sono stati trovati metadati tipici di generatori IA.',
      'ai-pixel-signals-detected':
        'Nessun tag IA nei metadati, ma sono presenti segnali pixel/spettrali frequenti nelle immagini generate da IA (micro-rumore di diffusione, correlazione di upsampling o watermark LSB).',
      'local-signals-clean': 'Nessun metadato IA o anomalia spettrale evidente rilevata (solo riferimento, non prova disegno a mano).',
    },
    labels: {
      metadataScan: 'Scansione metadati (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'Analisi forense pixel & spettro',
      artworkArea: 'Area analizzata',
      transparency: 'Trasparenza e bordi',
      visualDetail: 'Dettagli di linee e texture',
      colorVariety: 'Distribuzione cromatica',
      toolHints: 'Indizi software creativo',
    },
    values: {
      noAiTags: 'Nessun tag di generatori IA trovato',
      noPixelAiTags: 'Nessun forte segnale tipo IA rilevato nei pixel',
      aiTagsDetectedPrefix: 'Indicatori trovati:',
      pixelAiTagsDetectedPrefix: 'Segnali osservati:',
      reencodedNote: '(I PNG firmati sono ricodificati; allega l’originale per controllare eventuali tag dell’editor)',
      noneDetected: 'Nessuno rilevato',
      fullyOpaque: 'Completamente opaco',
      hasSoftAlpha: 'Contiene bordi semitrasparenti',
      hasTransparency: 'Contiene aree trasparenti',
      detailRich: 'Contorni e variazioni tonali attivi',
      detailFlat: 'Riempimento prevalentemente piatto',
      edgeDensityLabel: 'densità bordi',
      bucketsLabel: 'gruppi colore',
    },
  },
  ar: {
    badgeNotAssessed: 'غير مقيّم (لا توجد صورة)',
    badgeLocalSignals: 'تم فحص الإشارات محلياً (لا مؤشر ذكاء اصطناعي)',
    badgeAiMetadataDetected: 'تم رصد بيانات ذكاء اصطناعي (تنبيه)',
    badgeAiPixelSignalsDetected: 'تم رصد إشارات بكسل/طيف شبيهة بالذكاء الاصطناعي (تنبيه)',
    badgeInconclusive: 'غير حاسم (تفاصيل غير كافية)',
    cardTitle: 'D. الفحص المحلي للبيانات الوصفية والبكسلات (مجاني · دون إنترنت)',
    cardDisclaimer:
      'تنبيه: لا يمكن للبكسلات أو البيانات الوصفية وحدها إثبات الرسم اليدوي أو التوليد بالذكاء الاصطناعي بنسبة 100%. استخدمها كمرجع بجانب A و B.',
    preSignAiWarningTitle: 'تنبيه: تم رصد بيانات وصفية أو إشارات بكسل شبيهة بمولّدات الذكاء الاصطناعي في الصورة المرفوعة',
    outcomes: {
      'no-image': 'لم يتم تحميل صورة بعد. أرفق ملف PNG الموقّع أو الصورة الأصلية لتشغيل الفحص المحلي.',
      'insufficient-visual-signal': 'منطقة الصورة صغيرة جداً (<32 بكسل) أو موحدة اللون ولا تكفي للتحليل البصري.',
      'ai-metadata-detected': 'تم العثور على علامات لمولّدات صور بالذكاء الاصطناعي داخل بيانات الملف.',
      'ai-pixel-signals-detected':
        'لم يُعثر على وسوم بيانات وصفية، لكن رُصدت إشارات بكسل/تردد شائعة في الصور المولّدة بالذكاء الاصطناعي (ضجيج دقيق في المناطق الملساء، ارتباط شبكة التكبير أو علامة مائية).',
      'local-signals-clean': 'لم يتم العثور على بيانات ذكاء اصطناعي أو شذوذ طيفي واضح (للمرجعية فقط ولا يثبت الرسم اليدوي).',
    },
    labels: {
      metadataScan: 'فحص البيانات الوصفية (C2PA / EXIF / PNG)',
      pixelForensicsScan: 'فحص البكسلات والطيف الترددي',
      artworkArea: 'منطقة العمل المفحوصة',
      transparency: 'الشفافية وحواف الفرشاة',
      visualDetail: 'تفاصيل الخطوط والملمس',
      colorVariety: 'تنوع الألوان',
      toolHints: 'آثار برامج الرسم',
    },
    values: {
      noAiTags: 'لم يُعثر على علامات مولّد ذكاء اصطناعي',
      noPixelAiTags: 'لم تُرصد إشارات بكسل أو تردد قوية للذكاء الاصطناعي',
      aiTagsDetectedPrefix: 'العلامات المرصودة:',
      pixelAiTagsDetectedPrefix: 'الإشارات المرصودة:',
      reencodedNote: '(ملفات PNG الموقّعة يُعاد ترميزها؛ أرفق الملف الأصلي لفحص وسوم برنامج الرسم)',
      noneDetected: 'غير مسجل',
      fullyOpaque: 'معتم بالكامل',
      hasSoftAlpha: 'يحتوي على حواف شبه شفافة / تنعيم',
      hasTransparency: 'يحتوي على مناطق شفافة',
      detailRich: 'تباين واضح في الخطوط والدرجات',
      detailFlat: 'مساحات لونية مسطحة غالباً',
      edgeDensityLabel: 'كثافة الحواف',
      bucketsLabel: 'مجموعات الألوان',
    },
  },
};
