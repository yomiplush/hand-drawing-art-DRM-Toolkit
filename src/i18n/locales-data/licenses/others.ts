import type { LicenseGuideTranslations } from '../../licenses';

export const ZH_CN: LicenseGuideTranslations = {
  guideTitle: '作品许可与权利说明',
  guideSubtitle: '可写入 QR 证书的 8 种版权许可与补充声明选项（商用/转发/AI 训练）说明。',
  selectedLabel: '当前所选许可的含义',
  appLicenseTitle: '本工具软件许可证（MIT License）',
  appLicenseBody:
    'Certified Handmade 工具本身采用 MIT 开源协议；您创作的作品版权完全属于您自己，遵循您所选择的许可条款。',
  signalGuideTitle: '商用、再分发与 AI 训练偏好信号',
  signalGuideBody:
    '若不确定如何选择，可保持默认的 All Rights Reserved。知识共享 (CC) 条款全球通用；下方的偏好设置会将作者声明写入签名数据中，但不构成技术封锁，具体法律效力因地区而异。',
  badges: {
    commercialYes: '允许商用',
    commercialNo: '禁止商用',
    derivativesYes: '允许改编',
    derivativesNo: '禁止改编',
    shareAlikeYes: '须相同方式共享',
    attributionYes: '须署名作者',
    attributionNo: '无需署名',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved（保留所有权利·默认）',
      summary: '最严格保护。未经您的明确许可，任何人均不得复制、转发、出售或修改您的作品。',
    },
    'CC0-1.0': {
      name: 'CC0 1.0（公有领域贡献）',
      summary: '在法律允许的最大范围内放弃著作权，任何人均可免署名、可商用、可修改地自由使用。',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0（署名即可使用）',
      summary: '只要正确署名作者，任何人均可转发、改编并用于商业用途。',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0（署名—相同方式共享）',
      summary: '署名后允许商用与改编，但基于本作品的衍生创作也必须采用 CC BY-SA 4.0 许可公开。',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0（署名—非商业性使用）',
      summary: '署名后允许非商业性的转发与二次创作，禁止用于任何营利或商业用途。',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0（署名—非商业性—相同方式共享）',
      summary: '署名后仅限非商业性使用与改编，且衍生作品必须继续采用 CC BY-NC-SA 4.0。',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0（署名—禁止演绎）',
      summary: '署名后允许按原样转发共享（包括商用），但不得发布修改或剪辑后的衍生版本。',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0（署名—非商业性—禁止演绎）',
      summary: '最严格的 CC 许可：仅限署名后在非商业场景下按原样完整传播。',
    },
  },
};

export const ZH_TW: LicenseGuideTranslations = {
  guideTitle: '作品授權與權利說明',
  guideSubtitle: '可寫入 QR 憑證的 8 種版權授權與補充意向（商用／轉載／AI 訓練）的白話說明。',
  selectedLabel: '目前所選授權的含義',
  appLicenseTitle: '本工具軟體授權（MIT License）',
  appLicenseBody:
    'Certified Handmade 軟體本身採用 MIT 開源授權；您的畫作權利完全歸屬於您，依您選定的條款為準。',
  signalGuideTitle: '商業用途、再散佈與 AI 訓練偏好訊號',
  signalGuideBody:
    '若不確定如何選擇，維持預設的 All Rights Reserved 即可。創用 CC (CC) 為國際標準條款；下方選項會在簽章中記錄作者意向，但不具技術強制封鎖效力，法律效力視各國法規而定。',
  badges: {
    commercialYes: '允許商業用途',
    commercialNo: '禁止商業用途',
    derivativesYes: '允許改作',
    derivativesNo: '禁止改作',
    shareAlikeYes: '須相同方式分享',
    attributionYes: '須標示姓名',
    attributionNo: '無須標示姓名',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved（保留一切權利·預設）',
      summary: '最嚴謹的保護。未經您另外明確授權，任何人皆不得轉載、販售、修改或商業使用您的作品。',
    },
    'CC0-1.0': {
      name: 'CC0 1.0（公眾領域貢獻）',
      summary: '在法律允許的最大範圍內拋棄著作財產權，任何人皆可無須署名自由使用、改作與商用。',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0（姓名標示）',
      summary: '只要依規定標示您的作者姓名，任何人皆可分享、改作並作商業使用。',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0（姓名標示—相同方式分享）',
      summary: '標示姓名後可商用與改作，但衍生的改作作品也必須以相同的 CC BY-SA 4.0 釋出。',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0（姓名標示—非商業性）',
      summary: '標示姓名後可供非營利分享與二創，但嚴禁任何販售或商業獲利用途。',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0（姓名標示—非商業性—相同方式分享）',
      summary: '標示姓名後僅限非營利使用與改作，且衍生作品同樣必須採用 CC BY-NC-SA 4.0。',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0（姓名標示—禁止改作）',
      summary: '標示姓名後可依原樣轉載分享（含商業場合），但不得散佈經裁切、編輯或改作的版本。',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0（姓名標示—非商業性—禁止改作）',
      summary: '最嚴格的 CC 授權：僅限標示姓名後於非商業場合原封不動分享。',
    },
  },
};

