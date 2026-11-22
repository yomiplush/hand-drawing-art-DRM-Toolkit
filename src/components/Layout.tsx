import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  FileSignature,
  Globe,
  Home,
  KeyRound,
  Menu,
  RefreshCw,
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

  const navItems = [
    { to: '/', label: t.nav.home, icon: Home, end: true },
    { to: '/tutorial', label: t.tutorial.navLabel, icon: Compass, end: false },
    { to: '/create', label: t.nav.create, icon: FileSignature, end: false },
    { to: '/verify', label: t.nav.verify, icon: ShieldCheck, end: false },
    { to: '/keys', label: t.nav.keys, icon: KeyRound, end: false },
    { to: '/docs', label: t.nav.docs, icon: BookOpen, end: false },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 xl:px-3 py-1.5 text-[13px] xl:text-sm font-medium transition-colors min-h-[38px] ${
      isActive
        ? 'bg-white/[0.1] text-white border border-white/[0.16]'
        : 'text-slate-300/90 hover:bg-white/[0.06] hover:text-white border border-transparent'
    }`;

  return (
    <div className={`relative z-10 min-h-screen flex flex-col bg-transparent text-slate-100 ${bannerOpen ? "pb-52 sm:pb-40" : ""}`}>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#030b17]/65 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-slate-100 font-medium tracking-tight shrink-0"
            >
              <img
                src="/favicon.svg"
                alt=""
                className="h-7 w-7 rounded-md opacity-95"
              />
              <span className="text-base sm:text-[17px] text-slate-100 tracking-wide">
                {t.appName}
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    <Icon className="h-4 w-4 opacity-80 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {!isOnline ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200"
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t.pwa.offlineBadge}</span>
                </span>
              ) : offlineReady ? (
                <span
                  role="status"
                  className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300/90" aria-hidden="true" />
                  <span>{t.pwa.onlineReadyBadge}</span>
                </span>
              ) : null}

              <div className="relative inline-flex items-center">
                <Globe
                  className="h-3.5 w-3.5 text-slate-300 pointer-events-none absolute start-2.5"
                  aria-hidden="true"
                />
                <select
                  aria-label="Language"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  data-testid="lang-select"
                  className="appearance-none rounded-md border border-white/[0.12] bg-[#061224]/80 ps-8 pe-6 py-1.5 text-xs sm:text-sm font-medium text-slate-100 hover:border-white/[0.25] transition-colors min-h-[38px] cursor-pointer"
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

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label={t.nav.menuLabel}
                className="lg:hidden inline-flex items-center justify-center rounded-md border border-white/[0.12] bg-[#061224]/75 p-2 text-slate-200 hover:border-white/[0.25] min-h-[40px] min-w-[40px]"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile"
            className="lg:hidden border-t border-white/[0.08] bg-[#041020]/90 backdrop-blur-md px-4 py-3 space-y-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                      isActive
                        ? 'bg-white/[0.1] text-white border border-white/[0.16]'
                        : 'text-slate-200 hover:bg-white/[0.05]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 opacity-80" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {needRefresh && (
          <div className="border-t border-white/[0.1] bg-[#071c36]/85 px-4 py-2 text-xs sm:text-sm text-sky-100">
            <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
              <span>{t.pwa.updateAvailable}</span>
              <button
                type="button"
                onClick={onUpdateSw}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.pwa.updateButton}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.08] bg-[#020813]/70 backdrop-blur-md py-6 text-xs text-slate-400">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-slate-200">
              {t.appName} — {t.tagline}
            </p>
            <p>{t.pwa.localOnlyPill} · MIT License</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/tutorial"
              data-testid="footer-tutorial-link"
              className="hover:text-white transition-colors"
            >
              {t.tutorial.navLabel}
            </Link>
            <Link to="/docs" className="hover:text-white transition-colors">
              {t.nav.docs}
            </Link>
            <Link
              to="/#privacypolicy"
              data-testid="footer-privacy-link"
              className="hover:text-white transition-colors"
            >
              {t.nav.privacy}
            </Link>
            <button
              type="button"
              onClick={onOpenCookieSettings}
              data-testid="footer-cookie-settings"
              className="hover:text-white transition-colors cursor-pointer"
            >
              {t.nav.cookieSettings}
            </button>
            <a
              href="https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
