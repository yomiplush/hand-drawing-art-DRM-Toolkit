import type { SupportedLocale } from '../core/storage/consent';

export interface AssessmentTranslations {
  badgeNotAssessed: string;
  badgeLocalSignals: string;
  badgeAiMetadataDetected: string;
  badgeInconclusive: string;
  cardTitle: string;
  cardDisclaimer: string;
  outcomes: {
    'no-image': string;
    'insufficient-visual-signal': string;
    'ai-metadata-detected': string;
    'local-signals-clean': string;
  };
  labels: {
    metadataScan: string;
    artworkArea: string;
    transparency: string;
    visualDetail: string;
    colorVariety: string;
    toolHints: string;
  };
  values: {
    noAiTags: string;
    aiTagsDetectedPrefix: string;
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
    badgeLocalSignals: 'ローカル信号解析済み（参考値）',
    badgeAiMetadataDetected: 'AI生成メタデータ検出（要注意）',
    badgeInconclusive: 'Inconclusive（信号不足・判定不能）',
    cardTitle: 'D. ローカル補助解析の内訳（完全無料・オフライン処理）',
    cardDisclaimer:
      '※ 完成画像とメタデータだけでは「人間が手描きしたこと」の100%証明はできません。改ざんされていないか（A・B）とあわせて参考シグナルとしてご利用ください。',
    outcomes: {
      'no-image': '画像が読み込まれていないため未評価です。署名付きPNGまたは元画像を追加するとローカル解析を実行します。',
      'insufficient-visual-signal': '画像サイズが小さすぎる（32px未満）か単色に近いため、十分な特徴を抽出できませんでした。',
      'ai-metadata-detected': 'ファイル内のメタデータに AI 画像生成ツール由来の記述が見つかりました。作者への確認を推奨します。',
      'local-signals-clean': 'AI 生成ツール由来のメタデータは検出されず、通常のデジタル画像として視覚特徴を取得しました（手描き確定の証明ではありません）。',
    },
    labels: {
      metadataScan: 'ファイル内メタデータ検査',
      artworkArea: '解析した作品領域',
      transparency: '透過・ブラシ境界の割合',
      visualDetail: '線画・質感のディテール',
      colorVariety: '色分布の広がり',
      toolHints: '制作ソフト等の痕跡',
    },
    values: {
      noAiTags: 'AI生成ツールのメタデータ未検出',
      aiTagsDetectedPrefix: '検出されたマーカー:',
      reencodedNote: '（Certified Handmade 生成PNGは署名時に再エンコードされます。制作ソフト情報が残る未加工PNGでの再確認も可能です）',
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
    badgeLocalSignals: 'Local Signals Analyzed (Reference)',
    badgeAiMetadataDetected: 'AI Metadata Detected (Warning)',
    badgeInconclusive: 'Inconclusive (Low Visual Signal)',
    cardTitle: 'D. Local Heuristic & Metadata Breakdown (Free · Offline)',
    cardDisclaimer:
      'Note: Pixels and file metadata alone can never cryptographically prove human-only drawing. Use these local checks strictly as reference signals alongside A & B.',
    outcomes: {
      'no-image': 'No artwork pixels were loaded yet. Drop a signed PNG or attach the artwork image to run local inspection.',
      'insufficient-visual-signal': 'The image region is very small (<32 px) or visually uniform, so visual signals are inconclusive.',
      'ai-metadata-detected': 'AI-generation metadata markers were detected inside the image file container. Verify provenance details carefully.',
      'local-signals-clean': 'No automated AI-generator metadata was found and local visual statistics were computed (reference only, not proof of human origin).',
    },
    labels: {
      metadataScan: 'Container Metadata Scan',
      artworkArea: 'Analyzed Artwork Region',
      transparency: 'Alpha / Soft Edge Profile',
      visualDetail: 'Line & Texture Detail',
      colorVariety: 'Color Distribution',
      toolHints: 'Authoring Tool Hints',
    },
    values: {
      noAiTags: 'No AI generator metadata tags found',
      aiTagsDetectedPrefix: 'Detected markers:',
      reencodedNote: '(Signed .certified-handmade.png files are freshly encoded; attach pre-signed original PNG if checking original editor tags)',
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
    badgeLocalSignals: '本地信号已分析（仅供参考）',
    badgeAiMetadataDetected: '检测到 AI 生成元数据（警告）',
    badgeInconclusive: '无法判定（视觉信息不足）',
    cardTitle: 'D. 本地启发式与元数据检测详情（免费 · 纯离线）',
    cardDisclaimer:
      '提示：仅凭成品像素或文件元数据无法 100% 证明为纯人工手绘。请结合 A/B 密码学校验将以下结果作为辅助参考。',
    outcomes: {
      'no-image': '尚未加载作品图像。上传带二维码的 PNG 或关联原图后将自动执行本地检测。',
      'insufficient-visual-signal': '图像尺寸过小（<32 px）或画面几乎纯色，无法提取足够的视觉特征。',
      'ai-metadata-detected': '在文件元数据中检测到 AI 生成工具标记，建议进一步向作者核实创作过程。',
      'local-signals-clean': '未发现 AI 生成器元数据，已完成本地视觉统计分析（仅作参考，不构成手绘绝对证明）。',
    },
    labels: {
      metadataScan: '容器元数据扫描',
      artworkArea: '已分析作品区域',
      transparency: '透明与柔边分布',
      visualDetail: '线条与纹理细节',
      colorVariety: '色彩分布复杂度',
      toolHints: '绘图软件痕迹',
    },
    values: {
      noAiTags: '未检测到 AI 生成器元数据',
      aiTagsDetectedPrefix: '检测到标记：',
      reencodedNote: '（签名输出的 PNG 经本地重新编码；若需检查原软件标签，可附加原始未签名 PNG）',
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
    badgeLocalSignals: '本機訊號已分析（僅供參考）',
    badgeAiMetadataDetected: '偵測到 AI 生成中繼資料（警示）',
    badgeInconclusive: '無法判定（視覺訊號不足）',
    cardTitle: 'D. 本機啟發式與中繼資料檢查明細（免費 · 離線）',
    cardDisclaimer:
      '注意：僅靠完稿像素與檔案中繼資料無法 100% 證明完全由人工手繪。請搭配 A 與 B 的加密驗證作為輔助參考。',
    outcomes: {
      'no-image': '尚未載入作品圖片。請上傳含 QR 的 PNG 或附加原圖以執行本機檢查。',
      'insufficient-visual-signal': '圖片區域過小（<32 px）或過於單一，視覺訊號不足以分析。',
      'ai-metadata-detected': '檔案容器中偵測到 AI 圖像生成工具標記，建議進一步確認作品來源。',
      'local-signals-clean': '未偵測到 AI 生成器中繼資料，並已完成本機影像統計檢查（僅供參考，非手繪絕對證明）。',
    },
    labels: {
      metadataScan: '容器中繼資料掃描',
      artworkArea: '分析的作品區域',
      transparency: '透明度與筆刷邊緣',
      visualDetail: '線條與質感細節',
      colorVariety: '色彩分布豐富度',
      toolHints: '繪圖軟體線索',
    },
    values: {
      noAiTags: '未偵測到 AI 生成器中繼資料',
      aiTagsDetectedPrefix: '偵測到標記：',
      reencodedNote: '（簽署後的 PNG 為重新編碼輸出；若要檢查原繪圖軟體標籤，可附加簽署前原圖）',
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
    badgeLocalSignals: '로컬 신호 분석됨 (참고용)',
    badgeAiMetadataDetected: 'AI 생성 메타데이터 감지 (주의)',
    badgeInconclusive: '판정 불가 (시각 신호 부족)',
    cardTitle: 'D. 로컬 휴리스틱 및 메타데이터 분석 상세 (무료 · 오프라인)',
    cardDisclaimer:
      '참고: 완성된 픽셀과 메타데이터만으로는 100% 인간이 손으로 그렸음을 증명할 수 없습니다. A·B 암호화 검증과 함께 보조 참고 지표로만 활용하세요.',
    outcomes: {
      'no-image': '작품 이미지가 아직 불러와지지 않았습니다. 서명된 PNG 또는 원본 이미지를 넣으면 로컬 검사를 실행합니다.',
      'insufficient-visual-signal': '이미지 영역이 너무 작거나(<32 px) 단색에 가까워 시각적 신호를 충분히 판단할 수 없습니다.',
      'ai-metadata-detected': '파일 컨테이너에서 AI 이미지 생성 도구 관련 메타데이터가 발견되었습니다. 출처를 확인하세요.',
      'local-signals-clean': 'AI 생성기 메타데이터가 발견되지 않았으며 로컬 픽셀 통계를 확인했습니다 (참고용이며 손그림 확정 증명이 아님).',
    },
    labels: {
      metadataScan: '컨테이너 메타데이터 검사',
      artworkArea: '분석된 작품 영역',
      transparency: '투명도 및 브러시 경계',
      visualDetail: '선화 및 질감 디테일',
      colorVariety: '색상 분포',
      toolHints: '제작 소프트웨어 흔적',
    },
    values: {
      noAiTags: 'AI 생성기 메타데이터 미검출',
      aiTagsDetectedPrefix: '감지된 마커:',
      reencodedNote: '(서명된 PNG는 새로 인코딩되므로 원본 소프트웨어 태그 확인이 필요하면 서명 전 원본 파일을 첨부하세요)',
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
    badgeLocalSignals: 'Локальные сигналы проанализированы',
    badgeAiMetadataDetected: 'Найдены метаданные ИИ (внимание)',
    badgeInconclusive: 'Неопределённо (мало деталей)',
    cardTitle: 'D. Разбор локальной проверки метаданных и пикселей (Бесплатно · Офлайн)',
    cardDisclaimer:
      'Примечание: одни лишь пиксели и метаданные не могут гарантировать ручное создание работы. Используйте это как вспомогательный сигнал вместе с A и B.',
    outcomes: {
      'no-image': 'Изображение ещё не загружено. Загрузите подписанный PNG или оригинал для локального анализа.',
      'insufficient-visual-signal': 'Изображение слишком маленькое (<32 px) или однотонное — недостаточно визуальных данных.',
      'ai-metadata-detected': 'Внутри файла обнаружены метаданные генератора ИИ. Рекомендуется дополнительная проверка.',
      'local-signals-clean': 'Метаданные генераторов ИИ не обнаружены; локальные параметры изображения проверены (справочно, не доказательство).',
    },
    labels: {
      metadataScan: 'Проверка метаданных контейнера',
      artworkArea: 'Проверенная область',
      transparency: 'Прозрачность и мягкие края',
      visualDetail: 'Контуры и детализация',
      colorVariety: 'Разнообразие оттенков',
      toolHints: 'Следы редактора',
    },
    values: {
      noAiTags: 'Метаданные ИИ-генераторов не найдены',
      aiTagsDetectedPrefix: 'Обнаружены метки:',
      reencodedNote: '(Подписанный PNG перекодируется заново; для проверки тегов редактора приложите исходный файл)',
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
    badgeLocalSignals: 'Локальні сигнали перевірено (довідково)',
    badgeAiMetadataDetected: 'Виявлено метадані ШІ (увага)',
    badgeInconclusive: 'Невизначено (мало деталей)',
    cardTitle: 'D. Локальний розбір метаданих і пікселів (Безкоштовно · Офлайн)',
    cardDisclaimer:
      'Примітка: самі пікселі та метадані не можуть на 100% довести ручне малювання. Використовуйте ці дані лише як допоміжний орієнтир поруч із A та B.',
    outcomes: {
      'no-image': 'Зображення ще не додано. Завантажте підписаний PNG або оригінал для локальної перевірки.',
      'insufficient-visual-signal': 'Зображення занадто мале (<32 px) або майже суцільно однотонне.',
      'ai-metadata-detected': 'У контейнері файлу виявлено маркери генератора ШІ. Перевірте походження роботи.',
      'local-signals-clean': 'Метаданих генераторів ШІ не знайдено; локальні візуальні сигнали пораховано (довідково, не остаточний доказ).',
    },
    labels: {
      metadataScan: 'Перевірка метаданих файла',
      artworkArea: 'Перевірена ділянка',
      transparency: 'Прозорість і краї пензля',
      visualDetail: 'Лінії та деталізація',
      colorVariety: 'Колірне різноманіття',
      toolHints: 'Сліди графічного редактора',
    },
    values: {
      noAiTags: 'Метаданих ШІ-генераторів не виявлено',
      aiTagsDetectedPrefix: 'Виявлені маркери:',
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
    badgeLocalSignals: 'Señales locales analizadas (referencia)',
    badgeAiMetadataDetected: 'Metadatos de IA detectados (aviso)',
    badgeInconclusive: 'No concluyente (señal insuficiente)',
    cardTitle: 'D. Análisis local de metadatos y píxeles (Gratis · Sin conexión)',
    cardDisclaimer:
      'Nota: Los píxeles o metadatos por sí solos no pueden demostrar al 100% autoría manual. Úsalo solo como referencia junto a A y B.',
    outcomes: {
      'no-image': 'Aún no se cargó ninguna imagen. Carga un PNG firmado o adjunta la obra para analizarla localmente.',
      'insufficient-visual-signal': 'La región es demasiado pequeña (<32 px) o uniforme para obtener señales visuales claras.',
      'ai-metadata-detected': 'Se detectaron metadatos de generadores de IA dentro del archivo.',
      'local-signals-clean': 'No se hallaron metadatos de IA y se calcularon estadísticas visuales locales (solo referencia, no prueba absoluta).',
    },
    labels: {
      metadataScan: 'Escaneo de metadatos',
      artworkArea: 'Región analizada',
      transparency: 'Transparencia y bordes',
      visualDetail: 'Detalle de trazos y textura',
      colorVariety: 'Variedad cromática',
      toolHints: 'Indicios de software creativo',
    },
    values: {
      noAiTags: 'Sin etiquetas de generadores de IA',
      aiTagsDetectedPrefix: 'Marcadores detectados:',
      reencodedNote: '(Los PNG firmados se recodifican; adjunta el PNG original si deseas revisar etiquetas del editor)',
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
    badgeLocalSignals: 'Signaux locaux analysés (référence)',
    badgeAiMetadataDetected: 'Métadonnées IA détectées (alerte)',
    badgeInconclusive: 'Non concluant (signal faible)',
    cardTitle: 'D. Analyse locale des métadonnées et pixels (Gratuit · Hors ligne)',
    cardDisclaimer:
      'Note : les pixels ou métadonnées seuls ne prouvent jamais une création 100 % manuelle. À consulter uniquement en complément de A et B.',
    outcomes: {
      'no-image': 'Aucune image chargée pour le moment. Importez un PNG signé ou l’image d’origine pour lancer l’analyse locale.',
      'insufficient-visual-signal': 'Zone trop petite (<32 px) ou trop uniforme pour extraire des signaux visuels fiables.',
      'ai-metadata-detected': 'Des marqueurs de génération par IA ont été détectés dans les métadonnées du fichier.',
      'local-signals-clean': 'Aucune métadonnée IA détectée et statistiques visuelles locales calculées (indicatif uniquement, non probant).',
    },
    labels: {
      metadataScan: 'Analyse des métadonnées',
      artworkArea: 'Zone analysée',
      transparency: 'Transparence et bords doux',
      visualDetail: 'Détail des contours et textures',
      colorVariety: 'Richesse des couleurs',
      toolHints: 'Indices de logiciel créatif',
    },
    values: {
      noAiTags: 'Aucune balise de générateur IA trouvée',
      aiTagsDetectedPrefix: 'Marqueurs détectés :',
      reencodedNote: '(Le PNG signé est réencodé ; joignez le PNG original pour inspecter les balises du logiciel de dessin)',
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
    badgeLocalSignals: 'Lokale Signale analysiert (Referenz)',
    badgeAiMetadataDetected: 'KI-Metadaten erkannt (Hinweis)',
    badgeInconclusive: 'Unklar (zu wenig Bildsignal)',
    cardTitle: 'D. Lokale Metadaten- & Pixel-Analyse (Kostenlos · Offline)',
    cardDisclaimer:
      'Hinweis: Pixel und Metadaten allein beweisen niemals zu 100 % eine reine Handzeichnung. Nur als ergänzendes Signal neben A & B verwenden.',
    outcomes: {
      'no-image': 'Noch kein Bild geladen. Laden Sie ein signiertes PNG oder das Originalbild für die lokale Prüfung.',
      'insufficient-visual-signal': 'Der Bildbereich ist sehr klein (<32 px) oder einfarbig; keine ausreichenden Signale.',
      'ai-metadata-detected': 'In den Dateimetadaten wurden Hinweise auf KI-Bildgeneratoren gefunden.',
      'local-signals-clean': 'Keine KI-Generator-Metadaten gefunden; lokale Bildstatistiken geprüft (nur Referenz, kein Beweis).',
    },
    labels: {
      metadataScan: 'Container-Metadaten-Scan',
      artworkArea: 'Geprüfter Bildbereich',
      transparency: 'Transparenz & Pinselkanten',
      visualDetail: 'Linien- & Texturdetails',
      colorVariety: 'Farbverteilung',
      toolHints: 'Hinweise auf Zeichensoftware',
    },
    values: {
      noAiTags: 'Keine KI-Generator-Metadaten gefunden',
      aiTagsDetectedPrefix: 'Erkannte Marker:',
      reencodedNote: '(Signierte PNGs werden neu kodiert; für Original-Software-Tags fügen Sie das unsignierte Original-PNG an)',
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
    badgeLocalSignals: 'Sinais locais analisados (referência)',
    badgeAiMetadataDetected: 'Metadados de IA detectados (aviso)',
    badgeInconclusive: 'Inconclusivo (pouco sinal visual)',
    cardTitle: 'D. Detalhamento local de metadados e pixels (Grátis · Offline)',
    cardDisclaimer:
      'Nota: apenas pixels e metadados não garantem autoria 100% manual. Use como sinal auxiliar junto às verificações A e B.',
    outcomes: {
      'no-image': 'Nenhuma imagem carregada ainda. Envie o PNG assinado ou a arte original para inspeção local.',
      'insufficient-visual-signal': 'Região muito pequena (<32 px) ou uniforme demais para análise visual.',
      'ai-metadata-detected': 'Foram encontrados metadados de geradores de IA no arquivo.',
      'local-signals-clean': 'Nenhum metadado de IA detectado e estatísticas visuais verificadas localmente (apenas referência).',
    },
    labels: {
      metadataScan: 'Leitura de metadados',
      artworkArea: 'Área analisada',
      transparency: 'Transparência e bordas suaves',
      visualDetail: 'Detalhes de traço e textura',
      colorVariety: 'Distribuição de cores',
      toolHints: 'Indícios de software criativo',
    },
    values: {
      noAiTags: 'Nenhum metadado de IA encontrado',
      aiTagsDetectedPrefix: 'Marcadores encontrados:',
      reencodedNote: '(PNGs assinados são recodificados; anexe o PNG original se quiser checar metadados do editor)',
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
    badgeLocalSignals: 'Segnali locali analizzati (riferimento)',
    badgeAiMetadataDetected: 'Metadati IA rilevati (avviso)',
    badgeInconclusive: 'Inconcludente (segnale scarso)',
    cardTitle: 'D. Analisi locale metadati e pixel (Gratuita · Offline)',
    cardDisclaimer:
      'Nota: pixel e metadati da soli non possono mai provare al 100% l’esecuzione a mano. Da usare solo come supporto insieme ad A e B.',
    outcomes: {
      'no-image': 'Nessuna immagine caricata. Carica un PNG firmato o l’opera originale per l’analisi locale.',
      'insufficient-visual-signal': 'Area troppo piccola (<32 px) o uniforme per un’analisi significativa.',
      'ai-metadata-detected': 'Nel file sono stati trovati metadati tipici di generatori IA.',
      'local-signals-clean': 'Nessun metadato IA rilevato; statistiche visive locali calcolate (solo riferimento, nessuna prova certa).',
    },
    labels: {
      metadataScan: 'Scansione metadati',
      artworkArea: 'Area analizzata',
      transparency: 'Trasparenza e bordi',
      visualDetail: 'Dettagli di linee e texture',
      colorVariety: 'Distribuzione cromatica',
      toolHints: 'Indizi software creativo',
    },
    values: {
      noAiTags: 'Nessun tag di generatori IA trovato',
      aiTagsDetectedPrefix: 'Indicatori trovati:',
      reencodedNote: '(I PNG firmati sono ricodificati; allega il PNG originale per controllare eventuali tag dell’editor)',
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
    badgeLocalSignals: 'تم فحص الإشارات محلياً (للاستئناس)',
    badgeAiMetadataDetected: 'تم رصد بيانات ذكاء اصطناعي (تنبيه)',
    badgeInconclusive: 'غير حاسم (تفاصيل غير كافية)',
    cardTitle: 'D. تفاصيل الفحص المحلي للبيانات الوصفية والبكسلات (مجاني · دون إنترنت)',
    cardDisclaimer:
      'تنبيه: لا يمكن للبكسلات أو البيانات الوصفية وحدها إثبات الرسم اليدوي بنسبة 100%. استخدم هذه الإشارات كمرجع مساعد بجانب A و B فقط.',
    outcomes: {
      'no-image': 'لم يتم تحميل صورة بعد. أرفق ملف PNG الموقّع أو الصورة الأصلية لتشغيل الفحص المحلي.',
      'insufficient-visual-signal': 'منطقة الصورة صغيرة جداً (<32 بكسل) أو موحدة اللون ولا تكفي للتحليل البصري.',
      'ai-metadata-detected': 'تم العثور على علامات لمولّدات صور بالذكاء الاصطناعي داخل بيانات الملف.',
      'local-signals-clean': 'لم يتم العثور على بيانات ذكاء اصطناعي، وتم فحص الإحصاءات البصرية محلياً (للمرجعية فقط وليس إثباتاً قاطعاً).',
    },
    labels: {
      metadataScan: 'فحص البيانات الوصفية للملف',
      artworkArea: 'منطقة العمل المفحوصة',
      transparency: 'الشفافية وحواف الفرشاة',
      visualDetail: 'تفاصيل الخطوط والملمس',
      colorVariety: 'تنوع الألوان',
      toolHints: 'آثار برامج الرسم',
    },
    values: {
      noAiTags: 'لم يُعثر على علامات مولّد ذكاء اصطناعي',
      aiTagsDetectedPrefix: 'العلامات المرصودة:',
      reencodedNote: '(ملفات PNG الموقّعة يُعاد ترميزها؛ أرفق الملف الأصلي إذا أردت فحص وسوم برنامج الرسم الأصلي)',
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