export const KO: LicenseGuideTranslations = {
  guideTitle: '작품 라이선스 및 권리 안내',
  guideSubtitle: 'QR 인증서에 기록되는 8가지 라이선스와 추가 의사표시(상업적 이용·재배포·AI 학습)에 대한 쉬운 설명입니다.',
  selectedLabel: '선택한 라이선스 요약',
  appLicenseTitle: '도구 소프트웨어 라이선스 (MIT License)',
  appLicenseBody:
    'Certified Handmade 앱 자체는 MIT 오픈소스 라이선스입니다. 그려진 작품의 권리는 선택한 라이선스에 따라 100% 작가에게 있습니다.',
  signalGuideTitle: '상업적 이용 · 재배포 · AI 학습 의사표시',
  signalGuideBody:
    '잘 모르겠다면 기본값인 All Rights Reserved를 그대로 사용하세요. Creative Commons(CC)는 국제 표준 약관이며, 아래 AI 학습 거부 등의 선택은 서명 데이터에 작가의 의사를 기록하는 표시입니다(기술적 차단이나 법적 보장은 지역에 따라 다름).',
  badges: {
    commercialYes: '상업적 이용: 허용',
    commercialNo: '상업적 이용: 금지',
    derivativesYes: '수정/2차 창작: 허용',
    derivativesNo: '수정/변경: 금지',
    shareAlikeYes: '동일조건변경허락',
    attributionYes: '출처 표기 필수',
    attributionNo: '출처 표기 불필요',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (모든 권리 보유 · 기본값)',
      summary:
        '가장 보편적인 보호 설정입니다. 작가의 별도 허락 없이 무단 복제, 재배포, 판매, 수정을 모두 금지합니다.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (퍼블릭 도메인 기증)',
      summary:
        '법이 허용하는 최대 범위로 저작권을 포기하여 출처 표기 없이도 누구나 상업적 이용 및 수정이 가능합니다.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (저작자표시)',
      summary:
        '작가 이름(출처)을 올바르게 표기하면 상업적 이용과 2차 수정을 포함해 누구나 자유롭게 이용할 수 있습니다.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (저작자표시-동일조건변경허락)',
      summary:
        '출처 표기 시 상업적 이용과 수정이 가능하지만, 수정한 2차 저작물도 반드시 같은 CC BY-SA 4.0으로 공개해야 합니다.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (저작자표시-비영리)',
      summary:
        '출처를 밝히면 비영리 목적의 공유와 2차 창작은 가능하지만, 판매나 수익 창출 등 상업적 이용은 금지됩니다.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (저작자표시-비영리-동일조건변경허락)',
      summary:
        '출처를 표기한 비영리 이용 및 수정만 허용되며, 2차 저작물도 동일한 CC BY-NC-SA 4.0을 유지해야 합니다.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (저작자표시-변경금지)',
      summary:
        '출처 표기 후 원본 그대로의 공유(상업적 포함)는 가능하지만, 이미지를 편집·변형한 결과물을 배포할 수는 없습니다.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (저작자표시-비영리-변경금지)',
      summary:
        '가장 제한적인 CC 라이선스로, 출처 표기 후 비영리 목적의 원본 그대로 공유만 허용됩니다.',
    },
  },
};

