import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastData, ToastKind } from '../shared/ui';
import { automationsApi } from './api';
import { automationsConfig, type Overview, type Workflow } from './types';

/** Workflow list and settings for the Automations screen; refreshes while any workflow is live. */
export function useAutomations() {
  const [overview, setOverview] = useState<Overview>(() => ({
    workflows: automationsConfig.workflows, segments: automationsConfig.segments, settings: automationsConfig.settings, smtpReady: automationsConfig.smtpReady,
  }));
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>();

  const showToast = useCallback((kind: ToastKind, title: string, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ kind, title, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = useCallback(() => automationsApi.overview().then(setOverview).catch(() => undefined), []);

  const upsert = useCallback((w: Workflow) => setOverview(o => ({
    ...o, workflows: o.workflows.some(x => x.id === w.id) ? o.workflows.map(x => (x.id === w.id ? w : x)) : [w, ...o.workflows],
  })), []);
  const remove = useCallback((id: number) => setOverview(o => ({ ...o, workflows: o.workflows.filter(x => x.id !== id) })), []);

  // The list request also runs overdue automation work server-side (Noonfy_Automation_Runner::tick).
  const live = overview.workflows.some(w => w.status === 'live');
  useEffect(() => {
    if (!live) return;
    const iv = window.setInterval(refresh, 20000);
    return () => clearInterval(iv);
  }, [live, refresh]);

  return { overview, setOverview, toast, showToast, refresh, upsert, remove };
}

export type AutomationsState = ReturnType<typeof useAutomations>;
