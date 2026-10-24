import { EMAIL_LOGS, LOG_FILTERS, LOG_STATUS_COLORS, QUEUE_STATS } from '../data';
import type { SmtpApi } from '../useSmtpState';

const COLS = '1.6fr 1.7fr 1fr .9fr .8fr .9fr';
const CELL_MUTED = { fontSize: 11, fontWeight: 700, color: '#8A8DA3' } as const;

export function Queue({ api }: { api: SmtpApi }) {
  const { state, update } = api;
  const filter = LOG_FILTERS.find(f => f.key === state.logFilter) ?? LOG_FILTERS[0];
  const logs = EMAIL_LOGS.filter(l => filter.match(l.status));

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 11, marginBottom: 14 }}>
        {QUEUE_STATS.map(q => (
          <div key={q.label} className="nf-stat" style={{ borderRadius: 12, padding: '12px 14px' }}>
            <div className="nf-row" style={{ gap: 6 }}>
              <span className="nf-legend-dot" style={{ background: q.color }} />
              <span className="nf-stat-label">{q.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#14152A', marginTop: 6 }}>{q.value}</div>
          </div>
        ))}
      </div>

      <div className="nf-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="nf-row" style={{ gap: 8, padding: '14px 20px', borderBottom: '1px solid #F3F3FA', flexWrap: 'wrap' }}>
          <span className="nf-card-title nf-card-title--sm">Email logs</span>
          <div className="nf-ml-auto" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {LOG_FILTERS.map(f => (
              <button key={f.key} type="button" aria-pressed={state.logFilter === f.key} onClick={() => update({ logFilter: f.key })}
                className={'nf-filter-pill' + (state.logFilter === f.key ? ' nf-filter-pill--active' : '')}>{f.label}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 780 }} role="table">
            <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '11px 20px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#A5A8BD', borderBottom: '1px solid #F3F3FA' }}>
              {['Recipient', 'Subject', 'Provider', 'Status', 'Time', 'Latency'].map(h => <span key={h} role="columnheader">{h}</span>)}
            </div>
            {logs.map(l => {
              const [fg, bg] = LOG_STATUS_COLORS[l.status];
              return (
                <div key={l.to + l.time} role="row" className="nf-log-row" style={{ gridTemplateColumns: COLS }}>
                  <span role="cell" className="nf-block nf-mono nf-ellipsis" style={{ fontSize: 11.5, color: '#14152A', minWidth: 0 }}>{l.to}</span>
                  <span role="cell" className="nf-block nf-ellipsis" style={{ fontSize: 12, fontWeight: 600, color: '#5B5E75', minWidth: 0 }}>{l.subject}</span>
                  <span role="cell" className="nf-block nf-ellipsis" style={{ fontSize: 11, fontWeight: 800, color: '#5B5E75', minWidth: 0 }}>{l.provider}</span>
                  <span role="cell"><span className="nf-nowrap" style={{ fontSize: 10, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: '3px 8px' }}>{l.status}</span></span>
                  <span role="cell" className="nf-nowrap" style={CELL_MUTED}>{l.time}</span>
                  <span role="cell" className="nf-nowrap" style={CELL_MUTED}>{l.latency}</span>
                </div>
              );
            })}
          </div>
        </div>
        {logs.length === 0 && (
          <div className="nf-empty" style={{ padding: '48px 0' }}>
            <div style={{ fontSize: 28 }}>📭</div>
            <div className="nf-empty-title" style={{ fontSize: 13.5, marginTop: 9 }}>No messages in this state</div>
          </div>
        )}
      </div>
    </section>
  );
}
