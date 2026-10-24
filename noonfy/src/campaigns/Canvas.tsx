import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { app } from '../config';
import type { Block, CampaignSettings, Content, Product } from './types';

/** Second gradient colour; mirrors Noonfy_Email_Renderer::accent2(). */
export function accent2(accent: string) {
  if (accent.toLowerCase() === '#4f46e5') return '#8B5CF6';
  let hex = accent.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const mix = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16); return Math.round(c + (255 - c) * 0.3).toString(16).padStart(2, '0'); };
  return '#' + mix(0) + mix(2) + mix(4);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * In-place editable text. Uncontrolled while focused (React only writes the markup when `value` changes),
 * committed on blur. Paste is forced to plain text so no foreign markup lands in the email.
 */
function Editable({ value, onCommit, editable, html = false, multiline = false, placeholder, style, as = 'div' }: {
  value: string; onCommit: (v: string) => void; editable: boolean; html?: boolean; multiline?: boolean;
  placeholder?: string; style?: CSSProperties; as?: 'div' | 'span';
}) {
  const Tag = as;
  return (
    <Tag
      className="nf-editable" contentEditable={editable} suppressContentEditableWarning data-placeholder={placeholder}
      style={style} spellCheck={editable}
      onBlur={e => {
        const v = html ? e.currentTarget.innerHTML : e.currentTarget.innerText.replace(/\s*\n\s*/g, ' ').trim();
        if (v !== value) onCommit(v);
      }}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
      dangerouslySetInnerHTML={{ __html: html ? value : escapeHtml(value) }}
    />
  );
}

/** Bold / italic / link for the selected text block (mouse-down is cancelled to keep the text selection). */
function TextToolbar() {
  const cmd = (e: MouseEvent, c: string) => {
    e.preventDefault();
    if (c === 'createLink') {
      const url = window.prompt('Link URL', 'https://');
      if (url) document.execCommand('createLink', false, url);
    } else document.execCommand(c);
  };
  return (
    <div className="nf-text-toolbar" onMouseDown={e => e.preventDefault()}>
      <button type="button" onMouseDown={e => cmd(e, 'bold')} title="Bold"><b>B</b></button>
      <button type="button" onMouseDown={e => cmd(e, 'italic')} title="Italic"><i>I</i></button>
      <button type="button" onMouseDown={e => cmd(e, 'createLink')} title="Link">🔗</button>
      <button type="button" onMouseDown={e => cmd(e, 'unlink')} title="Remove link">⨯🔗</button>
    </div>
  );
}

