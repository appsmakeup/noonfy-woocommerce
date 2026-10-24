import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api';
import type { LogRow, LogStatus } from '../../config';
import type { LogFilter, SmtpApi } from '../useSmtpState';
import { fmtMs, fmtNum, fmtWhen } from '../../shared/ui';

const COLS = '1.6fr 1.7fr 1fr .9fr .8fr .9fr';
const CELL_MUTED = { fontSize: 11, fontWeight: 700, color: '#8A8DA3' } as const;
const STATUS_COLORS: Record<LogStatus, [fg: string, bg: string]> = {
  SENT: ['#4F46E5', '#EEF0FE'], RETRY: ['#C2620A', '#FFF3E8'], FAILED: ['#E02424', '#FDEDED'],
};
const FILTERS: { label: string; key: LogFilter }[] = [
  { label: 'All', key: 'all' }, { label: 'Sent', key: 'SENT' }, { label: 'Retried', key: 'RETRY' }, { label: 'Failed', key: 'FAILED' },
];
const PAGE = 25;

export function Queue({ api: smtp }: { api: SmtpApi }) {
  const { state, update } = smtp;
  const { stats } = state;
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const req = useRef(0);
  const connName = state.connections.find(c => c.id === state.logConnection)?.name ?? state.logConnection;

  const load = (before?: number) => {
    const id = ++req.current;
    setLoading(true);
    api.logs({ status: state.logFilter === 'all' ? '' : state.logFilter, connectionId: state.logConnection, search, before, limit: PAGE })
      .then(r => {
        if (id !== req.current) return;
        setRows(prev => (before ? [...prev, ...r.rows] : r.rows));
        setTotal(r.total);
        setError('');
      })
      .catch(e => { if (id === req.current) setError(errorMessage(e)); })
      .finally(() => { if (id === req.current) setLoading(false); });
  };

  // Reload on filter changes; search is debounced.
  useEffect(() => {
    const t = window.setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.logFilter, state.logConnection, search]);

  const tiles = [
    { label: 'SENT TODAY', value: fmtNum(stats.sentToday), color: '#34D399' },
    { label: 'FAILED TODAY', value: fmtNum(stats.failedToday), color: '#F87171' },
    { label: 'RETRIED TODAY', value: fmtNum(stats.retriedToday), color: '#FBBF24' },
    { label: 'LAST HOUR', value: fmtNum(stats.lastHour), color: '#8B5CF6' },
    { label: 'THIS MONTH', value: fmtNum(stats.sentMonth), color: '#6366F1' },
    { label: 'AVG SEND TIME', value: fmtMs(stats.avgLatency7), color: '#C4B5FD' },
    { label: 'IN LOG', value: fmtNum(stats.totalLogged), color: '#94A3B8' },
  ];

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 11, marginBottom: 14 }}>
        {tiles.map(q => (
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
          <span className="nf-card-sub" style={{ marginTop: 0 }}>{fmtNum(total)} {total === 1 ? 'entry' : 'entries'}</span>
          {state.logConnection && (
            <button type="button" className="nf-filter-pill nf-filter-pill--active" onClick={() => update({ logConnection: '' })} title="Clear connection filter">
              {connName} ✕
            </button>
          )}
          <div className="nf-ml-auto nf-row" style={{ gap: 5, flexWrap: 'wrap' }}>
            <input className="nf-search-input" style={{ width: 180, padding: '5px 11px', fontSize: 11.5 }} placeholder="Search recipient or subject…" value={search} onChange={e => setSearch(e.target.value)} />
            {FILTERS.map(f => (
              <button key={f.key} type="button" aria-pressed={state.logFilter === f.key} onClick={() => update({ logFilter: f.key })}
                className={'nf-filter-pill' + (state.logFilter === f.key ? ' nf-filter-pill--active' : '')}>{f.label}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 780 }} role="table">
            <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '11px 20px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#A5A8BD', borderBottom: '1px solid #F3F3FA' }}>
              {['Recipient', 'Subject', 'Connection', 'Status', 'Time', 'Send time'].map(h => <span key={h} role="columnheader">{h}</span>)}
            </div>
            {rows.map(l => {
              const [fg, bg] = STATUS_COLORS[l.status] ?? STATUS_COLORS.FAILED;
              return (
                <div key={l.id} role="row" className="nf-log-row" style={{ gridTemplateColumns: COLS }} title={l.error ?? undefined}>
                  <span role="cell" className="nf-block nf-mono nf-ellipsis" style={{ fontSize: 11.5, color: '#14152A', minWidth: 0 }}>{l.to}</span>
                  <span role="cell" className="nf-block nf-ellipsis" style={{ fontSize: 12, fontWeight: 600, color: '#5B5E75', minWidth: 0 }}>
                    {l.subject}
                    {l.error && <span className="nf-block nf-ellipsis" style={{ fontSize: 10.5, color: '#E02424', fontWeight: 600 }}>{l.error}</span>}
                  </span>
                  <span role="cell" className="nf-block nf-ellipsis" style={{ fontSize: 11, fontWeight: 800, color: '#5B5E75', minWidth: 0 }}>{l.connectionName}</span>
                  <span role="cell"><span className="nf-nowrap" style={{ fontSize: 10, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: '3px 8px' }}>{l.status}{l.attempt > 1 ? ` #${l.attempt}` : ''}</span></span>
                  <span role="cell" className="nf-nowrap" style={CELL_MUTED}>{fmtWhen(l.time)}</span>
                  <span role="cell" className="nf-nowrap" style={CELL_MUTED}>{fmtMs(l.latencyMs)}</span>
                </div>
              );
            })}
          </div>
        </div>
        {error && <div className="nf-empty" style={{ padding: '24px 0', color: '#E02424', fontSize: 12, fontWeight: 700 }}>{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="nf-empty" style={{ padding: '48px 0' }}>
            <div style={{ fontSize: 28 }}>📭</div>
            <div className="nf-empty-title" style={{ fontSize: 13.5, marginTop: 9 }}>{stats.totalLogged ? 'No emails match' : 'No emails logged yet'}</div>
            {!stats.totalLogged && <div className="nf-card-sub" style={{ marginTop: 4 }}>Every email WordPress sends will appear here.</div>}
          </div>
        )}
        {rows.length > 0 && rows.length < total && (
          <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid #F7F7FB' }}>
            <button type="button" className="nf-btn-ghost" disabled={loading} onClick={() => load(rows[rows.length - 1].id)}>{loading ? 'Loading…' : `Load more (${fmtNum(total - rows.length)} left)`}</button>
          </div>
        )}
      </div>
    </section>
  );
}
