import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  Cloud,
  Compass,
  FileSignature,
  Gamepad2,
  KeyRound,
  QrCode,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import { HelpTip } from '../components/HelpTip';
import { useAppPreferences } from '../components/useAppPreferences';
import { listAuthorKeys, listTrustedKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord, TrustedKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

const GalleryDeckPage = lazy(() =>
  import('./GalleryDeck').then((m) => ({ default: m.GalleryDeckPage })),
);
const SimpleKeysCard = lazy(() =>
  import('../components/SimpleKeysCard').then((m) => ({ default: m.SimpleKeysCard })),
);

export function HomePage() {
  const { t } = useI18n();
  const { isAdvanced } = useAppPreferences();
  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [trustedKeys, setTrustedKeys] = useState<TrustedKeyRecord[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([listAuthorKeys(), listTrustedKeys()])
      .then(([ak, tk]) => {
        if (!active) return;
        setAuthorKeys(ak);
        setTrustedKeys(tk);
        setKeysLoaded(true);
      })
      .catch(() => {
        if (active) setKeysLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isAdvanced]);

  if (!isAdvanced) {
    if (keysLoaded && authorKeys.length === 0) {
      return (
        <div data-testid="home-first-key-onboarding" className="min-w-0 w-full py-6 sm:py-10">
          <Suspense fallback={<div className="py-12 text-center text-xs ga-text-muted">…</div>}>
            <SimpleKeysCard
              showContinueToDeck={false}
              onKeyReady={(record) => setAuthorKeys([record])}
            />
          </Suspense>
        </div>
      );
    }
    return (
      <div data-testid="home-minimal-page" className="min-w-0 w-full">
        <Suspense fallback={<div className="py-16 text-center text-xs ga-text-muted">…</div>}>
          <GalleryDeckPage />
        </Suspense>
      </div>
    );
  }

  const primaryKey = authorKeys[0] ?? null;

  return (
    <div data-testid="home-advanced-page" className="space-y-6 min-w-0 w-full">
      <section className="ga-card rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4 min-w-0">
          <div className="space-y-1.5 max-w-2xl min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border ga-border-strong ga-surface-subtle px-3 py-1 text-xs font-medium ga-text-accent">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.simple.mode.advancedLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight ga-text break-words">
              {t.appName}
            </h1>
            <p data-testid="home-tagline" className="text-base sm:text-lg font-medium ga-text-accent break-words">
              {t.simple.home.headline}
            </p>
            <p data-testid="home-subtitle" className="text-xs sm:text-sm ga-text-secondary break-words">
              {t.simple.home.subline}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/gallerydeck"
              data-testid="home-cta-gallerydeck"
              className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            >
              <Gamepad2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.galleryDeck.navItem}</span>
            </Link>
            <Link
              to="/create"
              data-testid="home-cta-create"
              className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            >
              <FileSignature className="h-4 w-4 ga-text-accent" aria-hidden="true" />
              <span>{t.simple.home.createCardTitle}</span>
            </Link>
            <Link
              to="/verify"
              data-testid="home-cta-verify"
              className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            >
              <ShieldCheck className="h-4 w-4 ga-text-accent" aria-hidden="true" />
              <span>{t.simple.home.verifyCardTitle}</span>
            </Link>
          </div>
        </div>

        {/* Live local key status bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 min-w-0">
          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs ga-text-muted min-w-0">
              <span className="min-w-0 break-words">{t.keys.myKeysTitle}</span>
              <HelpTip
                label={t.simple.advancedTips.ed25519Label}
                text={t.simple.advancedTips.ed25519Text}
              />
            </div>
            <div className="font-mono text-sm font-semibold ga-text">
              {authorKeys.length} {t.simple.header.storedKeysCount}
            </div>
            <div className="font-mono text-[11px] ga-text-accent truncate">
              {primaryKey
                ? `${primaryKey.label} (${primaryKey.fingerprintShort})`
                : t.simple.header.noKeyYet}
            </div>
          </div>

          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1 min-w-0">
            <div className="text-xs ga-text-muted">{t.keys.trustedTitle}</div>
            <div className="font-mono text-sm font-semibold ga-text">
              {trustedKeys.length}
            </div>
            <div className="text-[11px] ga-text-secondary break-words">{t.pwa.localOnlyPill}</div>
          </div>

          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs ga-text-muted min-w-0">
              <span className="min-w-0 break-words">In-Image QR Studio</span>
              <HelpTip
                label={t.simple.advancedTips.protocolModesLabel}
                text={t.simple.advancedTips.protocolModesText}
              />
            </div>
            <Link
              to="/create?mode=studio"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ga-text-accent hover:underline pt-0.5 break-all"
            >
              <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>/create?mode=studio</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Unfolded Tool Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 min-w-0">
        <Link
          to="/keys"
          data-testid="home-keys-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <KeyRound className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.minimal.nav.myKeysItem}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.keys.subtitle}</p>
        </Link>

        <Link
          to="/exchange"
          data-testid="home-exchange-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Share2 className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.minimal.nav.keyExchangeItem}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.simple.advancedTips.exchangeText}</p>
        </Link>

        <Link
          to="/storage"
          data-testid="home-storage-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Cloud className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.googleCompliance.homeOverview.storageLinkLabel}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.simple.advancedTips.driveVaultText}</p>
        </Link>

        <Link
          to="/privacypolicy"
          data-testid="home-privacy-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <ShieldCheck className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {t.googleCompliance.homeOverview.privacyLinkLabel}
            </span>
          </div>
          <p className="text-xs ga-text-secondary break-words">
            {t.googleCompliance.homeOverview.drivePurposeTitle}
          </p>
        </Link>

        <Link
          to="/vault"
          data-testid="home-vault-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Archive className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.vault.navItem}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.vault.subtitle}</p>
        </Link>

        <Link
          to="/devices"
          data-testid="home-devices-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Smartphone className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.devices.navItem}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.devices.subtitle}</p>
        </Link>

        <Link
          to="/spec"
          data-testid="home-docs-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <BookOpen className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.googleCompliance.homeOverview.docsLinkLabel}</span>
          </div>
          <p className="text-xs ga-text-secondary break-words">{t.docs.subtitle}</p>
        </Link>
      </section>

      <nav className="flex flex-wrap items-center gap-2.5 text-xs">
        <Link
          to="/tutorial"
          data-testid="home-tutorial-link"
          className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px]"
        >
          <Compass className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
          <span>{t.tutorial.navLabel}</span>
        </Link>
      </nav>
    </div>
  );
}
