import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api';
import { useChart } from '../shared/useChart';
import { automationsApi } from './api';
import { pct } from './meta';
import type { Journey } from './types';

const BAR_COLORS = ['#4F46E5', '#6D5AE8', '#8B5CF6', '#A78BFA', '#C4B5FD'];

/** Funnel points: Entered, each email (by order in the flow), Converted. */
function funnel(j: Journey) {
  return [
    { label: 'Entered', value: j.entered },
    ...j.emails.map((e, i) => ({ label: `Email ${i + 1}`, value: e.sent, name: e.name })),
    { label: 'Converted', value: j.converted },
  ];
}

export function Journeys() {
  const [data, setData] = useState<Journey[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    automationsApi.journeys().then(d => {
      setData(d);
      setSelected([...d].sort((a, b) => b.entered - a.entered)[0]?.id ?? 0);
    }).catch(e => setError(errorMessage(e)));
  }, []);

  const current = data?.find(j => j.id === selected) ?? null;

  // Where contacts left without converting (share of everyone who entered); people still waiting don't count.
  const dropoffs = useMemo(() => {
    const out: { label: string; share: number }[] = [];
    (data ?? []).forEach(j => {
      if (!j.entered) return;
      Object.entries(j.dropoffs).forEach(([i, n]) => {
        out.push({ label: `${j.name} · after ${+i < 0 ? 'entering' : `Email ${+i + 1}`}`, share: n / j.entered });
      });
    });
    return out.sort((a, b) => b.share - a.share).slice(0, 5);
  }, [data]);

  if (error) return <div className="nf-card nf-empty-card"><div className="nf-empty-title">Couldn’t load journeys</div><div className="nf-hint">{error}</div></div>;
  if (!data) return <div className="nf-card nf-empty-card"><div className="nf-hint">Loading…</div></div>;
  if (!data.length) {
    return (
      <div className="nf-card nf-empty-card">
        <div style={{ fontSize: 30 }}>🛤️</div>
        <div className="nf-empty-title" style={{ marginTop: 8, fontSize: 14 }}>No journeys yet</div>
        <div className="nf-hint">Once contacts enter a live workflow, you’ll see how they move through it here.</div>
      </div>
    );
  }
  const maxShare = dropoffs[0]?.share ?? 1;

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div className="nf-card">
          <div className="nf-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div className="nf-card-title">Journey completion</div>
              <div className="nf-card-sub">How customers move through active flows</div>
            </div>
            <select className="nf-field nf-ml-auto" style={{ width: 'auto', maxWidth: 220 }} value={selected} onChange={e => setSelected(+e.target.value)} aria-label="Workflow">
              {data.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div style={{ height: 250, marginTop: 12 }}>{current && <FunnelChart key={current.id} journey={current} />}</div>
        </div>
        <div className="nf-card">
          <div className="nf-card-title">Drop-off points</div>
          <div className="nf-card-sub">Highest exit steps across journeys</div>
          <div className="nf-col" style={{ gap: 13, marginTop: 16 }}>
            {dropoffs.map(d => (
              <div key={d.label}>
                <div className="nf-row" style={{ fontSize: 12, fontWeight: 700, color: '#3C3F55' }}><span className="nf-ellipsis">{d.label}</span><span className="nf-ml-auto" style={{ color: '#E02424', fontWeight: 800, paddingLeft: 8 }}>{Math.round(d.share * 100)}%</span></div>
                <div style={{ height: 7, borderRadius: 99, background: '#F3F3FA', marginTop: 5 }}><div style={{ height: 7, borderRadius: 99, background: 'linear-gradient(90deg,#F59E0B,#EF4444)', width: (d.share / maxShare) * 78 + '%' }} /></div>
              </div>
            ))}
            {!dropoffs.length && <div className="nf-hint">No drop-offs yet. Contacts who leave a workflow early without ordering show up here.</div>}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 14 }}>
        {data.map(j => {
          const rate = j.entered ? j.completed / j.entered : 0;
          return (
            <a key={j.id} href={`#detail:${j.id}`} className="nf-card nf-ab-card" style={{ padding: '18px 20px' }}>
              <div className="nf-row" style={{ gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{j.emoji}</span>
                <span className="nf-ellipsis" style={{ fontSize: 13.5, fontWeight: 800, color: '#14152A' }}>{j.name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                <div><div style={{ fontSize: 10.5, fontWeight: 700, color: '#A5A8BD' }}>ENTERED</div><div style={{ fontSize: 15, fontWeight: 800, color: '#14152A', marginTop: 2 }}>{j.entered.toLocaleString()}</div></div>
                <div><div style={{ fontSize: 10.5, fontWeight: 700, color: '#A5A8BD' }}>COMPLETED</div><div style={{ fontSize: 15, fontWeight: 800, color: '#14152A', marginTop: 2 }}>{j.completed.toLocaleString()}</div></div>
                <div><div style={{ fontSize: 10.5, fontWeight: 700, color: '#A5A8BD' }}>CONVERTED</div><div style={{ fontSize: 15, fontWeight: 800, color: '#0E9F6E', marginTop: 2 }}>{j.converted.toLocaleString()}</div></div>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: '#F3F3FA', marginTop: 12 }}><div style={{ height: 7, borderRadius: 99, background: 'linear-gradient(90deg,#4F46E5,#8B5CF6)', width: rate * 100 + '%' }} /></div>
              <div style={{ fontSize: 11, color: '#8A8DA3', fontWeight: 600, marginTop: 6 }}>{pct(j.completed, j.entered)} completion rate{j.active ? ` · ${j.active.toLocaleString()} in progress` : ''}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function FunnelChart({ journey }: { journey: Journey }) {
  const pts = funnel(journey);
  const { ref } = useChart<'bar'>(() => ({
    type: 'bar',
    data: {
      labels: pts.map(p => p.label),
      datasets: [{ data: pts.map(p => p.value), backgroundColor: pts.map((_, i) => (i === pts.length - 1 ? '#0E9F6E' : BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)])), borderRadius: 7, barPercentage: 0.6 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => (pts[items[0].dataIndex] as { name?: string }).name ?? items[0].label } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: 700 }, color: '#5B5E75' } },
        y: { border: { display: false }, grid: { color: '#F3F3FA' }, beginAtZero: true, ticks: { maxTicksLimit: 5, precision: 0, font: { size: 10, weight: 600 }, color: '#A5A8BD' } },
      },
    },
  }));
  return <canvas ref={ref} />;
}
