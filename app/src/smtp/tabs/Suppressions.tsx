import { BOUNCE_KPIS, BOUNCE_REASONS, SUPPRESSIONS } from '../data';
import { Bar, CardHead } from '../ui';

export function Suppressions() {
  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {BOUNCE_KPIS.map(b => (
          <div key={b.label} className="stat">
            <div className="stat-label">{b.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: b.color, marginTop: 5 }}>{b.value}</div>
            <div className="stat-note">{b.note}</div>
          </div>
        ))}
      </div>
      <div className="flow">
        <div className="card" style={{ flex: '1 1 340px' }}>
          <CardHead title="Suppression list" sub="Addresses excluded from all sends" />
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            {SUPPRESSIONS.map(s => (
              <div key={s.label} style={{ minWidth: 0 }}>
                <div className="row" style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
                  <span className="row grow" style={{ display: 'flex', gap: 7 }}>
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="ellipsis">{s.label}</span>
                  </span>
                  <span className="noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{s.count}</span>
                </div>
                <Bar pct={s.width} color={s.color} height={6} style={{ marginTop: 5 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ flex: '1 1 340px' }}>
          <CardHead title="Bounce analysis" sub="Top reasons in the last 30 days" />
          <div className="col" style={{ gap: 9, marginTop: 14 }}>
            {BOUNCE_REASONS.map(b => (
              <div key={b.reason} className="list-item">
                <span className="tag" style={{ color: b.tagColor, background: b.tagBg }}>{b.type}</span>
                <span className="grow ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{b.reason}</span>
                <span className="noshrink" style={{ fontSize: 11.5, fontWeight: 800, color: '#5B5E75' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
