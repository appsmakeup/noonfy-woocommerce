// Mock data for the SMTP & Email Delivery page, transcribed from the Claude Design prototype.
// Swap these exports for API calls when a backend exists — components only read from here.

export const PAGES = ['dashboard', 'providers', 'routing', 'queue', 'domains', 'deliverability', 'suppressions', 'tools'] as const;
export type PageKey = (typeof PAGES)[number];

export const PAGE_TITLES: Record<PageKey, [title: string, sub: string]> = {
  dashboard: ['SMTP & Email Delivery', 'Multi-provider sending, routing and deliverability'],
  providers: ['Connections', 'SMTP servers and email API providers'],
  routing: ['Smart Routing', 'Rotation strategy, rules and failover'],
  queue: ['Email Queue & Logs', 'Every message, every state'],
  domains: ['Domains & Authentication', 'SPF, DKIM, DMARC, BIMI and warmup'],
  deliverability: ['Deliverability Center', 'Inbox placement, reputation and blacklists'],
  suppressions: ['Bounces & Suppressions', 'Bounce handling and excluded addresses'],
  tools: ['Monitoring & Tools', 'Health checks, alerts, tests and defaults'],
};

export const TABS: { label: string; key: PageKey }[] = [
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'Connections', key: 'providers' },
  { label: 'Routing', key: 'routing' },
  { label: 'Queue & Logs', key: 'queue' },
  { label: 'Domains', key: 'domains' },
  { label: 'Deliverability', key: 'deliverability' },
  { label: 'Suppressions', key: 'suppressions' },
  { label: 'Monitoring', key: 'tools' },
];

/** Sidebar item key highlighted for each tab. */
export const SIDEBAR_KEY: Record<PageKey, string> = {
  dashboard: 'smtpdash', providers: 'smtpconn', routing: 'smtprouting', queue: 'smtpqueue',
  domains: 'smtpdomains', deliverability: 'smtpdeliver', suppressions: 'smtpsuppress', tools: 'smtptools',
};

export const C = {
  ink: '#14152A', muted: '#8A8DA3', brand: '#4F46E5', purple: '#7C3AED',
  green: '#0E9F6E', greenSoft: '#EDF9F1', orange: '#C2620A', orangeSoft: '#FFF3E8',
  red: '#E02424', redSoft: '#FDEDED', brandSoft: '#EEF0FE', purpleSoft: '#F1EBFE', track: '#F3F3FA',
};

export const healthColor = (h: number) => (h >= 90 ? C.green : h >= 75 ? C.orange : C.red);
export const usageColor = (pct: number) => (pct >= 85 ? C.red : pct >= 60 ? C.orange : C.green);

// ---------- Dashboard ----------
export interface Kpi { label: string; value: string; color: string; delta: string; deltaColor: string }
export const KPIS: Kpi[] = [
  { label: 'PROVIDERS', value: '6', color: C.ink, delta: '6 active', deltaColor: C.green },
  { label: 'SENT TODAY', value: '38,630', color: C.ink, delta: '▲ 12%', deltaColor: C.green },
  { label: 'THIS MONTH', value: '412k', color: C.ink, delta: '▲ 8.4%', deltaColor: C.green },
  { label: 'QUEUED', value: '1,284', color: C.brand, delta: 'draining', deltaColor: C.muted },
  { label: 'DELIVERED', value: '99.2%', color: C.green, delta: '▲ 0.3pt', deltaColor: C.green },
  { label: 'FAILED', value: '0.8%', color: C.orange, delta: '▼ 0.2pt', deltaColor: C.green },
  { label: 'OPEN RATE', value: '38.4%', color: C.ink, delta: '▲ 2.1pt', deltaColor: C.green },
  { label: 'CLICK RATE', value: '4.9%', color: C.ink, delta: '▲ 0.6pt', deltaColor: C.green },
  { label: 'BOUNCE RATE', value: '0.8%', color: C.green, delta: 'healthy', deltaColor: C.green },
  { label: 'SPAM RATE', value: '0.02%', color: C.green, delta: 'below limit', deltaColor: C.green },
  { label: 'AVG DELIVERY', value: '118ms', color: C.ink, delta: 'p95 240ms', deltaColor: C.muted },
  { label: 'DOMAIN REP', value: '94', color: C.green, delta: 'excellent', deltaColor: C.green },
];

