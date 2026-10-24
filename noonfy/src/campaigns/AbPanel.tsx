import { useState } from 'react';
import { errorMessage } from '../api';
import { Toggle } from '../shared/ui';
import { campaignsApi } from './api';
import { METRIC_LABEL, confidence, fmtRate, leader, variantTitle } from './ab';
import type { AbConfig, AbMetric, Campaign } from './types';
import { money, pct, type CampaignsApi } from './useCampaigns';

const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginTop: 12, marginBottom: 5, display: 'block' } as const;
const WAITS = [1, 2, 4, 8, 12, 24, 48];
const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** A/B test settings in the builder's campaign panel. */
export function AbPanel({ ab, audience, onChange, onCopyContent }: { ab: AbConfig; audience: number; onChange: (patch: Partial<AbConfig>) => void; onCopyContent: () => void }) {
  const half = Math.round(ab.testPct / 2);
  const testSize = Math.max(2, Math.round((audience * ab.testPct) / 100));
  return (
    <div className="nf-ab-box">
      <div className="nf-row" style={{ gap: 8 }}>
        <Toggle size="sm" on={ab.enabled} onChange={() => onChange({ enabled: !ab.enabled })} label="A/B test" />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}>🧪 A/B test</span>
      </div>
      {!ab.enabled && <div className="nf-hint">Try two subject lines or two versions of the email on a sample, then send the winner to everyone else.</div>}
      {ab.enabled && (
        <>
          <div className="nf-segmented" style={{ width: '100%', marginTop: 10 }}>
            {([['subject', 'Subject line'], ['content', 'Email content']] as const).map(([k, l]) => (
              <button key={k} type="button" style={{ flex: 1, padding: '6px 4px' }} className={'nf-segmented-btn' + (ab.type === k ? ' nf-segmented-btn--active' : '')} onClick={() => onChange({ type: k })}>{l}</button>
            ))}
          </div>
          {ab.type === 'subject' ? (
            <>
              <label><span style={LABEL}>Variant B subject line</span>
                <input className="nf-field" style={{ fontWeight: 700 }} value={ab.subjectB} placeholder="Another way to say it" onChange={e => onChange({ subjectB: e.target.value })} /></label>
              <label><span style={LABEL}>Variant B preview text (optional)</span>
                <input className="nf-field" value={ab.preheaderB} placeholder="Same as A if empty" onChange={e => onChange({ preheaderB: e.target.value })} /></label>
            </>
          ) : (
            <>
              <div className="nf-hint" style={{ marginTop: 8 }}>Use the <b>A / B</b> switch above the email to edit each version.</div>
              <div className="nf-row" style={{ gap: 6 }}>
                <label style={{ flex: 1 }}><span style={LABEL}>Name A</span><input className="nf-field" value={ab.labelA} onChange={e => onChange({ labelA: e.target.value })} /></label>
                <label style={{ flex: 1 }}><span style={LABEL}>Name B</span><input className="nf-field" value={ab.labelB} onChange={e => onChange({ labelB: e.target.value })} /></label>
              </div>
              <button type="button" className="nf-link-btn" style={{ marginTop: 6 }} onClick={() => window.confirm('Replace version B with a copy of version A?') && onCopyContent()}>Reset B to a copy of A</button>
            </>
          )}
          <label><span style={LABEL}>Pick the winner by</span>
            <select className="nf-field" value={ab.metric} onChange={e => onChange({ metric: e.target.value as AbMetric })}>
              <option value="opens">Open rate</option><option value="clicks">Click rate</option><option value="revenue">Revenue per email</option>
            </select></label>
          <label><span style={{ ...LABEL, display: 'flex' }}><span>Test group</span><span className="nf-ml-auto" style={{ color: '#4F46E5' }}>{ab.testPct}%</span></span>
            <input type="range" min={10} max={50} step={2} value={ab.testPct} onChange={e => onChange({ testPct: +e.target.value })} style={{ width: '100%', accentColor: '#4F46E5' }} /></label>
          <div className="nf-hint">{half}% get A, {half}% get B (≈{testSize.toLocaleString()} people), then the winner goes to the other {100 - ab.testPct}%.</div>
          <label><span style={LABEL}>Wait before picking the winner</span>
            <select className="nf-field" value={ab.waitHours} onChange={e => onChange({ waitHours: +e.target.value })}>
              {WAITS.map(h => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
            </select></label>
          {audience > 0 && testSize < 200 && <div className="nf-hint" style={{ color: '#C2620A' }}>Small test group: results may not be statistically reliable.</div>}
        </>
      )}
    </div>
  );
}

/** Variant comparison and winner controls on a running or finished A/B campaign. */
export function AbResults({ campaign, api }: { campaign: Campaign; api: CampaignsApi }) {
  const [busy, setBusy] = useState(false);
  const ab = campaign.ab!;
  const v = campaign.stats.variants ?? {};
  const lead = leader(campaign);
  const winner = campaign.abWinner || null;
  const conf = confidence(v.A, v.B, ab.metric);

  const pick = (variant?: 'A' | 'B') => {
    if (!window.confirm(variant ? `Send version ${variant} to the remaining ${campaign.stats.held.toLocaleString()} recipients now?` : `End the test now and send the leader (${lead}) to the remaining ${campaign.stats.held.toLocaleString()} recipients?`)) return;
    setBusy(true);
    campaignsApi.winner(campaign.id, variant).then(c => { api.upsertCampaign(c); api.showToast('ok', `Version ${c.abWinner} wins`, 'Sending it to everyone else.'); api.refresh(); })
      .catch(e => api.showToast('warn', 'Couldn’t pick a winner', errorMessage(e))).finally(() => setBusy(false));
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div className="nf-panel-title">A/B test · {ab.type === 'content' ? 'email content' : 'subject line'}</div>
      {(['A', 'B'] as const).map(k => {
        const s = v[k];
        const isWin = winner === k;
        return (
          <div key={k} className={'nf-variant' + (isWin ? ' nf-variant--win' : '')}>
            <div className="nf-row" style={{ gap: 6 }}>
              <span className={'nf-variant-key nf-variant-key--' + k}>{k}</span>
              <span className="nf-grow nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 700, color: '#14152A' }} title={variantTitle(campaign, k)}>{variantTitle(campaign, k)}</span>
              {isWin && <span className="nf-win-badge">WINNER</span>}
            </div>
            <div className="nf-variant-stats">
              <span>Sent {s?.sent.toLocaleString() ?? 0}</span><span>Open {pct(s?.opens ?? 0, s?.sent ?? 0)}</span><span>Click {pct(s?.clicks ?? 0, s?.sent ?? 0)}</span><span>Rev {money(s?.revenue ?? 0)}</span>
            </div>
          </div>
        );
      })}
      <div className="nf-hint" style={{ marginTop: 6 }}>
        {campaign.abPhase === 'testing' && 'Sending the test group…'}
        {campaign.abPhase === 'waiting' && <>Leader: {lead} ({fmtRate(v[lead], ab.metric)} {METRIC_LABEL[ab.metric]}){conf !== null && `, ${conf}% confidence`}. Winner picked automatically {campaign.abDecideAt ? fmtDate(campaign.abDecideAt) : 'soon'}.</>}
        {campaign.abPhase === 'final' && winner && <>Version {winner} won and went to the rest of the audience{conf !== null && ` (${conf}% confidence on ${METRIC_LABEL[ab.metric]})`}.</>}
      </div>
      {(campaign.abPhase === 'waiting' || campaign.abPhase === 'testing') && campaign.stats.held > 0 && (
        <div className="nf-col" style={{ gap: 6, marginTop: 8 }}>
          <button type="button" className="nf-btn-ghost" disabled={busy} onClick={() => pick()}>End test now (send leader)</button>
          <div className="nf-row" style={{ gap: 6 }}>
            <button type="button" className="nf-btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => pick('A')}>Send A</button>
            <button type="button" className="nf-btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => pick('B')}>Send B</button>
          </div>
        </div>
      )}
    </div>
  );
}