function Countdown({ until }: { until?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = window.setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(iv); }, []);
  const left = (until ? Date.parse(until) : 0) - now;
  if (left <= 0) return <div style={{ padding: '16px 24px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#8A8DA3' }}>This offer has ended.</div>;
  const s = Math.floor(left / 1000);
  const units: [number, string][] = [[Math.floor(s / 86400), 'DAYS'], [Math.floor((s % 86400) / 3600), 'HRS'], [Math.floor((s % 3600) / 60), 'MIN']];
  return (
    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'center', gap: 10 }}>
      {units.map(([n, label]) => (
        <span key={label} style={{ background: '#14152A', color: '#fff', borderRadius: 9, padding: '10px 13px', fontSize: 16, fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {String(n).padStart(2, '0')}<span style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: '#A5A8BD', letterSpacing: 1 }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

export interface CanvasProps {
  content: Content;
  editable: boolean;
  selected: string | null;
  products: Record<number, Product>;
  settings: CampaignSettings;
  width: number;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Block>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onPickImage: (id: string) => void;
}

/** The email as it will look, block by block (visually mirrors includes/campaigns/class-noonfy-email-renderer.php). */
export function Canvas(p: CanvasProps) {
  const { accent } = p.content;
  const grad = `linear-gradient(135deg,${accent},${accent2(accent)})`;
  const blocks = p.content.blocks;

  const body = (b: Block) => {
    const set = (patch: Partial<Block>) => p.onChange(b.id, patch);
    const ed = p.editable;
    switch (b.type) {
      case 'header':
        return (
          <div style={{ background: grad, padding: '26px 24px', textAlign: 'center' }}>
            <Editable editable={ed} value={b.eyebrow ?? ''} onCommit={v => set({ eyebrow: v })} placeholder="EYEBROW"
              style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,.75)' }} />
            <Editable editable={ed} value={b.title ?? ''} onCommit={v => set({ title: v })} placeholder="Headline"
              style={{ fontSize: 23, fontWeight: 800, color: '#fff', marginTop: 8, letterSpacing: '-.3px', lineHeight: 1.3 }} />
          </div>
        );
      case 'image':
        return b.src ? (
          <div style={{ padding: '2px 0' }}><img src={b.src} alt={b.alt ?? ''} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6 }} /></div>
        ) : (
          <div style={{ height: 170, background: 'linear-gradient(135deg,#EEF0FE,#F4EFFE)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8A8DA3', gap: 8 }}>
            <span style={{ fontSize: 26 }}>🖼️</span>
            {ed ? <button type="button" className="nf-btn-ghost" onClick={e => { e.stopPropagation(); p.onPickImage(b.id); }}>Choose image</button>
              : <span style={{ fontSize: 11, fontWeight: 800 }}>NO IMAGE (skipped when sending)</span>}
          </div>
        );
      case 'text':
        return (
          <div style={{ padding: '18px 24px', fontSize: 13.5, color: '#3C3F55', fontWeight: 500, lineHeight: 1.65 }}>
            {ed && p.selected === b.id && <TextToolbar />}
            <Editable editable={ed} html multiline value={b.html ?? ''} onCommit={v => set({ html: v })} placeholder="Write something…" />
          </div>
        );
      case 'products': {
        const items = (b.productIds ?? []).map(id => p.products[id]).filter(Boolean);
        return items.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: p.width < 500 ? '1fr' : '1fr 1fr', gap: 12, padding: '10px 24px' }}>
            {items.map(it => (
              <div key={it.id} style={{ border: '1px solid #ECEDF4', borderRadius: 10, overflow: 'hidden' }}>
                {it.image ? <img src={it.image} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} /> : <div style={{ height: 86, background: '#EDF9F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛍️</div>}
                <div style={{ padding: '9px 11px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}>{it.name}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: accent, marginTop: 2 }}>{it.price}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '22px 24px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#8A8DA3' }}>🛍️ Pick WooCommerce products in the panel →</div>
        );
      }
      case 'button':
        return (
          <div style={{ padding: '16px 24px', textAlign: 'center' }}>
            <span style={{ display: 'inline-block', background: grad, color: '#fff', borderRadius: 10, padding: '12px 34px', fontSize: 13.5, fontWeight: 800 }}>
              <Editable as="span" editable={ed} value={b.label ?? ''} onCommit={v => set({ label: v })} placeholder="Button" />
            </span>
          </div>
        );
      case 'countdown':
        return <Countdown until={b.until} />;
      case 'reviews':
        return (
          <div style={{ padding: '14px 24px' }}>
            <div style={{ background: '#F8F8FC', borderRadius: 11, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#F59E0B', letterSpacing: 2 }}>{'★'.repeat(b.stars ?? 5)}</div>
              <Editable editable={ed} multiline value={b.quote ?? ''} onCommit={v => set({ quote: v })} placeholder="Customer quote"
                style={{ fontSize: 12.5, color: '#3C3F55', fontWeight: 600, lineHeight: 1.55, marginTop: 6 }} />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A5A8BD', marginTop: 6, textTransform: 'uppercase', display: 'flex', gap: 4 }}>
                — <Editable as="span" editable={ed} value={b.author ?? ''} onCommit={v => set({ author: v })} placeholder="Name" />
              </div>
            </div>
          </div>
        );
      case 'coupon':
        return (
          <div style={{ padding: '14px 24px' }}>
            <div style={{ border: `1.5px dashed ${accent2(accent)}`, background: '#FBFAFF', borderRadius: 11, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 1 }}>YOUR CODE</div>
              <Editable editable={ed} value={b.code ?? ''} onCommit={v => set({ code: v.toUpperCase() })} placeholder="CODE"
                style={{ fontSize: 19, fontWeight: 800, color: '#14152A', letterSpacing: 3, marginTop: 4 }} />
              <Editable editable={ed} value={b.note ?? ''} onCommit={v => set({ note: v })} placeholder="What it's for"
                style={{ fontSize: 11, fontWeight: 700, color: '#8A8DA3', marginTop: 3 }} />
            </div>
          </div>
        );
      case 'footer':
        return (
          <div style={{ background: '#F8F8FC', padding: '18px 24px', textAlign: 'center', fontSize: 10.5, color: '#A5A8BD', fontWeight: 600, lineHeight: 1.7 }}>
            {p.settings.companyAddress || <span style={{ color: '#C2620A' }}>Add your store address in ⚙ Settings</span>}<br />
            {p.settings.audienceMode === 'optin' ? `You're receiving this because you subscribed at ${app.site.host}` : `You're receiving this because you're a customer of ${app.site.name}`}<br />
            <span style={{ color: '#8A8DA3', textDecoration: 'underline' }}>Unsubscribe</span> · <span style={{ color: '#8A8DA3', textDecoration: 'underline' }}>Preferences</span>
          </div>
        );
    }
  };

  return (
    <div className="nf-email-canvas" style={{ width: p.width }} onClick={() => p.onSelect(null)}>
      {blocks.map((b, i) => {
        const sel = p.selected === b.id;
        const edge = b.type === 'header' || b.type === 'footer';
        return (
          <div key={b.id} className={'nf-block' + (sel ? ' nf-block--selected' : '')} style={{ margin: edge ? 0 : '2px 6px' }}
            onClick={e => { e.stopPropagation(); if (p.editable) p.onSelect(b.id); }}>
            {body(b)}
            {sel && p.editable && (
              <div className="nf-block-tools" onClick={e => e.stopPropagation()}>
                <button type="button" title="Move up" disabled={i === 0} onClick={() => p.onMove(b.id, -1)}>↑</button>
                <button type="button" title="Move down" disabled={i === blocks.length - 1} onClick={() => p.onMove(b.id, 1)}>↓</button>
                <button type="button" title="Remove block" className="nf-block-remove" onClick={() => p.onRemove(b.id)}>✕</button>
              </div>
            )}
          </div>
        );
      })}
      {blocks.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#8A8DA3', fontSize: 13, fontWeight: 700 }}>Add blocks from the left to start.</div>}
    </div>
  );
}
