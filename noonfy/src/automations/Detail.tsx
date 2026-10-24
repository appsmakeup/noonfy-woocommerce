import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { automationsApi } from './api';
import { describeTrigger, emailCount, fmtDate, KIND, money, nodeLabel, nodeStat, orderedNodes, pct, relTime, STATUS, TRIGGER_TINT } from './meta';
import type { AutomationsState } from './useAutomations';
import type { EnrolledContact, FlowNode, TriggerSettings, WorkflowDetail } from './types';

const AVATAR = [['#F1EBFE', '#7C3AED'], ['#EEF0FE', '#4F46E5'], ['#FFF3E8', '#C2620A'], ['#EDF9F1', '#0E9F6E'], ['#FDEDED', '#E02424']];
const EXIT_REASON: Record<string, string> = { unsubscribed: 'unsubscribed', ordered: 'placed an order', removed: 'removed', step_removed: 'their step was deleted', too_many_steps: 'too many steps' };

/** Where a contact is, in words (e.g. "Waiting · Email 2 in 4h"). */
function stepText(c: EnrolledContact, w: WorkflowDetail) {
  const node = w.graph.nodes.find(n => n.id === c.nodeId);
  const lastEmail = w.graph.nodes.find(n => n.id === c.lastEmail);
  if (c.status === 'completed') return c.converted ? 'Converted · completed' : 'Completed the workflow';
  if (c.status === 'exited') return 'Left · ' + (EXIT_REASON[c.exitReason] ?? c.exitReason);
  if (node && (node.kind === 'delay' || node.kind === 'wait')) {
    const next = w.graph.edges.find(e => e.from === node.id && (e.port === 'out' || e.port === 'no'));
    const nextNode = next ? w.graph.nodes.find(n => n.id === next.to) : null;
    return `Waiting · ${nextNode ? nodeLabel(nextNode) : 'next step'} ${relTime(c.nextRunAt, true)}`;
  }
  if (node?.kind === 'email' && c.nextRunAt && Date.parse(c.nextRunAt) > Date.now()) return `Waiting for an SMTP connection · ${nodeLabel(node)}`;
  if (lastEmail) return `Received ${nodeLabel(lastEmail)}`;
  return 'Entered workflow';
}

