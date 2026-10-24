import { app, config } from '../../config';
import { ALERTS, TESTS } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { CardHead, SoonBadge, Toggle, fmtMs, fmtNum, fmtPct } from '../../shared/ui';

const FIELD_LABEL = { fontSize: 10.5, fontWeight: 800, color: '#5B5E75' } as const;
const GREEN = '#0E9F6E', ORANGE = '#C2620A', RED = '#E02424', GREY = '#A5A8BD';

export function Tools({ api }: { api: SmtpApi }) {
  const { state, update, saveDefaults, setRetention, runTool, showToast } = api;
  const { stats } = state;
  const enabled = state.connections.filter(c => c.enabled);
  const failingTests = enabled.filter(c => c.lastTest && !c.lastTest.ok);
  const sys = config.system;

  const monitors = [
    { label: 'Enabled connections', value: `${enabled.length} / ${state.connections.length}`, dot: enabled.length ? GREEN : ORANGE },
    { label: 'Failing connection tests', value: String(failingTests.length), dot: failingTests.length ? RED : GREEN },
    { label: 'Sent today', value: fmtNum(stats.sentToday), dot: GREEN },
    { label: 'Failed today', value: fmtNum(stats.failedToday), dot: stats.failedToday ? ORANGE : GREEN },
    { label: 'Success rate · 30d', value: fmtPct(stats.successRate30), dot: stats.successRate30 == null ? GREY : stats.successRate30 >= 98 ? GREEN : ORANGE },
    { label: 'Avg send time · 7d', value: fmtMs(stats.avgLatency7), dot: GREY },
    { label: 'Log cleanup (daily)', value: sys.purgeScheduled ? 'Scheduled' : 'Not scheduled', dot: sys.purgeScheduled ? GREEN : ORANGE },
    { label: 'PHP OpenSSL (TLS)', value: sys.openssl ? 'Available' : 'Missing', dot: sys.openssl ? GREEN : RED },
  ];
  const status = !enabled.length ? { label: 'NOT ROUTING', color: ORANGE, bg: '#FFF3E8' }
    : failingTests.length || stats.failedToday ? { label: 'ATTENTION', color: ORANGE, bg: '#FFF3E8' }
    : { label: 'ALL GREEN', color: GREEN, bg: '#EDF9F1' };

  return (
    <section className="nf-flow">
      <div className="nf-stack" style={{ flex: '1 1 380px' }}>
        <div className="nf-card nf-card--roomy">
          <CardHead title="Testing tools" sub="Verify configuration before you send at scale" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
            {TESTS.map(t => (
              <button key={t.key} type="button" className={'nf-tool-btn' + (t.live ? '' : ' nf-tool-btn--soon')} disabled={!!state.toolRunning}
                onClick={() => (t.live ? runTool(t.key, t.label) : showToast('info', t.label, 'This check is coming soon.'))}>
                <div style={{ fontSize: 15 }}>{t.glyph}</div>
                <div className="nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 800, color: '#14152A', marginTop: 7 }}>{t.label}</div>
                <div className="nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600, marginTop: 1 }}>{t.detail}</div>
              </button>
            ))}
          </div>
          {state.toolRunning && (
            <div className="nf-row" style={{ gap: 9, marginTop: 14, fontSize: 12, fontWeight: 800, color: '#7C3AED' }}>
              <span style={{ width: 14, height: 14, border: '2px solid #E0D7FE', borderTopColor: '#7C3AED', borderRadius: 99, animation: 'nf-spin .7s linear infinite', display: 'inline-block' }} />
              Running {state.toolRunning}…
            </div>
          )}
          {!state.toolRunning && state.toolResults.length > 0 && (
            <div className="nf-col" style={{ gap: 8, marginTop: 14 }}>
              {state.toolResults.map((r, i) => (
                <div key={i} className="nf-row" style={{ gap: 9, border: '1px solid #F3F3FA', borderRadius: 9, padding: '9px 11px' }}>
                  <span className="nf-tag" style={r.ok ? { color: GREEN, background: '#EDF9F1', padding: '3px 8px' } : { color: RED, background: '#FDEDED', padding: '3px 8px' }}>{r.ok ? 'PASS' : 'FAIL'}</span>
                  <span className="nf-grow" style={{ fontSize: 11, fontWeight: 600, color: '#5B5E75', overflowWrap: 'anywhere' }}>{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nf-card nf-card--roomy">
          <div className="nf-row"><span className="nf-card-title">Alert rules</span><SoonBadge style={{ marginLeft: 'auto' }} /></div>
          <div className="nf-card-sub" style={{ marginTop: 4 }}>Email and Slack alerts for these events are being built.</div>
          <div className="nf-dim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 9, marginTop: 14 }} aria-disabled="true">
            {ALERTS.map(a => (
              <div key={a.id} className="nf-list-item" style={{ gap: 9 }}>
                <span className="nf-noshrink" style={{ fontSize: 12 }}>{a.glyph}</span>
                <span className="nf-grow nf-ellipsis" style={{ fontSize: 11, fontWeight: 700, color: '#14152A' }}>{a.label}</span>
                <Toggle size="sm" on={a.on} onChange={() => undefined} label={a.label + ' alert'} disabled />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nf-stack" style={{ flex: '1 1 280px' }}>
        <div className="nf-card">
          <div className="nf-row">
            <span className="nf-card-title nf-card-title--sm">System monitoring</span>
            <span className="nf-ml-auto" style={{ fontSize: 10, fontWeight: 800, color: status.color, background: status.bg, borderRadius: 99, padding: '3px 9px' }}>{status.label}</span>
          </div>
          <div className="nf-col" style={{ gap: 9, marginTop: 13 }}>
            {monitors.map(m => (
              <div key={m.label} className="nf-row" style={{ gap: 9, fontSize: 11.5, fontWeight: 700, color: '#5B5E75' }}>
                <span className="nf-dot" style={{ width: 7, height: 7, background: m.dot }} />
                <span className="nf-grow nf-ellipsis">{m.label}</span>
                <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{m.value}</span>
              </div>
            ))}
          </div>
          <div className="nf-hint" style={{ marginTop: 12 }}>WordPress {sys.wordpress} · WooCommerce {sys.woocommerce || '—'} · PHP {sys.php}</div>
        </div>

        <div className="nf-card">
          <CardHead small title="Global defaults" />
          <div className="nf-col" style={{ gap: 11, marginTop: 13 }}>
            <label>
              <div style={{ ...FIELD_LABEL, marginBottom: 4 }}>Default from name</div>
              <input className="nf-field" value={state.fromName} onChange={e => update({ fromName: e.target.value })} onBlur={saveDefaults} style={{ fontWeight: 700 }} />
            </label>
            <label>
              <div style={{ ...FIELD_LABEL, marginBottom: 4 }}>Default from email</div>
              <input className="nf-field nf-mono" value={state.fromEmail} onChange={e => update({ fromEmail: e.target.value })} onBlur={saveDefaults} style={{ fontSize: 11.5, color: '#5B5E75' }} />
            </label>
            <div className="nf-row" style={{ gap: 9, alignItems: 'flex-start' }}>
              <Toggle size="sm" on={state.forceFrom} label="Override sender set by other plugins"
                onChange={() => { update({ forceFrom: !state.forceFrom }); window.setTimeout(saveDefaults, 0); }} />
              <span className="nf-hint" style={{ marginTop: 0 }}>
                {state.forceFrom ? 'Every email uses this sender, including WooCommerce’s.' : 'Used when WordPress would send from wordpress@…; WooCommerce keeps its own sender.'} Only applies while a connection is enabled.
              </span>
            </div>
            <label>
              <div style={{ ...FIELD_LABEL, display: 'flex' }}><span>Log retention</span><span className="nf-ml-auto" style={{ color: '#4F46E5' }}>{state.retention} days</span></div>
              <input type="range" min={7} max={180} step={1} value={state.retention} onChange={e => setRetention(+e.target.value)}
                style={{ width: '100%', marginTop: 7, accentColor: '#4F46E5' }} />
            </label>
            <a href={app.links.wcEmailSettings} className="nf-btn-outline" style={{ display: 'block', borderRadius: 9, padding: 8, fontSize: 11.5 }}>WooCommerce email settings →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
