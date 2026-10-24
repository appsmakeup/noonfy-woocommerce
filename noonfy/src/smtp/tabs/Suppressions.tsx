import { BOUNCE_KPIS, BOUNCE_REASONS, SUPPRESSIONS } from '../data';
import { Bar, CardHead, SampleBanner } from '../ui';

export function Suppressions() {
  return (
    <section>
      <SampleBanner>Sample data. Bounce and complaint tracking (via provider webhooks) and the suppression list are coming next.</SampleBanner>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {BOUNCE_KPIS.map(b => (
          <div key={b.label} className="nf-stat">
            <div className="nf-stat-label">{b.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: b.color, marginTop: 5 }}>{b.value}</div>
            <div className="nf-stat-note">{b.note}</div>
          </div>
        ))}
      </div>
      <div className="nf-flow">
        <div className="nf-card" style={{ flex: '1 1 340px' }}>
          <CardHead title="Suppression list" sub="Addresses excluded from all sends" />
          <div className="nf-col" style={{ gap: 10, marginTop: 14 }}>
            {SUPPRESSIONS.map(s => (
              <div key={s.label} style={{ minWidth: 0 }}>
                <div className="nf-row" style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
                  <span className="nf-row nf-grow" style={{ display: 'flex', gap: 7 }}>
                    <span className="nf-legend-dot" style={{ background: s.color }} />
                    <span className="nf-ellipsis">{s.label}</span>
                  </span>
                  <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{s.count}</span>
                </div>
                <Bar pct={s.width} color={s.color} height={6} style={{ marginTop: 5 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="nf-card" style={{ flex: '1 1 340px' }}>
          <CardHead title="Bounce analysis" sub="Top reasons in the last 30 days" />
          <div className="nf-col" style={{ gap: 9, marginTop: 14 }}>
            {BOUNCE_REASONS.map(b => (
              <div key={b.reason} className="nf-list-item">
                <span className="nf-tag" style={{ color: b.tagColor, background: b.tagBg }}>{b.type}</span>
                <span className="nf-grow nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }}>{b.reason}</span>
                <span className="nf-noshrink" style={{ fontSize: 11.5, fontWeight: 800, color: '#5B5E75' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