export function Detail({ id, state }: { id: number; state: AutomationsState }) {
  const [w, setW] = useState<WorkflowDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    automationsApi.show(id).then(d => { setW(d); setError(''); }).catch(e => setError(errorMessage(e)));
  }, [id]);
  useEffect(() => {
    load();
    const iv = window.setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  if (!id) {
    return (
      <div className="nf-card nf-empty-card">
        <div className="nf-empty-title">No workflows yet</div>
        <div className="nf-hint">Create one from a template to see its performance here. <a href="#templates">Browse templates</a></div>
      </div>
    );
  }
  if (error) return <div className="nf-card nf-empty-card"><div className="nf-empty-title">Couldn’t load this workflow</div><div className="nf-hint">{error}</div></div>;
  if (!w) return <div className="nf-card nf-empty-card"><div className="nf-hint">Loading…</div></div>;

  const st = STATUS[w.status];
  const trig = w.graph.nodes.find(n => n.kind === 'trigger');
  const isSegment = (trig?.settings as TriggerSettings | undefined)?.type === 'segment';
  const s = w.stats;
  const kpis = [
    ['REVENUE', money(s.revenue)], ['EMAILS SENT', s.sent.toLocaleString()], ['OPEN RATE', pct(s.opens, s.sent)],
    ['CLICK RATE', pct(s.clicks, s.sent)], ['CONVERSIONS', s.converted.toLocaleString()],
  ];
  const steps = orderedNodes(w.graph);
  const emails = steps.filter(n => n.kind === 'email');

  const toggle = () => {
    setBusy(true);
    automationsApi.setLive(w.id, w.status !== 'live')
      .then(r => { state.upsert(r); load(); state.showToast('ok', r.status === 'live' ? 'Workflow is live' : 'Workflow paused', r.status === 'live' ? 'New contacts will be enrolled.' : 'Contacts stay where they are until you activate it again.'); })
      .catch(e => state.showToast('warn', 'Couldn’t change the workflow', errorMessage(e)))
      .finally(() => setBusy(false));
  };
  const enrol = () => {
    setBusy(true);
    automationsApi.enrol(w.id).then(r => { load(); state.showToast('ok', 'Segment enrolled', `${r.enrolled.toLocaleString()} new ${r.enrolled === 1 ? 'contact' : 'contacts'} joined.`); })
      .catch(e => state.showToast('warn', 'Couldn’t enrol', errorMessage(e))).finally(() => setBusy(false));
  };
  const removeContact = (c: EnrolledContact) => {
    if (!window.confirm(`Remove ${c.name || c.email} from this workflow? They won’t get its remaining emails.`)) return;
    automationsApi.removeContact(w.id, c.id).then(load).catch(e => state.showToast('warn', 'Couldn’t remove', errorMessage(e)));
  };

  return (
    <section>
      <div className="nf-card nf-row" style={{ gap: 12, padding: '16px 20px', flexWrap: 'wrap' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: TRIGGER_TINT[w.trigger] ?? '#EEF0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{w.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#14152A' }}>{w.name}</div>
          <div style={{ fontSize: 12, color: '#8A8DA3', fontWeight: 600 }}>
            Trigger: {describeTrigger(trig?.settings as TriggerSettings, state.overview.segments)} · {emailCount(w.graph)} {emailCount(w.graph) === 1 ? 'email' : 'emails'} · Created {fmtDate(w.createdAt)}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 99, padding: '4px 11px', marginLeft: 6 }}>{st.label}</span>
        <div className="nf-row nf-ml-auto" style={{ gap: 8 }}>
          {isSegment && w.status === 'live' && <button type="button" className="nf-btn-line" disabled={busy} onClick={enrol}>Enrol segment now</button>}
          <a href={`#builder:${w.id}`} className="nf-btn-line" style={{ padding: '8px 14px', fontSize: 12.5 }}>Edit in builder</a>
          {w.status === 'live'
            ? <button type="button" className="nf-btn-line" style={{ borderColor: '#FDE1E1', color: '#E02424', padding: '8px 14px', fontSize: 12.5 }} disabled={busy} onClick={toggle}>Pause</button>
            : <button type="button" className="nf-btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }} disabled={busy} onClick={toggle}>Activate</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginTop: 14 }}>
        {kpis.map(([label, value]) => (
          <div key={label} className="nf-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8DA3' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#14152A', marginTop: 5 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14, marginTop: 14, alignItems: 'start' }}>
        <div className="nf-card">
          <div className="nf-card-title" style={{ marginBottom: 16 }}>Workflow</div>
          <div className="nf-col" style={{ alignItems: 'center' }}>
            {steps.map((n, i) => <StepCard key={n.id} node={n} stat={nodeStat(n, w.nodeStats)} arrow={i < steps.length - 1} />)}
          </div>
        </div>
        <div className="nf-col" style={{ gap: 14 }}>
          <div className="nf-card">
            <div className="nf-card-title">Email performance</div>
            <div className="nf-col" style={{ gap: 12, marginTop: 14 }}>
              {emails.map((n, i) => {
                const e = w.nodeStats.emails[n.id] ?? { sent: 0, opens: 0, clicks: 0, orders: 0, revenue: 0, failed: 0 };
                return (
                  <div key={n.id} style={{ border: '1px solid #F3F3FA', borderRadius: 11, padding: '12px 14px' }}>
                    <div className="nf-row" style={{ fontSize: 12.5, fontWeight: 800, color: '#14152A' }}><span className="nf-ellipsis">Email {i + 1} — {nodeLabel(n)}</span><span className="nf-ml-auto" style={{ color: '#4F46E5', paddingLeft: 8 }}>{money(e.revenue)}</span></div>
                    <div className="nf-row" style={{ gap: 16, fontSize: 11, color: '#8A8DA3', fontWeight: 700, marginTop: 5, flexWrap: 'wrap' }}>
                      <span>Sent {e.sent.toLocaleString()}</span><span>Open {pct(e.opens, e.sent)}</span><span>Click {pct(e.clicks, e.sent)}</span><span>Conv {pct(e.orders, e.sent)}</span>
                      {e.failed > 0 && <span style={{ color: '#E02424' }}>Failed {e.failed}</span>}
                    </div>
                  </div>
                );
              })}
              {!emails.length && <div className="nf-hint">This workflow has no email steps yet.</div>}
            </div>
          </div>
          <div className="nf-card">
            <div className="nf-row"><span className="nf-card-title">Customers in workflow</span><span className="nf-ml-auto" style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', background: '#F1EBFE', borderRadius: 99, padding: '3px 9px' }}>{s.active.toLocaleString()} active</span></div>
            <div className="nf-col" style={{ gap: 11, marginTop: 14 }}>
              {w.contacts.map((c, i) => {
                const name = c.name || c.email;
                const initials = (c.name || c.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
                const [bg, fg] = AVATAR[i % AVATAR.length];
                return (
                  <div key={c.id} className="nf-row" style={{ gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 99, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: fg, flexShrink: 0 }}>{initials}</span>
                    <span className="nf-grow">
                      <span className="nf-ellipsis" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#14152A' }} title={c.email}>{name}</span>
                      <span className="nf-ellipsis" style={{ display: 'block', fontSize: 11, color: '#8A8DA3', fontWeight: 600 }}>{stepText(c, w)}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#A5A8BD', whiteSpace: 'nowrap' }}>{relTime(c.updatedAt)}</span>
                    {c.status === 'active' && <button type="button" className="nf-icon-btn" title="Remove from workflow" aria-label={`Remove ${name}`} onClick={() => removeContact(c)}>✕</button>}
                  </div>
                );
              })}
              {!w.contacts.length && <div className="nf-hint">{w.status === 'live' ? 'Nobody has entered yet. Contacts join when the trigger happens.' : 'Activate the workflow to start enrolling contacts.'}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One step in the vertical workflow list (Automations.dc.html#detail). */
export function StepCard({ node, stat, arrow }: { node: FlowNode; stat: string; arrow: boolean }) {
  const k = KIND[node.kind];
  const trigger = node.kind === 'trigger';
  const goal = node.kind === 'goal';
  return (
    <div className="nf-col" style={{ width: '100%', alignItems: 'center' }}>
      <div className="nf-row" style={{ width: 320, maxWidth: '100%', border: `1.5px solid ${trigger ? '#DDD6FE' : goal ? '#BEE9D2' : '#ECEDF4'}`, background: trigger ? '#FBFAFF' : goal ? '#F4FBF7' : '#fff', borderRadius: 12, padding: '11px 14px', gap: 10, boxShadow: '0 1px 3px rgba(20,21,42,.04)' }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: k.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{k.glyph}</span>
        <span className="nf-grow">
          <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.6px', color: k.color }}>{k.label}</span>
          <span className="nf-ellipsis" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#14152A' }}>{node.kind === 'email' ? `“${nodeLabel(node)}”` : nodeLabel(node)}</span>
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#8A8DA3', whiteSpace: 'nowrap' }}>{stat}</span>
      </div>
      {arrow && <div style={{ height: 22, width: 2, background: '#DDD6FE' }} />}
    </div>
  );
}
