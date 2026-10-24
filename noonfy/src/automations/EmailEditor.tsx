import { useCallback, useEffect, useState } from 'react';
import { BlockPanel } from '../campaigns/BlockPanel';
import { newBlock, PALETTE, type MediaFrame } from '../campaigns/Builder';
import { Canvas } from '../campaigns/Canvas';
import { campaignsApi } from '../campaigns/api';
import { app } from '../config';
import type { Block, BlockType, Content, Product } from '../campaigns/types';
import { automationsConfig, type EmailSettings } from './types';

const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginTop: 14, marginBottom: 5, display: 'block' } as const;

/**
 * Full-screen editor for one email step: the campaign email builder (same blocks and renderer), plus
 * products and buttons that adapt to what triggered the workflow.
 */
export function EmailEditor({ title, email, onDone, onClose, onPreview }: {
  title: string; email: EmailSettings; onDone: (email: EmailSettings) => void; onClose: () => void; onPreview: (email: EmailSettings) => void;
}) {
  const [draft, setDraft] = useState<EmailSettings>(() => JSON.parse(JSON.stringify(email)));
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [dirty, setDirty] = useState(false);

  const addProducts = useCallback((items: Product[]) => setProducts(p => ({ ...p, ...Object.fromEntries(items.map(i => [i.id, i])) })), []);
  useEffect(() => {
    const ids = [...new Set(draft.content.blocks.flatMap(b => b.productIds ?? []))];
    if (ids.length) campaignsApi.products({ ids }).then(addProducts).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { if (!dirty || window.confirm('Discard your changes to this email?')) onClose(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).isContentEditable) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const setContent = (fn: (c: Content) => Content) => { setDraft(d => ({ ...d, content: fn(d.content) })); setDirty(true); };
  const setBlocks = (fn: (b: Block[]) => Block[]) => setContent(c => ({ ...c, blocks: fn(c.blocks) }));
  const changeBlock = (id: string, patch: Partial<Block>) => setBlocks(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const addBlock = (type: BlockType) => {
    const b = newBlock(type);
    if (type === 'products') b.source = 'manual';
    setBlocks(bs => {
      const at = bs.length && bs[bs.length - 1].type === 'footer' && type !== 'footer' ? bs.length - 1 : bs.length;
      return [...bs.slice(0, at), b, ...bs.slice(at)];
    });
    setSelected(b.id);
  };
  const moveBlock = (id: string, dir: -1 | 1) => setBlocks(bs => {
    const i = bs.findIndex(b => b.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return bs;
    const next = [...bs]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const pickImage = (id: string) => {
    const media = (window as unknown as { wp?: { media?: (o: object) => MediaFrame } }).wp?.media;
    setSelected(id);
    if (!media) return;
    const frame = media({ title: 'Choose image', multiple: false, library: { type: 'image' }, button: { text: 'Use image' } });
    frame.on('select', () => { const a = frame.state().get('selection').first().toJSON(); changeBlock(id, { src: a.url, alt: a.alt ?? '' }); });
    frame.open();
  };
  /** Commits an inline edit in progress, then runs `fn` with the latest draft. */
  const withCommitted = (fn: (d: EmailSettings) => void) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setTimeout(() => setDraft(d => { fn(d); return d; }), 0);
  };

  const block = draft.content.blocks.find(b => b.id === selected) ?? null;
  const hasFooter = draft.content.blocks.some(b => b.type === 'footer');

  return (
    <div className="nf-email-editor" role="dialog" aria-modal="true" aria-label={`Edit email: ${title}`}>
      <header className="nf-flow-header">
        <button type="button" className="nf-flow-back" aria-label="Close" onClick={close}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3F55" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="nf-ellipsis" style={{ fontSize: 14.5, fontWeight: 800, color: '#14152A' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: '#8A8DA3', fontWeight: 600 }}>Email step · click blocks to edit</div>
        </div>
        <div className="nf-row nf-ml-auto" style={{ gap: 8 }}>
          {(['desktop', 'mobile'] as const).map(d => (
            <button key={d} type="button" className={'nf-device-btn' + (device === d ? ' nf-device-btn--active' : '')} onClick={() => setDevice(d)}>{d === 'desktop' ? '🖥️ Desktop' : '📱 Mobile'}</button>
          ))}
          <button type="button" className="nf-device-btn" onClick={() => withCommitted(onPreview)}>👁 Preview</button>
          <button type="button" className="nf-btn-ghost" onClick={close}>Cancel</button>
          <button type="button" className="nf-btn-primary nf-btn-primary--shadow" onClick={() => withCommitted(onDone)}>Done</button>
        </div>
      </header>
      <div className="nf-email-editor-body">
        <div className="nf-builder-side" style={{ width: 190, position: 'static', maxHeight: 'none' }}>
          <div className="nf-panel-title">Blocks</div>
          <div className="nf-col" style={{ gap: 6, marginTop: 8 }}>
            {PALETTE.map(([type, label, glyph]) => (
              <button key={type} type="button" className="nf-palette-btn" disabled={type === 'footer' && hasFooter} onClick={() => addBlock(type)}>
                <span style={{ fontSize: 13 }}>{glyph}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#14152A' }}>{label}</span>
                <span className="nf-ml-auto" style={{ fontSize: 13, color: '#C4C6D4', fontWeight: 700 }}>+</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          <Canvas content={draft.content} editable selected={selected} products={products} settings={automationsConfig.campaignSettings} width={device === 'desktop' ? 600 : 375}
            onSelect={setSelected} onChange={changeBlock} onRemove={id => { setBlocks(bs => bs.filter(b => b.id !== id)); setSelected(null); }} onMove={moveBlock} onPickImage={pickImage} />
        </div>
        <div className="nf-builder-side" style={{ width: 250, position: 'static', maxHeight: 'none' }}>
          {block ? (
            <BlockPanel block={block} accent={draft.content.accent} products={products} dynamic backLabel="Email settings" onBack={() => setSelected(null)}
              onChange={patch => changeBlock(block.id, patch)} onAccent={accent => setContent(c => ({ ...c, accent }))}
              onProducts={addProducts} onPickImage={() => pickImage(block.id)} onOpenSettings={() => window.open(app.screens.campaigns, '_blank')} />
          ) : (
            <>
              <div className="nf-panel-title">Email</div>
              <label><span style={LABEL}>Subject line</span>
                <input className="nf-field" style={{ fontWeight: 700 }} value={draft.subject} placeholder="e.g. {first_name|Hi}, you left something behind" onChange={e => { setDraft(d => ({ ...d, subject: e.target.value })); setDirty(true); }} />
              </label>
              <label><span style={LABEL}>Preview text</span>
                <input className="nf-field" value={draft.preheader} placeholder="Shown after the subject in the inbox" onChange={e => { setDraft(d => ({ ...d, preheader: e.target.value })); setDirty(true); }} />
              </label>
              <div className="nf-hint" style={{ marginTop: 14 }}>
                Personalise with <code>{'{first_name|there}'}</code>. In a <b>Products</b> block you can show the shopper’s cart, viewed products or order; a <b>Button</b> can reopen their saved cart.
              </div>
              <div className="nf-hint">The footer with your address and unsubscribe link is always added. Edit the address in Campaigns → ⚙ Settings.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
