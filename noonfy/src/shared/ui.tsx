import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { config } from '../config';

const TOGGLE_SIZES = {
  lg: { w: 36, h: 20, knob: 14, onLeft: 19 },
  md: { w: 34, h: 19, knob: 13, onLeft: 19 },
  sm: { w: 32, h: 18, knob: 12, onLeft: 17 },
};

export function Toggle({ on, onChange, size = 'md', label, disabled }: { on: boolean; onChange: () => void; size?: keyof typeof TOGGLE_SIZES; label: string; disabled?: boolean }) {
  const s = TOGGLE_SIZES[size];
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="nf-toggle" disabled={disabled}
      style={{ width: s.w, height: s.h, background: on ? '#4F46E5' : '#D9DBEA' }}>
      <span className="nf-toggle-knob" style={{ width: s.knob, height: s.knob, left: on ? s.onLeft : 3 }} />
    </button>
  );
}

/** Horizontal meter: grey track with a coloured fill. */
export function Bar({ pct, color, height, style }: { pct: string; color: string; height: number; style?: CSSProperties }) {
  return (
    <div className="nf-bar-track" style={{ height, ...style }}>
      <div className="nf-bar-fill" style={{ background: color, width: pct }} />
    </div>
  );
}

export function CardHead({ title, sub, small }: { title: ReactNode; sub?: ReactNode; small?: boolean }) {
  return (
    <>
      <div className={'nf-card-title' + (small ? ' nf-card-title--sm' : '')}>{title}</div>
      {sub != null && <div className="nf-card-sub">{sub}</div>}
    </>
  );
}

export type ToastKind = 'ok' | 'info' | 'warn';
export interface ToastData { kind: ToastKind; title: string; text: string }

const TOAST_STYLE: Record<ToastKind, { glyph: string; border: string; iconBg: string }> = {
  ok: { glyph: '✓', border: '#C4E9D3', iconBg: '#EDF9F1' },
  info: { glyph: 'i', border: '#D8DCFB', iconBg: '#EEF0FE' },
  warn: { glyph: '!', border: '#F8DFC5', iconBg: '#FFF3E8' },
};

export function Toast({ toast }: { toast: ToastData }) {
  const s = TOAST_STYLE[toast.kind];
  return (
    <div className="nf-toast" role="status" style={{ borderColor: s.border }}>
      <span className="nf-toast-icon" style={{ background: s.iconBg }}>{s.glyph}</span>
      <div style={{ minWidth: 0 }}>
        <div className="nf-toast-title">{toast.title}</div>
        <div className="nf-toast-text">{toast.text}</div>
      </div>
    </div>
  );
}

/** Small pill for features that aren't built yet. */
export function SoonBadge({ style }: { style?: CSSProperties }) {
  return <span className="nf-soon" style={style}>Coming soon</span>;
}

/** Top-of-tab notice for tabs that still show the design's sample data. */
export function SampleBanner({ children }: { children: ReactNode }) {
  return (
    <div className="nf-sample-banner" role="note">
      <span className="nf-soon">Preview</span>
      <span>{children}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="nf-palette-backdrop" onMouseDown={onClose}>
      <div className="nf-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined} onMouseDown={e => e.stopPropagation()}>
        <div className="nf-modal-head">
          <span className="nf-card-title">{title}</span>
          <button type="button" className="nf-icon-btn nf-ml-auto" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="nf-modal-body">{children}</div>
        <div className="nf-modal-foot">{footer}</div>
      </div>
    </div>
  );
}

/** Mark/colours for a provider id, falling back to a neutral SMTP badge. */
export function presetOf(provider: string) {
  return config.presets[provider] ?? { label: provider === 'phpmail' ? 'PHP mail()' : provider, mark: provider === 'phpmail' ? 'WP' : 'SMTP', tint: '#F3F3FA', fg: '#3C3F55' };
}

// ----- formatting -----
export const fmtNum = (n: number) => n.toLocaleString();
export const fmtMs = (ms: number | null | undefined) => (ms == null ? '—' : ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms');
export const fmtPct = (p: number | null | undefined) => (p == null ? '—' : (Number.isInteger(p) ? p : p.toFixed(1)) + '%');
export const fmtCompact = (n: number) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
