import type { LicenseGuideTranslations } from '../../licenses';

export const EN: LicenseGuideTranslations = {
  guideTitle: 'Artwork License & Rights Guide',
  guideSubtitle:
    'Plain-language summary of every license option you can sign into your QR certificate, plus supplementary intent flags.',
  selectedLabel: 'What this license means',
  appLicenseTitle: 'Toolkit License (MIT License)',
  appLicenseBody:
    'Certified Handmade itself is open-source software under the MIT License. Your artworks always remain yours under whichever license you select.',
  signalGuideTitle: 'Commercial / Redistribution / AI Training Signals',
  signalGuideBody:
    'Creative Commons terms are standardized globally and cannot be revoked arbitrarily once granted. The three extra dropdowns record the author’s stated preference (such as opting out of AI training) inside the signed manifest; legal effect and technical enforcement vary by jurisdiction and platform.',
  badges: {
    commercialYes: 'Commercial: Allowed',
    commercialNo: 'Commercial: Disallowed',
    derivativesYes: 'Remixes / Edits: Allowed',
    derivativesNo: 'No Derivatives',
    shareAlikeYes: 'ShareAlike Required',
    attributionYes: 'Credit Required',
    attributionNo: 'No Credit Required',
  },
  items: {
    ARR: {
      name: 'All Rights Reserved (Default)',
      summary:
        'Strictest default. No one may copy, redistribute, sell, or modify your artwork without your separate explicit permission.',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 Public Domain Dedication',
      summary:
        'You waive copyright to the greatest extent allowed by law. Anyone may use, edit, or sell the work without attribution.',
    },
    'CC-BY-4.0': {
      name: 'CC BY 4.0 (Attribution)',
      summary:
        'Anyone may share, edit, and use the work even commercially, as long as they give you proper credit.',
    },
    'CC-BY-SA-4.0': {
      name: 'CC BY-SA 4.0 (Attribution-ShareAlike)',
      summary:
        'Others may share, remix, and use commercially with credit, but any adapted works must use the same CC BY-SA 4.0 license.',
    },
    'CC-BY-NC-4.0': {
      name: 'CC BY-NC 4.0 (Attribution-NonCommercial)',
      summary:
        'Others may share and remix with credit for non-commercial purposes only. Selling or monetizing is not permitted.',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)',
      summary:
        'Non-commercial sharing and remixing with credit is allowed, and derivatives must also carry CC BY-NC-SA 4.0.',
    },
    'CC-BY-ND-4.0': {
      name: 'CC BY-ND 4.0 (Attribution-NoDerivatives)',
      summary:
        'Others may repost or share the unmodified original (including commercially) with credit, but cannot distribute edits or remixes.',
    },
    'CC-BY-NC-ND-4.0': {
      name: 'CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivatives)',
      summary:
        'Most restrictive CC license. Others may only share the exact unmodified work non-commercially with credit.',
    },
  },
};