export const RU: LicenseGuideTranslations = {
  guideTitle: 'Справочник лицензий и прав на произведение',
  guideSubtitle:
    'Понятное описание 8 вариантов лицензий для QR-сертификата и дополнительных сигналов (коммерция, распространение, обучение ИИ).',
  selectedLabel: 'Что означает выбранная лицензия',
  appLicenseTitle: 'Лицензия самого инструмента (MIT License)',
  appLicenseBody:
    'Сам сервис Certified Handmade распространяется под свободной лицензией MIT. Все права на ваши рисунки остаются у вас согласно выбранной лицензии.',
  signalGuideTitle: 'Дополнительные сигналы (коммерция / распространение / обучение ИИ)',
  signalGuideBody:
    'Если сомневаетесь, оставьте «All Rights Reserved». Лицензии Creative Commons стандартизированы во всём мире. Дополнительные флаги фиксируют намерение автора в подписанном манифесте, но не являются технической блокировкой и зависят от законодательства.',
  badges: {
    commercialYes: 'Коммерция: разрешена',
    commercialNo: 'Коммерция: запрещена',
    derivativesYes: 'Изменения: разрешены',
    derivativesNo: 'Без производных',
    shareAlikeYes: 'ShareAlike (та же лицензия)',
    attributionYes: 'Указание авторства обязательно',
    attributionNo: 'Авторство не требуется',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Все права защищены · по умолчанию)',
      summary:
        'Самая строгая защита. Никто не вправе копировать, распространять, продавать или изменять вашу работу без вашего отдельного разрешения.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Передача в общественное достояние)',
      summary:
        'Отказ от авторских прав в максимально допустимой законом мере: свободное использование, изменение и коммерция без указания авторства.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (С указанием авторства)',
      summary:
        'Разрешает распространять, изменять и использовать работу даже в коммерческих целях при обязательном указании автора.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (С указанием авторства — На тех же условиях)',
      summary:
        'Разрешает коммерцию и переработку с указанием авторства, но производные работы должны распространяться под CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Некоммерческая)',
      summary:
        'Разрешает некоммерческий обмен и переработку с указанием авторства; продажа и монетизация запрещены.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Некоммерческая — На тех же условиях)',
      summary:
        'Только некоммерческое использование и переработка с указанием авторства и сохранением лицензии CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Без производных произведений)',
      summary:
        'Разрешает делиться оригиналом без изменений (в т.ч. коммерчески) с указанием авторства, но запрещает распространять модификации.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Некоммерческая — Без производных)',
      summary:
        'Самая строгая лицензия CC: можно лишь некоммерчески делиться неизменённым оригиналом с указанием авторства.',
    },
  },
};

