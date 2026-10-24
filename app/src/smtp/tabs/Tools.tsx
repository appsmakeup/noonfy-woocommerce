import { ALERTS, MONITORS, TESTS, TEST_RESULTS } from '../data';
import type { SmtpApi } from '../useSmtpState';
import { CardHead, Toggle } from '../ui';

const FIELD_LABEL = { fontSize: 10.5, fontWeight: 800, color: '#5B5E75' } as const;

export function Tools({ api }: { api: SmtpApi }) {
  const { state, update, toggleIn, runTest } = api;
  return (
    <section className="flow">
      <div className="stack" style={{ flex: '1 1 380px' }}>
        <div className="card card--roomy">
          <CardHead title="Testing tools" sub="Verify configuration before you send at scale" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
            {TESTS.map(t => (
              <button key={t.label} type="button" className="tool-btn" onClick={() => runTest(t.label)}>
                <div style={{ fontSize: 15 }}>{t.glyph}</div>
                <div className="ellipsis" style={{ fontSize: 11.5, fontWeight: 800, color: '#14152A', marginTop: 7 }}>{t.label}</div>
                <div className="ellipsis" style={{ fontSize: 10, color: '#8A8DA3', fontWeight: 600, marginTop: 1 }}>{t.detail}</div>
              </button>
            ))}
          </div>
          {state.testRunning && (
            <div className="row" style={{ gap: 9, marginTop: 14, fontSize: 12, fontWeight: 800, color: '#7C3AED' }}>
              <span style={{ width: 14, height: 14, border: '2px solid #E0D7FE', borderTopColor: '#7C3AED', borderRadius: 99, animation: 'spin .7s linear infinite', display: 'inline-block' }} />
              Running {state.testName}…
            </div>
          )}
          {state.testDone && !state.testRunning && (
            <div className="col" style={{ gap: 8, marginTop: 14 }}>
              {TEST_RESULTS.map(text => (
                <div key={text} className="row" style={{ gap: 9, border: '1px solid #F3F3FA', borderRadius: 9, padding: '9px 11px' }}>
                  <span className="tag" style={{ color: '#0E9F6E', background: '#EDF9F1', padding: '3px 8px' }}>PASS</span>
                  <span className="grow ellipsis" style={{ fontSize: 11, fontWeight: 600, color: '#5B5E75' }}>{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card--roomy">
          <CardHead title="Alert rules" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 9, marginTop: 14 }}>
            {ALERTS.map(a => {
              const on = state.alertTg[a.id] ?? a.on;
              return (
                <div key={a.id} className="list-item" style={{ gap: 9 }}>
                  <span className="noshrink" style={{ fontSize: 12 }}>{a.glyph}</span>
                  <span className="grow ellipsis" style={{ fontSize: 11, fontWeight: 700, color: '#14152A' }}>{a.label}</span>
                  <Toggle size="sm" on={on} onChange={() => toggleIn('alertTg', a.id, on)} label={a.label + ' alert'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="stack" style={{ flex: '1 1 280px' }}>
        <div className="card">
          <div className="row">
            <span className="card-title card-title--sm">System monitoring</span>
            <span className="ml-auto" style={{ fontSize: 10, fontWeight: 800, color: '#0E9F6E', background: '#EDF9F1', borderRadius: 99, padding: '3px 9px' }}>ALL GREEN</span>
          </div>
          <div className="col" style={{ gap: 9, marginTop: 13 }}>
            {MONITORS.map(m => (
              <div key={m.label} className="row" style={{ gap: 9, fontSize: 11.5, fontWeight: 700, color: '#5B5E75' }}>
                <span className="dot" style={{ width: 7, height: 7, background: m.dot }} />
                <span className="grow ellipsis">{m.label}</span>
                <span className="noshrink" style={{ fontWeight: 800, color: '#14152A' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <CardHead small title="Global defaults" />
          <div className="col" style={{ gap: 11, marginTop: 13 }}>
            <label>
              <div style={{ ...FIELD_LABEL, marginBottom: 4 }}>Default from name</div>
              <input className="field" defaultValue="Bruma Home" style={{ fontWeight: 700 }} />
            </label>
            <label>
              <div style={{ ...FIELD_LABEL, marginBottom: 4 }}>Default from email</div>
              <input className="field mono" defaultValue="hello@brumahome.com" style={{ fontSize: 11.5, color: '#5B5E75' }} />
            </label>
            <label>
              <div style={{ ...FIELD_LABEL, display: 'flex' }}><span>Log retention</span><span className="ml-auto" style={{ color: '#4F46E5' }}>{state.retention} days</span></div>
              <input type="range" min={7} max={180} step={7} value={state.retention} onChange={e => update({ retention: +e.target.value })}
                style={{ width: '100%', marginTop: 7, accentColor: '#4F46E5' }} />
            </label>
            {/* Settings page is outside this build; link kept as in the design. */}
            <a href="Settings.dc.html#smtp" className="btn-outline" style={{ display: 'block', borderRadius: 9, padding: 8, fontSize: 11.5 }}>Open workspace settings →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
