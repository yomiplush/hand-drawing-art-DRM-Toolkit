import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  BookOpen,
  Cloud,
  Compass,
  FileSignature,
  KeyRound,
  QrCode,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { HelpTip } from '../components/HelpTip';
import { MagicSealBadge } from '../components/motion/MagicSealBadge';
import { useAppPreferences } from '../components/PreferencesContext';
import { listAuthorKeys, listTrustedKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord, TrustedKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

export function HomePage() {
  const { t } = useI18n();
  const { isAdvanced, setMode } = useAppPreferences();
  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [trustedKeys, setTrustedKeys] = useState<TrustedKeyRecord[]>([]);

  useEffect(() => {
    if (!isAdvanced) return;
    let active = true;
    void Promise.all([listAuthorKeys(), listTrustedKeys()])
      .then(([ak, tk]) => {
        if (!active) return;
        setAuthorKeys(ak);
        setTrustedKeys(tk);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdvanced]);

  if (!isAdvanced) {
    return (
      <div
        data-testid="home-minimal-page"
        className="relative flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-4 sm:py-10 space-y-8"
      >
        <section className="mx-auto w-full max-w-2xl text-center space-y-6">
          <div className="flex justify-center">
            <MagicSealBadge testId="home-magic-seal" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight ga-text">
              {t.appName}
            </h1>
            <p
              data-testid="home-tagline"
              className="text-xl sm:text-2xl font-semibold ga-text-accent tracking-tight"
            >
              {t.simple.home.headline}
            </p>
            <p
              data-testid="home-subtitle"
              className="text-sm sm:text-base ga-text-secondary"
            >
              {t.simple.home.subline}
            </p>
          </div>

          {/* Mandatory HelpTip #1: Local-only trust badge */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              data-testid="home-local-trust-badge"
              className="inline-flex items-center gap-2 rounded-full border ga-border-strong ga-surface-subtle px-4 py-1.5 text-xs sm:text-sm font-medium ga-text shadow-xs"
            >
              <ShieldCheck className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              <span>{t.simple.home.localOnlyBadge}</span>
              <HelpTip
                label={t.simple.home.localOnlyTipLabel}
                text={t.simple.home.localOnlyTipText}
                testId="home-local-tip-btn"
                panelTestId="home-local-tip-panel"
              />
            </span>
          </div>

          {/* Primary 2 tactile action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-start">
            <Link
              to="/create"
              data-testid="home-cta-create"
              className="chm-spring-btn ga-btn-primary group rounded-2xl p-5 sm:p-6 min-h-[96px] flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/18 text-white">
                  <FileSignature className="h-6 w-6" aria-hidden="true" />
                </span>
                <ArrowRight
                  className="h-5 w-5 opacity-80 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-bold leading-snug">
                  {t.simple.home.createCardTitle}
                </div>
                <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
                  {t.simple.home.createCardDesc}
                </p>
              </div>
            </Link>

            <Link
              to="/verify"
              data-testid="home-cta-verify"
              className="chm-spring-btn ga-card-solid group rounded-2xl border ga-border-strong p-5 sm:p-6 min-h-[96px] flex flex-col justify-between gap-3 shadow-sm hover:border-[var(--ga-accent)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ga-accent-soft)] ga-text-accent">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <ArrowRight
                  className="h-5 w-5 ga-text-accent opacity-80 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-bold ga-text leading-snug">
                  {t.simple.home.verifyCardTitle}
                </div>
                <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
                  {t.simple.home.verifyCardDesc}
                </p>
              </div>
            </Link>
          </div>

          {/* 1-click Sample Artwork Demo */}
          <div className="pt-1">
            <Link
              to="/verify?demo=sample"
              data-testid="home-sample-demo-link"
              className="chm-spring-btn inline-flex items-center justify-center gap-2 rounded-full ga-btn-secondary px-5 py-2.5 text-xs sm:text-sm font-medium min-h-[44px]"
            >
              <Sparkles className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              <span>{t.simple.home.sampleDemoLink}</span>
            </Link>
          </div>
        </section>

        {/* Quiet secondary navigation strip */}
        <nav
          aria-label="Secondary links"
          className="mx-auto flex flex-wrap items-center justify-center gap-2.5 text-xs pt-2"
        >
          <Link
            to="/exchange"
            data-testid="home-exchange-link"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px]"
          >
            <Share2 className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.simple.home.exchangeFooterLink}</span>
          </Link>

          <Link
            to="/storage"
            data-testid="home-storage-link"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px]"
          >
            <Cloud className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.googleCompliance.homeOverview.storageLinkLabel}</span>
          </Link>

          <Link
            to="/privacypolicy"
            data-testid="home-privacy-link"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px]"
          >
            <Shield className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.googleCompliance.homeOverview.privacyLinkLabel}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMode('advanced')}
            data-testid="home-switch-advanced-btn"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.simple.home.switchToAdvancedLink}</span>
          </button>
        </nav>
      </div>
    );
  }

  const primaryKey = authorKeys[0] ?? null;

  return (
    <div data-testid="home-advanced-page" className="space-y-6">
      <section className="ga-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border ga-border-strong ga-surface-subtle px-3 py-1 text-xs font-medium ga-text-accent">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.simple.mode.advancedLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight ga-text">
              {t.appName}
            </h1>
            <p data-testid="home-tagline" className="text-base sm:text-lg font-medium ga-text-accent">
              {t.simple.home.headline}
            </p>
            <p data-testid="home-subtitle" className="text-xs sm:text-sm ga-text-secondary">
              {t.simple.home.subline}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/create"
              data-testid="home-cta-create"
              className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px]"
            >
              <FileSignature className="h-4 w-4" aria-hidden="true" />
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs ga-text-muted">
              <span>{t.keys.myKeysTitle}</span>
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

          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1">
            <div className="text-xs ga-text-muted">{t.keys.trustedTitle}</div>
            <div className="font-mono text-sm font-semibold ga-text">
              {trustedKeys.length}
            </div>
            <div className="text-[11px] ga-text-secondary">{t.pwa.localOnlyPill}</div>
          </div>

          <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs ga-text-muted">
              <span>In-Image QR Studio</span>
              <HelpTip
                label={t.simple.advancedTips.protocolModesLabel}
                text={t.simple.advancedTips.protocolModesText}
              />
            </div>
            <Link
              to="/create?mode=studio"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ga-text-accent hover:underline pt-0.5"
            >
              <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>/create?mode=studio</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Unfolded Tool Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <Link
          to="/keys"
          data-testid="home-keys-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <KeyRound className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.minimal.nav.myKeysItem}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.keys.subtitle}</p>
        </Link>

        <Link
          to="/exchange"
          data-testid="home-exchange-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Share2 className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.minimal.nav.keyExchangeItem}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.simple.advancedTips.exchangeText}</p>
        </Link>

        <Link
          to="/storage"
          data-testid="home-storage-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Cloud className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.googleCompliance.homeOverview.storageLinkLabel}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.simple.advancedTips.driveVaultText}</p>
        </Link>

        <Link
          to="/vault"
          data-testid="home-vault-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Archive className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.vault.navItem}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.vault.subtitle}</p>
        </Link>

        <Link
          to="/devices"
          data-testid="home-devices-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <Smartphone className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.devices.navItem}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.devices.subtitle}</p>
        </Link>

        <Link
          to="/spec"
          data-testid="home-docs-link"
          className="ga-card-solid rounded-2xl border ga-border p-4 space-y-1.5 hover:border-[var(--ga-accent)] transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm ga-text">
            <BookOpen className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.googleCompliance.homeOverview.docsLinkLabel}</span>
          </div>
          <p className="text-xs ga-text-secondary">{t.docs.subtitle}</p>
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
        <Link
          to="/privacypolicy"
          data-testid="home-privacy-link"
          className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[44px]"
        >
          <Shield className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
          <span>{t.googleCompliance.homeOverview.privacyLinkLabel}</span>
        </Link>
      </nav>
    </div>
  );
}
