import { CHECK_STYLE, DNS_RECORDS, DOMAINS } from '../data';
import { useChart } from '../../shared/useChart';
import { CardHead, SampleBanner } from '../../shared/ui';

const STAT_ROW = { display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, fontWeight: 700, color: '#8A8DA3' } as const;

export function Domains() {
  return (
    <section>
      <SampleBanner>Sample data. Live SPF, DKIM, DMARC and MX checks for your sending domains are coming next.</SampleBanner>
      <div className="nf-flow">
      <div className="nf-card" style={{ flex: '1 1 420px' }}>
        <CardHead title="Sending domains" sub="Authentication status per domain" />
        <div className="nf-col" style={{ gap: 11, marginTop: 14 }}>
          {DOMAINS.map(d => (
            <div key={d.name} style={{ border: '1px solid #F3F3FA', borderRadius: 12, padding: '13px 15px', minWidth: 0 }}>
              <div className="nf-row" style={{ gap: 9, flexWrap: 'wrap' }}>
                <span className="nf-noshrink" style={{ fontSize: 13 }}>🌐</span>
                <span className="nf-ellipsis" style={{ fontSize: 12.5, fontWeight: 800, color: '#14152A', minWidth: 0 }}>{d.name}</span>
                <span className="nf-badge nf-noshrink" style={{ color: d.stColor, background: d.stBg }}>{d.status}</span>
                <span className="nf-ml-auto nf-noshrink" style={{ fontSize: 10.5, fontWeight: 700, color: '#8A8DA3' }}>Rep {d.rep}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
                {d.checks.map(c => {
                  const s = CHECK_STYLE[c.state];
                  return (
                    <span key={c.label} className="nf-row nf-nowrap" style={{ gap: 5, border: '1px solid ' + s.border, background: s.bg, borderRadius: 99, padding: '4px 10px', fontSize: 10.5, fontWeight: 800, color: s.color }}>
                      {s.icon} {c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="nf-btn-dashed">+ Add sending domain</button>
      </div>

      <div className="nf-stack" style={{ flex: '1 1 300px' }}>
        <WarmupCard />
        <div className="nf-card">
          <CardHead small title="DNS records" />
          <div className="nf-col" style={{ gap: 8, marginTop: 12 }}>
            {DNS_RECORDS.map(r => (
              <div key={r.type + r.host} style={{ border: '1px solid #F3F3FA', borderRadius: 9, padding: '9px 11px', minWidth: 0 }}>
                <div className="nf-row" style={{ gap: 7 }}>
                  <span className="nf-tag" style={{ color: '#4F46E5', background: '#EEF0FE', padding: '2px 7px' }}>{r.type}</span>
                  <span className="nf-ellipsis" style={{ fontSize: 10.5, fontWeight: 800, color: '#5B5E75', minWidth: 0 }}>{r.host}</span>
                  <span className="nf-ml-auto nf-noshrink" style={{ fontSize: 11, color: r.ok ? '#0E9F6E' : '#E02424' }}>{r.ok ? '✓' : '✕'}</span>
                </div>
                <div className="nf-mono nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', marginTop: 5 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

function WarmupCard() {
  const { ref: canvas } = useChart<'line'>(() => {
    const days = Array.from({ length: 18 }, (_, i) => 'D' + (i + 1));
    const tick = { font: { size: 9, weight: 600 } } as const;
    return {
      type: 'line',
      data: {
        labels: days,
        datasets: [{ data: days.map((_, i) => Math.round(400 * Math.pow(1.15, i))), borderColor: '#0E9F6E', backgroundColor: 'rgba(14,159,110,.14)', fill: true, tension: 0.4, borderWidth: 2.4, pointRadius: 0 }],
      },
      options: {
        maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { ...tick, maxTicksLimit: 5 } },
          y: { border: { display: false }, grid: { color: '#F3F3FA' }, ticks: { ...tick, maxTicksLimit: 4, callback: v => (Number(v) >= 1000 ? Number(v) / 1000 + 'k' : v) } },
        },
      },
    };
  });
  return (
    <div className="nf-card">
      <CardHead small title="Warmup progress" sub="mail.brumahome.com · day 18 of 30" />
      <div style={{ height: 130, marginTop: 12 }}><canvas ref={canvas} /></div>
      <div style={{ ...STAT_ROW, marginTop: 10 }}><span>Today's cap</span><span className="nf-ml-auto" style={{ fontWeight: 800, color: '#14152A' }}>24,000</span></div>
      <div style={{ ...STAT_ROW, marginTop: 5 }}><span>Recommended increase</span><span className="nf-ml-auto" style={{ fontWeight: 800, color: '#0E9F6E' }}>+15% / day</span></div>
    </div>
  );
}
