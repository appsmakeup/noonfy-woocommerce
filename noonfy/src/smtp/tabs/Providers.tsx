import { config } from '../../config';
import { CATALOG_SOON, healthColor, usageColor } from '../data';
import type { ConnFilter, SmtpApi } from '../useSmtpState';
import { Bar, CardHead, Toggle, fmtMs, fmtNum, fmtPct, presetOf } from '../ui';

const METRIC_LABEL = { fontSize: 9.5, fontWeight: 800, color: '#A5A8BD' } as const;
const METRIC_VALUE = { fontSize: 13, fontWeight: 800, color: '#14152A', marginTop: 2 } as const;
const GREY_BADGE = { color: '#5B5E75', background: '#F3F3FA' } as const;
const FILTERS: { label: string; key: ConnFilter }[] = [{ label: 'All', key: 'all' }, { label: 'Enabled', key: 'enabled' }, { label: 'Paused', key: 'disabled' }];

export function Providers({ api }: { api: SmtpApi }) {
  const { state, update, toggleConnection, testConnection } = api;
  const q = state.connQuery.toLowerCase();
  const connections = state.connections.filter(c =>
    (state.connFilter === 'all' || (state.connFilter === 'enabled' ? c.enabled : !c.enabled)) &&
    (!q || (c.name + ' ' + c.host).toLowerCase().includes(q)));
  const connectedProviders = new Set(state.connections.map(c => c.provider));
  const openNew = (preset?: string) => update({ editing: { id: '', preset } });

  return (
    <section>
      <div className="nf-row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="nf-segmented">
          {FILTERS.map(m => (
            <button key={m.key} type="button" onClick={() => update({ connFilter: m.key })}
              className={'nf-segmented-btn' + (state.connFilter === m.key ? ' nf-segmented-btn--active' : '')}>{m.label}</button>
          ))}
        </div>
        <input className="nf-search-input" placeholder="Search connections…" value={state.connQuery} onChange={e => update({ connQuery: e.target.value })} />
        <button type="button" className="nf-btn-primary nf-btn-primary--sm nf-ml-auto" onClick={() => openNew()}>+ Add connection</button>
      </div>

      {state.connections.length === 0 ? (
        <div className="nf-card nf-empty-card">
          <div style={{ fontSize: 30 }}>📮</div>
          <div className="nf-empty-title" style={{ fontSize: 15, marginTop: 10 }}>No connections yet</div>
          <div className="nf-card-sub" style={{ maxWidth: 460, margin: '6px auto 0', lineHeight: 1.5 }}>
            WordPress is sending email with PHP mail(), which often lands in spam. Connect an SMTP provider and every
            WordPress and WooCommerce email goes through it, with automatic failover between connections.
          </div>
          <button type="button" className="nf-btn-primary" style={{ marginTop: 16 }} onClick={() => openNew()}>+ Add your first connection</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 14 }}>
          {connections.map(c => {
            const p = presetOf(c.provider);
            const perf = state.stats.perConnection[c.id] ?? {};
            const sentToday = perf.sentToday ?? 0;
            const pct = c.dailyLimit ? Math.min(100, Math.round((sentToday / c.dailyLimit) * 100)) : 0;
            const latency = perf.avgLatency ?? c.lastTest?.latencyMs ?? null;
            const health = perf.successRate ?? null;
            const testFailed = !!c.lastTest && !c.lastTest.ok;
            const badge = testFailed ? { label: 'TEST FAILED', color: '#E02424', background: '#FDEDED' }
              : c.enabled ? { label: 'ACTIVE', color: '#0E9F6E', background: '#EDF9F1' } : { label: 'PAUSED', color: '#8A8DA3', background: '#F3F3FA' };
            return (
              <div key={c.id} className="nf-card nf-conn-card" style={{ border: '1.5px solid ' + (c.enabled ? '#ECEDF4' : '#E6E7F0'), padding: '16px 18px' }}>
                <div className="nf-row" style={{ gap: 11 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: p.fg, flexShrink: 0 }}>{p.mark}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 13, fontWeight: 800, color: '#14152A' }}>{c.name}</span>
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 10.5, color: '#8A8DA3', fontWeight: 600 }}>{c.host}:{c.port}</span>
                  </span>
                  <Toggle size="lg" on={c.enabled} onChange={() => toggleConnection(c)} label={'Enable ' + c.name} />
                </div>
                <div className="nf-row" style={{ gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                  <span className="nf-badge" style={{ color: badge.color, background: badge.background }} title={testFailed ? c.lastTest?.error ?? '' : undefined}>{badge.label}</span>
                  <span className="nf-badge" style={GREY_BADGE}>Priority {c.priority}</span>
                  <span className="nf-badge" style={GREY_BADGE}>Weight {c.weight}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
                  <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>TODAY</div><div style={METRIC_VALUE}>{fmtNum(sentToday)}</div></div>
                  <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>LATENCY</div><div style={METRIC_VALUE}>{fmtMs(latency)}</div></div>
                  <div style={{ minWidth: 0 }}><div style={METRIC_LABEL}>SUCCESS</div><div style={{ ...METRIC_VALUE, color: health == null ? '#14152A' : healthColor(health) }}>{fmtPct(health)}</div></div>
                </div>
                <div style={{ marginTop: 11 }}>
                  <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#8A8DA3' }}>
                    <span>Daily limit</span>
                    <span className="nf-ml-auto" style={{ fontWeight: 800, color: '#14152A' }}>{fmtNum(sentToday)} / {c.dailyLimit ? fmtNum(c.dailyLimit) : 'Unlimited'}</span>
                  </div>
                  <Bar pct={pct + '%'} color={usageColor(pct)} height={5} style={{ marginTop: 4 }} />
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
                  <button type="button" className="nf-btn-outline" disabled={state.testingId === c.id} onClick={() => testConnection(c)}>{state.testingId === c.id ? 'Testing…' : 'Test'}</button>
                  <button type="button" className="nf-btn-outline" onClick={() => update({ editing: { id: c.id } })}>Edit</button>
                  <a href="#queue" className="nf-btn-outline" onClick={() => update({ logConnection: c.id, logFilter: 'all' })}>Logs</a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.connections.length > 0 && connections.length === 0 && (
        <div className="nf-empty" style={{ padding: '56px 0' }}>
          <div style={{ fontSize: 30 }}>🔍</div>
          <div className="nf-empty-title" style={{ fontSize: 14, marginTop: 10 }}>No connections match</div>
        </div>
      )}

      <div className="nf-card" style={{ marginTop: 14 }}>
        <CardHead small title="Available integrations" sub={`${Object.keys(config.presets).length} SMTP providers ready to connect. Click one to set it up.`} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 13 }}>
          {Object.entries(config.presets).map(([id, p]) => (
            <button key={id} type="button" className="nf-chip" onClick={() => openNew(id)}>
              <span className="nf-dot" style={{ width: 6, height: 6, background: connectedProviders.has(id) ? '#0E9F6E' : '#C4C6D4' }} />
              {p.label}
            </button>
          ))}
          {CATALOG_SOON.map(name => (
            <span key={name} className="nf-chip nf-dim" title="Coming soon" style={{ cursor: 'default' }}>
              <span className="nf-dot" style={{ width: 6, height: 6, background: '#E2E4EE' }} />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
