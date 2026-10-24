import { METRIC_LABEL, confidence, fmtRate, leader, rate, variantTitle } from './ab';
import type { Campaign } from './types';
import { money, pct } from './useCampaigns';

const STATUS: Record<string, [label: string, fg: string, bg: string]> = {
  running: ['RUNNING', '#C2620A', '#FFF3E8'], complete: ['COMPLETE', '#0E9F6E', '#EDF9F1'],
  planned: ['NOT STARTED', '#4F46E5', '#EEF0FE'], stopped: ['STOPPED', '#8A8DA3', '#F3F3FA'],
};
const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function state(c: Campaign) {
  if (c.abWinner) return 'complete';
  if (c.status === 'cancelled') return 'stopped';
  if (c.abPhase === 'testing' || c.abPhase === 'waiting') return 'running';
  return 'planned';
}

function note(c: Campaign) {
  const ab = c.ab!, v = c.stats.variants ?? {}, conf = confidence(v.A, v.B, ab.metric);
  const confText = conf !== null ? ` (${conf}% confidence)` : '';
  switch (state(c)) {
    case 'complete': {
      const w = c.abWinner as 'A' | 'B', l = w === 'A' ? 'B' : 'A';
      return `Variant ${w} won on ${METRIC_LABEL[ab.metric]}: ${fmtRate(v[w], ab.metric)} vs ${fmtRate(v[l], ab.metric)}${confText} · rolled out to the rest of the audience.`;
    }
    case 'running':
      return c.abPhase === 'testing'
        ? `Sending the test group (${ab.testPct}% of the audience)…`
        : `${leader(c)} leads on ${METRIC_LABEL[ab.metric]}${confText} · winner picked ${c.abDecideAt ? fmtWhen(c.abDecideAt) : 'soon'}.`;
    case 'stopped':
      return 'The campaign was stopped before a winner was picked.';
    default:
      return c.status === 'scheduled' && c.scheduledAt ? `Starts with the campaign on ${fmtWhen(c.scheduledAt)}.` : 'Starts when the campaign is sent.';
  }
}

export function AbTests({ campaigns }: { campaigns: Campaign[] }) {
  const tests = campaigns.filter(c => c.ab?.enabled);
  if (!tests.length) {
    return (
      <div className="nf-card nf-empty-card">
        <div style={{ fontSize: 30 }}>🧪</div>
        <div className="nf-empty-title" style={{ fontSize: 15, marginTop: 10 }}>No A/B tests yet</div>
        <div className="nf-card-sub" style={{ maxWidth: 460, margin: '6px auto 0', lineHeight: 1.5 }}>
          Open a campaign in the <a href="#builder">builder</a> and switch on <b>A/B test</b> to try two subject lines or two versions of the email.
        </div>
      </div>
    );
  }
  return (
    <section className="nf-ab-grid">
      {tests.map(c => {
        const ab = c.ab!, v = c.stats.variants ?? {}, st = STATUS[state(c)];
        const best = Math.max(rate(v.A, ab.metric), rate(v.B, ab.metric)) || 1;
        return (
          <a key={c.id} href={'#builder:' + c.id} className="nf-card nf-ab-card">
            <div className="nf-row" style={{ gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🧪</span>
              <span className="nf-grow">
                <span className="nf-block nf-ellipsis" style={{ fontSize: 13.5, fontWeight: 800, color: '#14152A' }}>{c.name}</span>
                <span className="nf-block" style={{ fontSize: 11, color: '#8A8DA3', fontWeight: 600 }}>Testing: {ab.type === 'content' ? 'Email content' : 'Subject line'}</span>
              </span>
              <span className="nf-noshrink" style={{ fontSize: 10.5, fontWeight: 800, color: st[1], background: st[2], borderRadius: 99, padding: '3px 9px' }}>{st[0]}</span>
            </div>
            <div className="nf-col" style={{ gap: 10, marginTop: 16 }}>
              {(['A', 'B'] as const).map(k => {
                const s = v[k], win = c.abWinner === k;
                return (
                  <div key={k} className={'nf-variant nf-variant--lg' + (win ? ' nf-variant--win' : '')}>
                    <div className="nf-row" style={{ gap: 8 }}>
                      <span className={'nf-variant-key nf-variant-key--' + k}>{k}</span>
                      <span className="nf-grow nf-ellipsis" style={{ fontSize: 12.5, fontWeight: 700, color: '#14152A' }}>{variantTitle(c, k) || '—'}</span>
                      {win && <span className="nf-win-badge">WINNER</span>}
                    </div>
                    <div className="nf-variant-stats" style={{ fontSize: 11, gap: 16, marginTop: 7 }}>
                      <span>Open {pct(s?.opens ?? 0, s?.sent ?? 0)}</span><span>Click {pct(s?.clicks ?? 0, s?.sent ?? 0)}</span><span>Rev {money(s?.revenue ?? 0)}</span>
                    </div>
                    <div className="nf-bar-track" style={{ height: 6, marginTop: 8 }}>
                      <div className="nf-bar-fill" style={{ width: Math.round((rate(s, ab.metric) / best) * 100) + '%', background: win ? '#0E9F6E' : '#C4B5FD' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A5A8BD', marginTop: 12 }}>{note(c)}</div>
          </a>
        );
      })}
    </section>
  );
}
