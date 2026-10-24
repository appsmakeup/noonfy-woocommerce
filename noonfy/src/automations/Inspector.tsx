import { useState } from 'react';
import type { Segment } from '../campaigns/types';
import { app } from '../config';
import { CHECKS, KIND, REPEATABLE, TRIGGERS, UNITS, autoName, minutesLabel } from './meta';
import type { AutomationSettings, FlowNode, NodeSettings, TriggerType, Unit } from './types';

const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginTop: 14, marginBottom: 5, display: 'block' } as const;
const CART_DELAYS = [30, 60, 120, 240, 720, 1440];
const BROWSE_DELAYS = [1, 2, 4, 12, 24];

function Num({ value, onChange, min = 0, step = 1, prefix }: { value: number; onChange: (n: number) => void; min?: number; step?: number; prefix?: string }) {
  return (
    <div className="nf-row" style={{ gap: 6 }}>
      {prefix && <span style={{ fontSize: 12, fontWeight: 800, color: '#8A8DA3' }}>{prefix}</span>}
      <input className="nf-field" type="number" min={min} step={step} value={value} onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))} />
    </div>
  );
}

function Duration({ amount, unit, onChange }: { amount: number; unit: Unit; onChange: (p: { amount?: number; unit?: Unit }) => void }) {
  return (
    <div className="nf-row" style={{ gap: 6 }}>
      <input className="nf-field" type="number" min={1} value={amount} style={{ width: 80 }} onChange={e => onChange({ amount: Math.max(1, Number(e.target.value) || 1) })} aria-label="Amount" />
      <select className="nf-field" value={unit} onChange={e => onChange({ unit: e.target.value as Unit })} aria-label="Unit">
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

/** Settings panel for the selected step (Builder.dc.html right column). */
export function Inspector({ node, segments, settings, live, currency, onRename, onSettings, onDelete, onEditEmail, onPreview, onTest, onSaveSettings, onEnrol }: {
  node: FlowNode; segments: Segment[]; settings: AutomationSettings; live: boolean; currency: string;
  onRename: (name: string) => void; onSettings: (patch: NodeSettings) => void; onDelete: () => void;
  onEditEmail: () => void; onPreview: () => void; onTest: (to: string) => void;
  onSaveSettings: (patch: Partial<AutomationSettings>) => void; onEnrol: () => void;
}) {
  const k = KIND[node.kind];
  const s = node.settings;
  const [testTo, setTestTo] = useState(app.user.email);
  const [notice, setNotice] = useState(settings.cartNotice);

  return (
    <div>
      <div className="nf-panel-title">Inspector</div>
      <div className="nf-row" style={{ gap: 9, marginTop: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: k.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{k.glyph}</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.7px', color: '#7C3AED' }}>{k.label}</span>
      </div>
      <label><span style={LABEL}>Step name</span>
        <input className="nf-field" style={{ fontWeight: 700 }} value={node.name} placeholder={autoName(node)} onChange={e => onRename(e.target.value)} />
      </label>
      <span style={LABEL}>Settings</span>
      <div className="nf-inspector-box">
        {node.kind === 'trigger' && (
          <>
            <select className="nf-field" value={s.type} onChange={e => { const type = e.target.value as TriggerType; onSettings({ type, reentry: REPEATABLE.includes(type) }); }} aria-label="Trigger">
              {TRIGGERS.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
            <div className="nf-hint">{TRIGGERS.find(t => t.type === s.type)?.help}</div>

            {s.type === 'order_paid' && (
              <label className="nf-row" style={{ gap: 7, marginTop: 10, fontSize: 12, fontWeight: 700, color: '#3C3F55' }}>
                <input type="checkbox" checked={!!s.firstOrder} onChange={e => onSettings({ firstOrder: e.target.checked })} /> Only a customer’s first order
              </label>
            )}
            {(s.type === 'order_paid' || s.type === 'order_completed' || s.type === 'cart_abandoned') && (
              <label><span style={LABEL}>{s.type === 'cart_abandoned' ? 'Minimum cart total' : 'Minimum order total'}</span><Num prefix={currency} step={0.01} value={s.minTotal ?? 0} onChange={minTotal => onSettings({ minTotal })} /></label>
            )}
            {s.type === 'no_order' && <label><span style={LABEL}>Days since last order</span><Num min={7} value={s.days ?? 90} onChange={days => onSettings({ days })} /></label>}
            {s.type === 'lifetime_spend' && <label><span style={LABEL}>Lifetime spend at least</span><Num prefix={currency} min={1} value={s.amount ?? 500} onChange={amount => onSettings({ amount })} /></label>}
            {s.type === 'cart_abandoned' && (
              <>
                <label><span style={LABEL}>Abandoned after</span>
                  <select className="nf-field" value={s.minutes ?? 60} onChange={e => onSettings({ minutes: +e.target.value })}>
                    {[...new Set([...CART_DELAYS, s.minutes ?? 60])].sort((a, b) => a - b).map(m => <option key={m} value={m}>{minutesLabel(m)} without changes</option>)}
                  </select>
                </label>
                <label className="nf-row" style={{ gap: 7, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#3C3F55' }}>
                  <input type="checkbox" checked={settings.cartCapture} onChange={e => onSaveSettings({ cartCapture: e.target.checked })} /> Save carts (store-wide)
                </label>
                <div className="nf-hint">Carts of signed-in customers, and of guests once they type their email at checkout.</div>
                <label><span style={LABEL}>Notice shown to guests at checkout</span>
                  <textarea className="nf-field" rows={3} value={notice} onChange={e => setNotice(e.target.value)} onBlur={() => notice !== settings.cartNotice && onSaveSettings({ cartNotice: notice })} />
                </label>
                <div className="nf-hint">Mention saved carts and reminder emails in your privacy policy too.</div>
              </>
            )}
            {s.type === 'browse_abandoned' && (
              <>
                <label><span style={LABEL}>After viewing</span>
                  <select className="nf-field" value={s.hours ?? 2} onChange={e => onSettings({ hours: +e.target.value })}>
                    {[...new Set([...BROWSE_DELAYS, s.hours ?? 2])].sort((a, b) => a - b).map(h => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
                  </select>
                </label>
                <label className="nf-row" style={{ gap: 7, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#3C3F55' }}>
                  <input type="checkbox" checked={settings.browseTracking} onChange={e => onSaveSettings({ browseTracking: e.target.checked })} /> Record product views (store-wide)
                </label>
                <div className="nf-hint">Only for signed-in shoppers. At most one reminder a day each; skipped if they added the product to their cart or ordered.</div>
              </>
            )}
            {s.type === 'segment' && (
              <>
                <label><span style={LABEL}>Segment</span>
                  <select className="nf-field" value={s.segment ?? 'all'} onChange={e => onSettings({ segment: e.target.value })}>
                    {segments.map(sg => <option key={sg.id} value={sg.id}>{sg.label} ({sg.count.toLocaleString()})</option>)}
                  </select>
                </label>
                <div className="nf-hint">Everyone in it joins when you activate. New members join when you click Enrol now.</div>
                {live && <button type="button" className="nf-btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onEnrol}>Enrol now</button>}
              </>
            )}
            {s.type !== 'segment' && s.type !== 'subscribed' && s.type !== 'lifetime_spend' && (
              <label className="nf-row" style={{ gap: 7, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#3C3F55' }}>
                <input type="checkbox" checked={!!s.reentry} onChange={e => onSettings({ reentry: e.target.checked })} /> Can enter again later
              </label>
            )}
            <div className="nf-hint">Never twice at the same time. Only contacts who can receive marketing email join.</div>
          </>
        )}

        {node.kind === 'delay' && (
          <>
            <Duration amount={s.amount ?? 1} unit={s.unit ?? 'days'} onChange={onSettings} />
            <div className="nf-hint">Contacts wait here, then continue.</div>
          </>
        )}

        {node.kind === 'email' && (
          <>
            <label><span style={{ ...LABEL, marginTop: 0 }}>Subject line</span>
              <input className="nf-field" style={{ fontWeight: 700 }} value={s.subject ?? ''} placeholder="Required" onChange={e => onSettings({ subject: e.target.value })} />
            </label>
            <label><span style={LABEL}>Preview text</span>
              <input className="nf-field" value={s.preheader ?? ''} onChange={e => onSettings({ preheader: e.target.value })} />
            </label>
            <button type="button" className="nf-btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={onEditEmail}>✏️ Edit email content</button>
            <button type="button" className="nf-btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={onPreview}>👁 Preview</button>
            <span style={LABEL}>Send a test</span>
            <div className="nf-row" style={{ gap: 6 }}>
              <input className="nf-field" value={testTo} onChange={e => setTestTo(e.target.value)} aria-label="Test recipient" />
              <button type="button" className="nf-btn-ghost nf-noshrink" onClick={() => onTest(testTo)}>Send</button>
            </div>
          </>
        )}

        {node.kind === 'condition' && (
          <>
            <select className="nf-field" value={s.check} onChange={e => onSettings({ check: e.target.value as NodeSettings['check'] })} aria-label="Condition">
              {CHECKS.map(c => <option key={c.check} value={c.check}>{c.label}</option>)}
            </select>
            {CHECKS.find(c => c.check === s.check)?.needsValue && (
              <label><span style={LABEL}>{CHECKS.find(c => c.check === s.check)?.needsValue}</span><Num prefix={s.check === 'spent' ? currency : undefined} value={s.value ?? 0} onChange={value => onSettings({ value })} /></label>
            )}
            <div className="nf-hint">Connect the <b>Yes</b> and <b>No</b> dots to the next steps. An unconnected branch ends the workflow.</div>
          </>
        )}

        {node.kind === 'wait' && (
          <>
            <select className="nf-field" value={s.event} onChange={e => onSettings({ event: e.target.value as NodeSettings['event'] })} aria-label="Event">
              <option value="ordered">Until they place an order</option>
              <option value="opened">Until they open an email</option>
              <option value="clicked">Until they click an email</option>
            </select>
            <span style={LABEL}>Wait at most</span>
            <Duration amount={s.amount ?? 2} unit={s.unit ?? 'days'} onChange={onSettings} />
            <div className="nf-hint"><b>Yes</b> as soon as it happens; <b>No</b> when time runs out.</div>
          </>
        )}

        {node.kind === 'split' && (
          <>
            <div className="nf-row" style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}><span>A · {s.pct ?? 50}%</span><span className="nf-ml-auto">B · {100 - (s.pct ?? 50)}%</span></div>
            <input type="range" min={1} max={99} value={s.pct ?? 50} onChange={e => onSettings({ pct: +e.target.value })} style={{ width: '100%', marginTop: 6 }} aria-label="Share for path A" />
            <div className="nf-hint">Contacts are sent down path A or B at random. Compare the emails on each path in the workflow’s detail page.</div>
          </>
        )}

        {node.kind === 'goal' && (
          <div className="nf-hint" style={{ marginTop: 0 }}>
            When a contact in this workflow places a paid order, they jump here and count as converted — then continue from this step (e.g. to a thank-you email), or finish.
          </div>
        )}
        {node.kind === 'exit' && <div className="nf-hint" style={{ marginTop: 0 }}>Contacts who reach this step leave the workflow.</div>}
      </div>
      <button type="button" className="nf-btn-delete-step" onClick={onDelete}>Delete step</button>
    </div>
  );
}
