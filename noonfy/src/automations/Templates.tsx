import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { Modal, SoonBadge } from '../shared/ui';
import { automationsApi } from './api';
import { StepCard } from './Detail';
import { describeTrigger, orderedNodes } from './meta';
import type { Template, TriggerSettings } from './types';

export function Templates({ onUse, creating }: { onUse: (id: string) => void; creating: string }) {
  const [data, setData] = useState<{ categories: string[]; templates: Template[] } | null>(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<Template | null>(null);

  useEffect(() => { automationsApi.templates().then(setData).catch(e => setError(errorMessage(e))); }, []);

  const all = data?.templates ?? [];
  const needle = q.trim().toLowerCase();
  const list = all.filter(t => (cat === 'All' || t.cat === cat) && (!needle || (t.name + ' ' + t.desc).toLowerCase().includes(needle)));
  const available = all.filter(t => t.available).length;
  const trigger = (t: Template) => describeTrigger(t.graph?.nodes.find(n => n.kind === 'trigger')?.settings as TriggerSettings);

  return (
    <>
      <header className="nf-page-header" style={{ alignItems: 'flex-end', padding: '20px 0 16px 0' }}>
        <div>
          <h1 className="nf-page-title">Automation Templates</h1>
          <p className="nf-page-sub">{data ? `${available} proven workflows, ready to launch in one click.` : 'Loading templates…'}</p>
        </div>
        <input className="nf-search-input nf-ml-auto" style={{ width: 250, padding: '8px 13px' }} placeholder="Search templates…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search templates" />
      </header>
      <div className="nf-row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
        {['All', ...(data?.categories ?? [])].map(c => (
          <button key={c} type="button" className={'nf-filter-pill' + (cat === c ? ' nf-filter-pill--active' : '')} style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      {error && <div className="nf-card nf-empty-card"><div className="nf-empty-title">Couldn’t load templates</div><div className="nf-hint">{error}</div></div>}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {list.map(t => (
          <div key={t.id} className="nf-card nf-template-card" style={{ borderRadius: 15, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div className="nf-row" style={{ gap: 11 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: t.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{t.glyph}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: '#14152A', lineHeight: 1.25 }}>{t.name}</span>
              {t.popular && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#F1EBFE', borderRadius: 99, padding: '3px 8px', letterSpacing: '.3px' }}>POPULAR</span>}
            </div>
            <p style={{ margin: '11px 0 0 0', fontSize: 12, color: '#8A8DA3', fontWeight: 600, lineHeight: 1.55, flex: 1 }}>{t.desc}</p>
            <div className="nf-row" style={{ gap: 14, marginTop: 12, fontSize: 10.5, fontWeight: 800, color: '#A5A8BD', textTransform: 'uppercase' }}>
              {t.available ? <><span>{t.emails} {t.emails === 1 ? 'email' : 'emails'}</span><span className="nf-ellipsis">{trigger(t)}</span></> : <SoonBadge />}
            </div>
            <div className="nf-row" style={{ gap: 8, marginTop: 13 }}>
              <button type="button" className="nf-btn-outline" style={{ flex: 1, textAlign: 'center', padding: 7, fontSize: 12 }} disabled={!t.available} onClick={() => setPreview(t)}>Preview</button>
              <button type="button" className="nf-btn-primary" style={{ flex: 1, padding: 8, fontSize: 12 }} disabled={!t.available || !!creating} onClick={() => onUse(t.id)}>
                {creating === t.id ? 'Creating…' : 'Use template'}
              </button>
            </div>
          </div>
        ))}
      </section>
      {data && !list.length && (
        <div style={{ textAlign: 'center', padding: '70px 0', color: '#8A8DA3' }}>
          <div style={{ fontSize: 34 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#14152A', marginTop: 10 }}>No templates match</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>Try a different search or category.</div>
        </div>
      )}
      {preview?.graph && (
        <Modal title={`${preview.glyph} ${preview.name}`} width={480} onClose={() => setPreview(null)}
          footer={<><span className="nf-hint" style={{ marginTop: 0 }}>Everything is editable after you add it.</span><button type="button" className="nf-btn-primary nf-ml-auto" disabled={!!creating} onClick={() => onUse(preview.id)}>Use template</button></>}>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#5B5E75', fontWeight: 600, lineHeight: 1.55 }}>{preview.desc}</p>
          <div className="nf-col" style={{ alignItems: 'center' }}>
            {orderedNodes(preview.graph).map((n, i, arr) => <StepCard key={n.id} node={n} stat="" arrow={i < arr.length - 1} />)}
          </div>
        </Modal>
      )}
    </>
  );
}
