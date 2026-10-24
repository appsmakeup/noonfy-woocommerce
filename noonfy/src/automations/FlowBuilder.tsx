import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { errorMessage } from '../api';
import { app } from '../config';
import type { Content } from '../campaigns/types';
import { Modal } from '../shared/ui';
import { automationsApi } from './api';
import { EmailEditor } from './EmailEditor';
import { Inspector } from './Inspector';
import { KIND, PALETTE, STATUS, autoName, money, nodeLabel, nodeStat, pct, ports } from './meta';
import type { AutomationsState } from './useAutomations';
import { automationsConfig, type AutomationSettings, type Edge, type EmailSettings, type FlowNode, type Graph, type Kind, type NodeStats, type Workflow } from './types';

const W = 230; // node width (Builder.dc.html)
const uid = () => 'b' + Math.random().toString(36).slice(2, 9);

/** Starter email for a new email step (mirrors the campaign default content). */
function starterEmail(): EmailSettings {
  const content: Content = {
    accent: '#4F46E5',
    blocks: [
      { id: uid(), type: 'header', eyebrow: app.site.name.toUpperCase(), title: 'Your headline here' },
      { id: uid(), type: 'text', html: 'Hi {first_name|there},<br><br>Write your message here. Click any text to edit it.' },
      { id: uid(), type: 'button', label: 'Shop now', url: app.site.home, dest: 'url' },
      { id: uid(), type: 'footer' },
    ],
  };
  return { subject: '', preheader: '', content };
}

function defaults(kind: Kind): FlowNode['settings'] {
  switch (kind) {
    case 'trigger': return { type: 'subscribed', firstOrder: false, minTotal: 0, days: 90, amount: 500, minutes: 60, hours: 2, segment: 'all', reentry: false };
    case 'delay': return { amount: 1, unit: 'days' };
    case 'email': return starterEmail();
    case 'condition': return { check: 'ordered', value: 0 };
    case 'wait': return { event: 'ordered', amount: 2, unit: 'days' };
    case 'split': return { pct: 50 };
    default: return {};
  }
}

/** x offset of an output port on a node. */
const portX = (kind: Kind, port: string) => {
  const list = ports(kind);
  return list.length < 2 ? W / 2 : port === list[0].port ? W * 0.3 : W * 0.7;
};

