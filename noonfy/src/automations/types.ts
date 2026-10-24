// Automation data shapes (mirrors includes/automations/*.php).
import type { CampaignSettings, Content, Segment } from '../campaigns/types';

export type WorkflowStatus = 'draft' | 'live' | 'paused';
export type Kind = 'trigger' | 'delay' | 'email' | 'condition' | 'wait' | 'split' | 'goal' | 'exit';
export type TriggerType = 'subscribed' | 'order_paid' | 'order_completed' | 'no_order' | 'lifetime_spend' | 'cart_abandoned' | 'browse_abandoned' | 'segment';
export type Unit = 'minutes' | 'hours' | 'days';
export type Check = 'opened' | 'clicked' | 'ordered' | 'spent' | 'orders' | 'subscribed';

export interface TriggerSettings {
  type: TriggerType; firstOrder: boolean; minTotal: number; days: number; amount: number;
  minutes: number; hours: number; segment: string; reentry: boolean;
}
export interface EmailSettings { subject: string; preheader: string; content: Content }

/** Settings per kind (Noonfy_Workflows::sanitize_settings). */
export interface NodeSettings extends Partial<TriggerSettings>, Partial<EmailSettings> {
  amount?: number; unit?: Unit;          // delay, wait (timeout)
  check?: Check; value?: number;         // condition
  event?: 'ordered' | 'opened' | 'clicked'; // wait
  pct?: number;                          // split
}

export interface FlowNode { id: string; kind: Kind; name: string; x: number; y: number; settings: NodeSettings }
export interface Edge { from: string; to: string; port: string }
export interface Graph { nodes: FlowNode[]; edges: Edge[] }

export interface WorkflowStats {
  enrolled: number; active: number; completed: number; exited: number; converted: number;
  sent: number; opens: number; clicks: number; orders: number; revenue: number;
}

export interface Workflow {
  id: number; name: string; emoji: string; status: WorkflowStatus; trigger: TriggerType | ''; template: string;
  graph: Graph; activatedAt: string | null; createdAt: string; updatedAt: string; stats: WorkflowStats;
}

export interface EmailNodeStats { sent: number; failed: number; opens: number; clicks: number; orders: number; revenue: number }
export interface NodeStats {
  events: Record<string, Record<string, number>>;
  emails: Record<string, EmailNodeStats>;
  waiting: Record<string, number>;
}
export interface EnrolledContact {
  id: number; name: string; email: string; status: 'active' | 'completed' | 'exited'; nodeId: string; lastEmail: string;
  nextRunAt: string | null; enteredAt: string; updatedAt: string; converted: boolean; exitReason: string;
}
export interface WorkflowDetail extends Workflow { nodeStats: NodeStats; contacts: EnrolledContact[] }

export interface AutomationSettings { cartCapture: boolean; cartNotice: string; browseTracking: boolean }

export interface Overview { workflows: Workflow[]; segments: Segment[]; settings: AutomationSettings; smtpReady: boolean }

export interface Template {
  id: string; name: string; cat: string; glyph: string; tint: string; desc: string; popular: boolean;
  available: boolean; emails: number; graph: Graph | null;
}

export interface Journey {
  id: number; name: string; emoji: string; status: WorkflowStatus; entered: number; completed: number; converted: number; active: number;
  emails: { nodeId: string; name: string; sent: number }[];
  /** Left without converting, by index of the last email received (-1 = before the first). */
  dropoffs: Record<string, number>;
}

export interface AutomationsConfig extends Overview {
  emojis: string[];
  currency: { symbol: string; position: string; decimals: number };
  timezone: string;
  campaignSettings: CampaignSettings;
}

declare global {
  interface Window { noonfyAutomations?: AutomationsConfig }
}

export const automationsConfig: AutomationsConfig = window.noonfyAutomations ?? {
  workflows: [], segments: [], settings: { cartCapture: true, cartNotice: '', browseTracking: true }, smtpReady: false,
  emojis: ['⚡'], currency: { symbol: '$', position: 'left', decimals: 2 }, timezone: 'UTC',
  campaignSettings: { audienceMode: 'optin', checkoutOptin: true, optinLabel: '', companyAddress: '', batchSize: 50 },
};
