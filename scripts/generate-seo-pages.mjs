import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  throw new Error(`Missing built template at ${templatePath}`);
}

const template = fs.readFileSync(templatePath, 'utf8');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROUTES = [
  {
    slug: 'create',
    title: 'Create Cryptographic Artwork Provenance Certificate & PNG QR | Certified Handmade',
    description:
      'Sign your hand-drawn artwork locally with Ed25519 cryptographic signatures and SHA-256 pixel hashing. Export lossless PNGs with an outer QR frame or translucent In-Image QR Studio—zero server upload.',
    keywords:
      'Cryptographic Artwork Provenance, Create Art Certificate, Hand-drawn Art DRM, Ed25519 Signing, Lossless PNG QR, 手描きDRM, 来歴証明作成, QRコード埋め込み',
    heading: 'Create Cryptographic Artwork Provenance Certificate & QR Studio',
    summary:
      'Sign illustrations locally in your browser with Ed25519 + SHA-256 and embed an outer QR border or manual translucent in-image QR inside lossless PNG files.',
  },
  {
    slug: 'verify',
    title: 'Verify Artwork Provenance, Ed25519 Signature & QR Proof | Certified Handmade',
    description:
      'Verify Ed25519 artwork signatures, SHA-256 canonical pixel integrity, #proof= URL fragments, and locally trusted artist keys 100% locally offline via PNG upload, camera QR, or clipboard.',
    keywords:
      'Cryptographic Artwork Provenance, Verify Artwork, QR Proof Verifier, Ed25519 Signature Check, SHA-256 Pixel Integrity, Offline Verification, 手描き検証, ピクセル整合性',
    heading: 'Verify Artwork Provenance & QR Proof',
    summary:
      'Inspect signed PNG artwork, scan verification QR codes, paste images from clipboard, or verify #proof= links completely offline with zero external requests.',
  },
  {
    slug: 'tutorial',
    title: 'Step-by-Step Guide to Cryptographic Artwork Provenance | Certified Handmade',
    description:
      'Beginner-friendly standalone guide: generate an encrypted Ed25519 signing key, embed a verification QR into your PNG, and declare ARR or Creative Commons licenses honestly.',
    keywords:
      'Cryptographic Artwork Provenance Tutorial, Art DRM Tutorial, Hand-drawing Artist Guide, Ed25519 Key Setup, Artwork Licensing Guide, 手描きDRM 使い方, チュートリアル',
    heading: 'Step-by-Step Offline Provenance Tutorial',
    summary:
      'Learn how to create an AES-256-GCM encrypted artist key, embed a cryptographic QR proof into your drawing, and verify authenticity offline.',
  },
  {
    slug: 'keys',
    title: 'Local Signing Keys, Fingerprints & AES-256-GCM Backups | Certified Handmade',
    description:
      'Generate Ed25519 artist identity keys in your browser, manage revocation/rotation notices, verify key-possession challenges, and export passphrase-encrypted .chkey.json backups offline.',
    keywords:
      'Ed25519 Artist Key, AES-256-GCM Key Backup, Key Revocation Notice, Challenge Response, Local Key Management, ローカル署名鍵, 暗号化バックアップ',
    heading: 'Local Signing Keys, Notices & AES-256-GCM Encrypted Backups',
    summary:
      'Generate Ed25519 signing keys exclusively on your device, verify out-of-band fingerprints, and export passphrase-encrypted .chkey.json backups.',
  },
  {
    slug: 'devices',
    title: 'CHM Secure Device Pairing — Offline Multi-Device Enrollment | Certified Handmade',
    description:
      'Pair your PC, smartphone, and tablet to your CHM Identity offline via a 2-step QR handshake with zero servers, non-extractable Ed25519 device keys, and signed revocation notices.',
    keywords:
      'CHM-DEVICE-PAIRING-v1, Secure Device Pairing, Offline QR Pairing, Ed25519 Device Identity, Device Revocation, デバイス連携, 登録済みデバイス',
    heading: 'CHM Secure Device Pairing & Management',
    summary:
      'Link secondary devices to your CHM Identity offline via deterministic RFC 8949 CBOR QR handshakes, manage paired devices, and export signed backups or revocations.',
  },
  {
    slug: 'exchange',
    title: 'CHM Public-Key Exchange — Share & Verify Ed25519 Keys | Certified Handmade',
    description:
      'Share your Ed25519 artist public key via portable #key= URLs, QR codes, or JSON, and verify SHA-256 fingerprints locally offline without auto-trust.',
    keywords:
      'CHM-Exchange, Ed25519 Public-Key Exchange, Artist Fingerprint Verification, QR Key Sharing, Offline Trust, 公開鍵交換, フィンガープリント',
    heading: 'CHM Public-Key Exchange',
    summary:
      'Generate portable #key= exchange URLs, downloadable QR PNGs, and JSON public-key bundles, and confirm local trust via out-of-band fingerprints.',
  },
  {
    slug: 'docs',
    title: 'Cryptographic Architecture, SPEC & Offline Verifier Docs | Certified Handmade',
    description:
      'Technical reference for Certified Handmade: RFC 8949 CBOR proof schema, RGBA8 canonical SHA-256 digests, Protocol v1/v2 QR masks, key notices, and independent offline CLI verifiers.',
    keywords:
      'Cryptographic Artwork Provenance Spec, RFC 8949 CBOR, Ed25519 Provenance Spec, AES-256-GCM Encryption, Offline Verifier CLI, 暗号仕様, 手描きDRM',
    heading: 'Cryptographic Specification, Threat Model & License Guide',
    summary:
      'Explore the open MIT specification (SPEC.md), RFC 8949 CBOR payload layout, Protocol v1/v2 pixel integrity verification, and independent offline CLI verifiers.',
  },
  {
    slug: 'privacypolicy',
    title: 'Privacy Policy & GDPR Local-Only Architecture | Certified Handmade',
    description:
      'GDPR privacy disclosure: zero tracking, zero analytics, strict connect-src self CSP, and 100% on-device local processing of artworks and cryptographic keys.',
    keywords:
      'Privacy Policy, GDPR Compliance, Zero Telemetry, Local-Only Web App, Offline Privacy, プライバシーポリシー, 完全ローカル',
    heading: 'Privacy Policy & GDPR Local-Only Notice',
    summary:
      'Certified Handmade processes all artwork files and cryptographic keys strictly locally in your browser with zero analytics or tracking cookies.',
  },
];