const edgePath = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2 - 4}`;
};

type Drag = { id: string; offX: number; offY: number; moved: boolean };
type Connect = { from: string; port: string; x: number; y: number };

export function FlowBuilder({ state, id, onCreate, creating }: { state: AutomationsState; id: number; onCreate: () => void; creating: boolean }) {
  const [wf, setWf] = useState<Workflow | null>(null);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [loadError, setLoadError] = useState('');
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('⚡');
  const [sel, setSel] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<Edge | null>(null);
  const [save, setSave] = useState<{ state: 'saved' | 'dirty' | 'saving' | 'error'; at: number; error: string }>({ state: 'saved', at: 0, error: '' });
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState(app.user.email);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [connect, setConnect] = useState<Connect | null>(null);
  const [, tick] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Record<string, HTMLDivElement | null>>({});
  const drag = useRef<Drag | null>(null);
  const version = useRef(0);

  // Load the workflow with its per-step stats.
  useEffect(() => {
    if (!id) return;
    automationsApi.show(id).then(d => {
      setWf(d); setStats(d.nodeStats); setGraph(d.graph); setName(d.name); setEmoji(d.emoji);
    }).catch(e => setLoadError(errorMessage(e)));
  }, [id]);

  // Once loaded, scroll so the flow is centred horizontally in the canvas.
  const centred = useRef(false);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (centred.current || !el || !graph.nodes.length) return;
    centred.current = true;
    const minX = Math.min(...graph.nodes.map(n => n.x)), maxX = Math.max(...graph.nodes.map(n => n.x + W));
    el.scrollLeft = Math.max(0, (minX + maxX) / 2 - el.clientWidth / 2);
  });

  // "Auto-saved just now" → "2m ago".
  useEffect(() => { const iv = window.setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(iv); }, []);

  const touch = () => { version.current++; setSave(s => ({ ...s, state: 'dirty' })); };
  const setG = (fn: (g: Graph) => Graph) => { setGraph(fn); touch(); };

  // Auto-save shortly after the last change.
  useEffect(() => {
    if (save.state !== 'dirty' || !wf) return;
    const v = version.current;
    const t = window.setTimeout(() => {
      setSave(s => ({ ...s, state: 'saving' }));
      automationsApi.save(wf.id, { name, emoji, graph })
        .then(r => {
          state.upsert(r); setWf(r);
          if (version.current === v) setSave({ state: 'saved', at: Date.now(), error: '' });
          else setSave(s => ({ ...s, state: 'dirty' }));
        })
        .catch(e => setSave(s => ({ ...s, state: 'error', error: errorMessage(e) })));
    }, 900);
    return () => clearTimeout(t);
  }, [save.state, graph, name, emoji, wf, state]);

  // Measure node heights so edges start at each node's bottom edge.
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    graph.nodes.forEach(n => {
      const h = nodeEls.current[n.id]?.offsetHeight ?? 56;
      next[n.id] = h;
      if (heights[n.id] !== h) changed = true;
    });
    if (changed) setHeights(next);
  });

  const node = (nid: string | null) => graph.nodes.find(n => n.id === nid) ?? null;
  const selected = node(sel);
  const updateNode = (nid: string, patch: Partial<FlowNode>) => setG(g => ({ ...g, nodes: g.nodes.map(n => (n.id === nid ? { ...n, ...patch } : n)) }));
  /** A name that just describes the old settings (e.g. "Wait 2 days") is cleared so the label follows the new ones. */
  const updateSettings = (nid: string, patch: FlowNode['settings']) => setG(g => ({
    ...g,
    nodes: g.nodes.map(n => (n.id === nid ? { ...n, name: n.name && n.name === autoName(n) ? '' : n.name, settings: { ...n.settings, ...patch } } : n)),
  }));
  const deleteNode = (nid: string) => { setG(g => ({ nodes: g.nodes.filter(n => n.id !== nid), edges: g.edges.filter(e => e.from !== nid && e.to !== nid) })); setSel(null); };
  const deleteEdge = (e: Edge) => { setG(g => ({ ...g, edges: g.edges.filter(x => !(x.from === e.from && x.port === e.port)) })); setSelEdge(null); };
  const link = (from: string, port: string, to: string) => {
    const target = node(to);
    if (from === to || !target || target.kind === 'trigger') return;
    setG(g => ({ ...g, edges: [...g.edges.filter(x => !(x.from === from && x.port === port)), { from, to, port }] }));
  };

  /** Adds a step below the selected one (connected from its first free port), or below everything. */
  const add = (kind: Kind) => {
    const nid = 'n' + (Math.max(0, ...graph.nodes.map(n => Number(n.id.replace(/\D/g, '')) || 0)) + 1);
    const anchor = selected;
    const freePort = anchor ? ports(anchor.kind).map(p => p.port).find(p => !graph.edges.some(e => e.from === anchor.id && e.port === p)) : undefined;
    let x = anchor ? anchor.x + (freePort && ports(anchor.kind).length > 1 && freePort !== ports(anchor.kind)[0].port ? 300 : 0) : (graph.nodes.find(n => n.kind === 'trigger')?.x ?? 160);
    let y = anchor ? anchor.y + (heights[anchor.id] ?? 56) + 50 : Math.max(0, ...graph.nodes.map(n => n.y + (heights[n.id] ?? 56))) + (graph.nodes.length ? 50 : 40);
    while (graph.nodes.some(n => Math.abs(n.x - x) < W && Math.abs(n.y - y) < 60)) x += 260;
    if (x > 2400) { x = 40; y += 120; }
    const created: FlowNode = { id: nid, kind, name: '', x, y, settings: defaults(kind) };
    setG(g => ({
      nodes: [...g.nodes, created],
      edges: anchor && freePort && kind !== 'trigger' ? [...g.edges, { from: anchor.id, to: nid, port: freePort }] : g.edges,
    }));
    setSel(nid);
    setSelEdge(null);
    if (kind === 'email') setEditing(nid);
  };

  // Canvas coordinates of a mouse event.
  const point = (e: { clientX: number; clientY: number }) => {
    const el = canvas.current!;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  };
  const onNodeDown = (e: ReactMouseEvent, n: FlowNode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const p = point(e);
    drag.current = { id: n.id, offX: p.x - n.x, offY: p.y - n.y, moved: false };
    setSel(n.id);
    setSelEdge(null);
  };
  const onMove = (e: ReactMouseEvent) => {
    if (connect) { const p = point(e); setConnect(c => (c ? { ...c, x: p.x, y: p.y } : c)); return; }
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    const x = Math.max(0, Math.round(p.x - d.offX)), y = Math.max(0, Math.round(p.y - d.offY));
    d.moved = true;
    setGraph(g => ({ ...g, nodes: g.nodes.map(n => (n.id === d.id ? { ...n, x, y } : n)) }));
  };
  const onUp = () => {
    if (drag.current?.moved) touch();
    drag.current = null;
    setConnect(null);
  };

  // Delete / Backspace removes the selected step or connection (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (editing || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selEdge) { e.preventDefault(); deleteEdge(selEdge); } else if (sel) { e.preventDefault(); deleteNode(sel); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const saveSettings = useCallback((patch: Partial<AutomationSettings>) => {
    automationsApi.saveSettings(patch).then(s => state.setOverview(o => ({ ...o, settings: s })))
      .catch(e => state.showToast('warn', 'Couldn’t save settings', errorMessage(e)));
  }, [state]);

  /** Saves now (used before activating and test runs). */
  const flush = async () => {
    if (!wf) return null;
    setSave(s => ({ ...s, state: 'saving' }));
    try {
      const r = await automationsApi.save(wf.id, { name, emoji, graph });
      state.upsert(r); setWf(r); setSave({ state: 'saved', at: Date.now(), error: '' });
      return r;
    } catch (e) {
      setSave(s => ({ ...s, state: 'error', error: errorMessage(e) }));
      state.showToast('warn', 'Couldn’t save', errorMessage(e));
      return null;
    }
  };

  const toggleLive = async () => {
    if (!wf) return;
    setBusy('live');
    try {
      if (wf.status !== 'live' && !(await flush())) return;
      const r = await automationsApi.setLive(wf.id, wf.status !== 'live');
      state.upsert(r); setWf(r);
      state.showToast('ok', r.status === 'live' ? 'Workflow activated' : 'Workflow paused', r.status === 'live' ? 'Contacts will be enrolled when the trigger happens.' : 'Contacts stay where they are until you activate it again.');
    } catch (e) {
      state.showToast('warn', wf.status === 'live' ? 'Couldn’t pause' : 'Not ready to activate', errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const testRun = (to: string, nodeId?: string) => {
    setBusy('test');
    automationsApi.test(graph, to, nodeId)
      .then(r => { state.showToast('ok', nodeId ? 'Test email sent' : 'Test run sent', `${r.sent} ${r.sent === 1 ? 'email' : 'emails'} to ${r.to}.`); setTestOpen(false); })
      .catch(e => state.showToast('warn', 'Test failed', errorMessage(e)))
      .finally(() => setBusy(''));
  };
  const openPreview = (email: EmailSettings) => {
    automationsApi.preview(email).then(r => setPreview(r.html)).catch(e => state.showToast('warn', 'Preview failed', errorMessage(e)));
  };

  if (!id) return <BuilderPicker state={state} onCreate={onCreate} creating={creating} />;
  if (loadError) return <div className="nf-card nf-empty-card" style={{ margin: 28 }}><div className="nf-empty-title">Couldn’t open this workflow</div><div className="nf-hint">{loadError} <a href="#workflows">Back to workflows</a></div></div>;
  if (!wf) return <div className="nf-card nf-empty-card" style={{ margin: 28 }}><div className="nf-hint">Loading…</div></div>;

  const status = STATUS[wf.status];
  const ago = save.at ? Math.round((Date.now() - save.at) / 60000) : -1;
  const saveText = save.state === 'saving' ? 'Saving…' : save.state === 'dirty' ? 'Unsaved changes' : save.state === 'error' ? 'Not saved' : ago < 0 ? 'All changes saved' : ago === 0 ? 'Auto-saved just now' : `Auto-saved ${ago}m ago`;
  const hasTrigger = graph.nodes.some(n => n.kind === 'trigger');
  const width = Math.max(1400, ...graph.nodes.map(n => n.x + W + 300));
  const height = Math.max(1400, ...graph.nodes.map(n => n.y + 400));
  const s = wf.stats;

  const edges = graph.edges.map(e => {
    const a = node(e.from), b = node(e.to);
    if (!a || !b) return null;
    const x1 = a.x + portX(a.kind, e.port), y1 = a.y + (heights[a.id] ?? 56), x2 = b.x + W / 2, y2 = b.y;
    return { e, d: edgePath(x1, y1, x2, y2), x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, on: !!selEdge && selEdge.from === e.from && selEdge.port === e.port };
  }).filter(Boolean) as { e: Edge; d: string; x2: number; y2: number; mx: number; my: number; on: boolean }[];
  const pending = connect && node(connect.from);

  return (
    <div className="nf-flowbuilder">
      <header className="nf-flow-header">
        <a href="#workflows" className="nf-flow-back" aria-label="Back to workflows">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3F55" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </a>
        <select className="nf-flow-emoji" value={emoji} onChange={e => { setEmoji(e.target.value); touch(); }} aria-label="Icon">
          {automationsConfig.emojis.map(em => <option key={em} value={em}>{em}</option>)}
        </select>
        <div style={{ minWidth: 0 }}>
          <input className="nf-flow-name" value={name} onChange={e => { setName(e.target.value); touch(); }} aria-label="Workflow name" />
          <div style={{ fontSize: 11.5, color: save.state === 'error' ? '#E02424' : '#8A8DA3', fontWeight: 600 }} title={save.error}>
            {status.label.charAt(0) + status.label.slice(1).toLowerCase()} · {saveText}{save.state === 'error' ? ` — ${save.error}` : ''}
          </div>
        </div>
        <div className="nf-row nf-ml-auto" style={{ gap: 10 }}>
          <span className="nf-flow-hint">Drag nodes to arrange · click to inspect</span>
          <button type="button" className="nf-btn-line" style={{ fontSize: 12.5 }} onClick={() => setTestOpen(true)}>Test run</button>
          {wf.status === 'live'
            ? <button type="button" className="nf-btn-line" style={{ fontSize: 12.5, borderColor: '#FDE1E1', color: '#E02424' }} disabled={!!busy} onClick={toggleLive}>Pause workflow</button>
            : <button type="button" className="nf-btn-primary nf-btn-primary--shadow" style={{ fontSize: 12.5, padding: '8px 16px' }} disabled={!!busy} onClick={toggleLive}>{busy === 'live' ? 'Activating…' : 'Activate workflow'}</button>}
        </div>
      </header>

      <div className="nf-flow-body">
        <div className="nf-flow-palette">
          <div className="nf-panel-title" style={{ padding: '0 2px 8px 2px' }}>Blocks</div>
          <div className="nf-col" style={{ gap: 7 }}>
            {PALETTE.map(kind => {
              const k = KIND[kind];
              const soon = kind === 'sms';
              return (
                <button key={kind} type="button" className="nf-flow-palette-btn" disabled={soon || (kind === 'trigger' && hasTrigger)}
                  title={soon ? 'SMS is coming soon' : kind === 'trigger' && hasTrigger ? 'A workflow has one trigger' : `Add ${kind}${selected ? ' after the selected step' : ''}`}
                  onClick={() => kind !== 'sms' && add(kind)}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: k.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{k.glyph}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#14152A' }}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</span>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: soon ? 800 : 600, color: soon ? '#7C3AED' : '#A5A8BD' }}>{soon ? 'Coming soon' : k.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={canvas} className="nf-flow-canvas" onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onMouseDown={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) { setSel(null); setSelEdge(null); } }}>
          <div data-bg="1" style={{ position: 'relative', width, height }}>
            <svg style={{ position: 'absolute', inset: 0, width, height, overflow: 'visible', pointerEvents: 'none' }}>
              {edges.map(({ e, d, x2, y2, on }) => (
                <g key={e.from + e.port}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onMouseDown={ev => { ev.stopPropagation(); setSelEdge(e); setSel(null); }} />
                  <path d={d} fill="none" stroke={on ? '#8B5CF6' : '#B9B3F0'} strokeWidth={on ? 2.5 : 2} style={{ pointerEvents: 'none' }} />
                  <circle cx={x2} cy={y2 - 4} r={3.5} fill="#8B5CF6" style={{ pointerEvents: 'none' }} />
                </g>
              ))}
              {pending && connect && (
                <path d={edgePath(pending.x + portX(pending.kind, connect.port), pending.y + (heights[pending.id] ?? 56), connect.x, connect.y + 4)} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />
              )}
            </svg>
            {edges.filter(x => x.on).map(({ e, mx, my }) => (
              <button key="del" type="button" className="nf-edge-delete" style={{ left: mx - 11, top: my - 11 }} title="Remove connection" aria-label="Remove connection" onClick={() => deleteEdge(e)}>✕</button>
            ))}

            {graph.nodes.map(n => {
              const k = KIND[n.kind];
              const on = sel === n.id;
              const stat = nodeStat(n, stats);
              const outs = ports(n.kind);
              return (
                <div key={n.id} ref={el => { nodeEls.current[n.id] = el; }} className="nf-flow-node" role="button" tabIndex={0} aria-label={`${k.label}: ${nodeLabel(n)}`}
                  style={{ left: n.x, top: n.y, borderColor: on ? '#8B5CF6' : connect && connect.from !== n.id && n.kind !== 'trigger' ? '#C4B5FD' : '#E4E5EF', boxShadow: on ? '0 8px 24px rgba(99,82,229,.22)' : '0 2px 6px rgba(20,21,42,.06)' }}
                  onMouseDown={e => onNodeDown(e, n)}
                  onMouseUp={() => { if (connect) link(connect.from, connect.port, n.id); }}
                  onDoubleClick={() => n.kind === 'email' && setEditing(n.id)}
                  onKeyDown={e => { if (e.key === 'Enter') setSel(n.id); }}>
                  <div className="nf-row" style={{ gap: 9 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: k.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{k.glyph}</span>
                    <span className="nf-grow">
                      <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', color: k.color }}>{k.label}</span>
                      <span className="nf-ellipsis" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#14152A' }}>{nodeLabel(n)}</span>
                    </span>
                  </div>
                  {stat && <div style={{ marginTop: 8, borderTop: '1px solid #F3F3FA', paddingTop: 7, fontSize: 10.5, fontWeight: 700, color: '#8A8DA3' }}>{stat}</div>}
                  {n.kind !== 'trigger' && <span className="nf-port nf-port--in" />}
                  {outs.map(p => (
                    <span key={p.port} className="nf-port nf-port--out" style={{ left: portX(n.kind, p.port) }} title={`Drag to connect${p.label ? ' “' + p.label + '”' : ''}`}
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); const pt = point(e); setConnect({ from: n.id, port: p.port, x: pt.x, y: pt.y }); setSel(n.id); }}>
                      {p.label && <span className="nf-port-label">{p.label}</span>}
                    </span>
                  ))}
                </div>
              );
            })}
            {!graph.nodes.length && (
              <div className="nf-empty" style={{ position: 'absolute', left: 340, top: 120, width: 400 }}>
                <div className="nf-empty-title">Start with a trigger</div>
                <div className="nf-hint">Add a Trigger from the left, then steps below it.</div>
              </div>
            )}
          </div>
        </div>

        <div className="nf-flow-inspector">
          {selected ? (
            <Inspector key={selected.id} node={selected} segments={state.overview.segments} settings={state.overview.settings} live={wf.status === 'live'}
              currency={automationsConfig.currency.symbol}
              onRename={v => updateNode(selected.id, { name: v })} onSettings={patch => updateSettings(selected.id, patch)} onDelete={() => deleteNode(selected.id)}
              onEditEmail={() => setEditing(selected.id)} onPreview={() => openPreview(selected.settings as EmailSettings)} onTest={to => testRun(to, selected.id)}
              onSaveSettings={saveSettings}
              onEnrol={() => automationsApi.enrol(wf.id).then(r => state.showToast('ok', 'Segment enrolled', `${r.enrolled.toLocaleString()} new contacts joined.`)).catch(e => state.showToast('warn', 'Couldn’t enrol', errorMessage(e)))} />
          ) : (
            <div>
              <div className="nf-panel-title">Workflow</div>
              <div className="nf-col" style={{ gap: 10, marginTop: 14 }}>
                {[['STEPS', String(graph.nodes.length)], ['ENROLLED', s.enrolled.toLocaleString()], ['CONVERSION', pct(s.converted, s.enrolled)], ['REVENUE', money(s.revenue)]].map(([label, value]) => (
                  <div key={label} style={{ border: '1px solid #F3F3FA', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#A5A8BD' }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#14152A', marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8A8DA3', marginTop: 14, lineHeight: 1.6 }}>
                Select a node to edit it, or add blocks from the left panel. Drag from a node’s bottom dot to another node to connect them; click a connection to remove it.
              </div>
              <a href={`#detail:${wf.id}`} className="nf-link-btn" style={{ display: 'inline-block', marginTop: 10 }}>View performance →</a>
            </div>
          )}
        </div>
      </div>

      {editing && node(editing) && (
        <EmailEditor title={nodeLabel(node(editing)!)} email={node(editing)!.settings as EmailSettings} onClose={() => setEditing(null)} onPreview={openPreview}
          onDone={email => { updateSettings(editing, email); setEditing(null); }} />
      )}
      {preview !== null && (
        <Modal width={700} title="Preview" onClose={() => setPreview(null)} footer={<span className="nf-hint" style={{ marginTop: 0 }}>Rendered by the server as sent, with your newest products standing in for the shopper’s cart, views or order.</span>}>
          <iframe title="Email preview" sandbox="" srcDoc={preview} style={{ width: 640, maxWidth: '100%', height: '62vh', border: '1px solid #ECEDF4', borderRadius: 10, display: 'block', margin: '0 auto' }} />
        </Modal>
      )}
      {testOpen && (
        <Modal title="Test run" width={440} onClose={() => setTestOpen(false)}
          footer={<><button type="button" className="nf-btn-ghost nf-ml-auto" onClick={() => setTestOpen(false)}>Cancel</button><button type="button" className="nf-btn-primary" disabled={busy === 'test'} onClick={() => testRun(testTo)}>{busy === 'test' ? 'Sending…' : 'Send test emails'}</button></>}>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#5B5E75', fontWeight: 600, lineHeight: 1.55 }}>
            Sends every email in this workflow to you right away, in order, without the delays — so you can check them in your inbox. Nobody is enrolled.
          </p>
          <label><span className="nf-label">Send to</span><input className="nf-field" value={testTo} onChange={e => setTestTo(e.target.value)} /></label>
        </Modal>
      )}
    </div>
  );
}

