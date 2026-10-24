import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { app } from '../config';
import { Shell, readHash } from '../shared/Shell';
import { automationsApi } from './api';
import { Detail } from './Detail';
import { FlowBuilder } from './FlowBuilder';
import { Journeys } from './Journeys';
import { Templates } from './Templates';
import { WorkflowList } from './WorkflowList';
import { useAutomations } from './useAutomations';

const PAGES = ['workflows', 'journeys', 'detail', 'builder', 'templates'] as const;
type Page = (typeof PAGES)[number];
const TABS: [string, Page][] = [['Workflows', 'workflows'], ['Journey Analytics', 'journeys'], ['Detail', 'detail']];
const SIDEBAR: Record<Page, string> = { workflows: 'workflows', detail: 'workflows', journeys: 'journeys', builder: 'builder', templates: 'templates' };

function useRoute() {
  const [route, setRoute] = useState(() => readHash(PAGES, 'workflows'));
  useEffect(() => {
    const on = () => { setRoute(readHash(PAGES, 'workflows')); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function AutomationsPage() {
  const route = useRoute();
  const state = useAutomations();
  const [creating, setCreating] = useState('');
  const { workflows } = state.overview;

  /** Creates a workflow (blank or from a template) and opens it in the builder. */
  const create = (template?: string) => {
    setCreating(template ?? 'blank');
    automationsApi.create(template ? { template } : { name: 'Untitled workflow' })
      .then(w => { state.upsert(w); window.location.hash = 'builder:' + w.id; })
      .catch(e => state.showToast('warn', 'Couldn’t create the workflow', errorMessage(e)))
      .finally(() => setCreating(''));
  };

  if (route.page === 'builder') {
    return (
      <Shell active={SIDEBAR.builder} toast={state.toast} flush>
        <FlowBuilder key={route.arg || 'none'} state={state} id={Number(route.arg) || 0} onCreate={() => create()} creating={!!creating} />
      </Shell>
    );
  }
  if (route.page === 'templates') {
    return (
      <Shell active={SIDEBAR.templates} toast={state.toast}>
        <Templates onUse={create} creating={creating} />
      </Shell>
    );
  }

  const live = workflows.filter(w => w.status === 'live').length;
  const detailId = Number(route.arg) || workflows[0]?.id || 0;
  const detailName = workflows.find(w => w.id === detailId)?.name ?? '';
  const titles: Record<'workflows' | 'journeys' | 'detail', [string, string]> = {
    workflows: ['All Workflows', `${workflows.length} ${workflows.length === 1 ? 'automation' : 'automations'} · ${live} live`],
    journeys: ['Journey Analytics', 'How customers move through your automations'],
    detail: ['Automation Detail', detailName || 'No workflow selected'],
  };
  const page = route.page as 'workflows' | 'journeys' | 'detail';
  const [title, sub] = titles[page];

  return (
    <Shell active={SIDEBAR[page]} toast={state.toast}>
      <header className="nf-page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="nf-page-title">{title}</h1>
          <p className="nf-page-sub">{sub}</p>
        </div>
        <div className="nf-row nf-ml-auto nf-noshrink" style={{ gap: 10 }}>
          <a href="#templates" className="nf-btn-line nf-row" style={{ gap: 7, fontSize: 13 }}>Browse templates</a>
          <button type="button" className="nf-btn-primary nf-btn-primary--shadow nf-row" style={{ gap: 7, fontSize: 13 }} disabled={!!creating} onClick={() => create()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {creating === 'blank' ? 'Creating…' : 'New workflow'}
          </button>
        </div>
      </header>

      <nav className="nf-tabs" aria-label="Automation sections">
        {TABS.map(([label, key]) => (
          <a key={key} href={'#' + key + (key === 'detail' && detailId ? ':' + detailId : '')} aria-current={page === key ? 'page' : undefined}
            className={'nf-tab' + (page === key ? ' nf-tab--active' : '')} style={{ padding: '9px 14px' }}>{label}</a>
        ))}
      </nav>

      {!state.overview.smtpReady && (
        <div className="nf-sample-banner" role="note" style={{ borderStyle: 'solid', borderColor: '#F8DFC5', background: '#FFF8F1' }}>
          <span className="nf-soon" style={{ color: '#C2620A', background: '#FFF3E8' }}>Setup</span>
          <span>Automations send through your SMTP connections. <a href={app.screens.smtp + '#providers'}>Connect a provider →</a></span>
        </div>
      )}

      {page === 'workflows' && <WorkflowList workflows={workflows} segments={state.overview.segments} onCreate={() => create()} />}
      {page === 'journeys' && <Journeys />}
      {page === 'detail' && <Detail key={detailId} id={detailId} state={state} />}
    </Shell>
  );
}