export const UK: LicenseGuideTranslations = {
  guideTitle: 'Довідник ліцензій і прав на твір',
  guideSubtitle:
    'Зрозуміле пояснення 8 ліцензій для QR-сертифіката та додаткових намірів (комерція, поширення, навчання ШІ).',
  selectedLabel: 'Що означає обрана ліцензія',
  appLicenseTitle: 'Ліцензія самого інструмента (MIT License)',
  appLicenseBody:
    'Сам додаток Certified Handmade є відкритим ПЗ за ліцензією MIT. Усі права на ваші малюнки залишаються вашими згідно з обраною ліцензією.',
  signalGuideTitle: 'Додаткові сигнали (комерція / поширення / навчання ШІ)',
  signalGuideBody:
    'Якщо не впевнені — залиште «All Rights Reserved». Ліцензії Creative Commons є міжнародним стандартом. Додаткові прапорці фіксують намір автора у підписаному маніфесті, але не є технічним блокуванням.',
  badges: {
    commercialYes: 'Комерція: дозволена',
    commercialNo: 'Комерція: заборонена',
    derivativesYes: 'Зміни: дозволені',
    derivativesNo: 'Без похідних творів',
    shareAlikeYes: 'ShareAlike (ті самі умови)',
    attributionYes: 'Вказання авторства обов’язкове',
    attributionNo: 'Авторство не потрібне',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Усі права захищено · за замовчуванням)',
      summary:
        'Найсуворіший захист. Ніхто не має права копіювати, поширювати, продавати чи змінювати твір без вашого окремого дозволу.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Передача у суспільне надбання)',
      summary:
        'Максимально допустима законом відмова від майнових прав: вільне використання, зміни та комерція без вказання авторства.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Із зазначенням авторства)',
      summary:
        'Дозволяє поширювати, змінювати та використовувати твір навіть комерційно за умови належного зазначення автора.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Із зазначенням авторства — На тих самих умовах)',
      summary:
        'Дозволяє комерцію й переробку із зазначенням авторства, але похідні твори повинні мати ліцензію CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Некомерційна)',
      summary:
        'Дозволяє некомерційне поширення й переробку із зазначенням авторства; продаж і монетизація заборонені.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Некомерційна — На тих самих умовах)',
      summary:
        'Лише некомерційне використання й переробка із зазначенням авторства та збереженням ліцензії CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Без похідних творів)',
      summary:
        'Дозволяє поширювати незмінений оригінал (зокрема комерційно) із зазначенням авторства, але забороняє змінені версії.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Некомерційна — Без похідних)',
      summary:
        'Найсуворіша ліцензія CC: дозволяється лише некомерційно ділитися незміненим оригіналом із зазначенням авторства.',
    },
  },
};

export const ES: LicenseGuideTranslations = {
  guideTitle: 'Guía de Licencias y Derechos de Obra',
  guideSubtitle:
    'Explicación clara de las 8 licencias disponibles para el certificado QR y las preferencias adicionales.',
  selectedLabel: 'Qué significa esta licencia',
  appLicenseTitle: 'Licencia de la herramienta (MIT License)',
  appLicenseBody:
    'Certified Handmade es software libre bajo licencia MIT. Tus obras siempre te pertenecen según la licencia que elijas.',
  signalGuideTitle: 'Señales de uso comercial, redistribución y entrenamiento de IA',
  signalGuideBody:
    'Si tienes dudas, mantén «All Rights Reserved». Las licencias Creative Commons son estándares internacionales; las señales adicionales registran la intención del autor en el manifiesto firmado, sin constituir bloqueo técnico.',
  badges: {
    commercialYes: 'Comercial: Permitido',
    commercialNo: 'Comercial: Prohibido',
    derivativesYes: 'Obras derivadas: Permitidas',
    derivativesNo: 'Sin obras derivadas',
    shareAlikeYes: 'Compartir Igual',
    attributionYes: 'Atribución requerida',
    attributionNo: 'Sin atribución requerida',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Todos los derechos reservados)',
      summary:
        'Opción más restrictiva. Nadie puede copiar, redistribuir, vender ni modificar tu obra sin tu permiso expreso.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Dedicación al Dominio Público)',
      summary:
        'Renuncia máxima permitida por la ley: cualquiera puede usar, editar o comercializar la obra sin atribución.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Atribución)',
      summary:
        'Cualquiera puede compartir, editar y usar la obra incluso comercialmente, siempre que te dé crédito.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Atribución-CompartirIgual)',
      summary:
        'Permite uso comercial y adaptaciones con crédito, pero las obras derivadas deben usar la misma licencia CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Atribución-NoComercial)',
      summary:
        'Permite compartir y remezclar con crédito solo para fines no comerciales.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Atribución-NoComercial-CompartirIgual)',
      summary:
        'Solo uso y adaptación no comercial con crédito, manteniendo CC BY-NC-SA 4.0 en obras derivadas.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Atribución-SinDerivadas)',
      summary:
        'Permite compartir el original sin modificar (incluso comercialmente) con crédito, pero prohíbe distribuir ediciones.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Atribución-NoComercial-SinDerivadas)',
      summary:
        'La licencia CC más restrictiva: solo permite compartir la obra exacta sin fines comerciales y con crédito.',
    },
  },
};

