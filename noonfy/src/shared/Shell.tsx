import type { ReactNode } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { Toast, type ToastData } from './ui';

/** Page frame shared by Noonfy screens: sidebar, main column and the toast slot. */
export function Shell({ active, toast, children, flush }: { active: string; toast: ToastData | null; children: ReactNode; flush?: boolean }) {
  return (
    <div className="nf-shell">
      <Sidebar active={active} />
      <main className={'nf-main' + (flush ? ' nf-main--flush' : '')}>
        {children}
        {toast && <Toast toast={toast} />}
      </main>
    </div>
  );
}

/** Hash-routed page key, falling back to `fallback` for unknown hashes. */
export function readHash<T extends string>(valid: readonly T[], fallback: T): { page: T; arg: string } {
  const [page, arg = ''] = window.location.hash.slice(1).split(':');
  return { page: (valid as readonly string[]).includes(page) ? (page as T) : fallback, arg };
}
