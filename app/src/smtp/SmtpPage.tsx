import { useEffect, useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { PAGES, PAGE_TITLES, SIDEBAR_KEY, TABS, type PageKey } from './data';
import { useLiveQueue, useSmtpState } from './useSmtpState';
import { Toast } from './ui';
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
  const live = useLiveQueue(page === 'dashboard');
  const [title, sub] = PAGE_TITLES[page];

  return (
    <div className="shell">
      <Sidebar active={SIDEBAR_KEY[page]} />
      <main className="main">
        <header className="page-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">{sub}</p>
          </div>
          <div className="row ml-auto noshrink" style={{ gap: 9 }}>
            <span className="health-pill">
              <span className="dot" style={{ width: 7, height: 7, background: '#0E9F6E', animation: 'blink 1.6s ease infinite' }} />
              6 providers healthy
            </span>
            <button type="button" className="btn-primary btn-primary--shadow"
              onClick={() => api.showToast('ok', 'Test email sent', 'Delivered to sam@brumahome.com in 92ms.')}>Send test email</button>
          </div>
        </header>

        <nav className="tabs" aria-label="SMTP sections">
          {TABS.map(t => (
            <a key={t.key} href={'#' + t.key} aria-current={page === t.key ? 'page' : undefined}
              className={'tab' + (page === t.key ? ' tab--active' : '')}>{t.label}</a>
          ))}
        </nav>

        {page === 'dashboard' && <Dashboard liveLogs={live.logs} eps={live.eps} />}
        {page === 'providers' && <Providers api={api} />}
        {page === 'routing' && <Routing api={api} />}
        {page === 'queue' && <Queue api={api} />}
        {page === 'domains' && <Domains />}
        {page === 'deliverability' && <Deliverability />}
        {page === 'suppressions' && <Suppressions />}
        {page === 'tools' && <Tools api={api} />}

        {api.toast && <Toast toast={api.toast} />}
      </main>
    </div>
  );
}
