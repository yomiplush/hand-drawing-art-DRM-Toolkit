/**
 * Local-first URL safety & trust guard for creator websites and SNS links.
 *
 * Enforces:
 * - Strict HTTPS only (blocks javascript:, data:, http:, file:, etc.)
 * - No raw IP addresses, localhost, embedded credentials, or Punycode homographs (xn--)
 * - No URL shorteners / open redirectors that hide destinations
 * - No direct executable / archive dropper URLs (.exe, .msi, .apk, .zip, .sh, etc.)
 * - Strict allowlist of trusted creator SNS / art platforms for SNS links
 * - Safe TLD & domain policy for personal / artist / official websites
 */

const TRUSTED_SNS_EXACT_HOSTS = new Set([
  'x.com',
  'twitter.com',
  'bsky.app',
  'misskey.io',
  'misskey.design',
  'misskey.art',
  'misskey.cloud',
  'misskey.systems',
  'misskey.niri.la',
  'nijimiss.moe',
  'sushi.ski',
  'fedibird.com',
  'mstdn.jp',
  'mastodon.social',
  'pawoo.net',
  'baraag.net',
  'pixiv.net',
  'skeb.jp',
  'fantia.jp',
  'ci-en.net',
  'dlsite.com',
  'foriio.com',
  'xfolio.jp',
  'potofu.me',
  'lit.link',
  'profcard.info',
  'linktr.ee',
  'instagram.com',
  'threads.net',
  'youtube.com',
  'twitch.tv',
  'nicovideo.jp',
  'artstation.com',
  'deviantart.com',
  'behance.net',
  'cara.app',
  'vgen.co',
  'ko-fi.com',
  'patreon.com',
  'subscribestar.com',
  'subscribestar.adult',
  'buymeacoffee.com',
  'gumroad.com',
  'boosty.to',
  'liberapay.com',
  'throne.com',
  'artistree.io',
  'commiss.io',
  'ofuse.me',
  'doneru.jp',
  'skima.jp',
  'coconala.com',
  'tsunagu.cloud',
  'suzuri.jp',
  'nizima.com',
  'fanbox.cc',
  'booth.pm',
  'github.com',
  'note.com',
  'pixiv.me',
  'poipiku.com',
  'privatter.net',
  'marshmallow-qa.com',
  'wavebox.me',
]);

const TRUSTED_SNS_SUFFIXES = [
  '.fanbox.cc',
  '.booth.pm',
  '.carrd.co',
  '.tumblr.com',
  '.artstation.com',
  '.deviantart.com',
  '.pixiv.net',
  '.bsky.social',
];

const BLOCKED_SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'v.gd',
  'buff.ly',
  'cutt.ly',
  'rb.gy',
  'shorturl.at',
  'rebrand.ly',
  'lnkd.in',
  'tiny.cc',
  'adf.ly',
  'bc.vc',
  'ouo.io',
  'shrinkme.io',
  's.id',
  'x.gd',
]);

const SAFE_WEBSITE_TLDS = new Set([
  'com',
  'net',
  'org',
  'jp',
  'dev',
  'art',
  'studio',
  'design',
  'io',
  'me',
  'co',
  'info',
  'moe',
  'cc',
  'tv',
  'gallery',
  'works',
  'page',
  'app',
  'site',
  'link',
  'pm',
  'uk',
  'de',
  'fr',
  'ca',
  'au',
  'kr',
  'tw',
  'eu',
  'us',
  'ch',
  'nl',
  'se',
]);

const DANGEROUS_PATH_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.apk',
  '.dmg',
  '.pkg',
  '.scr',
  '.vbs',
  '.jar',
  '.iso',
  '.dll',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.lnk',
  '.hta',
];

export interface UrlValidationResult {
  ok: boolean;
  normalizedUrl?: string;
  reasonJa?: string;
  reasonEn?: string;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isIpOrLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  if (hostname.includes(':') || hostname.startsWith('[')) {
    return true;
  }
  return false;
}

