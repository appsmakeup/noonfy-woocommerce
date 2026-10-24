import apiFetch from '@wordpress/api-fetch';
import type { Campaign, CampaignSettings, Draft, Overview, Product } from './types';

const base = '/noonfy/v1/campaigns';
const post = <T,>(path: string, data?: unknown, method = 'POST') => apiFetch<T>({ path: base + path, method, data });
const payload = (d: Draft) => ({ name: d.name, subject: d.subject, preheader: d.preheader, emoji: d.emoji, segment: d.segment, content: d.content, ab: d.ab });

export const campaignsApi = {
  overview: () => apiFetch<Overview>({ path: base }),
  save: (d: Draft) => (d.id ? post<Campaign>(`/${d.id}`, payload(d)) : post<Campaign>('', payload(d))),
  remove: (id: number) => post<{ deleted: boolean }>(`/${id}`, undefined, 'DELETE'),
  duplicate: (id: number) => post<Campaign>(`/${id}/duplicate`),
  send: (id: number, scheduledAt: string | null) => post<Campaign>(`/${id}/send`, scheduledAt ? { scheduledAt } : {}),
  action: (id: number, action: 'pause' | 'resume' | 'cancel') => post<Campaign>(`/${id}/${action}`),
  winner: (id: number, variant?: 'A' | 'B') => post<Campaign>(`/${id}/winner`, variant ? { variant } : {}),
  preview: (d: Draft, variant: 'A' | 'B' = 'A') => post<{ html: string }>('/preview', { ...payload(d), variant }),
  test: (d: Draft, to: string, variant: 'A' | 'B' = 'A') => post<{ to: string }>('/test', { ...payload(d), to, variant }),
  products: (q: { search?: string; ids?: number[] }) =>
    apiFetch<Product[]>({ path: `${base}/products?` + new URLSearchParams(q.ids ? { ids: q.ids.join(',') } : { search: q.search ?? '' }) }),
  saveSettings: (s: Partial<CampaignSettings>) => post<Overview & { settings: CampaignSettings }>('/settings', s),
  sync: (page: number, subscribe: boolean, consent: boolean) =>
    post<{ processed: number; done: boolean; nextPage: number } & Partial<Overview>>('/contacts/sync', { page, subscribe, consent }),
};
