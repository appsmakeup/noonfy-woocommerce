import { config } from '../../config';
import { ALERTS, MONITORS, TESTS } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { CardHead, Toggle } from '../ui';

const FIELD_LABEL = { fontSize: 10.5, fontWeight: 800, color: '#5B5E75' } as const;

export function Tools({ api }: { api: SmtpApi }) {
  const { state, update, toggleIn, saveDefaults, runTest } = api;
  return (
    <section className="nf-flow">
      <div className="nf-stack" style={{ flex: '1 1 380px' }}>
        <div className="nf-card nf-card--roomy">
          <CardHead title="Testing tools" sub="Verify configuration before you send at scale" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
            {TESTS.map(t => (
              <button key={t.label} type="button" className="nf-tool-btn" onClick={() => runTest(t.label)}>
                <div style={{ fontSize: 15 }}>{t.glyph}</div>
                <div className="nf-ellipsis" style={{ fontSize: 11.5, fontWeight: 800, color: '#14152A', marginTop: 7 }}>{t.label}</div>
                <div className="nf-ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600, marginTop: 1 }}>{t.detail}</div>
              </button>
            ))}
          </div>
          {state.testRunning && (
            <div className="nf-row" style={{ gap: 9, marginTop: 14, fontSize: 12, fontWeight: 800, color: '#7C3AED' }}>
              <span style={{ width: 14, height: 14, border: '2px solid #E0D7FE', borderTopColor: '#7C3AED', borderRadius: 99, animation: 'nf-spin .7s linear infinite', display: 'inline-block' }} />
              Running {state.testName}…
            </div>
          )}
          {state.testDone && !state.testRunning && (
            <div className="nf-col" style={{ gap: 8, marginTop: 14 }}>
              {state.testResults.map(r => (
                <div key={r.text} className="nf-row" style={{ gap: 9, border: '1px solid #F3F3FA', borderRadius: 9, padding: '9px 11px' }}>
                  <span className="nf-tag" style={r.ok ? { color: '#0E9F6E', background: '#EDF9F1', padding: '3px 8px' } : { color: '#E02424', background: '#FDEDED', padding: '3px 8px' }}>{r.ok ? 'PASS' : 'FAIL'}</span>
                  <span className="nf-grow nf-ellipsis" style={{ fontSize: 11, fontWeight: 600, color: '#5B5E75' }} title={r.text}>{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nf-card nf-card--roomy">
          <CardHead title="Alert rules" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 9, marginTop: 14 }}>
            {ALERTS.map(a => {
              const on = state.alertTg[a.id] ?? a.on;
              return (
                <div key={a.id} className="nf-list-item" style={{ gap: 9 }}>
                  <span className="nf-noshrink" style={{ fontSize: 12 }}>{a.glyph}</span>
                  <span className="nf-grow nf-ellipsis" style={{ fontSize: 11, fontWeight: 700, color: '#14152A' }}>{a.label}</span>
                  <Toggle size="sm" on={on} onChange={() => toggleIn('alertTg', a.id, on)} label={a.label + ' alert'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="nf-stack" style={{ flex: '1 1 280px' }}>
        <div className="nf-card">
          <div className="nf-row">
            <span className="nf-card-title nf-card-title--sm">System monitoring</span>
            <span className="nf-ml-auto" style={{ fontSize: 10, fontWeight: 800, color: '#0E9F6E', background: '#EDF9F1', borderRadius: 99, padding: '3px 9px' }}>ALL GREEN</span>
          </div>
          <div className="nf-col" style={{ gap: 9, marginTop: 13 }}>
            {MONITORS.map(m => (
              <div key={m.label} className="nf-row" style={{ gap: 9, fontSize: 11.5, fontWeight: 700, color: '#5B5E75' }}>
                <span className="nf-dot" style={{ width: 7, height: 7, background: m.dot }} />
                <span className="nf-grow nf-ellipsis">{m.label}</span>
                <span className="nf-noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{m.value}</span>
              </div>
            ))}
          </div>
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
            <label>
              <div style={{ ...FIELD_LABEL, display: 'flex' }}><span>Log retention</span><span className="nf-ml-auto" style={{ color: '#4F46E5' }}>{state.retention} days</span></div>
              <input type="range" min={7} max={180} step={7} value={state.retention} onChange={e => update({ retention: +e.target.value })}
                style={{ width: '100%', marginTop: 7, accentColor: '#4F46E5' }} />
            </label>
            <a href={config.links.wcEmailSettings} className="nf-btn-outline" style={{ display: 'block', borderRadius: 9, padding: 8, fontSize: 11.5 }}>Open workspace settings →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
