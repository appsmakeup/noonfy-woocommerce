import { FAILOVER, RULES, SPLIT_BASE, SPLIT_COLORS, SPLIT_NAMES, STRATEGIES } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { Bar, CardHead, Toggle } from '../ui';

export function Routing({ api }: { api: SmtpApi }) {
  const { state, update, toggleIn } = api;
  const strategyName = (STRATEGIES.find(s => s.key === state.strategy) ?? STRATEGIES[0]).name;
  const split = SPLIT_BASE[state.strategy] ?? SPLIT_BASE.weighted;

  return (
    <section className="flow">
      <div className="stack" style={{ flex: '1 1 420px' }}>
        <div className="card card--roomy">
          <CardHead title="Rotation strategy" sub="How outbound mail is distributed across providers" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 16 }}>
            {STRATEGIES.map(s => {
              const active = state.strategy === s.key;
              return (
                <button key={s.key} type="button" aria-pressed={active} onClick={() => update({ strategy: s.key })} className="row"
                  style={{ gap: 10, border: '1.5px solid ' + (active ? '#4F46E5' : '#ECEDF4'), background: active ? '#F7F6FE' : '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
                  <span className="noshrink" style={{ fontSize: 14 }}>{s.glyph}</span>
                  <span className="grow">
                    <span className="block ellipsis" style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}>{s.name}</span>
                    <span className="block ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600 }}>{s.detail}</span>
                  </span>
                  {active && <span className="noshrink" style={{ fontSize: 13, color: '#4F46E5' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card card--roomy">
          <div className="row">
            <span className="card-title">Routing rules</span>
            <span className="ml-auto" style={{ fontSize: 10.5, fontWeight: 800, color: '#7C3AED', background: '#F1EBFE', borderRadius: 99, padding: '3px 10px' }}>evaluated top-down</span>
          </div>
          <div className="col" style={{ gap: 9, marginTop: 14 }}>
            {RULES.map((r, i) => {
              const on = state.ruleTg[r.id] ?? r.on;
              return (
                <div key={r.id} className="list-item" style={{ borderRadius: 11, padding: '11px 13px' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#7C3AED', flexShrink: 0 }}>{i + 1}</span>
                  <span className="grow">
                    <span className="block ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{r.condition}</span>
                    <span className="block ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600 }}>→ {r.action}</span>
                  </span>
                  <Toggle on={on} onChange={() => toggleIn('ruleTg', r.id, on)} label={'Rule ' + (i + 1)} />
                </div>
              );
            })}
          </div>
          <button type="button" className="btn-dashed">+ Add routing rule</button>
        </div>
      </div>

      <div className="stack" style={{ flex: '1 1 300px' }}>
        <div className="card">
          <CardHead small title="Traffic split" sub={`Live weights under “${strategyName}”`} />
          <div className="col" style={{ gap: 12, marginTop: 14 }}>
            {SPLIT_NAMES.map((name, i) => (
              <div key={name} style={{ minWidth: 0 }}>
                <div className="row" style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
                  <span className="grow ellipsis">{name}</span>
                  <span className="noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{split[i]}%</span>
                </div>
                <Bar pct={split[i] + '%'} color={SPLIT_COLORS[i]} height={7} style={{ marginTop: 5 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="card card--night">
          <div className="ai-head"><span>✨</span><b>AI routing insight</b></div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E6E4F5', lineHeight: 1.55, marginTop: 9 }}>
            Postmark delivers transactional mail 340ms faster with a 0.2% lower bounce rate. Routing order confirmations there and keeping SES for bulk would lift inbox placement ~1.4pt.
          </div>
        </div>

        <div className="card">
          <CardHead small title="Failover chain" />
          <div className="col" style={{ alignItems: 'center', marginTop: 12 }}>
            {FAILOVER.map((f, i) => (
              <div key={f.tag} className="col" style={{ width: '100%', alignItems: 'center' }}>
                <div className="row" style={{ width: '100%', border: '1.5px solid ' + f.border, background: f.bg, borderRadius: 10, padding: '10px 12px', gap: 9 }}>
                  <span className="tag" style={{ color: f.tagColor, background: f.tagBg }}>{f.tag}</span>
                  <span className="grow ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{f.name}</span>
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
