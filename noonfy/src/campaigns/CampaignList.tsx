import type { Campaign, CampaignStatus, Segment } from './types';
import { money, pct } from './useCampaigns';

const COLS = '2.4fr .8fr 1fr .8fr .8fr .8fr 1fr';
export const STATUS_STYLE: Record<CampaignStatus, [fg: string, bg: string]> = {
  sent: ['#0E9F6E', '#EDF9F1'], scheduled: ['#4F46E5', '#EEF0FE'], draft: ['#8A8DA3', '#F3F3FA'],
  sending: ['#C2620A', '#FFF3E8'], paused: ['#B45309', '#FDF3D7'], cancelled: ['#8A8DA3', '#F3F3FA'],
};
const TINTS: Record<CampaignStatus, string> = { sent: '#EDF9F1', scheduled: '#EEF0FE', draft: '#F3F3FA', sending: '#FFF3E8', paused: '#FDF3D7', cancelled: '#F3F3FA' };
const FILTERS = {
  all: () => true,
  scheduled: (c: Campaign) => c.status === 'scheduled' || c.status === 'sending' || c.status === 'paused',
  drafts: (c: Campaign) => c.status === 'draft',
  sent: (c: Campaign) => c.status === 'sent' || c.status === 'cancelled',
};

export function CampaignList({ campaigns, filter, segments }: { campaigns: Campaign[]; filter: keyof typeof FILTERS; segments: Segment[] }) {
  const rows = campaigns.filter(FILTERS[filter]);
  const segLabel = (id: string) => segments.find(s => s.id === id)?.label ?? id;
  return (
    <section className="nf-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 820 }} role="table">
          <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '12px 20px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#A5A8BD', borderBottom: '1px solid #F3F3FA' }}>
            {['Campaign', 'Status', 'Audience', 'Sent', 'Open', 'Click'].map(h => <span key={h} role="columnheader">{h}</span>)}
            <span role="columnheader" style={{ textAlign: 'right' }}>Revenue</span>
          </div>
          {rows.map(c => {
            const [fg, bg] = STATUS_STYLE[c.status];
            const started = c.stats.total > 0;
            const muted = { fontSize: 12.5, fontWeight: 700, color: '#5B5E75' } as const;
            return (
              <a key={c.id} role="row" href={'#builder:' + c.id} className="nf-campaign-row" style={{ gridTemplateColumns: COLS }}>
                <span className="nf-row" style={{ gap: 11 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: TINTS[c.status], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{c.emoji}</span>
                  <span className="nf-grow">
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{c.name}{c.ab?.enabled && <span className="nf-ab-chip">A/B</span>}</span>
                    <span className="nf-block nf-ellipsis" style={{ fontSize: 11, color: '#8A8DA3', fontWeight: 600 }}>{c.subject || 'No subject yet'}</span>
                  </span>
                </span>
                <span><span style={{ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: '3px 9px', textTransform: 'uppercase' }}>{c.status}</span></span>
                <span className="nf-ellipsis" style={{ fontSize: 12, fontWeight: 700, color: '#5B5E75' }}>{c.status === 'draft' ? '—' : segLabel(c.segment)}</span>
                <span style={muted}>{started ? c.stats.sent.toLocaleString() : '—'}</span>
                <span style={muted}>{started ? pct(c.stats.opens, c.stats.sent) : '—'}</span>
                <span style={muted}>{started ? pct(c.stats.clicks, c.stats.sent) : '—'}</span>
                <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'right' }}>{started ? money(c.stats.revenue) : '—'}</span>
              </a>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && (
        <div className="nf-empty" style={{ padding: '56px 0' }}>
          <div style={{ fontSize: 32 }}>📭</div>
          <div className="nf-empty-title" style={{ fontSize: 14, marginTop: 10 }}>Nothing here yet</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
            {filter === 'all' ? <>Create your first campaign with <a href="#builder">New campaign</a>.</> : 'Campaigns in this state will appear here.'}
          </div>
        </div>
      )}
    </section>
  );
}
