import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  Cookie,
  FileSignature,
  Globe,
  HardDriveDownload,
  Heart,
  KeyRound,
  Menu,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { LOCALE_OPTIONS, useI18n } from '../i18n/context';
import type { Locale } from '../i18n/context';

interface LayoutProps {
  offlineReady: boolean;
  needRefresh: boolean;
  onUpdateSw: () => void;
  onOpenCookieSettings: () => void;
  bannerOpen?: boolean;
}

const GITHUB_REPO_URL = 'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit';
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/yomiplush';

export function Layout({
  offlineReady,
  needRefresh,
  onUpdateSw,
  onOpenCookieSettings,
  bannerOpen = false,
}: LayoutProps) {
  const { t, locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const menuId = useId();
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const primaryLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors min-h-[44px] ${
      isActive
        ? 'bg-white/[0.12] text-white border border-white/[0.18]'
        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
    }`;

  const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
      isActive
        ? 'bg-white/[0.1] text-white border border-white/[0.16]'
        : 'text-slate-200 hover:bg-white/[0.06] hover:text-white border border-transparent'
    }`;

  const secondaryItems = [
    { to: '/keys', label: t.minimal.nav.myKeysItem, icon: KeyRound, testId: 'menu-keys-link' },
    {
      to: '/exchange',
      label: t.minimal.nav.keyExchangeItem,
      icon: Share2,
      testId: 'menu-exchange-link',
    },
    { to: '/docs', label: t.nav.docs, icon: BookOpen, testId: 'menu-docs-link' },
    { to: '/tutorial', label: t.tutorial.navLabel, icon: Compass, testId: 'menu-tutorial-link' },
    {
      to: '/docs#standalone',
      label: t.minimal.nav.standaloneItem,
      icon: HardDriveDownload,
      testId: 'menu-standalone-link',
    },
  ];

  return (
    <div
      className={`relative z-10 min-h-screen flex flex-col bg-transparent text-slate-100 ${bannerOpen ? 'pb-52 sm:pb-40' : ''}`}
    >
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#030b17]/75 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                to="/"
                className="flex items-center gap-2.5 text-slate-100 font-semibold tracking-tight min-w-0 min-h-[44px] py-1"
              >
                <img
                  src="/favicon.svg"
                  alt=""
                  className="h-7 w-7 rounded-md opacity-95 shrink-0"
                />
                <span className="text-sm sm:text-base text-slate-100 tracking-wide truncate">
                  {t.appName}
                </span>
              </Link>

              <nav className="hidden sm:flex items-center gap-1" aria-label="Primary">
                <NavLink to="/create" className={primaryLinkClass} data-testid="nav-create-link">
                  <FileSignature className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                  <span>{t.minimal.nav.createShort}</span>
                </NavLink>
                <NavLink to="/verify" className={primaryLinkClass} data-testid="nav-verify-link">
                  <ShieldCheck className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                  <span>{t.minimal.nav.verifyShort}</span>
                </NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0" ref={menuContainerRef}>
              {!isOnline && (
                <span
                  role="status"
                  title={t.pwa.offlineBadge}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 min-h-[36px]"
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">{t.pwa.offlineBadge}</span>
                </span>
              )}

              <div className="relative inline-flex items-center">
                <Globe
                  className="h-3.5 w-3.5 text-slate-300 pointer-events-none absolute start-2.5"
                  aria-hidden="true"
                />
                <select
                  aria-label={t.minimal.nav.languageLabel}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  data-testid="lang-select"
                  className="appearance-none rounded-lg border border-white/[0.12] bg-[#061224]/80 max-w-[92px] sm:max-w-none ps-8 pe-6 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:border-white/[0.25] transition-colors min-h-[44px] cursor-pointer"
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code} className="bg-[#061224] text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-2 text-[10px] text-slate-400"
                >
                  ▾
                </span>
              </div>

              <div className="relative">
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  aria-label={t.minimal.nav.menuBtn}
                  data-testid="nav-menu-toggle"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.14] bg-[#061224]/80 px-3 py-2 text-sm font-medium text-slate-100 hover:border-sky-400/40 hover:text-white transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
                >
                  {menuOpen ? (
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Menu className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="hidden md:inline">{t.minimal.nav.menuBtn}</span>
                </button>

                {menuOpen && (
                  <nav
                    id={menuId}
                    aria-label={t.minimal.nav.menuBtn}
                    data-testid="nav-menu-panel"
                    className="fixed inset-x-3 top-[4.25rem] z-50 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-72 rounded-2xl border border-white/[0.14] bg-[#041021]/95 backdrop-blur-xl shadow-2xl shadow-black/80 p-3 space-y-1 max-h-[80vh] overflow-y-auto"
                  >
                    <div className="sm:hidden space-y-1 pb-2 mb-2 border-b border-white/[0.08]">
                      <NavLink
                        to="/create"
                        onClick={() => setMenuOpen(false)}
                        className={menuLinkClass}
                      >
                        <FileSignature className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                        <span>{t.home.ctaCreate}</span>
                      </NavLink>
                      <NavLink
                        to="/verify"
                        onClick={() => setMenuOpen(false)}
                        className={menuLinkClass}
                      >
                        <ShieldCheck className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                        <span>{t.home.ctaVerify}</span>
                      </NavLink>
                    </div>

                    {secondaryItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          data-testid={item.testId}
                          onClick={() => setMenuOpen(false)}
                          className={menuLinkClass}
                        >
                          <Icon className="h-4 w-4 text-sky-300/90 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}

                    <div className="pt-2 mt-2 border-t border-white/[0.08] space-y-1">
                      <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        {t.minimal.nav.settingsSection}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenCookieSettings();
                        }}
                        data-testid="menu-cookie-settings"
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.06] hover:text-white min-h-[44px] cursor-pointer text-start"
                      >
                        <Cookie className="h-4 w-4 text-slate-300 shrink-0" aria-hidden="true" />
                        <span>{t.nav.cookieSettings}</span>
                      </button>

                      <Link
                        to="/#privacypolicy"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.06] hover:text-white min-h-[44px]"
                      >
                        <Shield className="h-4 w-4 text-slate-300 shrink-0" aria-hidden="true" />
                        <span>{t.nav.privacy}</span>
                      </Link>

                      <div className="flex items-center gap-2 px-1 pt-1">
                        <a
                          href={GITHUB_REPO_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="header-github-link"
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:border-white/[0.25] hover:text-white min-h-[44px]"
                        >
                          <span>GitHub</span>
                        </a>
                        <a
                          href={GITHUB_SPONSORS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="header-sponsor-link"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:border-rose-400/45 hover:bg-rose-500/20 min-h-[44px]"
                        >
                          <Heart className="h-3.5 w-3.5 fill-rose-400/30" aria-hidden="true" />
                          <span>Sponsor</span>
                        </a>
                      </div>

                      {offlineReady && isOnline && (
                        <div className="px-3 pt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-300/90" aria-hidden="true" />
                          <span>{t.pwa.onlineReadyBadge}</span>
                        </div>
                      )}
                    </div>
                  </nav>
                )}
              </div>
            </div>
          </div>
        </div>

        {needRefresh && (
          <div className="border-t border-white/[0.1] bg-[#071c36]/85 px-4 py-2 text-xs sm:text-sm text-sky-100">
            <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
              <span>{t.pwa.updateAvailable}</span>
              <button
                type="button"
                onClick={onUpdateSw}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white min-h-[36px]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.pwa.updateButton}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.08] bg-[#020813]/70 backdrop-blur-md py-5 text-xs text-slate-400">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-slate-300">
            {t.appName} · {t.pwa.localOnlyPill} · MIT
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/docs" className="hover:text-white transition-colors py-1">
              {t.nav.docs}
            </Link>
            <Link
              to="/#privacypolicy"
              data-testid="footer-privacy-link"
              className="hover:text-white transition-colors py-1"
            >
              {t.nav.privacy}
            </Link>
            <button
              type="button"
              onClick={onOpenCookieSettings}
              data-testid="footer-cookie-settings"
              className="hover:text-white transition-colors cursor-pointer py-1"
            >
              {t.nav.cookieSettings}
            </button>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors py-1"
            >
              GitHub
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-sponsor-link"
              className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 transition-colors py-1"
            >
              <Heart className="h-3.5 w-3.5 fill-rose-400/30" aria-hidden="true" />
              <span>Sponsor</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
