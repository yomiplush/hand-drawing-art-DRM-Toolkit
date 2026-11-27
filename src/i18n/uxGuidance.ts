import type { SupportedLocale } from '../core/storage/consent';

export interface UxGuidanceTranslations {
  snsRecompression: {
    createTitle: string;
    createBody: string;
    verifyTitle: string;
    verifyBody: string;
  };
  qrReadability: {
    tooSmallWarning: string;
    lowContrastWarning: string;
    moduleSizeLabel: string;
    contrastRatioLabel: string;
  };
}

export const UX_GUIDANCE_I18N: Record<SupportedLocale, UxGuidanceTranslations> = {
  en: {
    snsRecompression: {
      createTitle: 'Best for original PNG distribution',
      createBody:
        'Uploading directly to social platforms (X, Instagram, Discord, etc.) usually recompresses or resizes images, which breaks exact RGBA8 pixel-integrity verification. Share the original exported PNG directly for full verification.',
      verifyTitle: 'Note on social-media recompression',
      verifyBody:
        'Images downloaded from social platforms (X, Instagram, Discord, etc.) are often recompressed or resized, which will cause strict RGBA8 Artwork Integrity checks to report a mismatch. Use the original PNG file whenever possible.',
    },
    qrReadability: {
      tooSmallWarning:
        'QR modules are smaller than 2 px each and may fail to scan on cameras. Increase the QR box size or click Optimize QR Size.',
      lowContrastWarning:
        'Contrast between the QR modules and artwork background is low (< 3.0:1). Increase opacity, switch to a frosted backdrop style, or move the QR to a more uniform area.',
      moduleSizeLabel: 'Module size',
      contrastRatioLabel: 'Contrast',
    },
  },
  ja: {
    snsRecompression: {
      createTitle: 'オリジナルPNG配布向け',
      createBody:
        'X・Instagram・Discord などのSNSへ直接アップロードすると再圧縮やリサイズが行われ、厳密な RGBA8 ピクセル一致（Artwork Integrity）の検証が壊れます。完全な検証には書き出したオリジナルPNGをそのまま配布してください。',
      verifyTitle: 'SNS再圧縮に関するご注意',
      verifyBody:
        'X・Instagram・Discord などのSNSから保存した画像は再圧縮・リサイズされていることが多く、厳密な RGBA8 ピクセル一致検証が不一致になります。可能な限りオリジナルのPNGファイルをご使用ください。',
    },
    qrReadability: {
      tooSmallWarning:
        'QRの1モジュールが 2px 未満と小さすぎるため、カメラでの読み取りに失敗しやすくなります。QRサイズを大きくするか「サイズ最適化」をお試しください。',
      lowContrastWarning:
        'QRモジュールと背景のコントラストが低め（3.0:1 未満）です。不透明度を上げるか「すりガラス」系スタイルへの変更、背景が均一な位置への移動をおすすめします。',
      moduleSizeLabel: 'モジュール幅',
      contrastRatioLabel: 'コントラスト比',
    },
  },
  'zh-CN': {
    snsRecompression: {
      createTitle: '适用于原始 PNG 分发',
      createBody:
        '直接上传到社交平台（X、Instagram、Discord 等）通常会重新压缩或缩放图像，从而破坏严格的 RGBA8 像素完整性验证。请直接分发导出的原始 PNG 文件以获得完整验证。',
      verifyTitle: '关于社交平台重新压缩的提示',
      verifyBody:
        '从社交平台（X、Instagram、Discord 等）下载的图片通常经过重新压缩或缩放，会导致严格的 RGBA8 像素完整性检查不匹配。请尽量使用原始 PNG 文件。',
    },
    qrReadability: {
      tooSmallWarning:
        '二维码单个模块小于 2 像素，相机可能难以识别。请增大二维码尺寸或点击“优化二维码尺寸”。',
      lowContrastWarning:
        '二维码模块与背景的对比度较低（低于 3.0:1）。请提高不透明度、切换为磨砂底色样式，或将其移至背景更均匀的区域。',
      moduleSizeLabel: '模块大小',
      contrastRatioLabel: '对比度',
    },
  },
  'zh-TW': {
    snsRecompression: {
      createTitle: '適用於原始 PNG 分發',
      createBody:
        '直接上傳至社群平台（X、Instagram、Discord 等）通常會重新壓縮或縮放圖片，進而破壞嚴格的 RGBA8 像素完整性驗證。請直接分發匯出的原始 PNG 檔案以確保完整驗證。',
      verifyTitle: '關於社群平台重新壓縮的提示',
      verifyBody:
        '從社群平台（X、Instagram、Discord 等）下載的圖片常經過重新壓縮或縮放，會導致嚴格的 RGBA8 像素完整性檢查不符。請盡量使用原始 PNG 檔案。',
    },
    qrReadability: {
      tooSmallWarning:
        'QR 單一模組小於 2 像素，相機可能難以掃描。請調大 QR 尺寸或點擊「最佳化 QR 尺寸」。',
      lowContrastWarning:
        'QR 模組與背景的對比度偏低（低於 3.0:1）。請提高不透明度、改用霧面底色樣式，或移至背景較均勻的區域。',
      moduleSizeLabel: '模組大小',
      contrastRatioLabel: '對比度',
    },
  },
  ko: {
    snsRecompression: {
      createTitle: '원본 PNG 배포용 안내',
      createBody:
        'X, Instagram, Discord 등 SNS에 직접 업로드하면 재압축이나 리사이즈가 발생해 엄격한 RGBA8 픽셀 무결성 검증이 깨집니다. 완전한 검증을 위해 내보낸 원본 PNG를 그대로 배포해 주세요.',
      verifyTitle: 'SNS 재압축 안내',
      verifyBody:
        'X, Instagram, Discord 등 SNS에서 저장한 이미지는 재압축되거나 크기가 변경되어 엄격한 RGBA8 픽셀 일치 검증이 불일치로 표시될 수 있습니다. 가급적 원본 PNG 파일을 사용해 주세요.',
    },
    qrReadability: {
      tooSmallWarning:
        'QR 모듈 크기가 2px 미만으로 너무 작아 카메라 인식이 실패할 수 있습니다. QR 크기를 키우거나 크기 최적화를 사용해 주세요.',
      lowContrastWarning:
        'QR 모듈과 배경 간의 대비가 낮습니다(3.0:1 미만). 불투명도를 높이거나 반투명 배경 스타일을 선택하거나 배경이 균일한 위치로 옮겨 주세요.',
      moduleSizeLabel: '모듈 크기',
      contrastRatioLabel: '대비율',
    },
  },
  ru: {
    snsRecompression: {
      createTitle: 'Для распространения оригинального PNG',
      createBody:
        'Прямая загрузка в соцсети (X, Instagram, Discord и др.) обычно пересжимает или масштабирует изображение, нарушая строгую проверку целостности пикселей RGBA8. Для полной проверки передавайте оригинальный PNG.',
      verifyTitle: 'Замечание о пересжатии в соцсетях',
      verifyBody:
        'Изображения, скачанные из соцсетей (X, Instagram, Discord и др.), часто пересжаты или изменены по размеру, из-за чего строгая проверка RGBA8 покажет несовпадение. По возможности используйте оригинальный PNG.',
    },
    qrReadability: {
      tooSmallWarning:
        'Модули QR меньше 2 пикс. и могут плохо считываться камерой. Увеличьте размер QR-кода или нажмите «Оптимизировать размер».',
      lowContrastWarning:
        'Низкий контраст между модулями QR и фоном (< 3.0:1). Увеличьте непрозрачность, выберите матовую подложку или переместите QR на более однородный участок.',
      moduleSizeLabel: 'Размер модуля',
      contrastRatioLabel: 'Контраст',
    },
  },
  uk: {
    snsRecompression: {
      createTitle: 'Для поширення оригінального PNG',
      createBody:
        'Пряме завантаження у соцмережі (X, Instagram, Discord тощо) зазвичай перестискає або масштабує зображення, порушуючи сувору перевірку цілісності пікселів RGBA8. Для повної перевірки діліться оригінальним PNG.',
      verifyTitle: 'Примітка щодо перестиснення в соцмережах',
      verifyBody:
        'Зображення, завантажені із соцмереж (X, Instagram, Discord тощо), часто перестиснуті або змінені за розміром, через що сувора перевірка RGBA8 покаже невідповідність. За можливості використовуйте оригінальний PNG.',
    },
    qrReadability: {
      tooSmallWarning:
        'Модулі QR менші за 2 пікс. і можуть погано зчитуватися камерою. Збільште розмір QR або натисніть «Оптимізувати розмір».',
      lowContrastWarning:
        'Низький контраст між модулями QR і фоном (< 3.0:1). Підвищте непрозорість, оберіть матову підкладку або перемістіть QR на більш однорідну ділянку.',
      moduleSizeLabel: 'Розмір модуля',
      contrastRatioLabel: 'Контраст',
    },
  },
  es: {
    snsRecompression: {
      createTitle: 'Ideal para distribución del PNG original',
      createBody:
        'Subir directamente a redes sociales (X, Instagram, Discord, etc.) suele recomprimir o redimensionar la imagen, rompiendo la verificación exacta de píxeles RGBA8. Comparte el PNG original exportado para una verificación completa.',
      verifyTitle: 'Nota sobre la recompresión en redes sociales',
      verifyBody:
        'Las imágenes descargadas de redes sociales (X, Instagram, Discord, etc.) suelen estar recomprimidas o redimensionadas, lo que provocará un fallo en la verificación estricta de integridad RGBA8. Usa el PNG original siempre que sea posible.',
    },
    qrReadability: {
      tooSmallWarning:
        'Los módulos del QR miden menos de 2 px y pueden fallar al escanear. Aumenta el tamaño del QR o pulsa Optimizar tamaño.',
      lowContrastWarning:
        'El contraste entre los módulos del QR y el fondo es bajo (< 3.0:1). Aumenta la opacidad, usa un fondo esmerilado o mueve el QR a una zona más uniforme.',
      moduleSizeLabel: 'Tamaño de módulo',
      contrastRatioLabel: 'Contraste',
    },
  },
  fr: {
    snsRecompression: {
      createTitle: 'Conçu pour la diffusion du PNG original',
      createBody:
        'Le téléversement direct sur les réseaux sociaux (X, Instagram, Discord, etc.) recompresse ou redimensionne généralement l’image, ce qui rompt la vérification exacte des pixels RGBA8. Partagez le PNG original exporté pour une vérification complète.',
      verifyTitle: 'Remarque sur la recompression des réseaux sociaux',
      verifyBody:
        'Les images téléchargées depuis les réseaux sociaux (X, Instagram, Discord, etc.) sont souvent recompressées ou redimensionnées, entraînant un échec de l’intégrité RGBA8 stricte. Utilisez le fichier PNG original dès que possible.',
    },
    qrReadability: {
      tooSmallWarning:
        'Les modules QR font moins de 2 px et risquent de mal se scanner. Agrandissez le QR ou utilisez Optimiser la taille.',
      lowContrastWarning:
        'Le contraste entre les modules QR et l’arrière-plan est faible (< 3.0:1). Augmentez l’opacité, choisissez un fond dépoli ou déplacez le QR sur une zone plus uniforme.',
      moduleSizeLabel: 'Taille du module',
      contrastRatioLabel: 'Contraste',
    },
  },
  de: {
    snsRecompression: {
      createTitle: 'Für die Weitergabe der Original-PNG gedacht',
      createBody:
        'Direktes Hochladen auf soziale Plattformen (X, Instagram, Discord usw.) komprimiert oder skaliert Bilder meist neu und zerstört damit die exakte RGBA8-Pixelprüfung. Teile für eine vollständige Prüfung die exportierte Original-PNG.',
      verifyTitle: 'Hinweis zur Neukomprimierung in sozialen Netzwerken',
      verifyBody:
        'Bilder aus sozialen Netzwerken (X, Instagram, Discord usw.) sind oft neu komprimiert oder skaliert, sodass die strenge RGBA8-Integritätsprüfung fehlschlägt. Verwende möglichst die Original-PNG-Datei.',
    },
    qrReadability: {
      tooSmallWarning:
        'Die QR-Module sind kleiner als 2 px und könnten schwer scanbar sein. Vergrößere die QR-Box oder nutze „QR-Größe optimieren“.',
      lowContrastWarning:
        'Der Kontrast zwischen QR-Modulen und Hintergrund ist gering (< 3.0:1). Erhöhe die Deckkraft, wähle einen matten Hintergrundstil oder verschiebe den QR-Code auf eine ruhigere Fläche.',
      moduleSizeLabel: 'Modulgröße',
      contrastRatioLabel: 'Kontrast',
    },
  },
  pt: {
    snsRecompression: {
      createTitle: 'Ideal para distribuição do PNG original',
      createBody:
        'Enviar diretamente para redes sociais (X, Instagram, Discord etc.) normalmente recomprime ou redimensiona a imagem, quebrando a verificação exata de pixels RGBA8. Compartilhe o PNG original exportado para verificação completa.',
      verifyTitle: 'Nota sobre recompressão em redes sociais',
      verifyBody:
        'Imagens baixadas de redes sociais (X, Instagram, Discord etc.) costumam ser recomprimidas ou redimensionadas, fazendo a verificação estrita de integridade RGBA8 falhar. Use o arquivo PNG original sempre que possível.',
    },
    qrReadability: {
      tooSmallWarning:
        'Os módulos do QR têm menos de 2 px e podem falhar na leitura. Aumente o tamanho do QR ou clique em Otimizar tamanho.',
      lowContrastWarning:
        'O contraste entre os módulos do QR e o fundo está baixo (< 3.0:1). Aumente a opacidade, use um estilo fosco ou mova o QR para uma área mais uniforme.',
      moduleSizeLabel: 'Tamanho do módulo',
      contrastRatioLabel: 'Contraste',
    },
  },
  it: {
    snsRecompression: {
      createTitle: 'Ideale per la distribuzione del PNG originale',
      createBody:
        'Il caricamento diretto sui social (X, Instagram, Discord, ecc.) di solito ricomprime o ridimensiona l’immagine, compromettendo la verifica esatta dei pixel RGBA8. Condividi il PNG originale esportato per una verifica completa.',
      verifyTitle: 'Nota sulla ricompressione dei social',
      verifyBody:
        'Le immagini scaricate dai social (X, Instagram, Discord, ecc.) sono spesso ricompresse o ridimensionate, causando una mancata corrispondenza nella verifica RGBA8. Usa il file PNG originale quando possibile.',
    },
    qrReadability: {
      tooSmallWarning:
        'I moduli del QR sono più piccoli di 2 px e potrebbero non essere scansionati correttamente. Aumenta la dimensione del QR o usa Ottimizza dimensione.',
      lowContrastWarning:
        'Il contrasto tra i moduli del QR e lo sfondo è basso (< 3.0:1). Aumenta l’opacità, scegli uno stile satinato o sposta il QR su un’area più uniforme.',
      moduleSizeLabel: 'Dimensione modulo',
      contrastRatioLabel: 'Contrasto',
    },
  },
  ar: {
    snsRecompression: {
      createTitle: 'مخصص لتوزيع ملف PNG الأصلي',
      createBody:
        'عادةً ما يؤدي الرفع المباشر إلى منصات التواصل (X وInstagram وDiscord وغيرها) إلى إعادة ضغط الصورة أو تغيير حجمها، مما يكسر التحقق الدقيق من بكسلات RGBA8. شارك ملف PNG الأصلي المصدَّر للتحقق الكامل.',
      verifyTitle: 'ملاحظة حول إعادة الضغط في منصات التواصل',
      verifyBody:
        'غالبًا ما تكون الصور المحمّلة من منصات التواصل (X وInstagram وDiscord وغيرها) معاد ضغطها أو تغيير حجمها، مما يؤدي إلى عدم تطابق فحص سلامة RGBA8 الدقيق. استخدم ملف PNG الأصلي كلما أمكن.',
    },
    qrReadability: {
      tooSmallWarning:
        'حجم وحدات رمز QR أصغر من 2 بكسل وقد يصعب مسحه بالكاميرا. قم بزيادة حجم الرمز أو اضغط على تحسين الحجم.',
      lowContrastWarning:
        'التباين بين وحدات رمز QR والخلفية منخفض (أقل من 3.0:1). ارفع درجة التعتيم أو اختر خلفية ضبابية أو انقل الرمز إلى منطقة أكثر تجانسًا.',
      moduleSizeLabel: 'حجم الوحدة',
      contrastRatioLabel: 'التباين',
    },
  },
};