export const FR: LicenseGuideTranslations = {
  guideTitle: 'Guide des Licences et Droits d’Auteur',
  guideSubtitle:
    'Résumé clair des 8 licences intégrables au certificat QR et des préférences complémentaires.',
  selectedLabel: 'Ce que signifie cette licence',
  appLicenseTitle: 'Licence du logiciel (MIT License)',
  appLicenseBody:
    'L’outil Certified Handmade est open-source sous licence MIT. Vos œuvres restent entièrement soumises à la licence que vous choisissez.',
  signalGuideTitle: 'Signaux d’usage commercial, redistribution et entraînement IA',
  signalGuideBody:
    'En cas de doute, conservez « All Rights Reserved ». Les licences Creative Commons sont standardisées ; les signaux complémentaires expriment l’intention de l’auteur sans blocage technique universel.',
  badges: {
    commercialYes: 'Commercial : Autorisé',
    commercialNo: 'Commercial : Interdit',
    derivativesYes: 'Modifications : Autorisées',
    derivativesNo: 'Pas de modifications',
    shareAlikeYes: 'Partage à l’identique',
    attributionYes: 'Crédit obligatoire',
    attributionNo: 'Crédit non requis',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Tous droits réservés)',
      summary:
        'Protection standard maximale. Nul ne peut copier, rediffuser, vendre ou modifier l’œuvre sans autorisation explicite.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Transfert dans le domaine public)',
      summary:
        'Renonciation maximale aux droits : toute utilisation, modification ou exploitation commerciale est libre sans crédit.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Attribution)',
      summary:
        'Autorise le partage, la modification et l’usage commercial à condition de mentionner le nom de l’auteur.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Attribution - Partage dans les mêmes conditions)',
      summary:
        'Autorise modifications et usage commercial avec crédit, mais les œuvres dérivées doivent adopter CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Attribution - Pas d’utilisation commerciale)',
      summary:
        'Autorise le partage et l’adaptation avec crédit uniquement à des fins non commerciales.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Pas d’utilisation commerciale - Partage à l’identique)',
      summary:
        'Usage et adaptation non commerciaux avec crédit, en conservant la licence CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Pas de modification)',
      summary:
        'Autorise le partage de l’original intact (y compris commercialement) avec crédit, mais interdit la diffusion de dérivés.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Pas d’utilisation commerciale - Pas de modification)',
      summary:
        'Licence CC la plus restrictive : seul le partage exact à titre non commercial avec crédit est autorisé.',
    },
  },
};

