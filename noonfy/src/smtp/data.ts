// Static content for the SMTP & Email Delivery screen. Live data (connections, logs, stats) comes from
// the REST API; the sample datasets below back the tabs that are still previews (Domains,
// Deliverability, Suppressions), as transcribed from the Claude Design prototype.

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

/** Catalog entries without an SMTP preset yet (API-only integrations): shown as "coming soon". */
export const CATALOG_SOON = ['Gmail API', 'Graph Mail API', 'Custom REST API', 'Azure ACS', 'Courier', 'MailPace', 'Maileroo', 'Yandex', 'Cloudflare Routing', 'Sendmail'];

// ---------- Routing ----------
export const STRATEGIES = [
  { key: 'weighted', name: 'Weighted', detail: 'Distribute by weight %', glyph: '⚖️' },
  { key: 'roundrobin', name: 'Round robin', detail: 'Even, sequential rotation', glyph: '🔄' },
  { key: 'priority', name: 'Priority', detail: 'Highest priority first', glyph: '🥇' },
  { key: 'leastused', name: 'Least used', detail: 'Most daily quota left', glyph: '📉' },
  { key: 'fastest', name: 'Fastest provider', detail: 'Lowest send time, last 7 days', glyph: '⚡' },
  { key: 'cost', name: 'Lowest cost', detail: 'Uses priority until cost data exists', glyph: '💰' },
  { key: 'deliverability', name: 'Best deliverability', detail: 'Uses priority until inbox data exists', glyph: '📬' },
  { key: 'health', name: 'Health based', detail: 'Highest recent success rate', glyph: '🩺' },
] as const;
export type StrategyKey = (typeof STRATEGIES)[number]['key'];

/** Preview only: conditional routing rules aren't evaluated yet. */
export const RULES = [
  { id: 'r1', condition: 'Transactional (order, receipt, password)', action: 'Postmark · priority route', on: true },
  { id: 'r2', condition: 'Bulk campaigns over 10,000 recipients', action: 'Amazon SES · batched', on: true },
  { id: 'r3', condition: 'Recipient domain is gmail.com', action: 'Amazon SES · warmed IP pool', on: true },
  { id: 'r4', condition: 'Recipient country in EU', action: 'Brevo · EU region', on: true },
  { id: 'r5', condition: 'Primary fails twice within 60s', action: 'Failover to Mailgun', on: true },
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
export type TestKey = 'email' | 'smtp' | 'api' | 'dns' | 'spam' | 'webhook';
/** `live: false` tools aren't built yet and say so instead of faking a result. */
export const TESTS: { key: TestKey; label: string; glyph: string; detail: string; live: boolean }[] = [
  { key: 'email', label: 'Send test email', glyph: '✉️', detail: 'To your inbox', live: true },
  { key: 'smtp', label: 'SMTP connection', glyph: '🔌', detail: 'Handshake + auth', live: true },
  { key: 'api', label: 'API credentials', glyph: '🔑', detail: 'Coming soon', live: false },
  { key: 'dns', label: 'DNS records', glyph: '🌐', detail: 'Coming soon', live: false },
  { key: 'spam', label: 'Spam score', glyph: '🛡️', detail: 'Coming soon', live: false },
  { key: 'webhook', label: 'Webhook delivery', glyph: '📡', detail: 'Coming soon', live: false },
];
/** Preview only: alert delivery isn't built yet. */
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
