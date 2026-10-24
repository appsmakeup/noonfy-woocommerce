import { CATALOG, CATALOG_CONNECTED, CONNECTIONS, PROV_MODES, healthColor, usageColor } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { Bar, CardHead, Toggle } from '../ui';

const METRIC_LABEL = { fontSize: 9.5, fontWeight: 800, color: '#A5A8BD' } as const;
const METRIC_VALUE = { fontSize: 13, fontWeight: 800, color: '#14152A', marginTop: 2 } as const;
const GREY_BADGE = { color: '#5B5E75', background: '#F3F3FA' } as const;

export function Providers({ api }: { api: SmtpApi }) {
  const { state, update, toggleIn, showToast, testProvider } = api;
  const q = state.provQ.toLowerCase();
  const connections = CONNECTIONS.filter(c =>
    (state.provMode === 'all' || (state.provMode === 'api' ? c.api : !c.api)) &&
    (!q || (c.name + ' ' + c.host).toLowerCase().includes(q)));

  return (
    <section>
      <div className="nf-row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="nf-segmented">
          {PROV_MODES.map(m => (
            <button key={m.key} type="button" onClick={() => update({ provMode: m.key })}
              className={'nf-segmented-btn' + (state.provMode === m.key ? ' nf-segmented-btn--active' : '')}>{m.label}</button>
          ))}
        </div>
        <input className="nf-search-input" placeholder="Search providers…" value={state.provQ} onChange={e => update({ provQ: e.target.value })} />
        <button type="button" className="nf-btn-primary nf-btn-primary--sm nf-ml-auto"
          onClick={() => showToast('info', 'Add connection', 'Pick a provider from the catalog below.')}>+ Add connection</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 14 }}>
        {connections.map(c => {
          const on = state.enabled[c.id] ?? true;
          const pct = Math.round((c.used / c.limit) * 100);
          return (
            <div key={c.id} className="nf-card nf-conn-card" style={{ border: '1.5px solid ' + (on ? '#ECEDF4' : '#E6E7F0'), padding: '16px 18px' }}>
              <div className="nf-row" style={{ gap: 11 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: c.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: c.fg, flexShrink: 0 }}>{c.mark}</span>
                <span className="nf-grow">
                  <span className="nf-block nf-ellipsis" style={{ fontSize: 13, fontWeight: 800, color: '#14152A' }}>{c.name}</span>
                  <span className="nf-block nf-ellipsis" style={{ fontSize: 10.5, color: '#8A8DA3', fontWeight: 600 }}>{c.host}</span>
                </span>
                <Toggle size="lg" on={on} onChange={() => toggleIn('enabled', c.id, on)} label={'Enable ' + c.name} />
              </div>
              <div className="nf-row" style={{ gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                <span className="nf-badge" style={{ color: on ? '#0E9F6E' : '#8A8DA3', background: on ? '#EDF9F1' : '#F3F3FA' }}>{on ? 'ACTIVE' : 'DISABLED'}</span>
                <span className="nf-badge" style={GREY_BADGE}>Priority {c.priority}</span>
                <span className="nf-badge" style={GREY_BADGE}>Weight {c.weight}%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
                <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>TODAY</div><div style={METRIC_VALUE}>{c.today}</div></div>
                <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>LATENCY</div><div style={METRIC_VALUE}>{c.latency}</div></div>
                <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>HEALTH</div><div style={{ ...METRIC_VALUE, color: healthColor(c.health) }}>{c.health}</div></div>
              </div>
              <div style={{ marginTop: 11 }}>
                <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#8A8DA3' }}>
                  <span>Daily limit</span>
                  <span className="nf-ml-auto" style={{ fontWeight: 800, color: '#14152A' }}>{c.used.toLocaleString()} / {c.limit.toLocaleString()}</span>
                </div>
                <Bar pct={pct + '%'} color={usageColor(pct)} height={5} style={{ marginTop: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
                <button type="button" className="nf-btn-outline" onClick={() => testProvider(c.id)}>{state.testingId === c.id ? 'Testing…' : 'Test'}</button>
                <a href="#queue" className="nf-btn-outline">Logs</a>
              </div>
            </div>
          );
        })}
      </div>

      {connections.length === 0 && (
        <div className="nf-empty" style={{ padding: '56px 0' }}>
          <div style={{ fontSize: 30 }}>🔍</div>
          <div className="nf-empty-title" style={{ fontSize: 14, marginTop: 10 }}>No providers match</div>
        </div>
      )}

      <div className="nf-card" style={{ marginTop: 14 }}>
        <CardHead small title="Available integrations" sub={`${CATALOG.length} SMTP servers and email APIs ready to connect`} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 13 }}>
          {CATALOG.map(name => (
            <span key={name} className="nf-chip">
              <span className="nf-dot" style={{ width: 6, height: 6, background: CATALOG_CONNECTED.has(name) ? '#0E9F6E' : '#C4C6D4' }} />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
