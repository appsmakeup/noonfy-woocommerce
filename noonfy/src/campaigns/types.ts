// Campaign data shapes (mirrors includes/campaigns/*.php).

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'cancelled';
export type BlockType = 'header' | 'image' | 'text' | 'products' | 'button' | 'countdown' | 'reviews' | 'coupon' | 'footer';

export interface Block {
  id: string;
  type: BlockType;
  eyebrow?: string; title?: string;          // header
  src?: string; alt?: string; link?: string; // image
  html?: string;                             // text
  productIds?: number[];                     // products
  label?: string; url?: string;              // button
  until?: string;                            // countdown (ISO)
  quote?: string; author?: string; stars?: number; // reviews
  code?: string; note?: string;              // coupon
}

export interface Content { accent: string; blocks: Block[] }

export interface CampaignStats { total: number; sent: number; failed: number; pending: number; opens: number; clicks: number; orders: number; revenue: number }

export interface Campaign {
  id: number; name: string; subject: string; preheader: string; emoji: string; segment: string;
  status: CampaignStatus; content: Content;
  scheduledAt: string | null; startedAt: string | null; finishedAt: string | null; updatedAt: string | null;
  stats: CampaignStats;
}

/** Fields the builder edits (an unsaved campaign has id 0). */
export type Draft = Pick<Campaign, 'id' | 'name' | 'subject' | 'preheader' | 'emoji' | 'segment' | 'content'>;

export interface Segment { id: string; label: string; count: number }
export interface ContactSummary { subscribed: number; customersNotOptedIn: number; unsubscribed: number; total: number }

export interface Overview { campaigns: Campaign[]; segments: Segment[]; summary: ContactSummary; smtpReady: boolean }

export interface CampaignSettings {
  audienceMode: 'optin' | 'all';
  checkoutOptin: boolean;
  optinLabel: string;
  companyAddress: string;
  batchSize: number;
}

export interface Product { id: number; name: string; price: string; image: string; url: string }

export interface CampaignsConfig extends Overview {
  settings: CampaignSettings;
  emojis: string[];
  currency: { symbol: string; position: string; decimals: number };
  timezone: string;
}

declare global {
  interface Window { noonfyCampaigns?: CampaignsConfig }
}

export const campaignsConfig: CampaignsConfig = window.noonfyCampaigns ?? {
  campaigns: [], segments: [], summary: { subscribed: 0, customersNotOptedIn: 0, unsubscribed: 0, total: 0 }, smtpReady: false,
  settings: { audienceMode: 'optin', checkoutOptin: true, optinLabel: '', companyAddress: '', batchSize: 50 },
  emojis: ['✉️'], currency: { symbol: '$', position: 'left', decimals: 2 }, timezone: 'UTC',
};
