import { useEffect, useState } from 'react';
import { app } from '../config';
import { Shell, readHash } from '../shared/Shell';
import { SoonBadge } from '../shared/ui';
import { Builder } from './Builder';
import { CampaignList } from './CampaignList';
import { SettingsModal } from './SettingsModal';
import { money, useCampaigns } from './useCampaigns';
import type { Campaign } from './types';

const PAGES = ['all', 'scheduled', 'drafts', 'sent', 'ab', 'builder'] as const;
type Page = (typeof PAGES)[number];
const TABS: [string, Page][] = [['All', 'all'], ['Scheduled', 'scheduled'], ['Drafts', 'drafts'], ['Sent', 'sent'], ['A/B Testing', 'ab'], ['Builder', 'builder']];
const SIDEBAR: Record<Page, string> = { all: 'campaigns', builder: 'campaigns', scheduled: 'scheduled', drafts: 'drafts', sent: 'sent', ab: 'ab' };

function useRoute() {
  const [route, setRoute] = useState(() => readHash(PAGES, 'all'));
  useEffect(() => {
    const on = () => setRoute(readHash(PAGES, 'all'));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Revenue attributed to campaigns that started this calendar quarter. */
function quarterRevenue(campaigns: Campaign[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
  return campaigns.filter(c => c.startedAt && Date.parse(c.startedAt) >= start).reduce((n, c) => n + c.stats.revenue, 0);
}

export function CampaignsPage() {
  const route = useRoute();
  const api = useCampaigns();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { campaigns } = api.overview;
  const editing = route.page === 'builder' ? campaigns.find(c => String(c.id) === route.arg) ?? null : null;

  const titles: Record<Page, [string, string]> = {
    all: ['Email Campaigns', `${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'} · ${money(quarterRevenue(campaigns))} attributed revenue this quarter`],
    scheduled: ['Scheduled', 'Campaigns queued to send'],
    drafts: ['Drafts', 'Unfinished campaigns'],
    sent: ['Sent', 'Delivered campaigns and their results'],
    ab: ['A/B Testing', 'Running and completed experiments'],
    builder: ['Email Builder', `Click blocks to edit · ${editing?.name ?? 'New campaign'}`],
  };
  const [title, sub] = titles[route.page];

  return (
    <Shell active={SIDEBAR[route.page]} toast={api.toast}>
      <header className="nf-page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="nf-page-title">{title}</h1>
          <p className="nf-page-sub">{sub}</p>
        </div>
        <div className="nf-row nf-ml-auto nf-noshrink" style={{ gap: 9 }}>
          <button type="button" className="nf-btn-ghost" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
          <a href="#builder" className="nf-btn-primary nf-btn-primary--shadow nf-row" style={{ gap: 7, color: '#fff', fontSize: 13 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New campaign
          </a>
        </div>
      </header>

      <nav className="nf-tabs" aria-label="Campaign sections">
        {TABS.map(([label, key]) => (
          <a key={key} href={'#' + key} aria-current={route.page === key ? 'page' : undefined}
            className={'nf-tab' + (route.page === key ? ' nf-tab--active' : '')} style={{ padding: '9px 14px' }}>{label}</a>
        ))}
      </nav>

      {!api.overview.smtpReady && (
        <div className="nf-sample-banner" role="note" style={{ borderStyle: 'solid', borderColor: '#F8DFC5', background: '#FFF8F1' }}>
          <span className="nf-soon" style={{ color: '#C2620A', background: '#FFF3E8' }}>Setup</span>
          <span>Campaigns need an SMTP connection. <a href={app.screens.smtp + '#providers'}>Connect a provider →</a></span>
        </div>
      )}

      {(['all', 'scheduled', 'drafts', 'sent'] as Page[]).includes(route.page) && (
        <CampaignList campaigns={campaigns} filter={route.page as 'all' | 'scheduled' | 'drafts' | 'sent'} segments={api.overview.segments} />
      )}
      {route.page === 'ab' && (
        <div className="nf-card nf-empty-card">
          <div style={{ fontSize: 30 }}>🧪</div>
          <div className="nf-row" style={{ justifyContent: 'center', gap: 8, marginTop: 10 }}><span className="nf-empty-title" style={{ fontSize: 15 }}>A/B testing</span><SoonBadge /></div>
          <div className="nf-card-sub" style={{ maxWidth: 460, margin: '6px auto 0', lineHeight: 1.5 }}>
            Send two subject lines to a sample of your audience, then automatically send the winner to everyone else.
          </div>
        </div>
      )}
      {route.page === 'builder' && (
        <Builder key={route.arg || 'new'} api={api} campaign={editing} missing={!!route.arg && !editing} onOpenSettings={() => setSettingsOpen(true)} />
      )}
      {settingsOpen && <SettingsModal api={api} onClose={() => setSettingsOpen(false)} />}
    </Shell>
  );
}
