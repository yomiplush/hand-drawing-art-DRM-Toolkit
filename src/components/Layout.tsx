import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  Cloud,
  FileSignature,
  Gamepad2,
  Globe,
  Heart,
  KeyRound,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { listAuthorKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
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
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);

  const refreshKeysStatus = useCallback(() => {
    void listAuthorKeys()
      .then((keys) => setAuthorKeys(keys))
      .catch(() => {});
  }, []);

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
    if (!isAdvanced) return;
    refreshKeysStatus();
    const onKeysUpdated = () => refreshKeysStatus();
    window.addEventListener('chm-keys-updated', onKeysUpdated);
    return () => {
      window.removeEventListener('chm-keys-updated', onKeysUpdated);
    };
  }, [isAdvanced, location.pathname, refreshKeysStatus]);

  const cockpitLinkClass = ({ isActive }: { isActive: boolean }) =>
    `chm-link-dynamic inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-medium min-h-[36px] shrink-0 ${
      isActive
        ? 'bg-[var(--ga-accent-soft)] text-[var(--ga-accent)] border ga-border-strong'
        : 'ga-text-secondary hover:bg-[var(--ga-accent-soft)] hover:text-[var(--ga-text)] border border-transparent'
    }`;

  const cockpitNavItems = [
    { to: '/create', label: t.minimal.nav.createShort, icon: FileSignature, testId: 'cockpit-create-link' },
    { to: '/verify', label: t.minimal.nav.verifyShort, icon: ShieldCheck, testId: 'cockpit-verify-link' },
    { to: '/gallerydeck', label: t.galleryDeck.navItem, icon: Gamepad2, testId: 'cockpit-gallerydeck-link' },
    { to: '/keys', label: t.minimal.nav.myKeysItem, icon: KeyRound, testId: 'cockpit-keys-link' },
    { to: '/exchange', label: t.minimal.nav.keyExchangeItem, icon: Share2, testId: 'cockpit-exchange-link' },
    { to: '/storage', label: t.nextGen.navStorage, icon: Cloud, testId: 'cockpit-storage-link' },
    { to: '/vault', label: t.vault.navItem, icon: Archive, testId: 'cockpit-vault-link' },
    { to: '/devices', label: t.devices.navItem, icon: Smartphone, testId: 'cockpit-devices-link' },
    { to: '/spec', label: t.simple.header.specNavLabel, icon: BookOpen, testId: 'cockpit-spec-link' },
  ];

  const primaryKey = authorKeys[0] ?? null;

  return (
    <div
      className={`relative z-10 min-h-screen flex flex-col bg-transparent ga-text ${bannerOpen ? 'pb-52 sm:pb-40' : ''}`}
    >
      <header className="sticky top-0 z-40 ga-header">
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          {/* Primary Header Bar: max 3 visual groups in Simple Mode (Brand, Mode Pill, Language) */}
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2 min-w-0">
            <Link
              to="/"
              data-testid="header-brand-link"
              className="flex items-center gap-2 sm:gap-2.5 ga-text font-semibold tracking-tight min-w-0 min-h-[40px] py-1 shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                fill="none"
                aria-hidden="true"
                className="h-7 w-7 rounded-md shrink-0"
              >
                <rect x="4" y="4" width="56" height="56" rx="10" fill="var(--ga-accent)" />
                <rect
                  x="10"
                  y="10"
                  width="44"
                  height="44"
                  rx="6"
                  stroke="#FAF9F6"
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                />
                <path
                  d="M21 41L25.5 27.5L39 18L44.5 23.5L35 37L21 41Z"
                  stroke="#FAF9F6"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                  fill="#FAF9F6"
                  fillOpacity="0.18"
                />
                <circle cx="34.5" cy="27.5" r="2.2" fill="#FAF9F6" />
              </svg>
              <span className="hidden sm:inline text-base ga-text tracking-tight truncate">
                {t.appName}
              </span>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
              {!isOnline && (
                <span
                  role="status"
                  title={t.pwa.offlineBadge}
                  className="inline-flex items-center gap-1.5 rounded-full border ga-status-warning px-2 sm:px-2.5 py-1 text-xs font-medium min-h-[34px]"
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">{t.pwa.offlineBadge}</span>
                </span>
              )}

              <ModeToggle compact testId="header-mode-toggle" />

              <div className="relative inline-flex items-center shrink-0">
                <Globe
                  className="h-3.5 w-3.5 ga-text-muted pointer-events-none absolute start-2.5"
                  aria-hidden="true"
                />
                <select
                  aria-label={t.simple.header.languageAria}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  data-testid="lang-select"
                  className="appearance-none rounded-full ga-btn-secondary max-w-[78px] sm:max-w-[144px] md:max-w-none truncate ps-7 pe-5 py-1.5 text-xs sm:text-sm font-medium transition-colors min-h-[38px] sm:min-h-[40px] cursor-pointer"
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
            </div>
          </div>
        </div>

        {/* Advanced Mode Unfolded Cockpit Bar & Live Status Ribbon */}
        {isAdvanced && (
          <div
            data-testid="advanced-cockpit-bar"
            className="border-t ga-border bg-[var(--ga-surface-subtle)]"
          >
            <div className="mx-auto max-w-5xl px-3 sm:px-6 py-1.5 sm:py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 overflow-x-auto chm-no-scrollbar min-w-0 py-0.5">
                <nav
                  aria-label="Advanced workspace navigation"
                  className="flex flex-nowrap md:flex-wrap items-center gap-1 min-w-0 shrink-0 md:shrink"
                >
                  {cockpitNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        data-testid={item.testId}
                        className={cockpitLinkClass}
                      >
                        <Icon className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="header-github-link"
                    className="inline-flex items-center justify-center rounded-lg ga-btn-secondary px-2.5 py-1.5 text-xs font-medium min-h-[34px] shrink-0 whitespace-nowrap"
                  >
                    GitHub
                  </a>
                  <a
                    href={GITHUB_SPONSORS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="header-sponsor-link"
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-200 hover:bg-rose-500/20 min-h-[34px] shrink-0 whitespace-nowrap"
                  >
                    <Heart className="h-3 w-3 fill-rose-400/30" aria-hidden="true" />
                    <span>Sponsor</span>
                  </a>
                </div>
              </div>

              <div
                data-testid="advanced-status-ribbon"
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1.5 border-t ga-border text-[11px] font-mono ga-text-muted min-w-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
                  <span data-testid="ribbon-active-key" className="truncate max-w-full">
                    {t.simple.header.activeKeyLabel}:{' '}
                    <strong className="ga-text font-semibold">
                      {primaryKey
                        ? `${primaryKey.label} (${primaryKey.fingerprintShort})`
                        : t.simple.header.noKeyYet}
                    </strong>
                  </span>
                  <span data-testid="ribbon-key-count" className="whitespace-nowrap">
                    {authorKeys.length} {t.simple.header.storedKeysCount}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {offlineReady || !isOnline
                      ? t.simple.header.offlineReadyLabel
                      : t.pwa.onlineReadyBadge}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

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

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10 min-w-0">
        <div
          key={`${location.pathname}:${isAdvanced ? 'adv' : 'simple'}`}
          className="chm-page-enter min-w-0 w-full"
        >
          <Outlet />
        </div>
      </main>

      <footer className="border-t ga-border ga-header py-1.5 sm:py-2 text-[11px] sm:text-xs ga-text-muted">
        <div
          data-testid="footer-single-row"
          className="mx-auto max-w-5xl px-3 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 whitespace-nowrap overflow-x-auto chm-no-scrollbar"
        >
          <p className="ga-text-secondary font-medium shrink-0">
            {t.appName} · MIT
          </p>
          <nav
            aria-label="Footer navigation"
            className="flex items-center gap-3 sm:gap-4 shrink-0"
          >
            <ThemeToggle compact />
            <Link to="/tutorial" className="hover:text-[var(--ga-text)] transition-colors py-1 shrink-0">
              {t.tutorial.navLabel}
            </Link>
            <Link to="/storage" className="hover:text-[var(--ga-text)] transition-colors py-1 shrink-0">
              {t.nextGen.navStorage}
            </Link>
            {isAdvanced && (
              <Link to="/docs" className="hover:text-[var(--ga-text)] transition-colors py-1 shrink-0">
                {t.nav.docs}
              </Link>
            )}
            <Link
              to="/privacypolicy"
              data-testid="footer-privacy-link"
              className="hover:text-[var(--ga-text)] transition-colors py-1 shrink-0"
            >
              {t.nav.privacy}
            </Link>
            <button
              type="button"
              onClick={onOpenCookieSettings}
              data-testid="footer-cookie-settings"
              className="hover:text-[var(--ga-text)] transition-colors cursor-pointer py-1 shrink-0"
            >
              {t.nav.cookieSettings}
            </button>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--ga-text)] transition-colors py-1 shrink-0"
            >
              GitHub
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-sponsor-link"
              className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300 hover:underline transition-colors py-1 shrink-0"
            >
              <Heart className="h-3.5 w-3.5 fill-rose-400/30" aria-hidden="true" />
              <span>Sponsor</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
