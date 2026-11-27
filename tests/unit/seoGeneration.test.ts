import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd());

describe('SEO, JSON-LD, OGP & AEO (llms.txt) assets', () => {
  it('includes SoftwareApplication, FAQPage, HowTo JSON-LD, multilingual hreflang, and OGP image in index.html', () => {
    const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

    // Multilingual hreflang
    expect(indexHtml).toContain('hreflang="x-default"');
    expect(indexHtml).toContain('hreflang="en"');
    expect(indexHtml).toContain('hreflang="ja"');
    expect(indexHtml).toContain('hreflang="zh-CN"');
    expect(indexHtml).toContain('hreflang="zh-TW"');
    expect(indexHtml).toContain('hreflang="ko"');

    // OGP & Twitter Card
    expect(indexHtml).toContain('property="og:image" content="https://certified-handmade.com/og-image.png"');
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"');
    expect(indexHtml).toContain('name="twitter:image" content="https://certified-handmade.com/og-image.png"');

    // JSON-LD structured data
    const jsonLdMatch = indexHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(jsonLdMatch).not.toBeNull();
    const parsed = JSON.parse(jsonLdMatch![1]);
    const types = parsed['@graph'].map((node: { '@type': string }) => node['@type']);
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('FAQPage');
    expect(types).toContain('HowTo');
  });

  it('provides public/llms.txt, public/llms-full.txt, and public/og-image.png', () => {
    const llmsTxt = fs.readFileSync(path.join(repoRoot, 'public/llms.txt'), 'utf8');
    const llmsFullTxt = fs.readFileSync(path.join(repoRoot, 'public/llms-full.txt'), 'utf8');

    expect(llmsTxt).toContain('Certified Handmade');
    expect(llmsTxt).toContain('sourceCommitmentHash');
    expect(llmsFullTxt).toContain('Google Drive');
    expect(llmsFullTxt).toContain('C2PA');
    expect(fs.existsSync(path.join(repoRoot, 'public/og-image.png'))).toBe(true);
  });

  it('configures generate-seo-pages.mjs to output multilingual sitemap.xml and robots.txt', () => {
    const script = fs.readFileSync(path.join(repoRoot, 'scripts/generate-seo-pages.mjs'), 'utf8');
    expect(script).toContain('sitemap.xml');
    expect(script).toContain('xhtml:link');
    expect(script).toContain('robots.txt');
    expect(script).toContain('Sitemap: https://certified-handmade.com/sitemap.xml');
  });
});
