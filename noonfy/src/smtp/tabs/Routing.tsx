import { FAILOVER, RULES, SPLIT_BASE, SPLIT_COLORS, SPLIT_NAMES, STRATEGIES } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { Bar, CardHead, Toggle } from '../ui';

export function Routing({ api }: { api: SmtpApi }) {
  const { state, update, toggleIn } = api;
  const strategyName = (STRATEGIES.find(s => s.key === state.strategy) ?? STRATEGIES[0]).name;
  const split = SPLIT_BASE[state.strategy] ?? SPLIT_BASE.weighted;

  return (
    <section className="nf-flow">
      <div className="nf-stack" style={{ flex: '1 1 420px' }}>
        <div className="nf-card nf-card--roomy">
          <CardHead title="Rotation strategy" sub="How outbound mail is distributed across providers" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 16 }}>
            {STRATEGIES.map(s => {
              const active = state.strategy === s.key;
              return (
                <button key={s.key} type="button" aria-pressed={active} onClick={() => update({ strategy: s.key })} className="nf-row"
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
            <span className="nf-ml-auto" style={{ fontSize: 10.5, fontWeight: 800, color: '#7C3AED', background: '#F1EBFE', borderRadius: 99, padding: '3px 10px' }}>evaluated top-down</span>
          </div>
          <div className="nf-col" style={{ gap: 9, marginTop: 14 }}>
            {RULES.map((r, i) => {
              const on = state.ruleTg[r.id] ?? r.on;
              return (
                <div key={r.id} className="nf-list-item" style={{ borderRadius: 11, padding: '11px 13px' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#7C3AED', flexShrink: 0 }}>{i + 1}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{r.condition}</span>
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600 }}>→ {r.action}</span>
                  </span>
                  <Toggle on={on} onChange={() => toggleIn('ruleTg', r.id, on)} label={'Rule ' + (i + 1)} />
                </div>
              );
            })}
          </div>
          <button type="button" className="nf-btn-dashed">+ Add routing rule</button>
        </div>
      </div>

      <div className="nf-stack" style={{ flex: '1 1 300px' }}>
        <div className="nf-card">
          <CardHead small title="Traffic split" sub={`Live weights under “${strategyName}”`} />
          <div className="nf-col" style={{ gap: 12, marginTop: 14 }}>
            {SPLIT_NAMES.map((name, i) => (
              <div key={name} style={{ minWidth: 0 }}>
                <div className="nf-row" style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
                  <span className="nf-grow nf-ellipsis">{name}</span>
                  <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{split[i]}%</span>
                </div>
                <Bar pct={split[i] + '%'} color={SPLIT_COLORS[i]} height={7} style={{ marginTop: 5 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="nf-card nf-card--night">
          <div className="nf-ai-head"><span>✨</span><b>AI routing insight</b></div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E6E4F5', lineHeight: 1.55, marginTop: 9 }}>
            Postmark delivers transactional mail 340ms faster with a 0.2% lower bounce rate. Routing order confirmations there and keeping SES for bulk would lift inbox placement ~1.4pt.
          </div>
        </div>

        <div className="nf-card">
          <CardHead small title="Failover chain" />
          <div className="nf-col" style={{ alignItems: 'center', marginTop: 12 }}>
            {FAILOVER.map((f, i) => (
              <div key={f.tag} className="nf-col" style={{ width: '100%', alignItems: 'center' }}>
                <div className="nf-row" style={{ width: '100%', border: '1.5px solid ' + f.border, background: f.bg, borderRadius: 10, padding: '10px 12px', gap: 9 }}>
                  <span className="nf-tag" style={{ color: f.tagColor, background: f.tagBg }}>{f.tag}</span>
                  <span className="nf-grow nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{f.name}</span>
                </div>
                {i < FAILOVER.length - 1 && <div style={{ height: 14, width: 2, background: '#DDD6FE' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
