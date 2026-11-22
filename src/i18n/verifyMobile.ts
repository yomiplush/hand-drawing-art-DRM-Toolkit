import type { SupportedLocale } from '../core/storage/consent';

export interface VerifyMobileTranslations {
  proofStep2Title: string;
  proofStep2Desc: string;
  pasteImageBtn: string;
  pasteBusy: string;
  pasteNoImage: string;
  pasteUnsupported: string;
  pasteHint: string;
  rawProofToggle: string;
  attachedReadyBadge: string;
  sharedImageVerifiedNote: string;
  sharedImageNoQrNote: string;
  cameraFollowUpHint: string;
}

export const VERIFY_MOBILE_I18N: Record<SupportedLocale, VerifyMobileTranslations> = {
  ja: {
    proofStep2Title: '次のステップ：作品画像を読み込んで一致を検証',
    proofStep2Desc:
      'QRコードの署名は確認できました。スマホの写真・ファイルから画像を選ぶか、画像をコピーして「クリップボードから貼り付け」を押してください。',
    pasteImageBtn: 'クリップボードから画像を貼り付け',
    pasteBusy: 'クリップボードを読み込み中…',
    pasteNoImage: 'クリップボードに画像が見つかりませんでした。画像をコピーするかファイル選択をご利用ください。',
    pasteUnsupported:
      'このブラウザではボタンからの貼り付けが制限されています。入力欄や画面上で「ペースト」するかファイル選択をご利用ください。',
    pasteHint: 'ヒント：SNSや画像ビューアで画像を長押しコピーして、そのまま貼り付けできます（Ctrl+V / ペースト対応）。',
    rawProofToggle: '読み込んだ署名URL / トークンを確認・編集する',
    attachedReadyBadge: '照合中の画像',
    sharedImageVerifiedNote: '共有された画像内のQRコードから自動検証しました',
    sharedImageNoQrNote:
      '共有画像を読み込みました（画像内にQRが見つかりませんでした）。QRコードを読み取るか署名URLを貼り付けるとピクセル一致を検証できます。',
    cameraFollowUpHint: 'QR読み取り完了！続けて作品画像を選択または貼り付けするとピクセル一致を検証できます。',
  },
  en: {
    proofStep2Title: 'Next Step: Select or Paste the Artwork Image to Verify Pixels',
    proofStep2Desc:
      'The QR signature is loaded. Choose the artwork file from Photos/Files or copy an image and tap Paste Image from Clipboard.',
    pasteImageBtn: 'Paste Image from Clipboard',
    pasteBusy: 'Reading Clipboard…',
    pasteNoImage: 'No image found in clipboard. Copy an image first or select a file.',
    pasteUnsupported:
      'Clipboard button access is blocked by this browser. Use Ctrl+V / browser Paste or choose a file instead.',
    pasteHint: 'Tip: Long-press → Copy Image in another app, then paste directly here (Ctrl+V / Paste supported).',
    rawProofToggle: 'Inspect or Edit Raw Proof URL / Token',
    attachedReadyBadge: 'Loaded Image',
    sharedImageVerifiedNote: 'Verified from shared image QR code',
    sharedImageNoQrNote:
      'Shared image loaded (no QR found inside the image). Scan or paste a proof URL to verify its SHA-256 pixels.',
    cameraFollowUpHint: 'QR proof loaded! Now select or paste the artwork image above to verify pixel integrity.',
  },
  'zh-CN': {
    proofStep2Title: '下一步：选择或粘贴作品图像以校验像素',
    proofStep2Desc:
      '二维码签名已加载。请从相册/文件选择作品图像，或在复制图像后点击“从剪贴板粘贴图像”。',
    pasteImageBtn: '从剪贴板粘贴图像',
    pasteBusy: '正在读取剪贴板…',
    pasteNoImage: '剪贴板中未找到图像。请先复制图像或选择文件。',
    pasteUnsupported: '当前浏览器限制按钮读取剪贴板，请直接使用 Ctrl+V / 粘贴或选择文件。',
    pasteHint: '提示：在其他应用中长按复制图像后，可直接在此粘贴（支持 Ctrl+V / 粘贴）。',
    rawProofToggle: '查看或编辑原始证明 URL / 令牌',
    attachedReadyBadge: '已加载图像',
    sharedImageVerifiedNote: '已从分享图像的二维码自动完成验证',
    sharedImageNoQrNote:
      '已加载分享图像（未检测到内嵌二维码）。请扫码或粘贴验证 URL 以比对 SHA-256 像素。',
    cameraFollowUpHint: '二维码读取成功！请继续选择或粘贴作品图像以验证像素一致性。',
  },
  'zh-TW': {
    proofStep2Title: '下一步：選擇或貼上作品圖片以驗證像素',
    proofStep2Desc:
      '已載入 QR 簽章。請從相簿／檔案選擇作品圖片，或在複製圖片後點擊「從剪貼簿貼上圖片」。',
    pasteImageBtn: '從剪貼簿貼上圖片',
    pasteBusy: '正在讀取剪貼簿…',
    pasteNoImage: '剪貼簿中找不到圖片。請先複製圖片或改用檔案選擇。',
    pasteUnsupported: '此瀏覽器限制按鈕讀取剪貼簿，請使用 Ctrl+V / 貼上或選擇檔案。',
    pasteHint: '提示：在其他應用程式長按複製圖片後，可直接在此貼上（支援 Ctrl+V / 貼上）。',
    rawProofToggle: '檢視或編輯原始驗證 URL / 權杖',
    attachedReadyBadge: '已載入圖片',
    sharedImageVerifiedNote: '已透過分享圖片中的 QR 碼完成自動驗證',
    sharedImageNoQrNote:
      '已載入分享圖片（圖片內未找到 QR 碼）。請掃描或貼上驗證 URL 以比對 SHA-256 像素。',
    cameraFollowUpHint: 'QR 掃描成功！請繼續選擇或貼上作品圖片以驗證像素完整性。',
  },
  ko: {
    proofStep2Title: '다음 단계: 작품 이미지를 선택하거나 붙여넣어 픽셀 검증',
    proofStep2Desc:
      'QR 서명이 로드되었습니다. 사진/파일에서 작품 이미지를 선택하거나 이미지를 복사한 뒤 클립보드에서 붙여넣기를 누르세요.',
    pasteImageBtn: '클립보드에서 이미지 붙여넣기',
    pasteBusy: '클립보드 읽는 중…',
    pasteNoImage: '클립보드에 이미지가 없습니다. 먼저 이미지를 복사하거나 파일을 선택하세요.',
    pasteUnsupported:
      '이 브라우저에서는 버튼으로 클립보드 읽기가 제한됩니다. Ctrl+V / 붙여넣기 또는 파일 선택을 이용하세요.',
    pasteHint: '팁: 다른 앱에서 이미지를 길게 눌러 복사한 뒤 여기에 바로 붙여넣을 수 있습니다 (Ctrl+V 지원).',
    rawProofToggle: '원본 검증 URL / 토큰 보기 및 편집',
    attachedReadyBadge: '불러온 이미지',
    sharedImageVerifiedNote: '공유된 이미지 내 QR 코드로 자동 검증됨',
    sharedImageNoQrNote:
      '공유 이미지가 로드되었습니다 (이미지 내 QR 없음). QR을 스캔하거나 증명 URL을 붙여넣어 SHA-256을 비교하세요.',
    cameraFollowUpHint: 'QR 코드 인식 완료! 위에서 작품 이미지를 선택하거나 붙여넣어 픽셀 일치 여부를 확인하세요.',
  },
  ru: {
    proofStep2Title: 'Следующий шаг: выберите или вставьте изображение работы',
    proofStep2Desc:
      'Подпись из QR-кода загружена. Выберите файл из галереи/файлов или скопируйте картинку и нажмите «Вставить из буфера».',
    pasteImageBtn: 'Вставить изображение из буфера',
    pasteBusy: 'Чтение буфера обмена…',
    pasteNoImage: 'В буфере обмена нет изображения. Сначала скопируйте картинку или выберите файл.',
    pasteUnsupported:
      'Браузер ограничивает доступ к буферу по кнопке. Используйте Ctrl+V / Вставить или выберите файл.',
    pasteHint: 'Совет: скопируйте изображение в другом приложении и вставьте его прямо сюда (Ctrl+V).',
    rawProofToggle: 'Показать или изменить исходный URL / токен',
    attachedReadyBadge: 'Загруженное изображение',
    sharedImageVerifiedNote: 'Проверено по QR-коду из переданного изображения',
    sharedImageNoQrNote:
      'Изображение загружено (QR-код внутри не найден). Отсканируйте QR или вставьте URL для сверки SHA-256.',
    cameraFollowUpHint: 'QR-код считан! Выберите или вставьте изображение работы выше для проверки пикселей.',
  },
  uk: {
    proofStep2Title: 'Наступний крок: оберіть або вставте зображення твору',
    proofStep2Desc:
      'Підпис із QR-коду завантажено. Оберіть файл із галереї або скопіюйте картинку й натисніть «Вставити з буфера».',
    pasteImageBtn: 'Вставити зображення з буфера',
    pasteBusy: 'Читання буфера обміну…',
    pasteNoImage: 'У буфері обміну не знайдено зображення. Спочатку скопіюйте картинку або оберіть файл.',
    pasteUnsupported:
      'Браузер обмежує доступ до буфера за кнопкою. Використайте Ctrl+V / Вставити або оберіть файл.',
    pasteHint: 'Порада: скопіюйте зображення в іншому застосунку та вставте його сюди (підтримується Ctrl+V).',
    rawProofToggle: 'Показати або змінити вихідний URL / токен',
    attachedReadyBadge: 'Завантажене зображення',
    sharedImageVerifiedNote: 'Перевірено за QR-кодом у переданому зображенні',
    sharedImageNoQrNote:
      'Зображення завантажено (QR-код усередині не знайдено). Відскануйте QR або вставте URL для звірки SHA-256.',
    cameraFollowUpHint: 'QR-код зчитано! Оберіть або вставте зображення твору вище для перевірки пікселів.',
  },
  es: {
    proofStep2Title: 'Siguiente paso: selecciona o pega la imagen para verificar los píxeles',
    proofStep2Desc:
      'La firma del QR está cargada. Elige la imagen desde Fotos/Archivos o cópiala y pulsa «Pegar imagen del portapapeles».',
    pasteImageBtn: 'Pegar imagen del portapapeles',
    pasteBusy: 'Leyendo portapapeles…',
    pasteNoImage: 'No hay ninguna imagen en el portapapeles. Copia una imagen o elige un archivo.',
    pasteUnsupported:
      'El navegador bloquea el acceso al portapapeles desde el botón. Usa Ctrl+V / Pegar o selecciona un archivo.',
    pasteHint: 'Consejo: copia una imagen en otra app y pégala directamente aquí (compatible con Ctrl+V).',
    rawProofToggle: 'Ver o editar URL / token de prueba',
    attachedReadyBadge: 'Imagen cargada',
    sharedImageVerifiedNote: 'Verificado desde el QR de la imagen compartida',
    sharedImageNoQrNote:
      'Imagen compartida cargada (sin QR dentro). Escanea o pega la URL de prueba para comparar sus píxeles SHA-256.',
    cameraFollowUpHint: '¡QR leído! Selecciona o pega arriba la imagen de la obra para verificar los píxeles.',
  },
  fr: {
    proofStep2Title: 'Étape suivante : sélectionnez ou collez l’image pour vérifier les pixels',
    proofStep2Desc:
      'La signature du QR est chargée. Choisissez l’image dans vos fichiers/photos ou copiez-la et appuyez sur « Coller l’image ».',
    pasteImageBtn: 'Coller l’image du presse-papiers',
    pasteBusy: 'Lecture du presse-papiers…',
    pasteNoImage: 'Aucune image trouvée dans le presse-papiers. Copiez une image ou choisissez un fichier.',
    pasteUnsupported:
      'Ce navigateur bloque l’accès au presse-papiers par bouton. Utilisez Ctrl+V / Coller ou choisissez un fichier.',
    pasteHint: 'Astuce : copiez une image depuis une autre application et collez-la ici (Ctrl+V pris en charge).',
    rawProofToggle: 'Afficher ou modifier l’URL / le jeton brut',
    attachedReadyBadge: 'Image chargée',
    sharedImageVerifiedNote: 'Vérifié via le QR code de l’image partagée',
    sharedImageNoQrNote:
      'Image partagée chargée (aucun QR détecté dedans). Scannez ou collez une URL de preuve pour comparer les pixels SHA-256.',
    cameraFollowUpHint: 'QR lu ! Sélectionnez ou collez l’image ci-dessus pour vérifier les pixels.',
  },
  de: {
    proofStep2Title: 'Nächster Schritt: Bild auswählen oder einfügen, um Pixel zu prüfen',
    proofStep2Desc:
      'Die QR-Signatur ist geladen. Wähle die Bilddatei aus Fotos/Dateien oder kopiere ein Bild und tippe auf „Aus Zwischenablage einfügen“.',
    pasteImageBtn: 'Bild aus Zwischenablage einfügen',
    pasteBusy: 'Zwischenablage wird gelesen…',
    pasteNoImage: 'Kein Bild in der Zwischenablage gefunden. Kopiere zuerst ein Bild oder wähle eine Datei.',
    pasteUnsupported:
      'Dieser Browser blockiert den Schaltflächenzugriff. Nutze Strg+V / Einfügen oder wähle eine Datei.',
    pasteHint: 'Tipp: Bild in einer anderen App kopieren und direkt hier einfügen (Strg+V unterstützt).',
    rawProofToggle: 'Rohe Prüf-URL / Token anzeigen oder bearbeiten',
    attachedReadyBadge: 'Geladenes Bild',
    sharedImageVerifiedNote: 'Über QR-Code im geteilten Bild verifiziert',
    sharedImageNoQrNote:
      'Geteiltes Bild geladen (kein QR enthalten). Scanne oder füge eine Prüf-URL ein, um SHA-256 zu vergleichen.',
    cameraFollowUpHint: 'QR erkannt! Wähle oder füge oben das Bild ein, um die Pixel zu prüfen.',
  },
  pt: {
    proofStep2Title: 'Próximo passo: selecione ou cole a imagem para verificar os pixels',
    proofStep2Desc:
      'A assinatura do QR foi carregada. Escolha a imagem em Fotos/Arquivos ou copie a imagem e toque em «Colar imagem da área de transferência».',
    pasteImageBtn: 'Colar imagem da área de transferência',
    pasteBusy: 'Lendo área de transferência…',
    pasteNoImage: 'Nenhuma imagem encontrada na área de transferência. Copie uma imagem ou escolha um arquivo.',
    pasteUnsupported:
      'O navegador bloqueia o acesso pelo botão. Use Ctrl+V / Colar ou selecione um arquivo.',
    pasteHint: 'Dica: copie uma imagem em outro app e cole diretamente aqui (suporta Ctrl+V).',
    rawProofToggle: 'Ver ou editar URL / token bruto',
    attachedReadyBadge: 'Imagem carregada',
    sharedImageVerifiedNote: 'Verificado pelo QR code da imagem compartilhada',
    sharedImageNoQrNote:
      'Imagem compartilhada carregada (sem QR interno). Escaneie ou cole uma URL de prova para comparar os pixels SHA-256.',
    cameraFollowUpHint: 'QR lido! Selecione ou cole a imagem acima para verificar a integridade dos pixels.',
  },
  it: {
    proofStep2Title: 'Prossimo passo: seleziona o incolla l’immagine per verificare i pixel',
    proofStep2Desc:
      'La firma del QR è caricata. Scegli l’immagine da Foto/File oppure copiala e tocca «Incolla immagine dagli appunti».',
    pasteImageBtn: 'Incolla immagine dagli appunti',
    pasteBusy: 'Lettura degli appunti…',
    pasteNoImage: 'Nessuna immagine trovata negli appunti. Copia un’immagine o seleziona un file.',
    pasteUnsupported:
      'Il browser blocca l’accesso dal pulsante. Usa Ctrl+V / Incolla o seleziona un file.',
    pasteHint: 'Suggerimento: copia un’immagine da un’altra app e incollala qui (supporta Ctrl+V).',
    rawProofToggle: 'Mostra o modifica URL / token grezzo',
    attachedReadyBadge: 'Immagine caricata',
    sharedImageVerifiedNote: 'Verificato dal codice QR nell’immagine condivisa',
    sharedImageNoQrNote:
      'Immagine condivisa caricata (nessun QR trovato). Scansiona o incolla un URL di prova per confrontare i pixel SHA-256.',
    cameraFollowUpHint: 'QR letto! Seleziona o incolla l’immagine qui sopra per verificare i pixel.',
  },
  ar: {
    proofStep2Title: 'الخطوة التالية: اختر صورة العمل الفني أو الصقها للتحقق من البكسلات',
    proofStep2Desc:
      'تم تحميل توقيع QR. اختر الصورة من الصور/الملفات أو انسخ صورة واضغط «لصق صورة من الحافظة».',
    pasteImageBtn: 'لصق صورة من الحافظة',
    pasteBusy: 'جارٍ قراءة الحافظة…',
    pasteNoImage: 'لم يتم العثور على صورة في الحافظة. انسخ صورة أولاً أو اختر ملفًا.',
    pasteUnsupported:
      'يقيّد هذا المتصفح الوصول عبر الزر. استخدم Ctrl+V / لصق أو اختر ملفًا بدلاً من ذلك.',
    pasteHint: 'تلميح: انسخ صورة من أي تطبيق آخر ثم الصقها هنا مباشرة (يدعم Ctrl+V).',
    rawProofToggle: 'عرض أو تعديل رابط / رمز الإثبات الخام',
    attachedReadyBadge: 'الصورة المحمّلة',
    sharedImageVerifiedNote: 'تم التحقق عبر رمز QR في الصورة المشتركة',
    sharedImageNoQrNote:
      'تم تحميل الصورة المشتركة (لا يوجد رمز QR داخلها). امسح رمز QR أو الصق رابط الإثبات لمقارنة بكسلات SHA-256.',
    cameraFollowUpHint: 'تمت قراءة QR! اختر صورة العمل الفني أو الصقها أعلاه للتحقق من البكسلات.',
  },
};
