import type { Connection, Stats } from '../../config';
import { RULES, STRATEGIES } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { Bar, CardHead, SoonBadge, Toggle, fmtMs, fmtPct } from '../../shared/ui';

const SPLIT_COLORS = ['#4F46E5', '#8B5CF6', '#C4B5FD', '#E0D7FE', '#EFEFF7'];
const CHAIN_TAGS = [
  { tag: 'PRIMARY', tagColor: '#0E9F6E', tagBg: '#EDF9F1', border: '#BEE9D2', bg: '#F7FCF9' },
  { tag: 'SECONDARY', tagColor: '#4F46E5', tagBg: '#EEF0FE', border: '#ECEDF4', bg: '#fff' },
  { tag: 'FAILOVER', tagColor: '#C2620A', tagBg: '#FFF3E8', border: '#ECEDF4', bg: '#fff' },
];

/** Actual share of sends this month when there is data, otherwise the configured weights. */
function split(stats: Stats, enabled: Connection[]) {
  const sent = enabled.map(c => ({ c, n: stats.shareMonth.find(s => s.connectionId === c.id)?.count ?? 0 }));
  const total = sent.reduce((t, x) => t + x.n, 0);
  if (total) return { actual: true, rows: sent.map(x => ({ name: x.c.name, pct: Math.round((x.n / total) * 100) })) };
  const weights = enabled.reduce((t, c) => t + c.weight, 0);
  return { actual: false, rows: enabled.map(c => ({ name: c.name, pct: weights ? Math.round((c.weight / weights) * 100) : 0 })) };
}

/** A plain-language observation from the last 7 days, or a prompt when there's no data yet. */
function insight(stats: Stats, enabled: Connection[]) {
  const measured = enabled
    .map(c => ({ c, p: stats.perConnection[c.id] }))
    .filter(x => x.p?.avgLatency != null && (x.p.attempts ?? 0) >= 5);
  if (measured.length >= 2) {
    const fastest = [...measured].sort((a, b) => a.p!.avgLatency! - b.p!.avgLatency!)[0];
    const reliable = [...measured].sort((a, b) => (b.p!.successRate ?? 0) - (a.p!.successRate ?? 0))[0];
    return `${fastest.c.name} is your fastest connection (${fmtMs(fastest.p!.avgLatency)} average over 7 days). ` +
      `${reliable.c.name} has the best success rate (${fmtPct(reliable.p!.successRate)}). Put the one you trust most at priority 1.`;
  }
  if (enabled.length === 1) return `All email goes through ${enabled[0].name}. Add a second connection so mail keeps flowing if it goes down.`;
  if (!enabled.length) return 'No connection is enabled, so WordPress sends with PHP mail(). Add a connection on the Connections tab.';
  return 'Once each connection has sent a few emails, this card compares their speed and reliability.';
}

export function Routing({ api }: { api: SmtpApi }) {
  const { state, setStrategy } = api;
  const enabled = state.connections.filter(c => c.enabled);
  const strategyName = (STRATEGIES.find(s => s.key === state.strategy) ?? STRATEGIES[0]).name;
  const traffic = split(state.stats, enabled);

  return (
    <section className="nf-flow">
      <div className="nf-stack" style={{ flex: '1 1 420px' }}>
        <div className="nf-card nf-card--roomy">
          <CardHead title="Rotation strategy" sub="Which connection each email tries first. The others are kept as failover." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 16 }}>
            {STRATEGIES.map(s => {
              const active = state.strategy === s.key;
              return (
                <button key={s.key} type="button" aria-pressed={active} onClick={() => setStrategy(s.key)} className="nf-row"
                  style={{ gap: 10, border: '1.5px solid ' + (active ? '#4F46E5' : '#ECEDF4'), background: active ? '#F7F6FE' : '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
                  <span className="nf-noshrink" style={{ fontSize: 14 }}>{s.glyph}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}>{s.name}</span>
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600 }}>{s.detail}</span>
                  </span>
                  {active && <span className="nf-noshrink" style={{ fontSize: 13, color: '#4F46E5' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="nf-card nf-card--roomy">
          <div className="nf-row">
            <span className="nf-card-title">Routing rules</span>
            <SoonBadge style={{ marginLeft: 'auto' }} />
          </div>
          <div className="nf-card-sub" style={{ marginTop: 4 }}>Conditional rules (by email type, recipient domain, country) are being built. Until then the strategy above applies to every email.</div>
          <div className="nf-col nf-dim" style={{ gap: 9, marginTop: 14 }} aria-disabled="true">
            {RULES.map((r, i) => (
              <div key={r.id} className="nf-list-item" style={{ borderRadius: 11, padding: '11px 13px' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#7C3AED', flexShrink: 0 }}>{i + 1}</span>
                <span className="nf-grow">
                  <span className="nf-block nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{r.condition}</span>
                  <span className="nf-block nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600 }}>→ {r.action}</span>
                </span>
                <Toggle on={r.on} onChange={() => undefined} label={'Rule ' + (i + 1)} disabled />
              </div>
            ))}
          </div>
          <button type="button" className="nf-btn-dashed" disabled style={{ cursor: 'not-allowed', opacity: 0.6 }}>+ Add routing rule</button>
        </div>
      </div>

      <div className="nf-stack" style={{ flex: '1 1 300px' }}>
        <div className="nf-card">
          <CardHead small title="Traffic split" sub={traffic.actual ? 'Actual share of emails sent this month' : `Configured weights under “${strategyName}”`} />
          <div className="nf-col" style={{ gap: 12, marginTop: 14 }}>
            {!traffic.rows.length && <div className="nf-card-sub">No enabled connections.</div>}
            {traffic.rows.map((row, i) => (
              <div key={row.name + i} style={{ minWidth: 0 }}>
                <div className="nf-row" style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
                  <span className="nf-grow nf-ellipsis">{row.name}</span>
                  <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{row.pct}%</span>
                </div>
                <Bar pct={row.pct + '%'} color={SPLIT_COLORS[Math.min(i, SPLIT_COLORS.length - 1)]} height={7} style={{ marginTop: 5 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="nf-card nf-card--night">
          <div className="nf-ai-head"><span>✨</span><b>Routing insight</b></div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E6E4F5', lineHeight: 1.55, marginTop: 9 }}>{insight(state.stats, enabled)}</div>
        </div>

        <div className="nf-card">
          <CardHead small title="Failover chain" sub="After the strategy’s first pick, connections are tried in priority order (up to 3 attempts per email)." />
          <div className="nf-col" style={{ alignItems: 'center', marginTop: 12 }}>
            {!enabled.length && <div className="nf-card-sub" style={{ alignSelf: 'stretch' }}>Enable at least one connection to build the chain.</div>}
            {enabled.map((c, i) => {
              const t = CHAIN_TAGS[Math.min(i, 2)];
              return (
                <div key={c.id} className="nf-col" style={{ width: '100%', alignItems: 'center' }}>
                  <div className="nf-row" style={{ width: '100%', border: '1.5px solid ' + t.border, background: t.bg, borderRadius: 10, padding: '10px 12px', gap: 9, opacity: i > 2 ? 0.6 : 1 }}>
                    <span className="nf-tag" style={{ color: t.tagColor, background: t.tagBg }}>{i > 2 ? 'BACKUP' : t.tag}</span>
                    <span className="nf-grow nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{c.name}</span>
                    <span className="nf-noshrink" style={{ fontSize: 10, fontWeight: 800, color: '#A5A8BD' }}>P{c.priority}</span>
                  </div>
                  {i < enabled.length - 1 && <div style={{ height: 14, width: 2, background: '#DDD6FE' }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
