import { useState } from 'react';
import type { Segment } from '../campaigns/types';
import { describeTrigger, money, pct, STATUS, TRIGGER_TINT } from './meta';
import type { TriggerSettings, Workflow, WorkflowStatus } from './types';

const COLS = '2.2fr .8fr .9fr .9fr .9fr .9fr 1fr';
const FILTERS: [string, 'all' | WorkflowStatus][] = [['All', 'all'], ['Live', 'live'], ['Paused', 'paused'], ['Draft', 'draft']];

export const triggerOf = (w: Workflow) => w.graph.nodes.find(n => n.kind === 'trigger')?.settings as TriggerSettings | undefined;

export function WorkflowList({ workflows, segments, onCreate }: { workflows: Workflow[]; segments: Segment[]; onCreate: () => void }) {
  const [filter, setFilter] = useState<'all' | WorkflowStatus>('all');
  const [q, setQ] = useState('');

  const sum = (k: keyof Workflow['stats']) => workflows.reduce((n, w) => n + w.stats[k], 0);
  const live = workflows.filter(w => w.status === 'live').length;
  const paused = workflows.filter(w => w.status === 'paused').length;
  const kpis = [
    { label: 'ACTIVE WORKFLOWS', value: String(live), delta: `${paused} paused · ${workflows.length - live - paused} drafts` },
    { label: 'CUSTOMERS ENROLLED', value: sum('enrolled').toLocaleString(), delta: `${sum('active').toLocaleString()} in a workflow now` },
    { label: 'AUTOMATION REVENUE', value: money(sum('revenue')), delta: `${sum('orders').toLocaleString()} attributed orders` },
    { label: 'AVG CONVERSION', value: pct(sum('converted'), sum('enrolled')), delta: `${sum('converted').toLocaleString()} conversions` },
  ];

  const needle = q.trim().toLowerCase();
  const rows = workflows.filter(w => (filter === 'all' || w.status === filter) && (!needle || (w.name + ' ' + describeTrigger(triggerOf(w), segments)).toLowerCase().includes(needle)));

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} className="nf-card" style={{ padding: '15px 18px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8A8DA3' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#14152A', marginTop: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0E9F6E', marginTop: 2 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="nf-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="nf-row" style={{ padding: '14px 20px', borderBottom: '1px solid #F3F3FA', gap: 10 }}>
          <input placeholder="Filter workflows…" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter workflows"
            style={{ border: '1px solid #ECEDF4', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, outline: 'none', color: '#14152A', width: 240, background: '#F8F8FC' }} />
          <div className="nf-row nf-ml-auto" style={{ gap: 6 }}>
            {FILTERS.map(([label, key]) => (
              <button key={key} type="button" className={'nf-filter-pill' + (filter === key ? ' nf-filter-pill--active' : '')} style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 20px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#A5A8BD', borderBottom: '1px solid #F3F3FA' }}>
          <span>Workflow</span><span>Status</span><span>Enrolled</span><span>Emails sent</span><span>Open rate</span><span>Click rate</span><span style={{ textAlign: 'right' }}>Revenue</span>
        </div>
        {rows.map(w => {
          const st = STATUS[w.status];
          const s = w.stats;
          const none = w.status === 'draft' && !s.enrolled;
          return (
            <a key={w.id} href={`#detail:${w.id}`} className="nf-campaign-row" style={{ gridTemplateColumns: COLS, padding: '12px 20px', borderBottom: '1px solid #F7F7FB' }}>
              <span className="nf-row" style={{ gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: TRIGGER_TINT[w.trigger] ?? '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{w.emoji}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="nf-ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{w.name}</span>
                  <span className="nf-ellipsis" style={{ display: 'block', fontSize: 11, color: '#8A8DA3', fontWeight: 600 }}>{describeTrigger(triggerOf(w), segments)}</span>
                </span>
              </span>
              <span><span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 99, padding: '3px 9px' }}>{st.label}</span></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5B5E75' }}>{none ? '—' : s.enrolled.toLocaleString()}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5B5E75' }}>{none ? '—' : s.sent.toLocaleString()}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5B5E75' }}>{pct(s.opens, s.sent)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5B5E75' }}>{pct(s.clicks, s.sent)}</span>
              <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'right' }}>{none ? '—' : money(s.revenue)}</span>
            </a>
          );
        })}
        {rows.length === 0 && (
          <div className="nf-empty-card">
            {workflows.length === 0 ? (
              <>
                <div style={{ fontSize: 30 }}>⚡</div>
                <div className="nf-empty-title" style={{ marginTop: 8, fontSize: 14 }}>No workflows yet</div>
                <div className="nf-hint" style={{ marginBottom: 14 }}>Start from a proven template — welcome series, cart recovery, win-back — or build your own.</div>
                <div className="nf-row" style={{ gap: 8, justifyContent: 'center' }}>
                  <a href="#templates" className="nf-btn-line">Browse templates</a>
                  <button type="button" className="nf-btn-primary" onClick={onCreate}>New workflow</button>
                </div>
              </>
            ) : <div className="nf-hint">No workflows match.</div>}
          </div>
        )}
      </div>
    </section>
  );
}