for (const route of ROUTES) {
  const canonicalUrl = `https://certified-handmade.com/${route.slug}`;
  const titleEscaped = escapeHtml(route.title);
  const descEscaped = escapeHtml(route.description);
  const kwEscaped = escapeHtml(route.keywords);

  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${titleEscaped}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${descEscaped}" />`,
  );
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*\/>/,
    `<meta name="keywords" content="${kwEscaped}" />`,
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonicalUrl}" />`,
  );
  html = html.replace(
    /<link\s+rel="alternate"\s+hreflang="x-default"\s+href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />`,
  );
  html = html.replace(
    /<link\s+rel="alternate"\s+hreflang="en"\s+href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="en" href="${canonicalUrl}?hl=en" />`,
  );
  html = html.replace(
    /<link\s+rel="alternate"\s+hreflang="ja"\s+href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="ja" href="${canonicalUrl}?hl=ja" />`,
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${titleEscaped}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${descEscaped}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonicalUrl}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${titleEscaped}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${descEscaped}" />`,
  );
  html = html.replace(
    /<main[\s\S]*?<\/main>/,
    `<main style="max-width:56rem;margin:0 auto;padding:2rem 1.25rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#e2e8f0"><h1>${escapeHtml(route.heading)}</h1><p>${escapeHtml(route.summary)}</p><nav aria-label="Primary pages"><a href="/">Home</a> · <a href="/create">Create</a> · <a href="/verify">Verify</a> · <a href="/tutorial">Tutorial</a> · <a href="/keys">Keys</a> · <a href="/devices">Devices</a> · <a href="/exchange">Exchange</a> · <a href="/docs">Docs</a></nav></main>`,
  );

  const outPath = path.join(distDir, `${route.slug}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Generated SEO shell: dist/${route.slug}.html`);
}
