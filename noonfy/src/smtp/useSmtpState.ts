import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api';
import { config, type Connection, type ConnectionInput, type LogRow, type PersistedSettings, type Stats } from '../config';
import type { StrategyKey } from './data';
import type { ToastData, ToastKind } from './ui';

export interface ToolResult { ok: boolean; text: string }
export type ConnFilter = 'all' | 'enabled' | 'disabled';
export type LogFilter = 'all' | 'SENT' | 'FAILED' | 'RETRY';

export interface SmtpState {
  connections: Connection[];
  stats: Stats;
  connFilter: ConnFilter;
  connQuery: string;
  testingId: string | null;
  strategy: StrategyKey;
  logFilter: LogFilter;
  logConnection: string;
  toolRunning: string;
  toolResults: ToolResult[];
  retention: number;
  fromName: string;
  fromEmail: string;
  forceFrom: boolean;
  sendingTest: boolean;
  /** Connection form: null = closed, id '' = new, otherwise the connection being edited. */
  editing: { id: string; preset?: string } | null;
}

const s0 = config.settings;
const INITIAL: SmtpState = {
  connections: config.connections, stats: config.stats, connFilter: 'all', connQuery: '', testingId: null,
  strategy: s0.strategy, logFilter: 'all', logConnection: '', toolRunning: '', toolResults: [],
  retention: s0.retention, fromName: s0.fromName, fromEmail: s0.fromEmail, forceFrom: s0.forceFrom, sendingTest: false,
  editing: null,
};

const byPriority = (a: Connection, b: Connection) => a.priority - b.priority || a.createdAt - b.createdAt;

