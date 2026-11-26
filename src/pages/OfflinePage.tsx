import { Download, ExternalLink, HardDriveDownload, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StandaloneEditionSection } from '../components/StandaloneEditionSection';
import { useI18n } from '../i18n/context';
import { STANDALONE_I18N } from '../i18n/standalone';

const GITHUB_RELEASES_LATEST_URL =
  'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/releases/latest';
const GITHUB_RELEASES_URL =
  'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/releases';

export function OfflinePage() {
  const { locale } = useI18n();
  const s = STANDALONE_I18N[locale];
  const isJa = locale === 'ja';

  return (
    <div className="space-y-8 min-w-0">
      <header className="space-y-2 border-b ga-border pb-5 min-w-0">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--ga-accent)]">
          <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{s.badge}</span>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold ga-text break-words">{s.title}</h1>
        <p className="text-sm sm:text-base ga-text-secondary break-words">{s.subtitle}</p>
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <a
            href={GITHUB_RELEASES_LATEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="offline-latest-release-link"
            className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors min-h-[44px]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{isJa ? '最新リリースをダウンロード (GitHub Releases)' : 'Download Latest Release (GitHub)'}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
          </a>
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors min-h-[44px]"
          >
            <span>{isJa ? 'すべてのリリース一覧' : 'All Releases'}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </a>
        </div>
      </header>

      <StandaloneEditionSection variant="docs" />

      <section className="ga-card rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
          <span>{isJa ? '起動方法とチェックサム検証' : 'Quick Start & Checksum Verification'}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ga-surface-subtle rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium ga-text">Linux (x86_64)</h3>
            <pre className="overflow-x-auto rounded-lg bg-black/25 p-3 font-mono text-[11px] leading-relaxed ga-text">
{`tar -xzf certified-handmade-standalone-*-linux-amd64.tar.gz
chmod +x certified-handmade-linux-amd64
./certified-handmade-linux-amd64`}
            </pre>
            <p className="text-xs ga-text-secondary leading-relaxed">
              {isJa
                ? '起動すると自動的に http://127.0.0.1:43777/ が既定のブラウザで開きます。'
                : 'Automatically launches http://127.0.0.1:43777/ in your default browser.'}
            </p>
          </div>

          <div className="ga-surface-subtle rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium ga-text">Windows (x86_64)</h3>
            <pre className="overflow-x-auto rounded-lg bg-black/25 p-3 font-mono text-[11px] leading-relaxed ga-text">
{`# ZIP を展開して実行ファイルをダブルクリック
certified-handmade-windows-amd64.exe`}
            </pre>
            <p className="text-xs ga-text-secondary leading-relaxed">
              {isJa
                ? 'コンソールウィンドウを開いたまま利用し、終了時は Ctrl+C またはウィンドウを閉じてください。'
                : 'Keep the console window open while using the app; press Ctrl+C or close it when finished.'}
            </p>
          </div>
        </div>

        <div className="ga-surface-subtle rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium ga-text flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{isJa ? 'SHA-256 改ざん検証 (SHA256SUMS.txt)' : 'SHA-256 Integrity Check (SHA256SUMS.txt)'}</span>
          </h3>
          <pre className="overflow-x-auto rounded-lg bg-black/25 p-3 font-mono text-[11px] leading-relaxed ga-text">
{`sha256sum -c SHA256SUMS.txt --ignore-missing`}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            to="/keys"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[40px]"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isJa ? 'マイ鍵管理でバックアップ (.chkey.json) を作成' : 'Back up keys (.chkey.json) in My Keys'}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
