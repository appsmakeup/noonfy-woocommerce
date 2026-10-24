import { useEffect, type MutableRefObject } from 'react';
import type { Chart, ChartType } from 'chart.js';
import type { Connection, LogRow, Stats } from '../../config';
import { C, healthColor } from '../data';
import { useChart } from '../useChart';
import { CardHead, fmtCompact, fmtMs, fmtNum, fmtPct, fmtTime, presetOf } from '../ui';

const SHARE_COLORS = ['#4F46E5', '#8B5CF6', '#C4B5FD', '#E0D7FE', '#EFEFF7'];
const LIVE_COLORS: Record<string, string> = { SENT: '#34D399', RETRY: '#FBBF24', FAILED: '#F87171' };
const NOT_TRACKED = { color: C.ink, deltaColor: C.muted };

interface Kpi { label: string; value: string; color: string; delta: string; deltaColor: string }

function kpis(stats: Stats, connections: Connection[]): Kpi[] {
  const active = connections.filter(c => c.enabled).length;
  const ok = stats.successRate30;
  return [
    { label: 'PROVIDERS', value: String(active), color: C.ink, delta: active ? `${connections.length} configured` : 'using PHP mail()', deltaColor: active ? C.green : C.orange },
    { label: 'SENT TODAY', value: fmtNum(stats.sentToday), color: C.ink, delta: `${fmtNum(stats.sentYesterday)} yesterday`, deltaColor: C.muted },
    { label: 'THIS MONTH', value: fmtCompact(stats.sentMonth), color: C.ink, delta: 'accepted', deltaColor: C.muted },
    { label: 'QUEUED', value: '0', color: C.brand, delta: 'sent instantly', deltaColor: C.muted },
    { label: 'SUCCESS RATE', value: fmtPct(ok), color: ok == null ? C.ink : ok >= 98 ? C.green : ok >= 90 ? C.orange : C.red, delta: 'last 30 days', deltaColor: C.muted },
    { label: 'FAILED', value: fmtPct(stats.failedRate30), color: stats.failedRate30 ? C.orange : C.ink, delta: `${fmtNum(stats.failedToday)} today`, deltaColor: stats.failedToday ? C.orange : C.muted },
    { label: 'OPEN RATE', value: '—', ...NOT_TRACKED, delta: 'not tracked yet' },
    { label: 'CLICK RATE', value: '—', ...NOT_TRACKED, delta: 'not tracked yet' },
    { label: 'BOUNCE RATE', value: '—', ...NOT_TRACKED, delta: 'needs webhooks' },
    { label: 'SPAM RATE', value: '—', ...NOT_TRACKED, delta: 'needs webhooks' },
    { label: 'AVG SEND TIME', value: fmtMs(stats.avgLatency7), color: C.ink, delta: stats.p95Latency7 != null ? `p95 ${fmtMs(stats.p95Latency7)}` : 'last 7 days', deltaColor: C.muted },
    { label: 'DOMAIN REP', value: '—', ...NOT_TRACKED, delta: 'coming soon' },
  ];
}

