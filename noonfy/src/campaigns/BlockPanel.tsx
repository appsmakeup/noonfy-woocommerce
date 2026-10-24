import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { campaignsApi } from './api';
import type { Block, Product } from './types';

const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginTop: 14, marginBottom: 5, display: 'block' } as const;
const NAMES: Record<Block['type'], string> = {
  header: 'Header', image: 'Image', text: 'Text', products: 'Products', button: 'Button',
  countdown: 'Countdown', reviews: 'Review', coupon: 'Coupon', footer: 'Footer',
};

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function BlockPanel({ block, accent, products, onChange, onAccent, onProducts, onPickImage, onBack, onOpenSettings }: {
  block: Block; accent: string; products: Record<number, Product>;
  onChange: (patch: Partial<Block>) => void; onAccent: (hex: string) => void; onProducts: (items: Product[]) => void;
  onPickImage: () => void; onBack: () => void; onOpenSettings: () => void;
}) {
  return (
    <>
      <button type="button" className="nf-link-btn" onClick={onBack}>← Campaign settings</button>
      <div className="nf-panel-title" style={{ marginTop: 10 }}>{NAMES[block.type]} block</div>
      <div className="nf-hint">Click text in the email to edit it directly.</div>

      {(block.type === 'header' || block.type === 'button') && (
        <label><span style={LABEL}>Brand colour</span>
          <div className="nf-row" style={{ gap: 8 }}>
            <input type="color" value={accent} onChange={e => onAccent(e.target.value)} style={{ width: 38, height: 30, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
            <span className="nf-mono" style={{ fontSize: 11.5, color: '#5B5E75' }}>{accent.toUpperCase()}</span>
          </div>
        </label>
      )}

      {block.type === 'image' && (
        <>
          <span style={LABEL}>Image</span>
          {block.src && <img src={block.src} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid #ECEDF4' }} />}
          <button type="button" className="nf-btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={onPickImage}>{block.src ? 'Replace image' : 'Choose from media library'}</button>
          <label><span style={LABEL}>…or image URL</span><input className="nf-field" value={block.src ?? ''} placeholder="https://" onChange={e => onChange({ src: e.target.value })} /></label>
          <label><span style={LABEL}>Alt text</span><input className="nf-field" value={block.alt ?? ''} onChange={e => onChange({ alt: e.target.value })} /></label>
          <label><span style={LABEL}>Link (optional)</span><input className="nf-field" value={block.link ?? ''} placeholder="https://" onChange={e => onChange({ link: e.target.value })} /></label>
        </>
      )}

      {block.type === 'text' && (
        <div className="nf-hint" style={{ marginTop: 12 }}>
          Select text to make it <b>bold</b>, <i>italic</i> or a link with the toolbar above the block. Personalise with <code>{'{first_name|there}'}</code>.
        </div>
      )}

      {block.type === 'button' && (
        <label><span style={LABEL}>Button link</span><input className="nf-field" value={block.url ?? ''} placeholder="https://" onChange={e => onChange({ url: e.target.value })} /></label>
      )}

      {block.type === 'products' && <ProductPicker ids={block.productIds ?? []} products={products} onProducts={onProducts} onChange={productIds => onChange({ productIds })} />}

      {block.type === 'countdown' && (
        <label><span style={LABEL}>Counts down to</span>
          <input className="nf-field" type="datetime-local" value={toLocalInput(block.until)} onChange={e => e.target.value && onChange({ until: new Date(e.target.value).toISOString() })} />
          <div className="nf-hint">The time left is worked out when each email is sent.</div>
        </label>
      )}

      {block.type === 'reviews' && (
        <label><span style={LABEL}>Stars</span>
          <select className="nf-field" value={block.stars ?? 5} onChange={e => onChange({ stars: +e.target.value })}>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select>
        </label>
      )}

      {block.type === 'coupon' && (
        <>
          <label><span style={LABEL}>Coupon code</span><input className="nf-field nf-mono" value={block.code ?? ''} onChange={e => onChange({ code: e.target.value.toUpperCase() })} /></label>
          <div className="nf-hint">Create the coupon itself in WooCommerce → Marketing → Coupons.</div>
          <label><span style={LABEL}>Note</span><input className="nf-field" value={block.note ?? ''} onChange={e => onChange({ note: e.target.value })} /></label>
        </>
      )}

      {block.type === 'footer' && (
        <div className="nf-hint" style={{ marginTop: 12 }}>
          The footer shows your store address and the unsubscribe link, which every marketing email must include.
          It's added automatically even if you remove this block. <button type="button" className="nf-link-btn" onClick={onOpenSettings}>Edit address</button>
        </div>
      )}
    </>
  );
}

function ProductPicker({ ids, products, onProducts, onChange }: {
  ids: number[]; products: Record<number, Product>; onProducts: (items: Product[]) => void; onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => {
      campaignsApi.products({ search }).then(r => { setResults(r); onProducts(r); setError(''); }).catch(e => setError(errorMessage(e)));
    }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <span style={LABEL}>Products in this email ({ids.length}/4)</span>
      {ids.length === 0 && <div className="nf-hint">None yet. Add up to four below.</div>}
      {ids.map(id => (
        <div key={id} className="nf-row nf-picked">
          <span className="nf-grow nf-ellipsis">{products[id]?.name ?? `#${id}`}</span>
          <button type="button" className="nf-icon-btn" aria-label="Remove" onClick={() => onChange(ids.filter(x => x !== id))}>✕</button>
        </div>
      ))}
      <span style={LABEL}>Add products</span>
      <input className="nf-field" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
      {error && <div className="nf-hint" style={{ color: '#E02424' }}>{error}</div>}
      <div className="nf-col" style={{ gap: 4, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
        {results.filter(r => !ids.includes(r.id)).map(r => (
          <button key={r.id} type="button" className="nf-pick-result" disabled={ids.length >= 4} onClick={() => onChange([...ids, r.id])}>
            <span className="nf-grow nf-ellipsis">{r.name}</span><span style={{ color: '#4F46E5', fontWeight: 800 }}>{r.price}</span>
          </button>
        ))}
        {!error && results.length === 0 && <div className="nf-hint">No published products found.</div>}
      </div>
    </>
  );
}