/** #builder with no workflow: pick one or start a new one. */
function BuilderPicker({ state, onCreate, creating }: { state: AutomationsState; onCreate: () => void; creating: boolean }) {
  const { workflows } = state.overview;
  return (
    <div style={{ padding: '0 28px 40px' }}>
      <header className="nf-page-header">
        <div>
          <h1 className="nf-page-title">Visual Builder</h1>
          <p className="nf-page-sub">Choose a workflow to edit, or start a new one.</p>
        </div>
        <div className="nf-row nf-ml-auto" style={{ gap: 10 }}>
          <a href="#templates" className="nf-btn-line" style={{ fontSize: 13 }}>Browse templates</a>
          <button type="button" className="nf-btn-primary nf-btn-primary--shadow" style={{ fontSize: 13 }} disabled={creating} onClick={onCreate}>{creating ? 'Creating…' : 'New workflow'}</button>
        </div>
      </header>
      <div className="nf-card" style={{ padding: 0, overflow: 'hidden' }}>
        {workflows.map(w => (
          <a key={w.id} href={`#builder:${w.id}`} className="nf-campaign-row" style={{ gridTemplateColumns: '1fr auto', padding: '12px 20px' }}>
            <span className="nf-row" style={{ gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: '#F1EBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{w.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{w.name}</span>
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: STATUS[w.status].color, background: STATUS[w.status].bg, borderRadius: 99, padding: '3px 9px' }}>{STATUS[w.status].label}</span>
          </a>
        ))}
        {!workflows.length && <div className="nf-empty-card"><div className="nf-hint">No workflows yet.</div></div>}
      </div>
    </div>
  );
}