export const DE: LicenseGuideTranslations = {
  guideTitle: 'Leitfaden zu Lizenzen & Nutzungsrechten',
  guideSubtitle:
    'Verständliche Übersicht der 8 auswählbaren Werk-Lizenzen sowie der ergänzenden Nutzungshinweise.',
  selectedLabel: 'Bedeutung der gewählten Lizenz',
  appLicenseTitle: 'Lizenz der Anwendung (MIT License)',
  appLicenseBody:
    'Certified Handmade selbst ist Open-Source-Software unter der MIT-Lizenz. Ihre Kunstwerke unterliegen ausschließlich Ihrer gewählten Lizenz.',
  signalGuideTitle: 'Kommerzielle Nutzung, Weiterverbreitung & KI-Training',
  signalGuideBody:
    'Im Zweifel behalten Sie „All Rights Reserved“. Creative-Commons-Lizenzen sind international standardisiert; Zusatzsignale dokumentieren Ihren Willen im signierten Manifest, stellen aber keine technische Sperre dar.',
  badges: {
    commercialYes: 'Kommerziell: Erlaubt',
    commercialNo: 'Kommerziell: Untersagt',
    derivativesYes: 'Bearbeitungen: Erlaubt',
    derivativesNo: 'Keine Bearbeitungen',
    shareAlikeYes: 'Weitergabe unter gleichen Bedingungen',
    attributionYes: 'Namensnennung erforderlich',
    attributionNo: 'Keine Namensnennung nötig',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Alle Rechte vorbehalten)',
      summary:
        'Strengster Standardschutz. Ohne Ihre ausdrückliche Erlaubnis sind Kopie, Verbreitung, Verkauf und Bearbeitung untersagt.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Verzichtserklärung / Public Domain)',
      summary:
        'Maximal möglicher Rechteverzicht: Jede Nutzung, Bearbeitung und kommerzielle Verwendung ohne Namensnennung ist frei.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Namensnennung)',
      summary:
        'Teilen, Bearbeiten und auch kommerzielle Nutzung sind erlaubt, sofern Sie korrekt als Urheber genannt werden.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Namensnennung – Weitergabe unter gleichen Bedingungen)',
      summary:
        'Bearbeitungen und kommerzielle Nutzung mit Namensnennung erlaubt, solange Abwandlungen wieder unter CC BY-SA 4.0 stehen.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Namensnennung – Nicht kommerziell)',
      summary:
        'Teilen und Bearbeiten mit Namensnennung nur für nicht-kommerzielle Zwecke erlaubt.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Nicht kommerziell – Gleiche Bedingungen)',
      summary:
        'Nicht-kommerzielle Nutzung und Bearbeitung mit Namensnennung unter Beibehaltung von CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Namensnennung – Keine Bearbeitungen)',
      summary:
        'Unveränderte Weitergabe (auch kommerziell) mit Namensnennung erlaubt, veränderte Fassungen dürfen nicht verbreitet werden.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Nicht kommerziell – Keine Bearbeitungen)',
      summary:
        'Strengste CC-Lizenz: Nur unverändertes Teilen für nicht-kommerzielle Zwecke mit Namensnennung erlaubt.',
    },
  },
};

export const PT: LicenseGuideTranslations = {
  guideTitle: 'Guia de Licenças e Direitos da Obra',
  guideSubtitle:
    'Resumo simples das 8 opções de licença do certificado QR e dos sinais complementares.',
  selectedLabel: 'O que esta licença significa',
  appLicenseTitle: 'Licença da ferramenta (MIT License)',
  appLicenseBody:
    'O Certified Handmade é software livre sob licença MIT. Suas obras permanecem suas conforme a licença escolhida.',
  signalGuideTitle: 'Sinais de uso comercial, redistribuição e treino de IA',
  signalGuideBody:
    'Na dúvida, mantenha «All Rights Reserved». Os termos Creative Commons são padrões internacionais; os sinais extras registram a preferência do autor sem bloqueio técnico.',
  badges: {
    commercialYes: 'Comercial: Permitido',
    commercialNo: 'Comercial: Proibido',
    derivativesYes: 'Derivações: Permitidas',
    derivativesNo: 'Sem obras derivadas',
    shareAlikeYes: 'CompartilhaIgual',
    attributionYes: 'Atribuição obrigatória',
    attributionNo: 'Sem atribuição necessária',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Todos os direitos reservados)',
      summary:
        'Proteção padrão máxima. Ninguém pode copiar, redistribuir, vender ou modificar a obra sem sua autorização.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Dedicação ao Domínio Público)',
      summary:
        'Renúncia máxima permitida por lei: uso livre, edição e fins comerciais sem necessidade de crédito.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Atribuição)',
      summary:
        'Qualquer pessoa pode compartilhar, adaptar e usar comercialmente desde que dê o devido crédito.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Atribuição-CompartilhaIgual)',
      summary:
        'Permite uso comercial e adaptações com crédito, mas obras derivadas devem usar CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Atribuição-NãoComercial)',
      summary:
        'Permite compartilhar e adaptar com crédito apenas para fins não comerciais.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (NãoComercial-CompartilhaIgual)',
      summary:
        'Uso e adaptação apenas não comerciais com crédito, mantendo CC BY-NC-SA 4.0 nas derivações.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Atribuição-SemDerivações)',
      summary:
        'Permite compartilhar o original intacto (inclusive comercialmente) com crédito, sem distribuir alterações.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (NãoComercial-SemDerivações)',
      summary:
        'A licença CC mais restritiva: permite apenas compartilhar a obra exata sem fins comerciais e com crédito.',
    },
  },
};