function validateBaseSafeHttpsUrl(raw: string): { url?: URL; error?: UrlValidationResult } {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      error: {
        ok: false,
        reasonJa: `URLの形式が正しくありません: ${trimmed}`,
        reasonEn: `Invalid URL format: ${trimmed}`,
      },
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      error: {
        ok: false,
        reasonJa: `安全のため https:// で始まるURLのみ登録できます: ${trimmed}`,
        reasonEn: `Only https:// URLs are allowed for security: ${trimmed}`,
      },
    };
  }

  if (parsed.username || parsed.password) {
    return {
      error: {
        ok: false,
        reasonJa: `認証情報を含む不審なURLは登録できません: ${trimmed}`,
        reasonEn: `URLs containing embedded credentials are blocked: ${trimmed}`,
      },
    };
  }

  const host = normalizeHostname(parsed.hostname);
  if (!host || !host.includes('.') || isIpOrLocalHost(host)) {
    return {
      error: {
        ok: false,
        reasonJa: `IPアドレスやローカルURLは登録できません: ${trimmed}`,
        reasonEn: `IP addresses and local URLs are not allowed: ${trimmed}`,
      },
    };
  }

  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    return {
      error: {
        ok: false,
        reasonJa: `なりすまし防止のためPunycodeドメインは登録できません: ${trimmed}`,
        reasonEn: `Punycode/IDN homograph domains are blocked: ${trimmed}`,
      },
    };
  }

  if (BLOCKED_SHORTENER_HOSTS.has(host)) {
    return {
      error: {
        ok: false,
        reasonJa: `短縮URL (${host}) はマルウェア誘導防止のため登録できません。直接のURLを入力してください。`,
        reasonEn: `URL shorteners (${host}) are blocked to prevent hidden redirects. Use the direct URL.`,
      },
    };
  }

  const lowerPath = parsed.pathname.toLowerCase();
  if (DANGEROUS_PATH_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return {
      error: {
        ok: false,
        reasonJa: `実行ファイルや圧縮ファイルへの直接リンクは登録できません: ${trimmed}`,
        reasonEn: `Direct links to executables or archives are blocked: ${trimmed}`,
      },
    };
  }

  return { url: parsed };
}

export function validateTrustedSnsUrl(raw: string): UrlValidationResult {
  const base = validateBaseSafeHttpsUrl(raw);
  if (base.error || !base.url) {
    return base.error!;
  }

  const host = normalizeHostname(base.url.hostname);
  const parts = host.split('.');
  const tld = parts[parts.length - 1] ?? '';
  const isFediverseProfilePath = /^\/(@[^/]+|users\/[^/]+)(\/.*)?$/i.test(base.url.pathname);
  const isAllowed =
    TRUSTED_SNS_EXACT_HOSTS.has(host) ||
    TRUSTED_SNS_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    (SAFE_WEBSITE_TLDS.has(tld) && isFediverseProfilePath);

  if (!isAllowed) {
    return {
      ok: false,
      reasonJa: `SNSリンクは信頼済みプラットフォーム（X / Bluesky / Misskey / Mastodon 等の自鯖 /@ユーザー名 / Pixiv / Skeb / Booth / Instagram / YouTube 等）のみ登録できます: ${host}`,
      reasonEn: `SNS links must be on a trusted creator platform or a Fediverse profile (/@username) on a standard HTTPS domain: ${host}`,
    };
  }

  return { ok: true, normalizedUrl: base.url.toString() };
}

export function validateTrustedWebsiteUrl(raw: string): UrlValidationResult {
  const base = validateBaseSafeHttpsUrl(raw);
  if (base.error || !base.url) {
    return base.error!;
  }

  const host = normalizeHostname(base.url.hostname);
  const parts = host.split('.');
  const tld = parts[parts.length - 1] ?? '';

  if (!SAFE_WEBSITE_TLDS.has(tld)) {
    return {
      ok: false,
      reasonJa: `不審なドメイン拡張子 (.${tld}) のため登録できません。一般的な個人サイト・ポートフォリオ・公式サイトのURLを入力してください。`,
      reasonEn: `Untrusted TLD (.${tld}) is blocked. Please use a standard personal, portfolio, or official website URL.`,
    };
  }

  return { ok: true, normalizedUrl: base.url.toString() };
}
