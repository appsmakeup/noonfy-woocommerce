import type { AbConfig, AbMetric, Campaign, Content, VariantStats } from './types';
import { money, pct } from './useCampaigns';

export const METRIC_LABEL: Record<AbMetric, string> = { opens: 'open rate', clicks: 'click rate', revenue: 'revenue per email' };

export function defaultAb(content: Content): AbConfig {
  return {
    enabled: false, type: 'subject', subjectB: '', preheaderB: '', contentB: JSON.parse(JSON.stringify(content)) as Content,
    labelA: 'Version A', labelB: 'Version B', metric: 'opens', testPct: 20, waitHours: 4,
  };
}

/** Metric value per email sent. */
export function rate(v: VariantStats | undefined, metric: AbMetric) {
  if (!v || !v.sent) return 0;
  return metric === 'opens' ? v.opens / v.sent : metric === 'clicks' ? v.clicks / v.sent : v.revenue / v.sent;
}

export const fmtRate = (v: VariantStats | undefined, metric: AbMetric) =>
  !v || !v.sent ? '—' : metric === 'revenue' ? money(v.revenue / v.sent) : pct(metric === 'opens' ? v.opens : v.clicks, v.sent);

/** Normal CDF (Abramowitz–Stegun approximation). */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Confidence (0–100) that the open/click rates of A and B really differ: two-proportion z-test.
 * Null for revenue (not a proportion) or when there's too little data.
 */
export function confidence(a: VariantStats | undefined, b: VariantStats | undefined, metric: AbMetric): number | null {
  if (metric === 'revenue' || !a || !b || a.sent < 2 || b.sent < 2) return null;
  const x1 = metric === 'opens' ? a.opens : a.clicks, x2 = metric === 'opens' ? b.opens : b.clicks;
  const p = (x1 + x2) / (a.sent + b.sent);
  const se = Math.sqrt(p * (1 - p) * (1 / a.sent + 1 / b.sent));
  if (!se) return null;
  const z = Math.abs(x1 / a.sent - x2 / b.sent) / se;
  return Math.round((2 * phi(z) - 1) * 1000) / 10;
}

/** Which variant leads on the campaign's metric right now (A on a tie). */
export function leader(c: Campaign): 'A' | 'B' {
  const v = c.stats.variants ?? {};
  return rate(v.B, c.ab!.metric) > rate(v.A, c.ab!.metric) ? 'B' : 'A';
}

export const variantTitle = (c: Pick<Campaign, 'subject' | 'ab'>, key: 'A' | 'B') =>
  c.ab?.type === 'content' ? (key === 'A' ? c.ab.labelA : c.ab.labelB) : key === 'A' ? c.subject : c.ab?.subjectB ?? '';
