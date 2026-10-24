import { useCallback, useEffect, useRef, useState } from 'react';
import { CONNECTIONS, makeLiveLog, type LiveLog, type LogFilter, type ProvMode, type StrategyKey } from './data';
import type { ToastData, ToastKind } from './ui';

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
  alertTg: Record<string, boolean>;
  retention: number;
}

const INITIAL: SmtpState = {
  provMode: 'smtp', provQ: '', enabled: {}, testingId: null, strategy: 'weighted', ruleTg: {},
  logFilter: 'all', testRunning: false, testName: '', testDone: false, alertTg: {}, retention: 30,
};

/** All interactive page state lives here so it survives switching tabs, as in the design. */
export function useSmtpState() {
  const [state, setState] = useState(INITIAL);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>();
  const runTimer = useRef<number>();

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(runTimer.current); }, []);

  const update = useCallback((patch: Partial<SmtpState>) => setState(s => ({ ...s, ...patch })), []);

  const showToast = useCallback((kind: ToastKind, title: string, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, title, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleIn = useCallback((field: 'enabled' | 'ruleTg' | 'alertTg', id: string, current: boolean) =>
    setState(s => ({ ...s, [field]: { ...s[field], [id]: !current } })), []);

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
    runTimer.current = window.setTimeout(() => {
      update({ testRunning: false, testDone: true });
      showToast('ok', label + ' passed', 'All checks completed successfully.');
    }, 1100);
  }, [update, showToast]);

  return { state, update, toggleIn, toast, showToast, testProvider, runTest };
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