export const SHARE = {
  labels: ['Amazon SES', 'Postmark', 'Mailgun', 'Brevo', 'Other'],
  data: [48, 22, 16, 9, 5],
  colors: ['#4F46E5', '#8B5CF6', '#C4B5FD', '#E0D7FE', '#EFEFF7'],
};
/** The legend lists the first four slices only ("Other" is omitted), as in the design. */
export const SHARE_LEGEND = SHARE.labels.slice(0, 4).map((label, i) => ({ label, value: SHARE.data[i] + '%', color: SHARE.colors[i] }));

export interface LiveLog { id: number; time: string; status: string; color: string; to: string; provider: string }
let liveLogId = 0;
export function makeLiveLog(): LiveLog {
  const names = ['maya.okafor', 'j.lindqvist', 'priya.raman', 't.becker', 'a.fontaine', 's.ricci', 'd.chen', 'h.suzuki'];
  const doms = ['gmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'gmx.de', 'libero.it'];
  const provs = ['ses-1', 'postmark', 'mailgun', 'brevo'];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const r = Math.random();
  const [status, color] = r < 0.82 ? ['SENT', '#34D399'] : r < 0.92 ? ['QUEUED', '#FBBF24'] : r < 0.97 ? ['RETRY', '#F87171'] : ['BOUNCE', '#EF4444'];
  return {
    id: ++liveLogId,
    time: new Date().toLocaleTimeString([], { hour12: false }),
    status, color,
    to: pick(names) + '@' + pick(doms),
    provider: pick(provs),
  };
}

// ---------- Connections ----------
export interface Connection {
  id: string; name: string; host: string; mark: string; tint: string; fg: string;
  priority: number; weight: number; today: string; latency: string; health: number;
  used: number; limit: number; api: boolean;
}
export const CONNECTIONS: Connection[] = [
  { id: 'ses', name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', mark: 'SES', tint: '#FFF3E8', fg: '#C2620A', priority: 1, weight: 48, today: '18,420', latency: '112ms', health: 99, used: 198420, limit: 250000, api: false },
  { id: 'postmark', name: 'Postmark', host: 'smtp.postmarkapp.com', mark: 'PM', tint: '#FDF3D7', fg: '#B45309', priority: 2, weight: 22, today: '8,640', latency: '86ms', health: 98, used: 88640, limit: 150000, api: false },
  { id: 'mailgun', name: 'Mailgun API', host: 'api.mailgun.net/v3', mark: 'MG', tint: '#FDEDED', fg: '#E02424', priority: 3, weight: 16, today: '6,210', latency: '148ms', health: 94, used: 66210, limit: 100000, api: true },
  { id: 'brevo', name: 'Brevo API', host: 'api.brevo.com/v3', mark: 'BR', tint: '#EDF9F1', fg: '#0E9F6E', priority: 4, weight: 9, today: '3,480', latency: '164ms', health: 92, used: 43480, limit: 80000, api: true },
  { id: 'sendgrid', name: 'SendGrid API', host: 'api.sendgrid.com/v3', mark: 'SG', tint: '#EEF0FE', fg: '#4F46E5', priority: 5, weight: 3, today: '1,240', latency: '196ms', health: 88, used: 21240, limit: 60000, api: true },
  { id: 'gsuite', name: 'Google Workspace', host: 'smtp.gmail.com', mark: 'GW', tint: '#F1EBFE', fg: '#7C3AED', priority: 6, weight: 2, today: '640', latency: '242ms', health: 76, used: 1640, limit: 2000, api: false },
];

export type ProvMode = 'smtp' | 'api' | 'all';
export const PROV_MODES: { label: string; key: ProvMode }[] = [
  { label: 'SMTP servers', key: 'smtp' }, { label: 'Email APIs', key: 'api' }, { label: 'All', key: 'all' },
];

export const CATALOG = ['Generic SMTP', 'Amazon SES', 'Mailgun', 'Brevo', 'Postmark', 'SparkPost', 'SMTP2GO', 'Elastic Email', 'SocketLabs', 'TurboSMTP', 'Mailjet', 'Mailtrap', 'MailerSend', 'Resend', 'Maileroo', 'Scaleway', 'Google Workspace', 'Microsoft 365', 'Zoho Mail', 'Yandex', 'Cloudflare Routing', 'SendGrid', 'ZeptoMail', 'Mandrill', 'MailPace', 'Courier', 'Azure ACS', 'Gmail API', 'Graph Mail API', 'Custom REST API', 'Sendmail', 'PHP Mail'];
export const CATALOG_CONNECTED = new Set(['Amazon SES', 'Postmark', 'Mailgun', 'Brevo', 'SendGrid', 'Google Workspace']);

// ---------- Routing ----------
export const STRATEGIES = [
  { key: 'weighted', name: 'Weighted', detail: 'Distribute by weight %', glyph: '⚖️' },
  { key: 'roundrobin', name: 'Round robin', detail: 'Even, sequential rotation', glyph: '🔄' },
  { key: 'priority', name: 'Priority', detail: 'Highest priority first', glyph: '🥇' },
  { key: 'leastused', name: 'Least used', detail: 'Balance remaining quota', glyph: '📉' },
  { key: 'fastest', name: 'Fastest provider', detail: 'Lowest observed latency', glyph: '⚡' },
  { key: 'cost', name: 'Lowest cost', detail: 'Cheapest per thousand', glyph: '💰' },
  { key: 'deliverability', name: 'Best deliverability', detail: 'Highest inbox placement', glyph: '📬' },
  { key: 'health', name: 'Health based', detail: 'Skip degraded providers', glyph: '🩺' },
] as const;
export type StrategyKey = (typeof STRATEGIES)[number]['key'];

export const SPLIT_BASE: Record<StrategyKey, number[]> = {
  weighted: [48, 22, 16, 9, 5], roundrobin: [20, 20, 20, 20, 20], priority: [70, 18, 8, 3, 1], leastused: [26, 24, 22, 16, 12],
  fastest: [30, 44, 14, 8, 4], cost: [62, 8, 18, 10, 2], deliverability: [34, 40, 14, 8, 4], health: [40, 26, 18, 10, 6],
};
export const SPLIT_NAMES = ['Amazon SES', 'Postmark', 'Mailgun', 'Brevo', 'SendGrid'];
export const SPLIT_COLORS = SHARE.colors;

export const RULES = [
  { id: 'r1', condition: 'Transactional (order, receipt, password)', action: 'Postmark · priority route', on: true },
  { id: 'r2', condition: 'Bulk campaigns over 10,000 recipients', action: 'Amazon SES · batched', on: true },
  { id: 'r3', condition: 'Recipient domain is gmail.com', action: 'Amazon SES · warmed IP pool', on: true },
  { id: 'r4', condition: 'Recipient country in EU', action: 'Brevo · EU region', on: true },
  { id: 'r5', condition: 'Primary fails twice within 60s', action: 'Failover to Mailgun', on: true },
];

export const FAILOVER = [
  { tag: 'PRIMARY', name: 'Amazon SES', tagColor: C.green, tagBg: C.greenSoft, border: '#BEE9D2', bg: '#F7FCF9' },
  { tag: 'SECONDARY', name: 'Postmark', tagColor: C.brand, tagBg: C.brandSoft, border: '#ECEDF4', bg: '#fff' },
  { tag: 'FAILOVER', name: 'Mailgun', tagColor: C.orange, tagBg: C.orangeSoft, border: '#ECEDF4', bg: '#fff' },
];

// ---------- Queue & logs ----------
export const QUEUE_STATS = [
  { label: 'QUEUED', value: '1,284', color: '#6366F1' }, { label: 'SENDING', value: '214', color: '#8B5CF6' },
  { label: 'WAITING', value: '96', color: '#C4B5FD' }, { label: 'RETRY', value: '38', color: '#FBBF24' },
  { label: 'DELIVERED', value: '38,630', color: '#34D399' }, { label: 'FAILED', value: '112', color: '#F87171' },
  { label: 'PAUSED', value: '0', color: '#94A3B8' },
];

export type LogStatus = 'DELIVERED' | 'SENT' | 'QUEUED' | 'FAILED' | 'BOUNCED' | 'OPENED';
export const LOG_STATUS_COLORS: Record<LogStatus, [fg: string, bg: string]> = {
  DELIVERED: [C.green, C.greenSoft], SENT: [C.brand, C.brandSoft], QUEUED: [C.orange, C.orangeSoft],
  FAILED: [C.red, C.redSoft], BOUNCED: [C.red, C.redSoft], OPENED: [C.purple, C.purpleSoft],
};
export interface EmailLog { to: string; subject: string; provider: string; status: LogStatus; time: string; latency: string }
export const EMAIL_LOGS: EmailLog[] = [
  { to: 'maya.okafor@gmail.com', subject: 'Your order #28471 is confirmed', provider: 'Postmark', status: 'DELIVERED', time: '09:41', latency: '86ms' },
  { to: 'j.lindqvist@proton.me', subject: 'The Summer Linen Drop is here ☀️', provider: 'Amazon SES', status: 'OPENED', time: '09:38', latency: '112ms' },
  { to: 'priya.raman@gmail.com', subject: 'Welcome to Bruma Home', provider: 'Postmark', status: 'DELIVERED', time: '09:34', latency: '92ms' },
  { to: 't.becker@gmx.de', subject: 'You left something behind', provider: 'Amazon SES', status: 'QUEUED', time: '09:33', latency: '—' },
  { to: 'old.addr@gmx.de', subject: 'Back in stock: Linen Duvet', provider: 'Mailgun', status: 'BOUNCED', time: '09:31', latency: '148ms' },
  { to: 's.ricci@libero.it', subject: 'Your VIP early access starts now', provider: 'Brevo', status: 'DELIVERED', time: '09:28', latency: '164ms' },
  { to: 'd.chen@outlook.com', subject: 'Order shipped — tracking inside', provider: 'Postmark', status: 'OPENED', time: '09:24', latency: '88ms' },
  { to: 'h.suzuki@icloud.com', subject: 'Flash sale: 25% off everything', provider: 'Amazon SES', status: 'SENT', time: '09:21', latency: '118ms' },
  { to: 'noreply@invalid.tld', subject: 'Password reset request', provider: 'Postmark', status: 'FAILED', time: '09:18', latency: '—' },
  { to: 'a.fontaine@orange.fr', subject: 'We miss you — 20% off', provider: 'Brevo', status: 'DELIVERED', time: '09:14', latency: '158ms' },
];

export type LogFilter = 'all' | 'delivered' | 'queued' | 'opened' | 'failed';
export const LOG_FILTERS: { label: string; key: LogFilter; match: (s: LogStatus) => boolean }[] = [
  { label: 'All', key: 'all', match: () => true },
  { label: 'Delivered', key: 'delivered', match: s => s === 'DELIVERED' || s === 'OPENED' },
  { label: 'Queued', key: 'queued', match: s => s === 'QUEUED' },
  { label: 'Opened', key: 'opened', match: s => s === 'OPENED' },
  { label: 'Failed', key: 'failed', match: s => s === 'FAILED' || s === 'BOUNCED' },
];

// ---------- Domains ----------
export type CheckState = 'ok' | 'wait' | 'off';
export const CHECK_STYLE: Record<CheckState, { icon: string; color: string; bg: string; border: string }> = {
  ok: { icon: '✓', color: C.green, bg: C.greenSoft, border: '#C4E9D3' },
  wait: { icon: '…', color: C.orange, bg: C.orangeSoft, border: '#F8DFC5' },
  off: { icon: '—', color: C.muted, bg: C.track, border: '#ECEDF4' },
};
const checks = (states: CheckState[]) => ['SPF', 'DKIM', 'DMARC', 'BIMI', 'MX', 'SSL'].map((label, i) => ({ label, state: states[i] }));
export const DOMAINS = [
  { name: 'mail.brumahome.com', status: 'VERIFIED', stColor: C.green, stBg: C.greenSoft, rep: '94', checks: checks(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']) },
  { name: 'send.brumahome.com', status: 'VERIFIED', stColor: C.green, stBg: C.greenSoft, rep: '91', checks: checks(['ok', 'ok', 'ok', 'off', 'ok', 'ok']) },
  { name: 'news.brumahome.com', status: 'PENDING', stColor: C.orange, stBg: C.orangeSoft, rep: '—', checks: checks(['ok', 'wait', 'wait', 'off', 'ok', 'ok']) },
];
export const DNS_RECORDS = [
  { type: 'TXT', host: '@', value: 'v=spf1 include:amazonses.com ~all', ok: true },
  { type: 'CNAME', host: 'noonfy1._domainkey', value: 'noonfy1.dkim.brumahome.com', ok: true },
  { type: 'TXT', host: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@…', ok: true },
  { type: 'CNAME', host: 'bounce', value: 'feedback-smtp.us-east-1.amazonses.com', ok: true },
];

// ---------- Deliverability ----------
export const DELIV_CARDS = [
  { glyph: '📬', label: 'INBOX PLACEMENT', value: '96.4%', color: C.green, note: 'primary inbox' },
  { glyph: '🛡️', label: 'SPAM SCORE', value: '0.4 / 10', color: C.green, note: 'low risk' },
  { glyph: '🔥', label: 'DOMAIN REPUTATION', value: '94', color: C.green, note: 'Google Postmaster' },
  { glyph: '🌐', label: 'IP REPUTATION', value: '97', color: C.green, note: 'dedicated pool' },
  { glyph: '↩️', label: 'BOUNCE RATE', value: '0.8%', color: C.green, note: 'below 2% target' },
  { glyph: '🚩', label: 'COMPLAINT RATE', value: '0.02%', color: C.green, note: 'below 0.1% limit' },
];
export const BLACKLISTS = [
  { name: 'Spamhaus (SBL/XBL)', status: 'CLEAR' }, { name: 'Barracuda', status: 'CLEAR' },
  { name: 'SpamCop', status: 'CLEAR' }, { name: 'SORBS', status: 'CLEAR' }, { name: 'Microsoft SNDS', status: 'GREEN' },
];
export const DELIV_RECS = [
  'Warm news.brumahome.com over 14 days before moving campaign volume — it is a fresh subdomain.',
  'Suppress the 412 addresses with no opens in 180 days to protect sender score.',
  'Route password resets and receipts to Postmark; its transactional reputation is 1.4pt higher.',
  'Gmail placement dips on Tuesday sends — shift bulk to Thursday morning.',
];

// ---------- Suppressions ----------
export const BOUNCE_KPIS = [
  { label: 'HARD BOUNCES', value: '284', color: C.red, note: 'auto-suppressed' },
  { label: 'SOFT BOUNCES', value: '1,120', color: C.orange, note: 'retrying' },
  { label: 'COMPLAINTS', value: '38', color: C.red, note: '0.02% rate' },
  { label: 'SUPPRESSED', value: '4,918', color: C.ink, note: 'total list' },
];
export const SUPPRESSIONS = [
  { label: 'Unsubscribed', count: '2,410', width: '100%', color: C.brand },
  { label: 'Hard bounce', count: '1,284', width: '53%', color: C.red },
  { label: 'Complaints', count: '412', width: '17%', color: C.orange },
  { label: 'Blocked', count: '318', width: '13%', color: C.purple },
  { label: 'Invalid email', count: '284', width: '12%', color: C.muted },
  { label: 'Disposable email', count: '142', width: '6%', color: C.muted },
  { label: 'Role-based', count: '68', width: '3%', color: C.muted },
  { label: 'Manual blacklist', count: '20', width: '1%', color: C.ink },
];
const HARD = { tagColor: C.red, tagBg: C.redSoft };
const SOFT = { tagColor: C.orange, tagBg: C.orangeSoft };
const BLOCK = { tagColor: C.purple, tagBg: C.purpleSoft };
export const BOUNCE_REASONS = [
  { type: 'HARD', reason: 'Mailbox does not exist (550 5.1.1)', count: '148', ...HARD },
  { type: 'HARD', reason: 'Domain not found (550 5.4.4)', count: '86', ...HARD },
  { type: 'SOFT', reason: 'Mailbox full (452 4.2.2)', count: '410', ...SOFT },
  { type: 'SOFT', reason: 'Temporary greylisting (451 4.7.1)', count: '380', ...SOFT },
  { type: 'BLOCK', reason: 'Policy rejection — content flagged', count: '92', ...BLOCK },
  { type: 'BLOCK', reason: 'Rate limited by receiving server', count: '54', ...BLOCK },
];

// ---------- Monitoring & tools ----------
export const TESTS = [
  { label: 'Send test email', glyph: '✉️', detail: 'To any inbox' },
  { label: 'SMTP connection', glyph: '🔌', detail: 'Handshake + auth' },
  { label: 'API credentials', glyph: '🔑', detail: 'Token validity' },
  { label: 'DNS records', glyph: '🌐', detail: 'SPF/DKIM/DMARC' },
  { label: 'Spam score', glyph: '🛡️', detail: 'Content analysis' },
  { label: 'Webhook delivery', glyph: '📡', detail: 'Callback round-trip' },
];
export const TEST_RESULTS = [
  'Connection established · TLS 1.3 · 92ms',
  'Authentication accepted for hello@brumahome.com',
  'Message queued and delivered to primary inbox',
];
export const ALERTS = [
  { id: 'a1', label: 'Provider down', glyph: '🔴', on: true },
  { id: 'a2', label: 'Queue stopped', glyph: '⏸️', on: true },
  { id: 'a3', label: 'High bounce rate', glyph: '↩️', on: true },
  { id: 'a4', label: 'Spam complaints spike', glyph: '🚩', on: true },
  { id: 'a5', label: 'Authentication failure', glyph: '🔐', on: true },
  { id: 'a6', label: 'DNS record failure', glyph: '🌐', on: true },
  { id: 'a7', label: 'Rate limit reached', glyph: '🚦', on: true },
  { id: 'a8', label: 'SSL / domain expiring', glyph: '📅', on: false },
];
export const MONITORS = [
  { label: 'SMTP endpoints', value: '6 / 6', dot: C.green }, { label: 'API endpoints', value: '4 / 4', dot: C.green },
  { label: 'Queue workers', value: '8 active', dot: C.green }, { label: 'Webhooks', value: 'Healthy', dot: C.green },
  { label: 'DNS resolution', value: 'Pass', dot: C.green }, { label: 'SSL certificates', value: '84 days', dot: C.green },
  { label: 'Retry backlog', value: '38', dot: C.orange }, { label: 'Uptime · 90d', value: '99.98%', dot: C.green },
];
