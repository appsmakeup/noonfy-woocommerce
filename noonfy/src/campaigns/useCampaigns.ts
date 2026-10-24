import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api';
import type { ToastData, ToastKind } from '../shared/ui';
import { campaignsApi } from './api';
import { campaignsConfig, type Campaign, type CampaignSettings, type Overview } from './types';

/** Campaign list, audience and settings state for the Campaigns screen, with live polling while sending. */
export function useCampaigns() {
  const [overview, setOverview] = useState<Overview>(() => ({
    campaigns: campaignsConfig.campaigns, segments: campaignsConfig.segments, summary: campaignsConfig.summary, smtpReady: campaignsConfig.smtpReady,
  }));
  const [settings, setSettings] = useState<CampaignSettings>(campaignsConfig.settings);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>();

  const showToast = useCallback((kind: ToastKind, title: string, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, title, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = useCallback(() => campaignsApi.overview().then(setOverview).catch(() => undefined), []);

  /** Puts a changed campaign into the list without a full reload. */
  const upsertCampaign = useCallback((c: Campaign) => setOverview(o => ({
    ...o, campaigns: [c, ...o.campaigns.filter(x => x.id !== c.id)],
  })), []);

  const removeCampaign = useCallback((id: number) => setOverview(o => ({ ...o, campaigns: o.campaigns.filter(x => x.id !== id) })), []);

  const saveSettings = useCallback((patch: Partial<CampaignSettings>) =>
    campaignsApi.saveSettings(patch).then(r => {
      const { settings: next, ...rest } = r;
      setSettings(next);
      setOverview(rest);
      return next;
    }).catch(e => { showToast('warn', 'Couldn’t save settings', errorMessage(e)); throw e; }), [showToast]);

  // Poll while anything is sending or due to start; the list request also nudges the sender server-side.
  const active = overview.campaigns.some(c => c.status === 'sending' || (c.status === 'scheduled' && c.scheduledAt && Date.parse(c.scheduledAt) <= Date.now() + 60000));
  useEffect(() => {
    if (!active) return;
    const iv = window.setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [active, refresh]);

  return { overview, setOverview, settings, toast, showToast, refresh, upsertCampaign, removeCampaign, saveSettings };
}

export type CampaignsApi = ReturnType<typeof useCampaigns>;

/** Money in the store's currency format. */
export function money(n: number) {
  const { symbol, position, decimals } = campaignsConfig.currency;
  const v = n.toLocaleString(undefined, { minimumFractionDigits: n >= 1000 ? 0 : decimals, maximumFractionDigits: n >= 1000 ? 0 : decimals });
  return position === 'right' ? v + symbol : position === 'right_space' ? v + ' ' + symbol : position === 'left_space' ? symbol + ' ' + v : symbol + v;
}

/** `part` as a percentage of `whole`, or '—'. */
export const pct = (part: number, whole: number) => (whole ? (Math.round((part / whole) * 1000) / 10).toString() + '%' : '—');
