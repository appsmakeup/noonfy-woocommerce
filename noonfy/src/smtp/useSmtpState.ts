import { useCallback, useEffect, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { config, type PersistedSettings } from '../config';
import { CONNECTIONS, TEST_RESULTS, makeLiveLog, type LiveLog, type LogFilter, type ProvMode, type StrategyKey } from './data';
import type { ToastData, ToastKind } from './ui';

export interface TestResult { ok: boolean; text: string }

export interface SmtpState {
  provMode: ProvMode;
  provQ: string;
  enabled: Record<string, boolean>;
  testingId: string | null;
  strategy: StrategyKey;
  ruleTg: Record<string, boolean>;
  logFilter: LogFilter;
  testRunning: boolean;
  testName: string;
  testDone: boolean;
  testResults: TestResult[];
  alertTg: Record<string, boolean>;
  retention: number;
  fromName: string;
  fromEmail: string;
  sendingTest: boolean;
}

const s0 = config.settings;
const INITIAL: SmtpState = {
  provMode: 'smtp', provQ: '', enabled: s0.enabled, testingId: null, strategy: s0.strategy, ruleTg: s0.rules,
  logFilter: 'all', testRunning: false, testName: '', testDone: false, testResults: [], alertTg: s0.alerts,
  retention: s0.retention, fromName: s0.fromName, fromEmail: s0.fromEmail, sendingTest: false,
};

const errorMessage = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Request failed.');

/** The test-email tool really sends; every other tool is still a simulation (there is no sending engine yet). */
const REAL_TEST = 'Send test email';

/** All interactive page state lives here so it survives switching tabs, as in the design. */
export function useSmtpState() {
  const [state, setState] = useState(INITIAL);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>();
  const runTimer = useRef<number>();
  const saveTimer = useRef<number>();
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(runTimer.current); clearTimeout(saveTimer.current); }, []);

  const update = useCallback((patch: Partial<SmtpState>) => setState(s => ({ ...s, ...patch })), []);

  const showToast = useCallback((kind: ToastKind, title: string, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, title, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const save = useCallback((patch: Partial<PersistedSettings>) =>
    apiFetch({ path: `/${config.restPath}/settings`, method: 'POST', data: patch })
      .catch(e => showToast('warn', 'Couldn’t save settings', errorMessage(e))), [showToast]);

  // Toggles, strategy and retention autosave (debounced) whenever they change.
  const persisted = { enabled: state.enabled, strategy: state.strategy, rules: state.ruleTg, alerts: state.alertTg, retention: state.retention };
  const persistedKey = JSON.stringify(persisted);
  const lastSaved = useRef(persistedKey);
  useEffect(() => {
    if (persistedKey === lastSaved.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { lastSaved.current = persistedKey; save(JSON.parse(persistedKey)); }, 400);
  }, [persistedKey, save]);

  const toggleIn = useCallback((field: 'enabled' | 'ruleTg' | 'alertTg', id: string, current: boolean) =>
    setState(s => ({ ...s, [field]: { ...s[field], [id]: !current } })), []);

  /** Text fields save on blur rather than per keystroke. */
  const savedDefaults = useRef(JSON.stringify({ fromName: s0.fromName, fromEmail: s0.fromEmail }));
  const saveDefaults = useCallback(() => {
    const next = JSON.stringify({ fromName: latest.current.fromName, fromEmail: latest.current.fromEmail });
    if (next === savedDefaults.current) return;
    // Only remember the values once the server accepts them, so a rejected email is re-sent after it is edited.
    apiFetch({ path: `/${config.restPath}/settings`, method: 'POST', data: JSON.parse(next) })
      .then(() => { savedDefaults.current = next; })
      .catch(e => showToast('warn', 'Couldn’t save settings', errorMessage(e)));
  }, [showToast]);

  const requestTestEmail = useCallback(() =>
    apiFetch<{ to: string }>({ path: `/${config.restPath}/test-email`, method: 'POST' }), []);

  const sendTestEmail = useCallback(() => {
    update({ sendingTest: true });
    requestTestEmail()
      .then(r => showToast('ok', 'Test email sent', `wp_mail() accepted the message for ${r.to}.`))
      .catch(e => showToast('warn', 'Test email failed', errorMessage(e)))
      .finally(() => update({ sendingTest: false }));
  }, [update, requestTestEmail, showToast]);

  const testProvider = useCallback((id: string) => {
    const conn = CONNECTIONS.find(c => c.id === id)!;
    update({ testingId: id });
    clearTimeout(runTimer.current);
    runTimer.current = window.setTimeout(() => {
      update({ testingId: null });
      showToast('ok', conn.name + ' reachable', 'Handshake completed in ' + conn.latency + '.');
    }, 900);
  }, [update, showToast]);

  const runTest = useCallback((label: string) => {
    update({ testRunning: true, testName: label, testDone: false });
    clearTimeout(runTimer.current);
    if (label === REAL_TEST) {
      requestTestEmail()
        .then(r => {
          update({ testRunning: false, testDone: true, testResults: [{ ok: true, text: `wp_mail() accepted the message for ${r.to}` }] });
          showToast('ok', label + ' passed', `Check ${r.to} for the message.`);
        })
        .catch(e => {
          update({ testRunning: false, testDone: true, testResults: [{ ok: false, text: errorMessage(e) }] });
          showToast('warn', label + ' failed', errorMessage(e));
        });
      return;
    }
    runTimer.current = window.setTimeout(() => {
      update({ testRunning: false, testDone: true, testResults: TEST_RESULTS.map(text => ({ ok: true, text })) });
      showToast('ok', label + ' passed', 'All checks completed successfully.');
    }, 1100);
  }, [update, requestTestEmail, showToast]);

  return { state, update, toggleIn, saveDefaults, toast, showToast, sendTestEmail, testProvider, runTest };
}

export type SmtpApi = ReturnType<typeof useSmtpState>;

/** Live queue feed: seeded with 9 rows, two new rows every 1.5s while `active`, capped at 10. */
export function useLiveQueue(active: boolean) {
  const [logs, setLogs] = useState<LiveLog[]>(() => Array.from({ length: 9 }, makeLiveLog));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = window.setInterval(() => {
      setLogs(prev => [makeLiveLog(), makeLiveLog(), ...prev].slice(0, 10));
      setTick(t => t + 1);
    }, 1500);
    return () => clearInterval(iv);
  }, [active]);
  return { logs, eps: 214 + (tick % 40) };
}