/** Page-level state and actions; lives above the tabs so it survives tab switches. */
export function useSmtpState() {
  const [state, setState] = useState(INITIAL);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>();
  const retentionTimer = useRef<number>();
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(retentionTimer.current); }, []);

  const update = useCallback((patch: Partial<SmtpState>) => setState(s => ({ ...s, ...patch })), []);

  const showToast = useCallback((kind: ToastKind, title: string, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, title, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  /** Shows the error as a toast and re-throws so callers (e.g. the connection form) can stay open. */
  const fail = useCallback((title: string) => (e: unknown): never => { showToast('warn', title, errorMessage(e)); throw e; }, [showToast]);

  // ----- settings -----
  const saveSettings = useCallback((patch: Partial<PersistedSettings>) =>
    api.saveSettings(patch).catch(e => showToast('warn', 'Couldn’t save settings', errorMessage(e))), [showToast]);

  const setStrategy = useCallback((strategy: StrategyKey) => { update({ strategy }); saveSettings({ strategy }); }, [update, saveSettings]);

  // Retention saves once the slider stops moving.
  const setRetention = useCallback((retention: number) => {
    update({ retention });
    clearTimeout(retentionTimer.current);
    retentionTimer.current = window.setTimeout(() => saveSettings({ retention }), 500);
  }, [update, saveSettings]);

  /** Sender fields save on blur, and only when changed; a rejected value is re-sent after it's edited. */
  const savedDefaults = useRef(JSON.stringify({ fromName: s0.fromName, fromEmail: s0.fromEmail, forceFrom: s0.forceFrom }));
  const saveDefaults = useCallback(() => {
    const { fromName, fromEmail, forceFrom } = latest.current;
    const next = JSON.stringify({ fromName, fromEmail, forceFrom });
    if (next === savedDefaults.current) return;
    api.saveSettings({ fromName, fromEmail, forceFrom })
      .then(() => { savedDefaults.current = next; })
      .catch(e => showToast('warn', 'Couldn’t save settings', errorMessage(e)));
  }, [showToast]);

  // ----- stats -----
  const refreshStats = useCallback(() => { api.stats().then(stats => update({ stats })).catch(() => undefined); }, [update]);

  // ----- connections -----
  const replaceConnection = useCallback((c: Connection) =>
    setState(s => ({ ...s, connections: [...s.connections.filter(x => x.id !== c.id), c].sort(byPriority) })), []);

  const saveConnection = useCallback((id: string, input: ConnectionInput) =>
    (id ? api.updateConnection(id, input) : api.createConnection(input))
      .then(c => { replaceConnection(c); showToast('ok', id ? 'Connection saved' : 'Connection added', c.name); return c; })
      .catch(fail('Couldn’t save connection')), [replaceConnection, showToast, fail]);

  const toggleConnection = useCallback((c: Connection) => {
    replaceConnection({ ...c, enabled: !c.enabled });
    api.updateConnection(c.id, { enabled: !c.enabled }).then(replaceConnection)
      .catch(e => { replaceConnection(c); showToast('warn', 'Couldn’t update connection', errorMessage(e)); });
  }, [replaceConnection, showToast]);

  const deleteConnection = useCallback((c: Connection) =>
    api.deleteConnection(c.id)
      .then(() => {
        setState(s => ({ ...s, connections: s.connections.filter(x => x.id !== c.id), editing: null }));
        showToast('ok', 'Connection deleted', c.name);
      })
      .catch(fail('Couldn’t delete connection')), [showToast, fail]);

  const testConnection = useCallback((c: Connection) => {
    update({ testingId: c.id });
    api.testConnection(c.id)
      .then(r => {
        replaceConnection({ ...c, lastTest: { at: Date.now() / 1000, ...r } });
        if (r.ok) showToast('ok', c.name + ' reachable', `Connected and authenticated in ${r.latencyMs}ms.`);
        else showToast('warn', c.name + ' failed', r.error ?? 'Connection failed.');
      })
      .catch(e => showToast('warn', 'Test failed', errorMessage(e)))
      .finally(() => update({ testingId: null }));
  }, [update, replaceConnection, showToast]);

  // ----- test email -----
  const sendTestEmail = useCallback((connectionId?: string) => {
    update({ sendingTest: true });
    api.sendTestEmail(connectionId)
      .then(r => showToast('ok', 'Test email sent', `Accepted for ${r.to} via ${r.via}.`))
      .catch(e => showToast('warn', 'Test email failed', errorMessage(e)))
      .finally(() => { update({ sendingTest: false }); refreshStats(); });
  }, [update, showToast, refreshStats]);

  // ----- monitoring tools -----
  const runTool = useCallback(async (key: string, label: string) => {
    update({ toolRunning: label, toolResults: [] });
    try {
      if (key === 'email') {
        const r = await api.sendTestEmail();
        update({ toolResults: [{ ok: true, text: `Accepted for ${r.to} via ${r.via}` }] });
      } else if (key === 'smtp') {
        const enabled = latest.current.connections.filter(c => c.enabled);
        if (!enabled.length) {
          update({ toolResults: [{ ok: false, text: 'No enabled connections: WordPress is sending with PHP mail().' }] });
        } else {
          const results = await Promise.all(enabled.map(c => api.testConnection(c.id).then(r => ({ c, r }))));
          results.forEach(({ c, r }) => replaceConnection({ ...c, lastTest: { at: Date.now() / 1000, ...r } }));
          update({ toolResults: results.map(({ c, r }) => ({ ok: r.ok, text: r.ok ? `${c.name}: connected in ${r.latencyMs}ms` : `${c.name}: ${r.error}` })) });
        }
      }
    } catch (e) {
      update({ toolResults: [{ ok: false, text: errorMessage(e) }] });
    } finally {
      update({ toolRunning: '' });
      refreshStats();
    }
  }, [update, replaceConnection, refreshStats]);

  return {
    state, update, toast, showToast,
    setStrategy, setRetention, saveDefaults, refreshStats,
    saveConnection, toggleConnection, deleteConnection, testConnection, sendTestEmail, runTool,
  };
}

export type SmtpApi = ReturnType<typeof useSmtpState>;

/** Dashboard live feed: newest log rows, polled every 5s while `active`; stats refresh on new rows and every 30s. */
export function useLiveLogs(active: boolean, onStats: () => void) {
  const [logs, setLogs] = useState<LogRow[]>(config.recentLogs);
  const newest = useRef(config.recentLogs[0]?.id ?? 0);
  useEffect(() => {
    if (!active) return;
    let ticks = 0;
    const iv = window.setInterval(() => {
      api.logs({ after: newest.current, limit: 10 }).then(({ rows }) => {
        if (!rows.length) return;
        newest.current = rows[0].id;
        setLogs(prev => [...rows, ...prev].slice(0, 10));
        onStats();
      }).catch(() => undefined);
      if (++ticks % 6 === 0) onStats();
    }, 5000);
    return () => clearInterval(iv);
  }, [active, onStats]);
  return logs;
}
