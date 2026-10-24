import { useEffect, useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { PAGES, PAGE_TITLES, SIDEBAR_KEY, TABS, type PageKey } from './data';
import { useLiveLogs, useSmtpState } from './useSmtpState';
import { ConnectionModal } from './ConnectionModal';
import { Toast } from '../shared/ui';
import { Dashboard } from './tabs/Dashboard';
import { Providers } from './tabs/Providers';
import { Routing } from './tabs/Routing';
import { Queue } from './tabs/Queue';
import { Domains } from './tabs/Domains';
import { Deliverability } from './tabs/Deliverability';
import { Suppressions } from './tabs/Suppressions';
import { Tools } from './tabs/Tools';

const readPage = (): PageKey => {
  const p = window.location.hash.slice(1);
  return (PAGES as readonly string[]).includes(p) ? (p as PageKey) : 'dashboard';
};

function useHashPage() {
  const [page, setPage] = useState(readPage);
  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page;
}

export function SmtpPage() {
  const page = useHashPage();
  const api = useSmtpState();
  const liveLogs = useLiveLogs(page === 'dashboard', api.refreshStats);
  const [title, sub] = PAGE_TITLES[page];
  const active = api.state.connections.filter(c => c.enabled).length;

  return (
    <div className="nf-shell">
      <Sidebar active={SIDEBAR_KEY[page]} />
      <main className="nf-main">
        <header className="nf-page-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="nf-page-title">{title}</h1>
            <p className="nf-page-sub">{sub}</p>
          </div>
          <div className="nf-row nf-ml-auto nf-noshrink" style={{ gap: 9 }}>
            {active ? (
              <span className="nf-health-pill">
                <span className="nf-dot" style={{ width: 7, height: 7, background: '#0E9F6E', animation: 'nf-blink 1.6s ease infinite' }} />
                {active} {active === 1 ? 'provider' : 'providers'} active
              </span>
            ) : (
              <a href="#providers" className="nf-health-pill nf-health-pill--idle" title="WordPress is sending with PHP mail(). Add a connection.">
                <span className="nf-dot" style={{ width: 7, height: 7, background: '#C2620A' }} />
                Using PHP mail()
              </a>
            )}
            <button type="button" className="nf-btn-primary nf-btn-primary--shadow" disabled={api.state.sendingTest} onClick={() => api.sendTestEmail()}>
              {api.state.sendingTest ? 'Sending…' : 'Send test email'}
            </button>
          </div>
        </header>

        <nav className="nf-tabs" aria-label="SMTP sections">
          {TABS.map(t => (
            <a key={t.key} href={'#' + t.key} aria-current={page === t.key ? 'page' : undefined}
              className={'nf-tab' + (page === t.key ? ' nf-tab--active' : '')}>{t.label}</a>
          ))}
        </nav>

        {page === 'dashboard' && <Dashboard stats={api.state.stats} connections={api.state.connections} liveLogs={liveLogs} />}
        {page === 'providers' && <Providers api={api} />}
        {page === 'routing' && <Routing api={api} />}
        {page === 'queue' && <Queue api={api} />}
        {page === 'domains' && <Domains />}
        {page === 'deliverability' && <Deliverability />}
        {page === 'suppressions' && <Suppressions />}
        {page === 'tools' && <Tools api={api} />}

        {api.state.editing && <ConnectionModal api={api} />}
        {api.toast && <Toast toast={api.toast} />}
      </main>
    </div>
  );
}
