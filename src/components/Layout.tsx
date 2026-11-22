import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
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
import { useI18n } from '../i18n/context';

interface LayoutProps {
  offlineReady: boolean;
  needRefresh: boolean;
  onUpdateSw: () => void;
}

export function Layout({ offlineReady, needRefresh, onUpdateSw }: LayoutProps) {
  const { t, toggleLocale } = useI18n();
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
    { to: '/create', label: t.nav.create, icon: FileSignature, end: false },
    { to: '/verify', label: t.nav.verify, icon: ShieldCheck, end: false },
    { to: '/keys', label: t.nav.keys, icon: KeyRound, end: false },
    { to: '/docs', label: t.nav.docs, icon: BookOpen, end: false },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
      isActive
        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#06111e] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-cyan-500/15 bg-[#06111e]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-white font-semibold tracking-tight shrink-0"
            >
              <img
                src="/favicon.svg"
                alt=""
                className="h-8 w-8 rounded-lg shadow-sm shadow-cyan-500/20"
              />
              <span className="text-base sm:text-lg bg-gradient-to-r from-sky-200 via-cyan-200 to-sky-400 bg-clip-text text-transparent">
                {t.appName}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {!isOnline ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t.pwa.offlineBadge}</span>
                </span>
              ) : offlineReady ? (
                <span
                  role="status"
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                  <span>{t.pwa.onlineReadyBadge}</span>
                </span>
              ) : null}

              <button
                type="button"
                onClick={toggleLocale}
                data-testid="lang-toggle"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors min-h-[40px]"
              >
                <Globe className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                <span>{t.nav.langToggle}</span>
              </button>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label={t.nav.menuLabel}
                className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/70 p-2 text-slate-200 hover:border-cyan-400/40 min-h-[44px] min-w-[44px]"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile"
            className="md:hidden border-t border-slate-800 bg-[#081628] px-4 py-3 space-y-1"
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
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
                        : 'text-slate-200 hover:bg-slate-800/70'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {needRefresh && (
          <div className="border-t border-cyan-500/25 bg-cyan-950/70 px-4 py-2 text-xs sm:text-sm text-cyan-100">
            <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
              <span>{t.pwa.updateAvailable}</span>
              <button
                type="button"
                onClick={onUpdateSw}
                className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.pwa.updateButton}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800/80 bg-[#040c16] py-6 text-xs text-slate-400">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-slate-300">
              {t.appName} — {t.tagline}
            </p>
            <p>{t.pwa.localOnlyPill} · MIT License</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/docs" className="hover:text-cyan-300 transition-colors">
              {t.nav.docs}
            </Link>
            <a
              href="https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-300 transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
