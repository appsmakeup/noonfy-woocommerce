// Labels, colours and descriptions for workflow steps (colours from Builder.dc.html / Automations.dc.html).
import { automationsConfig, type Check, type FlowNode, type Graph, type Kind, type NodeStats, type TriggerSettings, type TriggerType, type Unit, type WorkflowStatus } from './types';

/** glyph, tint, kind colour, palette hint. */
export const KIND: Record<Kind | 'sms', { label: string; glyph: string; tint: string; color: string; hint: string }> = {
  trigger: { label: 'TRIGGER', glyph: '⚡', tint: '#F1EBFE', color: '#7C3AED', hint: 'Starts the flow' },
  condition: { label: 'CONDITION', glyph: '🔀', tint: '#EDF9F1', color: '#0E9F6E', hint: 'Branch on behavior' },
  delay: { label: 'DELAY', glyph: '⏱️', tint: '#FFF3E8', color: '#C2620A', hint: 'Pause for a time' },
  email: { label: 'EMAIL', glyph: '✉️', tint: '#EEF0FE', color: '#4F46E5', hint: 'Send an email' },
  sms: { label: 'SMS', glyph: '💬', tint: '#EDF9F1', color: '#0E9F6E', hint: 'Send a text' },
  wait: { label: 'WAIT', glyph: '⏳', tint: '#FFF3E8', color: '#C2620A', hint: 'Wait for event' },
  split: { label: 'SPLIT', glyph: '🧪', tint: '#F1EBFE', color: '#7C3AED', hint: 'A/B split' },
  goal: { label: 'GOAL', glyph: '🏁', tint: '#EDF9F1', color: '#0E9F6E', hint: 'Conversion target' },
  exit: { label: 'EXIT', glyph: '🚪', tint: '#F3F3FA', color: '#8A8DA3', hint: 'Leave workflow' },
};
export const PALETTE: (Kind | 'sms')[] = ['trigger', 'condition', 'delay', 'email', 'sms', 'wait', 'split', 'goal', 'exit'];

/** Output ports per kind (Noonfy_Workflows::PORTS). */
export function ports(kind: Kind): { port: string; label: string }[] {
  if (kind === 'condition' || kind === 'wait') return [{ port: 'yes', label: 'Yes' }, { port: 'no', label: 'No' }];
  if (kind === 'split') return [{ port: 'a', label: 'A' }, { port: 'b', label: 'B' }];
  if (kind === 'exit') return [];
  return [{ port: 'out', label: '' }];
}

export const STATUS: Record<WorkflowStatus, { label: string; color: string; bg: string }> = {
  live: { label: 'LIVE', color: '#0E9F6E', bg: '#EDF9F1' },
  paused: { label: 'PAUSED', color: '#C2620A', bg: '#FFF3E8' },
  draft: { label: 'DRAFT', color: '#8A8DA3', bg: '#F3F3FA' },
};

export const TRIGGERS: { type: TriggerType; label: string; help: string }[] = [
  { type: 'subscribed', label: 'Contact subscribes', help: 'Someone opts in at checkout, in their account, or from a customer import.' },
  { type: 'order_paid', label: 'Order paid', help: 'Each order once it is paid (processing or completed).' },
  { type: 'order_completed', label: 'Order completed', help: 'When you mark an order completed — good for review requests and cross-sells.' },
  { type: 'cart_abandoned', label: 'Cart abandoned', help: 'A saved cart hasn’t changed for a while and no order was placed.' },
  { type: 'browse_abandoned', label: 'Viewed product, no cart', help: 'A signed-in shopper viewed products without adding them to the cart.' },
  { type: 'no_order', label: 'No order in a while', help: 'A customer hasn’t ordered for a number of days (checked daily).' },
  { type: 'lifetime_spend', label: 'Lifetime spend reached', help: 'A customer’s total spend passes an amount.' },
  { type: 'segment', label: 'Everyone in a segment', help: 'Enrolls a segment when you activate the workflow, and again whenever you choose.' },
];
/** Icon background per trigger (the design's per-workflow tints). */
export const TRIGGER_TINT: Record<string, string> = {
  subscribed: '#F1EBFE', order_paid: '#FFF3E8', order_completed: '#FDEDED', cart_abandoned: '#EEF0FE', browse_abandoned: '#EDF9F1',
  no_order: '#FFF3E8', lifetime_spend: '#F1EBFE', segment: '#EEF0FE',
};
export const REPEATABLE: TriggerType[] = ['order_paid', 'order_completed', 'no_order', 'cart_abandoned', 'browse_abandoned'];

export const CHECKS: { check: Check; label: string; needsValue?: string }[] = [
  { check: 'ordered', label: 'Placed an order since entering' },
  { check: 'opened', label: 'Opened an email from this workflow' },
  { check: 'clicked', label: 'Clicked an email from this workflow' },
  { check: 'spent', label: 'Lifetime spend is at least', needsValue: 'Amount' },
  { check: 'orders', label: 'Number of orders is at least', needsValue: 'Orders' },
  { check: 'subscribed', label: 'Is subscribed to marketing' },
];

export const UNITS: Unit[] = ['minutes', 'hours', 'days'];
const unitLabel = (n: number, u: Unit) => `${n} ${n === 1 ? u.slice(0, -1) : u}`;

