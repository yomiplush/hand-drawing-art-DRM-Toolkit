/**
 * Child-safe author name guard.
 *
 * Helps prevent children and artists from accidentally embedding personal
 * identifying information (real full names, school/class names, phone numbers,
 * email addresses, or home addresses) into permanent cryptographic certificates.
 *
 * - `block`: Clear personal/school/contact info that should not be embedded.
 * - `warn`: Looks like a real full name (e.g. "山田 太郎"); shows a gentle
 *   reminder to use a nickname/pen name without hard-blocking legitimate pen names.
 * - `safe`: No personal-info patterns detected.
 */

export type AuthorNameRiskLevel = 'safe' | 'warn' | 'block';

export type AuthorNameRiskReason =
  | 'school-info'
  | 'personal-contact'
  | 'possible-real-name';

export interface AuthorNameInspectionResult {
  level: AuthorNameRiskLevel;
  reasons: AuthorNameRiskReason[];
  messageJa: string | null;
  messageEn: string | null;
}

const SCHOOL_PATTERNS: RegExp[] = [
  /(?:小学校|中学校|高等学校|高校|幼稚園|保育園|こども園|特別支援学校|義務教育学校)/u,
  /[0-9０-９]{1,2}\s*年\s*[0-9０-９]{1,2}\s*組/u,
  /(?:小学|中学|高校)?[0-9０-９]{1,2}\s*年生/u,
  /\b(?:elementary|middle|junior\s+high|high)\s+school\b/i,
  /\b(?:grade\s*[0-9]{1,2}|[0-9]{1,2}(?:st|nd|rd|th)\s+grade)\b/i,
];

const CONTACT_PATTERNS: RegExp[] = [
  // Email address
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  // Japanese phone numbers (090-1234-5678, 03-1234-5678, 08012345678)
  /(?:^|[^\d])0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}(?:$|[^\d])/,
  // Japanese postal code (〒123-4567 or 123-4567)
  /〒\s*[0-9０-９]{3}[-ー−]?[0-9０-９]{4}/u,
  // Japanese street address cues
  /(?:都|道|府|県)[^\s]{1,8}(?:市|区|町|村)/u,
  /[0-9０-９]+丁目[0-9０-９]+番/u,
];

// Kanji surname + space + Kanji given name (e.g., "山田 太郎", "佐藤　花子")
const JAPANESE_KANJI_FULLNAME_PATTERN =
  /^[\u4E00-\u9FFF]{1,4}[\s\u3000]+[\u4E00-\u9FFF]{1,4}$/u;

// Common Japanese surnames followed by a space and a hiragana/katakana/kanji given name
const COMMON_JP_SURNAMES = new Set([
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
  '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川',
  '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', '村上', '遠藤', '青木', '坂本',
  '斉藤', '福田', '太田', '西村', '藤井', '金子', '岡本', '藤原', '中野', '三浦',
  '原田', '中川', '松田', '竹内', '小野', '田村', '中山', '和田', '石田', '森田',
  '上田', '内田', '柴田', '酒井', '宮崎', '横山', '高木', '安藤', '宮本', '大野',
]);

function looksLikeJapaneseRealName(trimmed: string): boolean {
  if (JAPANESE_KANJI_FULLNAME_PATTERN.test(trimmed)) {
    return true;
  }
  const parts = trimmed.split(/[\s\u3000]+/u);
  if (parts.length === 2) {
    const [first, second] = parts;
    if (
      COMMON_JP_SURNAMES.has(first) &&
      /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,5}$/u.test(second)
    ) {
      return true;
    }
  }
  return false;
}

export function inspectAuthorName(rawName: string): AuthorNameInspectionResult {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { level: 'safe', reasons: [], messageJa: null, messageEn: null };
  }

  const reasons: AuthorNameRiskReason[] = [];

  if (SCHOOL_PATTERNS.some((re) => re.test(trimmed))) {
    reasons.push('school-info');
  }

  if (CONTACT_PATTERNS.some((re) => re.test(trimmed))) {
    reasons.push('personal-contact');
  }

  if (reasons.length > 0) {
    if (reasons.includes('school-info')) {
      return {
        level: 'block',
        reasons,
        messageJa:
          '学校名や学年・クラスは入れないでね。本名や学校がわからないニックネーム（ペンネーム）にしよう！',
        messageEn:
          'Please do not include your school name, grade, or class. Use a nickname or pen name instead.',
      };
    }
    return {
      level: 'block',
      reasons,
      messageJa:
        '電話番号・メールアドレス・住所などの個人情報は入れないでね。ニックネーム（ペンネーム）を使おう！',
      messageEn:
        'Please do not include personal contact info (email, phone number, or address). Use a nickname or pen name instead.',
    };
  }

  if (looksLikeJapaneseRealName(trimmed)) {
    return {
      level: 'warn',
      reasons: ['possible-real-name'],
      messageJa:
        '本名のように見えます。みんなに見られても安心なニックネーム（ペンネーム）を使うのがおすすめだよ！',
      messageEn:
        'This looks like a real full name. We recommend using a nickname or pen name to stay safe.',
    };
  }

  return { level: 'safe', reasons: [], messageJa: null, messageEn: null };
}
