import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  Cloud,
  Compass,
  Cookie,
  FileSignature,
  Globe,
  HardDriveDownload,
  Heart,
  HelpCircle,
  KeyRound,
  Menu,
  RefreshCw,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { LOCALE_OPTIONS, useI18n } from '../i18n/context';
import type { Locale } from '../i18n/context';
import { useAppPreferences } from './PreferencesContext';
import { ModeToggle } from './ui/ModeToggle';
import { ThemeToggle } from './ui/ThemeToggle';

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
  const { isAdvanced } = useAppPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const menuId = useId();
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const isJa = locale === 'ja';

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
    `inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors min-h-[44px] ${
      isActive
        ? 'bg-[var(--ga-accent-soft)] text-[var(--ga-accent)] border ga-border-strong'
        : 'ga-text-secondary hover:bg-[var(--ga-accent-soft)] hover:text-[var(--ga-text)] border border-transparent'
    }`;

  const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
      isActive
        ? 'bg-[var(--ga-accent-soft)] text-[var(--ga-accent)] border ga-border-strong'
        : 'ga-text-secondary hover:bg-[var(--ga-accent-soft)] hover:text-[var(--ga-text)] border border-transparent'
    }`;

  const simpleMenuItems = [
    {
      to: '/storage',
      label: isJa ? '端末同期とバックアップ' : 'Sync & Backup',
      icon: Cloud,
      testId: 'menu-storage-link',
    },
    {
      to: '/keys',
      label: isJa ? '鍵のバックアップ・復元' : 'Key Backup & Restore',
      icon: KeyRound,
      testId: 'menu-keys-link',
    },
    {
      to: '/tutorial',
      label: isJa ? 'ヘルプ・使い方ガイド' : 'Help & Guide',
      icon: HelpCircle,
      testId: 'menu-tutorial-link',
    },
  ];

  const advancedMenuItems = [
    { to: '/keys', label: t.minimal.nav.myKeysItem, icon: KeyRound, testId: 'menu-keys-link' },
    { to: '/devices', label: t.devices.navItem, icon: Smartphone, testId: 'menu-devices-link' },
    { to: '/vault', label: t.vault.navItem, icon: Archive, testId: 'menu-vault-link' },
    { to: '/storage', label: t.nextGen.navStorage, icon: Cloud, testId: 'menu-storage-link' },
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

  const menuItems = isAdvanced ? advancedMenuItems : simpleMenuItems;

  return (
    <div
      className={`relative z-10 min-h-screen flex flex-col bg-transparent ga-text ${bannerOpen ? 'pb-52 sm:pb-40' : ''}`}
    >
      <header className="sticky top-0 z-40 ga-header">
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Link
                to="/"
                className="flex items-center gap-2.5 ga-text font-semibold tracking-tight min-w-0 min-h-[44px] py-1"
              >
                <img
                  src="/favicon.svg"
                  alt=""
                  className="h-7 w-7 rounded-lg opacity-95 shrink-0"
                />
                <span className="text-sm sm:text-base ga-text tracking-tight truncate">
                  {t.appName}
                </span>
              </Link>

              <nav className="hidden sm:flex items-center gap-1" aria-label="Primary">
                <NavLink to="/create" className={primaryLinkClass} data-testid="nav-create-link">
                  <FileSignature className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                  <span>{t.minimal.nav.createShort}</span>
                </NavLink>
                <NavLink to="/verify" className={primaryLinkClass} data-testid="nav-verify-link">
                  <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                  <span>{t.minimal.nav.verifyShort}</span>
                </NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" ref={menuContainerRef}>
              {!isOnline && (
                <span
                  role="status"
                  title={t.pwa.offlineBadge}
                  className="inline-flex items-center gap-1.5 rounded-xl border ga-status-warning px-2.5 py-1.5 text-xs font-medium min-h-[36px]"
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">{t.pwa.offlineBadge}</span>
                </span>
              )}

              <div className="relative inline-flex items-center">
                <Globe
                  className="h-3.5 w-3.5 ga-text-muted pointer-events-none absolute start-2.5"
                  aria-hidden="true"
                />
                <select
                  aria-label={t.minimal.nav.languageLabel}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  data-testid="lang-select"
                  className="appearance-none rounded-xl ga-btn-secondary max-w-[88px] sm:max-w-[144px] md:max-w-none truncate ps-8 pe-6 py-2 text-xs sm:text-sm font-medium transition-colors min-h-[44px] cursor-pointer"
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option
                      key={opt.code}
                      value={opt.code}
                      className="bg-[var(--ga-surface-solid)] text-[var(--ga-text)]"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-2 text-[10px] ga-text-muted"
                >
                  ▾
                </span>
              </div>

              <ThemeToggle />

              <div className="relative">
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  aria-label={t.minimal.nav.menuBtn}
                  data-testid="nav-menu-toggle"
                  className="inline-flex items-center justify-center gap-2 rounded-xl ga-btn-secondary px-3 py-2 text-sm font-medium transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
                >
                  {menuOpen ? (
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Settings className="h-4 w-4 shrink-0 hidden sm:block" aria-hidden="true" />
                  )}
                  {!menuOpen && (
                    <Menu className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
                  )}
                  <span className="hidden md:inline">{t.minimal.nav.menuBtn}</span>
                </button>

                {menuOpen && (
                  <nav
                    id={menuId}
                    aria-label={t.minimal.nav.menuBtn}
                    data-testid="nav-menu-panel"
                    className="fixed inset-x-3 top-[4.25rem] z-50 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl ga-popover p-3.5 space-y-2 max-h-[82vh] overflow-y-auto"
                  >
                    <div className="rounded-xl ga-surface-subtle p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider ga-text-muted">
                          {isJa ? '表示モード' : 'Mode'}
                        </span>
                        <span className="text-[11px] ga-text-muted">
                          {isAdvanced
                            ? isJa
                              ? '詳細機能を表示中'
                              : 'All tools visible'
                            : isJa
                              ? '基本操作のみ'
                              : 'Essentials only'}
                        </span>
                      </div>
                      <ModeToggle compact testId="nav-mode-toggle" />
                    </div>

                    <div className="sm:hidden space-y-1 pb-2 border-b ga-border">
                      <NavLink
                        to="/create"
                        onClick={() => setMenuOpen(false)}
                        className={menuLinkClass}
                      >
                        <FileSignature className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                        <span>{t.home.ctaCreate}</span>
                      </NavLink>
                      <NavLink
                        to="/verify"
                        onClick={() => setMenuOpen(false)}
                        className={menuLinkClass}
                      >
                        <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                        <span>{t.home.ctaVerify}</span>
                      </NavLink>
                    </div>

                    <div className="space-y-1">
                      {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            data-testid={item.testId}
                            onClick={() => setMenuOpen(false)}
                            className={menuLinkClass}
                          >
                            <Icon className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>

                    <div className="pt-2 mt-2 border-t ga-border space-y-1">
                      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ga-text-muted">
                        {t.minimal.nav.settingsSection}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenCookieSettings();
                        }}
                        data-testid="menu-cookie-settings"
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ga-text-secondary hover:bg-[var(--ga-accent-soft)] hover:text-[var(--ga-text)] min-h-[44px] cursor-pointer text-start"
                      >
                        <Cookie className="h-4 w-4 ga-text-muted shrink-0" aria-hidden="true" />
                        <span>{t.nav.cookieSettings}</span>
                      </button>

                      <Link
                        to="/privacypolicy"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ga-text-secondary hover:bg-[var(--ga-accent-soft)] hover:text-[var(--ga-text)] min-h-[44px]"
                      >
                        <Shield className="h-4 w-4 ga-text-muted shrink-0" aria-hidden="true" />
                        <span>{t.nav.privacy}</span>
                      </Link>

                      <div className="flex items-center gap-2 px-1 pt-1">
                        <a
                          href={GITHUB_REPO_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="header-github-link"
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl ga-btn-secondary px-3 py-2 text-xs font-medium min-h-[44px]"
                        >
                          <span>GitHub</span>
                        </a>
                        <a
                          href={GITHUB_SPONSORS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="header-sponsor-link"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-200 hover:bg-rose-500/20 min-h-[44px]"
                        >
                          <Heart className="h-3.5 w-3.5 fill-rose-400/30" aria-hidden="true" />
                          <span>Sponsor</span>
                        </a>
                      </div>

                      {offlineReady && isOnline && (
                        <div className="px-3 pt-1.5 flex items-center gap-2 text-[11px] ga-text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ga-accent)]" aria-hidden="true" />
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
          <div className="border-t ga-border ga-status-info px-4 py-2 text-xs sm:text-sm">
            <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
              <span>{t.pwa.updateAvailable}</span>
              <button
                type="button"
                onClick={onUpdateSw}
                className="inline-flex items-center gap-1.5 rounded-lg ga-btn-primary px-3 py-1.5 text-xs font-semibold min-h-[36px] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.pwa.updateButton}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12 min-w-0">
        <Outlet />
      </main>

      <footer className="border-t ga-border ga-header py-5 text-xs ga-text-muted">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="ga-text-secondary font-medium">
            {t.appName} · {t.pwa.localOnlyPill} · MIT
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/tutorial" className="hover:text-[var(--ga-text)] transition-colors py-1">
              {t.tutorial.navLabel}
            </Link>
            <Link to="/docs" className="hover:text-[var(--ga-text)] transition-colors py-1">
              {t.nav.docs}
            </Link>
            <Link
              to="/privacypolicy"
              data-testid="footer-privacy-link"
              className="hover:text-[var(--ga-text)] transition-colors py-1"
            >
              {t.nav.privacy}
            </Link>
            <button
              type="button"
              onClick={onOpenCookieSettings}
              data-testid="footer-cookie-settings"
              className="hover:text-[var(--ga-text)] transition-colors cursor-pointer py-1"
            >
              {t.nav.cookieSettings}
            </button>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--ga-text)] transition-colors py-1"
            >
              GitHub
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-sponsor-link"
              className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300 hover:underline transition-colors py-1"
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