export const IT: LicenseGuideTranslations = {
  guideTitle: 'Guida alle Licenze e ai Diritti d’Autore',
  guideSubtitle:
    'Spiegazione semplice delle 8 licenze integrabili nel certificato QR e delle preferenze aggiuntive.',
  selectedLabel: 'Significato della licenza selezionata',
  appLicenseTitle: 'Licenza dello strumento (MIT License)',
  appLicenseBody:
    'Certified Handmade è software open source con licenza MIT. I diritti sulle tue opere restano tuoi secondo la licenza scelta.',
  signalGuideTitle: 'Segnali per uso commerciale, redistribuzione e addestramento IA',
  signalGuideBody:
    'Nel dubbio lascia «All Rights Reserved». Le licenze Creative Commons sono standard internazionali; i segnali extra registrano la volontà dell’autore senza blocchi tecnici.',
  badges: {
    commercialYes: 'Commerciale: Consentito',
    commercialNo: 'Commerciale: Vietato',
    derivativesYes: 'Modifiche: Consentite',
    derivativesNo: 'Nessuna opera derivata',
    shareAlikeYes: 'Condividi allo stesso modo',
    attributionYes: 'Attribuzione richiesta',
    attributionNo: 'Nessuna attribuzione',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Tutti i diritti riservati)',
      summary:
        'Protezione standard più restrittiva: nessuno può copiare, ridistribuire, vendere o modificare l’opera senza permesso.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (Dedica al Pubblico Dominio)',
      summary:
        'Rinuncia massima ai diritti consentita dalla legge: uso, modifica e scopi commerciali liberi senza attribuzione.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Attribuzione)',
      summary:
        'Chiunque può condividere, modificare e usare anche commercialmente l’opera citando l’autore.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Attribuzione - Condividi allo stesso modo)',
      summary:
        'Consente uso commerciale e modifiche con credito, ma le opere derivate devono usare CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Attribuzione - Non commerciale)',
      summary:
        'Consente condivisione e rielaborazioni con credito solo per scopi non commerciali.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Non commerciale - Condividi allo stesso modo)',
      summary:
        'Uso e modifiche solo non commerciali con credito, mantenendo la licenza CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Attribuzione - Non opere derivate)',
      summary:
        'Consente di condividere l’originale integro (anche commercialmente) con credito, senza distribuire modifiche.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Non commerciale - Non opere derivate)',
      summary:
        'Licenza CC più restrittiva: solo condivisione esatta senza scopi commerciali e con attribuzione.',
    },
  },
};

