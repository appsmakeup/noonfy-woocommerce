import type { CSSProperties, ReactNode } from 'react';

const TOGGLE_SIZES = {
  lg: { w: 36, h: 20, knob: 14, onLeft: 19 },
  md: { w: 34, h: 19, knob: 13, onLeft: 19 },
  sm: { w: 32, h: 18, knob: 12, onLeft: 17 },
};

export function Toggle({ on, onChange, size = 'md', label }: { on: boolean; onChange: () => void; size?: keyof typeof TOGGLE_SIZES; label: string }) {
  const s = TOGGLE_SIZES[size];
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="nf-toggle"
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
