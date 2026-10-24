import apiFetch from '@wordpress/api-fetch';
import { config, type Connection, type ConnectionInput, type LogRow, type LogStatus, type PersistedSettings, type Stats, type TestResult } from './config';

const path = (p: string) => `/${config.restPath}${p}`;
const post = <T,>(p: string, data?: unknown, method = 'POST') => apiFetch<T>({ path: path(p), method, data });

export const errorMessage = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Request failed.';

export const api = {
  saveSettings: (patch: Partial<PersistedSettings>) => post<PersistedSettings>('/settings', patch),
  createConnection: (input: ConnectionInput) => post<Connection>('/connections', input),
  updateConnection: (id: string, input: Partial<ConnectionInput>) => post<Connection>(`/connections/${id}`, input),
  deleteConnection: (id: string) => post<{ deleted: boolean }>(`/connections/${id}`, undefined, 'DELETE'),
  testConnection: (id: string) => post<TestResult>(`/connections/${id}/test`),
  testConfig: (input: ConnectionInput & { id?: string }) => post<TestResult>('/connections/test', input),
  sendTestEmail: (connectionId?: string) => post<{ to: string; via: string }>('/test-email', connectionId ? { connectionId } : {}),
  stats: () => apiFetch<Stats>({ path: path('/stats') }),
  logs: (q: { status?: LogStatus | ''; connectionId?: string; search?: string; before?: number; after?: number; limit?: number }) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== 0) params.set(k, String(v)); });
    return apiFetch<{ rows: LogRow[]; total: number }>({ path: path('/logs') + (params.toString() ? '?' + params : '') });
  },
};
