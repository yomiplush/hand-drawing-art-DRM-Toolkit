import { describe, expect, it } from 'vitest';
import { inspectAuthorName } from '../../src/core/security/authorNameGuard';

describe('inspectAuthorName (child-safe real-name & PII guard)', () => {
  it('allows normal nicknames and pen names', () => {
    expect(inspectAuthorName('')).toMatchObject({ level: 'safe', reasons: [] });
    expect(inspectAuthorName('YomiPlush')).toMatchObject({ level: 'safe', reasons: [] });
    expect(inspectAuthorName('さくら')).toMatchObject({ level: 'safe', reasons: [] });
    expect(inspectAuthorName('ねこみみ画伯')).toMatchObject({ level: 'safe', reasons: [] });
    expect(inspectAuthorName('Blue Moon')).toMatchObject({ level: 'safe', reasons: [] });
  });

  it('blocks school names, grades, and class numbers', () => {
    expect(inspectAuthorName('さくら小学校 はなこ')).toMatchObject({
      level: 'block',
      reasons: ['school-info'],
    });
    expect(inspectAuthorName('3年2組 ゆうた')).toMatchObject({
      level: 'block',
      reasons: ['school-info'],
    });
    expect(inspectAuthorName('小学4年生')).toMatchObject({
      level: 'block',
      reasons: ['school-info'],
    });
    expect(inspectAuthorName('Maple Elementary School')).toMatchObject({
      level: 'block',
      reasons: ['school-info'],
    });
    expect(inspectAuthorName('Grade 5 Artist')).toMatchObject({
      level: 'block',
      reasons: ['school-info'],
    });
  });

  it('blocks email addresses, phone numbers, and Japanese addresses', () => {
    expect(inspectAuthorName('hanako@example.com')).toMatchObject({
      level: 'block',
      reasons: ['personal-contact'],
    });
    expect(inspectAuthorName('090-1234-5678')).toMatchObject({
      level: 'block',
      reasons: ['personal-contact'],
    });
    expect(inspectAuthorName('東京都渋谷区')).toMatchObject({
      level: 'block',
      reasons: ['personal-contact'],
    });
  });

  it('warns gently on likely Japanese real full names', () => {
    expect(inspectAuthorName('山田 太郎')).toMatchObject({
      level: 'warn',
      reasons: ['possible-real-name'],
    });
    expect(inspectAuthorName('佐藤　はなこ')).toMatchObject({
      level: 'warn',
      reasons: ['possible-real-name'],
    });
  });
});