export const AR: LicenseGuideTranslations = {
  guideTitle: 'دليل تراخيص الأعمال الفنية والحقوق',
  guideSubtitle:
    'شرح مبسّط للخيارات الثمانية للتراخيص التي يمكن تضمينها في شهادة QR بالإضافة إلى إشارات الاستخدام.',
  selectedLabel: 'ماذا يعني هذا الترخيص',
  appLicenseTitle: 'ترخيص الأداة نفسها (MIT License)',
  appLicenseBody:
    'تطبيق Certified Handmade مفتوح المصدر بموجب رخصة MIT. تبقى حقوق أعمالك الفنية ملكاً لك وفق الترخيص الذي تختاره.',
  signalGuideTitle: 'إشارات الاستخدام التجاري وإعادة النشر وتدريب الذكاء الاصطناعي',
  signalGuideBody:
    'إذا لم تكن متأكداً، أبقِ الخيار الافتراضي All Rights Reserved. تراخيص المشاع الإبداعي معيار عالمي، بينما تسجل الخيارات الإضافية رغبة المؤلف داخل البيان الموقّع دون منع تقني قسري.',
  badges: {
    commercialYes: 'الاستخدام التجاري: مسموح',
    commercialNo: 'الاستخدام التجاري: ممنوع',
    derivativesYes: 'التعديل والاشتقاق: مسموح',
    derivativesNo: 'يُمنع التعديل',
    shareAlikeYes: 'المشاركة بالمثل مطلوبة',
    attributionYes: 'ذكر المصدر مطلوب',
    attributionNo: 'لا يلزم ذكر المصدر',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (جميع الحقوق محفوظة · افتراضي)',
      summary:
        'أعلى مستوى حماية افتراضي: لا يجوز لأحد نسخ عملك أو إعادة نشره أو بيعه أو تعديله دون إذن صريح منك.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 (التنازل للملكية العامة)',
      summary:
        'التنازل عن حقوق النشر لأقصى حد يسمح به القانون: يجوز للجميع الاستخدام والتعديل والربح التجاري دون نسبة.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (نسبة المصنف)',
      summary:
        'يُسمح بمشاركة العمل وتعديله واستخدامه تجارياً بشرط ذكر اسم المؤلف بشكل صحيح.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (نسبة المصنف - المشاركة بالمثل)',
      summary:
        'يُسمح بالتعديل والاستخدام التجاري مع ذكر المصدر، لكن يجب ترخيص الأعمال المشتقة بنفس رخصة CC BY-SA 4.0.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (نسبة المصنف - غير تجاري)',
      summary:
        'يُسمح بالمشاركة والتعديل للأغراض غير التجارية فقط مع ذكر المصدر، ويُمنع البيع أو الاستغلال التجاري.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (غير تجاري - المشاركة بالمثل)',
      summary:
        'استخدام وتعديل غير تجاري فقط مع ذكر المصدر والحفاظ على ترخيص CC BY-NC-SA 4.0 للأعمال المشتقة.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (نسبة المصنف - منع الاشتقاق)',
      summary:
        'يُسمح بمشاركة النسخة الأصلية كما هي (بما فيها تجارياً) مع ذكر المصدر، لكن يُمنع توزيع نسخ معدّلة.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (غير تجاري - منع الاشتقاق)',
      summary:
        'أكثر تراخيص CC تقييداً: يُسمح فقط بمشاركة العمل الأصلي دون تعديل ولأغراض غير تجارية مع ذكر المصدر.',
    },
  },
};

export interface LicenseGuideTranslationsOthers {
  'zh-CN': LicenseGuideTranslations;
  'zh-TW': LicenseGuideTranslations;
  'ko': LicenseGuideTranslations;
  'ru': LicenseGuideTranslations;
  'uk': LicenseGuideTranslations;
  'es': LicenseGuideTranslations;
  'fr': LicenseGuideTranslations;
  'de': LicenseGuideTranslations;
  'pt': LicenseGuideTranslations;
  'it': LicenseGuideTranslations;
  'ar': LicenseGuideTranslations;
}

export const OTHERS: LicenseGuideTranslationsOthers = {
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