export function Dashboard({ stats, connections, liveLogs }: { stats: Stats; connections: Connection[]; liveLogs: LogRow[] }) {
  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12 }}>
        {kpis(stats, connections).map(k => (
          <div key={k.label} className="nf-stat" style={{ padding: '13px 15px' }}>
            <div className="nf-stat-label" style={{ letterSpacing: '.2px' }}>{k.label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: k.color, marginTop: 5, letterSpacing: '-.3px' }}>{k.value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: k.deltaColor, marginTop: 2 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="nf-flow" style={{ marginTop: 14 }}>
        <VolumeCard volume={stats.volume14} />
        <ShareCard stats={stats} />
      </div>

      <div className="nf-flow" style={{ marginTop: 14 }}>
        <div className="nf-card" style={{ flex: '1 1 380px' }}>
          <div className="nf-row">
            <span className="nf-card-title">Provider health</span>
            <a href="#providers" className="nf-card-link">Manage →</a>
          </div>
          <div className="nf-col" style={{ gap: 10, marginTop: 14 }}>
            {connections.length === 0 && <div className="nf-card-sub">No connections yet. <a href="#providers">Add one</a> to start routing email.</div>}
            {connections.map(c => {
              const p = presetOf(c.provider);
              const perf = stats.perConnection[c.id] ?? {};
              const score = perf.successRate ?? null;
              const color = score == null ? '#C4C6D4' : healthColor(score);
              return (
                <div key={c.id} className="nf-row" style={{ gap: 11, opacity: c.enabled ? 1 : 0.55 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: p.fg, flexShrink: 0 }}>{p.mark}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 12, fontWeight: 700, color: '#14152A' }}>{c.name}</span>
                    <span className="nf-block" style={{ fontSize: 10.5, color: '#8A8DA3', fontWeight: 600 }}>{fmtNum(perf.sentToday ?? 0)} sent · {fmtMs(perf.avgLatency ?? c.lastTest?.latencyMs)}</span>
                  </span>
                  <span className="nf-row nf-noshrink" style={{ gap: 6 }}>
                    <span className="nf-bar-track" style={{ width: 34, height: 5, display: 'inline-block' }}>
                      <span className="nf-bar-fill nf-block" style={{ background: color, width: (score ?? 0) + '%' }} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: score == null ? '#8A8DA3' : color, minWidth: 22, textAlign: 'right' }}>{score == null ? '—' : Math.round(score)}</span>
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
              {fmtNum(stats.lastHour)}/h
            </span>
          </div>
          <div className="nf-mono" style={{ marginTop: 12, fontSize: 11 }}>
            {liveLogs.length === 0 && <div style={{ color: '#5B5E88', padding: '6px 0' }}>Waiting for the first email…</div>}
            {liveLogs.map(l => (
              <div key={l.id} title={l.error ?? undefined} style={{ display: 'flex', gap: 9, padding: '6px 0', borderBottom: '1px solid #1E1F3D', animation: 'nf-rowIn .3s ease', minWidth: 0 }}>
                <span className="nf-noshrink" style={{ color: '#5B5E88' }}>{fmtTime(l.time)}</span>
                <span className="nf-noshrink" style={{ fontWeight: 800, color: LIVE_COLORS[l.status] ?? '#9EA0C8', width: 64 }}>{l.status}</span>
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

function VolumeCard({ volume }: { volume: Stats['volume14'] }) {
  const tick = { font: { size: 10, weight: 600 } } as const;
  const { ref, chart } = useChart<'bar'>(() => ({
    type: 'bar',
    data: {
      labels: volume.map(v => v.label),
      datasets: [
        { label: 'Sent', data: volume.map(v => v.sent), backgroundColor: '#4F46E5', borderRadius: 5, stack: 's' },
        { label: 'Failed', data: volume.map(v => v.failed), backgroundColor: '#DDD6FE', borderRadius: 5, stack: 's' },
      ],
    },
    options: {
      maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { ...tick, maxTicksLimit: 7 } },
        y: { stacked: true, beginAtZero: true, suggestedMax: 5, border: { display: false }, grid: { color: '#F3F3FA' }, ticks: { ...tick, maxTicksLimit: 5, precision: 0, callback: v => fmtCompact(Number(v)) } },
      },
    },
  }));
  useUpdate(chart, c => {
    c.data.labels = volume.map(v => v.label);
    c.data.datasets[0].data = volume.map(v => v.sent);
    c.data.datasets[1].data = volume.map(v => v.failed);
  }, volume);

  return (
    <div className="nf-card" style={{ flex: '1 1 440px' }}>
      <div className="nf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ minWidth: 0 }}><CardHead title="Sending volume" sub="Sent vs. failed, last 14 days" /></div>
        <div className="nf-ml-auto nf-noshrink" style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700, color: '#5B5E75' }}>
          <span className="nf-row" style={{ gap: 5 }}><span className="nf-legend-dot" style={{ background: '#4F46E5' }} />Sent</span>
          <span className="nf-row" style={{ gap: 5 }}><span className="nf-legend-dot" style={{ background: '#DDD6FE' }} />Failed</span>
        </div>
      </div>
      <div style={{ height: 220, marginTop: 12 }}><canvas ref={ref} /></div>
    </div>
  );
}

/** Top four connections this month plus "Other". */
function shareSlices(stats: Stats) {
  const top = stats.shareMonth.slice(0, 4).map((s, i) => ({ label: s.name || presetOf(s.provider).label, count: s.count, color: SHARE_COLORS[i] }));
  const other = stats.shareMonth.slice(4).reduce((n, s) => n + s.count, 0);
  if (other) top.push({ label: 'Other', count: other, color: SHARE_COLORS[4] });
  return top;
}

function ShareCard({ stats }: { stats: Stats }) {
  const slices = shareSlices(stats);
  const total = slices.reduce((n, s) => n + s.count, 0);
  const data = () => total ? { labels: slices.map(s => s.label), values: slices.map(s => s.count), colors: slices.map(s => s.color) } : { labels: ['No email yet'], values: [1], colors: ['#EFEFF7'] };
  const { ref, chart } = useChart<'doughnut'>(() => {
    const d = data();
    return {
      type: 'doughnut',
      data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: d.colors, borderWidth: 0 }] },
      options: { cutout: '72%', maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: total > 0 } } },
    };
  });
  useUpdate(chart, c => {
    const d = data();
    c.data.labels = d.labels;
    c.data.datasets[0].data = d.values;
    c.data.datasets[0].backgroundColor = d.colors;
  }, stats.shareMonth);

  return (
    <div className="nf-card" style={{ flex: '1 1 280px' }}>
      <CardHead title="Provider share" sub="Emails sent per connection" />
      <div style={{ height: 150, margin: '14px auto 6px auto', position: 'relative', maxWidth: 150 }}>
        <canvas ref={ref} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#14152A' }}>{fmtCompact(stats.sentMonth)}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#8A8DA3' }}>this month</span>
        </div>
      </div>
      <div className="nf-col" style={{ gap: 7, marginTop: 6 }}>
        {total === 0 && <div className="nf-card-sub" style={{ textAlign: 'center' }}>No email sent this month yet.</div>}
        {slices.map(s => (
          <div key={s.label} className="nf-row" style={{ gap: 8, fontSize: 11.5, fontWeight: 700, color: '#3C3F55' }}>
            <span className="nf-legend-dot" style={{ background: s.color }} />
            <span className="nf-grow nf-ellipsis">{s.label}</span>
            <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{Math.round((s.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Applies new data to an existing chart without recreating it. */
function useUpdate<K extends ChartType>(chart: MutableRefObject<Chart<K> | null>, apply: (c: Chart<K>) => void, dep: unknown) {
  useEffect(() => {
    if (!chart.current) return;
    apply(chart.current);
    chart.current.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
