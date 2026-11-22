import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { ChmExchangeView } from '@yomiplush/chm-exchange/react';
import type { ChmExchangeTheme, ExchangeTab } from '@yomiplush/chm-exchange/react';
import '@yomiplush/chm-exchange/styles.css';
import { createCertifiedHandmadeExchangeAdapter } from '../core/exchange/hostAdapter';
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
    <div data-testid="exchange-page" className="space-y-4">
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
