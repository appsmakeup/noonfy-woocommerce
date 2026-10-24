import apiFetch from '@wordpress/api-fetch';
import type { Content } from '../campaigns/types';
import type { AutomationSettings, Graph, Journey, Overview, Template, Workflow, WorkflowDetail } from './types';

const base = '/noonfy/v1/automations';
const post = <T,>(path: string, data?: unknown, method = 'POST') => apiFetch<T>({ path: base + path, method, data });

export const automationsApi = {
  overview: () => apiFetch<Overview>({ path: base }),
  show: (id: number) => apiFetch<WorkflowDetail>({ path: `${base}/${id}` }),
  create: (data: { template?: string; name?: string }) => post<Workflow>('', data),
  save: (id: number, data: { name?: string; emoji?: string; graph?: Graph }) => post<Workflow>(`/${id}`, data, 'PUT'),
  remove: (id: number) => post<{ deleted: boolean }>(`/${id}`, undefined, 'DELETE'),
  duplicate: (id: number) => post<Workflow>(`/${id}/duplicate`),
  setLive: (id: number, live: boolean) => post<Workflow>(`/${id}/${live ? 'activate' : 'pause'}`),
  enrol: (id: number) => post<{ enrolled: number }>(`/${id}/enrol`),
  removeContact: (id: number, enrollment: number) => post<{ removed: boolean }>(`/${id}/enrollments/${enrollment}/remove`),
  templates: () => apiFetch<{ categories: string[]; templates: Template[] }>({ path: `${base}/templates` }),
  journeys: () => apiFetch<Journey[]>({ path: `${base}/journeys` }),
  saveSettings: (s: Partial<AutomationSettings>) => post<AutomationSettings>('/settings', s),
  preview: (email: { subject: string; preheader: string; content: Content }) => post<{ html: string }>('/preview', email),
  test: (graph: Graph, to: string, nodeId?: string) => post<{ to: string; sent: number }>('/test', { graph, to, nodeId }),
};
