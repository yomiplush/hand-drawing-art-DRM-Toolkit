import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { ChmExchangeView } from '@yomiplush/chm-exchange/react';
import type { ChmExchangeTheme, ExchangeTab } from '@yomiplush/chm-exchange/react';
import '@yomiplush/chm-exchange/styles.css';
import { DiscordIdentityLinkPanel } from '../components/discord/DiscordIdentityLinkPanel';
import { HelpTip } from '../components/HelpTip';
import { useAppPreferences } from '../components/PreferencesContext';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { SimpleModeBanner } from '../components/ui/SimpleModeBanner';
import { createCertifiedHandmadeExchangeAdapter } from '../core/exchange/hostAdapter';
import { listKeyNotices } from '../core/storage/keyStore';
import type { StoredKeyNoticeRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

const LIGHT_EXCHANGE_THEME: ChmExchangeTheme = {
  panelBg: 'rgba(255, 255, 255, 0.94)',
  cardBg: '#FFFFFF',
  inputBg: '#FFFFFF',
  border: 'rgba(20, 39, 68, 0.12)',
  borderStrong: 'rgba(40, 89, 182, 0.28)',
  text: '#142744',
  textMuted: '#536885',
  accent: '#2859B6',
  sky: '#3D73C5',
  emerald: '#166534',
  amber: '#92400E',
  rose: '#991B1B',
};

const DARK_EXCHANGE_THEME: ChmExchangeTheme = {
  panelBg: 'rgba(20, 39, 68, 0.72)',
  cardBg: '#142744',
  inputBg: '#0C1424',
  border: 'rgba(130, 184, 255, 0.16)',
  borderStrong: 'rgba(130, 184, 255, 0.36)',
  text: '#F5F8FD',
  textMuted: '#9CB4D4',
  accent: '#82B8FF',
  sky: '#82B8FF',
  emerald: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
};

export function ExchangePage() {
  const { locale, t } = useI18n();
  const { resolvedTheme } = useAppPreferences();
  const [searchParams] = useSearchParams();
  const adapter = useMemo(() => createCertifiedHandmadeExchangeAdapter(), []);
  const [notices, setNotices] = useState<StoredKeyNoticeRecord[]>([]);

  useEffect(() => {
    let active = true;
    listKeyNotices().then((list) => {
      if (active) setNotices(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const initialIdentityId = searchParams.get('identity') ?? undefined;
  const initialInspectInput = searchParams.get('inspect') ?? undefined;
  const rawTab = searchParams.get('tab');
  const initialTab: ExchangeTab | undefined =
    rawTab === 'share' || rawTab === 'receive' || rawTab === 'trusted'
      ? rawTab
      : undefined;

  const exchangeBaseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/exchange`
      : 'https://certified-handmade.com/exchange';

  const exchangeTheme = resolvedTheme === 'dark' ? DARK_EXCHANGE_THEME : LIGHT_EXCHANGE_THEME;

  return (
    <div data-testid="exchange-page" className="space-y-6 min-w-0 w-full">
      <header className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 border-b ga-border pb-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-semibold ga-text min-w-0 break-words">
            {t.minimal.nav.keyExchangeItem}
          </h1>
          <HelpTip
            label={t.simple.advancedTips.exchangeLabel}
            text={t.simple.advancedTips.exchangeText}
            testId="exchange-tip-btn"
          />
        </div>

        <HelpIconButton
          label={t.minimal.exchange.helpLabel}
          title={t.minimal.exchange.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="exchange-help-btn"
          panelTestId="exchange-help-panel"
        >
          <p>{t.minimal.exchange.helpBody}</p>
        </HelpIconButton>
      </header>

      <SimpleModeBanner testId="exchange-simple-mode-banner" />

      <div className="ga-status-info rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs min-w-0">
        <div className="flex items-start gap-2.5 leading-relaxed min-w-0">
          <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0 mt-0.5" aria-hidden="true" />
          <span className="ga-text-secondary min-w-0 break-words">{t.hardening.trust.outOfBandNote}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/devices"
            data-testid="exchange-devices-link"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ga-accent)] hover:underline underline-offset-4 min-h-[36px]"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.devices.exchangePagePairingLink}</span>
          </Link>
          <Link
            to="/keys"
            className="inline-flex items-center text-xs font-medium text-[var(--ga-accent)] hover:underline underline-offset-4 min-h-[36px]"
          >
            {t.hardening.notices.sectionTitle}
          </Link>
        </div>
      </div>

      {notices.length > 0 && (
        <div
          role="note"
          data-testid="exchange-notices-alert"
          className="ga-status-warning rounded-2xl border px-4 py-3 flex items-start gap-2.5 text-xs min-w-0"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">
              {t.hardening.notices.listTitle}: {notices.length}
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              {notices.slice(0, 4).map((n) => (
                <span key={n.id} className="ga-surface-subtle rounded px-2 py-0.5 border ga-border">
                  {n.noticeType === 'revocation'
                    ? t.hardening.notices.revokeBadge
                    : t.hardening.notices.rotateBadge}
                  : {n.subjectFingerprintShort}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <ChmExchangeView
        adapter={adapter}
        exchangeBaseUrl={exchangeBaseUrl}
        locale={locale === 'ja' ? 'ja' : 'en'}
        theme={exchangeTheme}
        initialTab={initialTab}
        initialIdentityId={initialIdentityId}
        initialInspectInput={initialInspectInput}
        emptyIdentitiesAction={
          <Link
            to="/keys"
            data-testid="exchange-create-key-link"
            className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>{t.keys.generateTitle}</span>
          </Link>
        }
      />

      <DiscordIdentityLinkPanel
        initialProfileParam={searchParams.get('discordProfile') ?? undefined}
      />
    </div>
  );
}
