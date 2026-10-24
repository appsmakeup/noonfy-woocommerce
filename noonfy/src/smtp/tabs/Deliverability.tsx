import { BLACKLISTS, DELIV_CARDS, DELIV_RECS } from '../data';
import { CardHead, SampleBanner } from '../../shared/ui';

export function Deliverability() {
  return (
    <section>
      <SampleBanner>Sample data. Reputation, blacklist monitoring and inbox placement need provider webhooks, which are coming next.</SampleBanner>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>
        <div className="nf-col" style={{ flex: '1 1 240px', minWidth: 0, background: 'linear-gradient(135deg,#0E9F6E,#059669)', borderRadius: 16, padding: '22px 24px', color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.7px', opacity: 0.85, textAlign: 'center' }}>AI DELIVERABILITY SCORE</div>
          <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-1px', marginTop: 6 }}>94</div>
          <div style={{ fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.2)', borderRadius: 99, padding: '4px 14px', marginTop: 4 }}>EXCELLENT</div>
        </div>
        <div style={{ flex: '2 1 420px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
          {DELIV_CARDS.map(d => (
            <div key={d.label} className="nf-stat">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span className="nf-noshrink" style={{ fontSize: 13 }}>{d.glyph}</span>
                <span className="nf-stat-label">{d.label}</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: d.color, marginTop: 6 }}>{d.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#A5A8BD', marginTop: 1 }}>{d.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="nf-flow" style={{ marginTop: 14 }}>
        <div className="nf-card" style={{ flex: '1 1 360px' }}>
          <CardHead title="Blacklist monitor" sub="Checked hourly across 32 RBLs" />
          <div className="nf-col" style={{ gap: 9, marginTop: 14 }}>
            {BLACKLISTS.map(b => (
              <div key={b.name} className="nf-row" style={{ gap: 10, fontSize: 12, fontWeight: 700, color: '#5B5E75' }}>
                <span className="nf-dot" style={{ width: 8, height: 8, background: '#0E9F6E' }} />
                <span className="nf-grow nf-ellipsis">{b.name}</span>
                <span className="nf-noshrink" style={{ fontSize: 10.5, fontWeight: 800, color: '#0E9F6E' }}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="nf-card nf-card--night" style={{ flex: '1 1 320px' }}>
          <div className="nf-ai-head"><span>✨</span><b>AI recommendations</b></div>
          <div className="nf-col" style={{ gap: 9, marginTop: 12 }}>
            {DELIV_RECS.map(r => (
              <div key={r} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: '#E6E4F5', lineHeight: 1.5 }}>{r}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