/** Duration like "2 hours" from minutes. */
export function minutesLabel(m: number) {
  return m % 1440 === 0 ? unitLabel(m / 1440, 'days') : m % 60 === 0 ? unitLabel(m / 60, 'hours') : unitLabel(m, 'minutes');
}

/** Money in the store's currency format. */
export function money(n: number) {
  const { symbol, position, decimals } = automationsConfig.currency;
  const v = n.toLocaleString(undefined, { minimumFractionDigits: n >= 1000 ? 0 : decimals, maximumFractionDigits: n >= 1000 ? 0 : decimals });
  return position === 'right' ? v + symbol : position === 'right_space' ? v + ' ' + symbol : position === 'left_space' ? symbol + ' ' + v : symbol + v;
}
export const pct = (part: number, whole: number) => (whole ? (Math.round((part / whole) * 1000) / 10).toString() + '%' : '—');

/** One-line trigger summary, e.g. "Cart abandoned 1 hour". */
export function describeTrigger(s: Partial<TriggerSettings> | undefined, segments: { id: string; label: string }[] = []): string {
  if (!s?.type) return 'No trigger yet';
  switch (s.type) {
    case 'subscribed': return 'Contact subscribes';
    case 'order_paid': return (s.firstOrder ? 'First order paid' : 'Order paid') + (s.minTotal ? ` over ${money(s.minTotal)}` : '');
    case 'order_completed': return 'Order completed' + (s.minTotal ? ` over ${money(s.minTotal)}` : '');
    case 'cart_abandoned': return `Cart abandoned ${minutesLabel(s.minutes ?? 60)}`;
    case 'browse_abandoned': return `Viewed product, no cart (${unitLabel(s.hours ?? 2, 'hours')})`;
    case 'no_order': return `No order in ${s.days ?? 90} days`;
    case 'lifetime_spend': return `Lifetime spend over ${money(s.amount ?? 500)}`;
    case 'segment': return `Segment: ${segments.find(x => x.id === s.segment)?.label ?? s.segment ?? 'All contacts'}`;
  }
}

/** Default step name for a node, from its settings. */
export function autoName(n: Pick<FlowNode, 'kind' | 'settings'>): string {
  const s = n.settings;
  switch (n.kind) {
    case 'trigger': return describeTrigger(s as TriggerSettings);
    case 'delay': return `Wait ${unitLabel(s.amount ?? 1, s.unit ?? 'hours')}`;
    case 'email': return s.subject ? s.subject : 'New email';
    case 'condition': return CHECKS.find(c => c.check === s.check)?.label.replace(' is at least', ` ≥ ${s.value ?? 0}`) + '?';
    case 'wait': return `Wait up to ${unitLabel(s.amount ?? 2, s.unit ?? 'days')} for ${s.event === 'opened' ? 'an open' : s.event === 'clicked' ? 'a click' : 'an order'}`;
    case 'split': return `Split ${s.pct ?? 50}% / ${100 - (s.pct ?? 50)}%`;
    case 'goal': return 'Order placed';
    case 'exit': return 'Exit workflow';
  }
}

export const nodeLabel = (n: FlowNode) => n.name || autoName(n);

/** Short stat shown on a step (builder nodes and the detail step list), or ''. */
export function nodeStat(n: FlowNode, stats: NodeStats | null): string {
  if (!stats) return '';
  const ev = stats.events[n.id] ?? {};
  switch (n.kind) {
    case 'trigger': return ev.enter ? `${ev.enter.toLocaleString()} entered` : '';
    case 'email': {
      const e = stats.emails[n.id];
      return e && e.sent ? `${pct(e.opens, e.sent)} open` : '';
    }
    case 'condition': case 'wait': {
      const total = (ev.yes ?? 0) + (ev.no ?? 0);
      return total ? `${pct(ev.yes ?? 0, total)} yes · ${pct(ev.no ?? 0, total)} no` : '';
    }
    case 'split': {
      const total = (ev.a ?? 0) + (ev.b ?? 0);
      return total ? `A ${pct(ev.a ?? 0, total)} · B ${pct(ev.b ?? 0, total)}` : '';
    }
    case 'goal': return ev.enter ? `${ev.enter.toLocaleString()} converted` : '';
    case 'delay': return stats.waiting[n.id] ? `${stats.waiting[n.id].toLocaleString()} waiting` : '';
  }
  return '';
}

/** Steps reachable from the trigger, breadth first, then any unconnected ones (mirrors Runner::emails_in_order). */
export function orderedNodes(graph: Graph): FlowNode[] {
  const seen = new Set<string>();
  const order: FlowNode[] = [];
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const queue = graph.nodes.filter(n => n.kind === 'trigger').map(n => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    order.push(byId.get(id)!);
    graph.edges.filter(e => e.from === id).forEach(e => queue.push(e.to));
  }
  graph.nodes.forEach(n => { if (!seen.has(n.id)) order.push(n); });
  return order;
}

export const emailCount = (g: Graph) => g.nodes.filter(n => n.kind === 'email').length;

/** "3h ago" / "in 4h". */
export function relTime(iso: string | null, future = false) {
  if (!iso) return '';
  const diff = Math.abs(Date.parse(iso) - Date.now()) / 1000;
  const v = diff < 60 ? 'now' : diff < 3600 ? Math.round(diff / 60) + 'm' : diff < 86400 ? Math.round(diff / 3600) + 'h' : Math.round(diff / 86400) + 'd';
  if (v === 'now') return 'just now';
  return future ? 'in ' + v : v + ' ago';
}

export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—');
