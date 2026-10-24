import { CONNECTIONS, KPIS, SHARE, SHARE_LEGEND, healthColor, type LiveLog } from '../data';
import { useChart } from '../useChart';
import { CardHead } from '../ui';

export function Dashboard({ liveLogs, eps }: { liveLogs: LiveLog[]; eps: number }) {
  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12 }}>
        {KPIS.map(k => (
          <div key={k.label} className="nf-stat" style={{ padding: '13px 15px' }}>
            <div className="nf-stat-label" style={{ letterSpacing: '.2px' }}>{k.label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: k.color, marginTop: 5, letterSpacing: '-.3px' }}>{k.value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: k.deltaColor, marginTop: 2 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="nf-flow" style={{ marginTop: 14 }}>
        <VolumeCard />
        <ShareCard />
      </div>

      <div className="nf-flow" style={{ marginTop: 14 }}>
        <div className="nf-card" style={{ flex: '1 1 380px' }}>
          <div className="nf-row">
            <span className="nf-card-title">Provider health</span>
            <a href="#providers" className="nf-card-link">Manage →</a>
          </div>
          <div className="nf-col" style={{ gap: 10, marginTop: 14 }}>
            {CONNECTIONS.map(c => {
              const color = healthColor(c.health);
              return (
                <div key={c.id} className="nf-row" style={{ gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: c.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: c.fg, flexShrink: 0 }}>{c.mark}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 12, fontWeight: 700, color: '#14152A' }}>{c.name}</span>
                    <span className="nf-block" style={{ fontSize: 10.5, color: '#8A8DA3', fontWeight: 600 }}>{c.today} sent · {c.latency}</span>
                  </span>
                  <span className="nf-row nf-noshrink" style={{ gap: 6 }}>
                    <span className="nf-bar-track" style={{ width: 34, height: 5, display: 'inline-block' }}>
                      <span className="nf-bar-fill nf-block" style={{ background: color, width: c.health + '%' }} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color }}>{c.health}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="nf-card" style={{ flex: '1 1 320px', background: '#0C0D1E', borderColor: '#24264A' }}>
          <div className="nf-row">
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Live queue</span>
            <span className="nf-row nf-ml-auto" style={{ fontSize: 10.5, fontWeight: 800, color: '#34D399', gap: 6 }}>
              <span className="nf-dot" style={{ width: 6, height: 6, background: '#34D399', animation: 'nf-blink 1.4s ease infinite' }} />
              {eps}/s
            </span>
          </div>
          <div className="nf-mono" style={{ marginTop: 12, fontSize: 11 }}>
            {liveLogs.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 9, padding: '6px 0', borderBottom: '1px solid #1E1F3D', animation: 'nf-rowIn .3s ease', minWidth: 0 }}>
                <span className="nf-noshrink" style={{ color: '#5B5E88' }}>{l.time}</span>
                <span className="nf-noshrink" style={{ fontWeight: 800, color: l.color, width: 64 }}>{l.status}</span>
                <span className="nf-grow nf-ellipsis" style={{ color: '#9EA0C8' }}>{l.to}</span>
                <span className="nf-noshrink" style={{ color: '#5B5E88' }}>{l.provider}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VolumeCard() {
  const canvas = useChart<'bar'>(() => {
    const days = Array.from({ length: 14 }, (_, i) => 'D' + (i + 1));
    const tick = { font: { size: 10, weight: 600 } } as const;
    return {
      type: 'bar',
      data: {
        labels: days,
        datasets: [
          { label: 'Delivered', data: days.map((_, i) => 22000 + Math.round(Math.sin(i / 2.2) * 4200) + i * 320), backgroundColor: '#4F46E5', borderRadius: 5, stack: 's' },
          { label: 'Failed', data: days.map(() => 420 + Math.round(Math.random() * 380)), backgroundColor: '#DDD6FE', borderRadius: 5, stack: 's' },
        ],
      },
      options: {
        maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: tick },
          y: { stacked: true, border: { display: false }, grid: { color: '#F3F3FA' }, ticks: { ...tick, maxTicksLimit: 5, callback: v => Number(v) / 1000 + 'k' } },
        },
      },
    };
  });
  return (
    <div className="nf-card" style={{ flex: '1 1 440px' }}>
      <div className="nf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ minWidth: 0 }}><CardHead title="Sending volume" sub="Delivered vs. failed, last 14 days" /></div>
        <div className="nf-ml-auto nf-noshrink" style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700, color: '#5B5E75' }}>
          <span className="nf-row" style={{ gap: 5 }}><span className="nf-legend-dot" style={{ background: '#4F46E5' }} />Delivered</span>
          <span className="nf-row" style={{ gap: 5 }}><span className="nf-legend-dot" style={{ background: '#DDD6FE' }} />Failed</span>
        </div>
      </div>
      <div style={{ height: 220, marginTop: 12 }}><canvas ref={canvas} /></div>
    </div>
  );
}

function ShareCard() {
  const canvas = useChart<'doughnut'>(() => ({
    type: 'doughnut',
    data: { labels: SHARE.labels, datasets: [{ data: SHARE.data, backgroundColor: SHARE.colors, borderWidth: 0 }] },
    options: { cutout: '72%', maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } } },
  }));
  return (
    <div className="nf-card" style={{ flex: '1 1 280px' }}>
      <CardHead title="Provider share" sub="Volume routed per provider" />
      <div style={{ height: 150, margin: '14px auto 6px auto', position: 'relative', maxWidth: 150 }}>
        <canvas ref={canvas} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#14152A' }}>412k</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#8A8DA3' }}>this month</span>
        </div>
      </div>
      <div className="nf-col" style={{ gap: 7, marginTop: 6 }}>
        {SHARE_LEGEND.map(s => (
          <div key={s.label} className="nf-row" style={{ gap: 8, fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
            <span className="nf-legend-dot" style={{ background: s.color }} />
            <span className="nf-grow nf-ellipsis">{s.label}</span>
            <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
