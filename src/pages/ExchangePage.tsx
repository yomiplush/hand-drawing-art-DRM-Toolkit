import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { ChmExchangeView } from '@yomiplush/chm-exchange/react';
import type { ChmExchangeTheme, ExchangeTab } from '@yomiplush/chm-exchange/react';
import '@yomiplush/chm-exchange/styles.css';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { createCertifiedHandmadeExchangeAdapter } from '../core/exchange/hostAdapter';
import { listKeyNotices } from '../core/storage/keyStore';
import type { StoredKeyNoticeRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

const HOST_EXCHANGE_THEME: ChmExchangeTheme = {
  panelBg: 'rgba(5, 18, 36, 0.72)',
  cardBg: 'rgba(3, 11, 24, 0.78)',
  inputBg: 'rgba(2, 8, 19, 0.86)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(34, 211, 238, 0.35)',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  accent: '#22d3ee',
  sky: '#38bdf8',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
};

export function ExchangePage() {
  const { locale, t } = useI18n();
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

  return (
    <div data-testid="exchange-page" className="space-y-6">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">
          {t.minimal.nav.keyExchangeItem}
        </h1>

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

      <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-200">
        <div className="flex items-start gap-2.5 leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.hardening.trust.outOfBandNote}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/devices"
            data-testid="exchange-devices-link"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.devices.exchangePagePairingLink}</span>
          </Link>
          <Link
            to="/keys"
            className="text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4"
          >
            {t.hardening.notices.sectionTitle}
          </Link>
        </div>
      </div>

      {notices.length > 0 && (
        <div
          role="note"
          data-testid="exchange-notices-alert"
          className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-100"
        >
          <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div className="font-semibold">
              {t.hardening.notices.listTitle}: {notices.length}
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              {notices.slice(0, 4).map((n) => (
                <span key={n.id} className="rounded bg-black/30 px-2 py-0.5">
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
        theme={HOST_EXCHANGE_THEME}
        initialTab={initialTab}
        initialIdentityId={initialIdentityId}
        initialInspectInput={initialInspectInput}
        emptyIdentitiesAction={
          <Link
            to="/keys"
            data-testid="exchange-create-key-link"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[44px]"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>{t.keys.generateTitle}</span>
          </Link>
        }
      />
    </div>
  );
}
