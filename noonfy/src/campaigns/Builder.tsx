import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api';
import { app } from '../config';
import { Modal, SoonBadge } from '../shared/ui';
import { campaignsApi } from './api';
import { BlockPanel } from './BlockPanel';
import { Canvas } from './Canvas';
import { STATUS_STYLE } from './CampaignList';
import { campaignsConfig, type Block, type BlockType, type Campaign, type Draft, type Product } from './types';
import { money, pct, type CampaignsApi } from './useCampaigns';

const PALETTE: [BlockType, string, string][] = [
  ['header', 'Header', '🏷️'], ['image', 'Image', '🖼️'], ['text', 'Text', '📝'], ['products', 'Products', '🛍️'], ['button', 'Button', '🔘'],
  ['countdown', 'Countdown', '⏳'], ['reviews', 'Reviews', '⭐'], ['coupon', 'Coupon', '🎟️'], ['footer', 'Footer', '📎'],
];
const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginTop: 14, marginBottom: 5, display: 'block' } as const;

const uid = () => 'b' + Math.random().toString(36).slice(2, 9);

function newBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case 'header': return { id, type, eyebrow: app.site.name.toUpperCase(), title: 'Your headline here' };
    case 'image': return { id, type, src: '', alt: '', link: '' };
    case 'text': return { id, type, html: 'Write something your customers will love.' };
    case 'products': return { id, type, productIds: [] };
    case 'button': return { id, type, label: 'Shop now', url: app.site.home };
    case 'countdown': return { id, type, until: new Date(Date.now() + 3 * 86400000).toISOString() };
    case 'reviews': return { id, type, quote: 'The best thing I bought this year.', author: 'Verified buyer', stars: 5 };
    case 'coupon': return { id, type, code: 'SAVE10', note: '10% off your next order' };
    default: return { id, type };
  }
}

/** Mirrors Noonfy_Campaigns::default_content(). */
function blankDraft(): Draft {
  return {
    id: 0, name: 'Untitled campaign', subject: '', preheader: '', emoji: '✉️', segment: 'all',
    content: {
      accent: '#4F46E5',
      blocks: [
        { id: uid(), type: 'header', eyebrow: app.site.name.toUpperCase(), title: 'Something new is here' },
        { id: uid(), type: 'text', html: 'Tell your customers what’s new. Click any text in the email to edit it.' },
        { id: uid(), type: 'button', label: 'Shop now', url: app.site.home },
        { id: uid(), type: 'footer' },
      ],
    },
  };
}

const fromCampaign = (c: Campaign): Draft => ({ id: c.id, name: c.name, subject: c.subject, preheader: c.preheader, emoji: c.emoji, segment: c.segment, content: c.content });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

type MediaFrame = { on: (e: string, cb: () => void) => void; open: () => void; state: () => { get: (k: string) => { first: () => { toJSON: () => { url: string; alt?: string } } } } };

export function Builder({ api, campaign, missing, onOpenSettings }: { api: CampaignsApi; campaign: Campaign | null; missing: boolean; onOpenSettings: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => (campaign ? fromCampaign(campaign) : blankDraft()));
  const [dirty, setDirty] = useState(!campaign);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'send' | 'test' | 'preview' | 'action'>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>(campaign?.scheduledAt && campaign.status === 'scheduled' ? 'later' : 'now');
  const [sendAt, setSendAt] = useState(() => toLocalInput(campaign?.scheduledAt ? new Date(campaign.scheduledAt) : new Date(Date.now() + 86400000)));
  const [testTo, setTestTo] = useState(app.user.email);

  const status = campaign?.status ?? 'draft';
  const editable = status === 'draft' || status === 'scheduled';
  const { segments, smtpReady } = api.overview;
  const audience = segments.find(s => s.id === draft.segment);

  // Product names/prices for blocks already in the email.
  useEffect(() => {
    const ids = [...new Set(draft.content.blocks.flatMap(b => b.productIds ?? []))].filter(id => !products[id]);
    if (ids.length) campaignsApi.products({ ids }).then(addProducts).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addProducts = useCallback((items: Product[]) => setProducts(p => ({ ...p, ...Object.fromEntries(items.map(i => [i.id, i])) })), []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty || !editable) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, editable]);

  const edit = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setDirty(true); };
  const setBlocks = (fn: (b: Block[]) => Block[]) => { setDraft(d => ({ ...d, content: { ...d.content, blocks: fn(d.content.blocks) } })); setDirty(true); };
  const changeBlock = (id: string, patch: Partial<Block>) => setBlocks(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const addBlock = (type: BlockType) => {
    const b = newBlock(type);
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
  const removeBlock = (id: string) => { setBlocks(bs => bs.filter(b => b.id !== id)); setSelected(null); };

  const pickImage = (id: string) => {
    const media = (window as unknown as { wp?: { media?: (o: object) => MediaFrame } }).wp?.media;
    if (!media) { api.showToast('info', 'Media library unavailable', 'Paste an image URL in the panel instead.'); setSelected(id); return; }
    const frame = media({ title: 'Choose image', multiple: false, library: { type: 'image' }, button: { text: 'Use image' } });
    frame.on('select', () => { const a = frame.state().get('selection').first().toJSON(); changeBlock(id, { src: a.url, alt: a.alt ?? '' }); });
    frame.open();
    setSelected(id);
  };

  /** Saves and returns the stored campaign (first save of a new campaign moves the URL to its id). */
  const save = async (quiet = false): Promise<Campaign | null> => {
    // Commit any in-progress inline edit first.
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise(r => setTimeout(r, 0));
    setBusy('save');
    try {
      const c = await campaignsApi.save(draft);
      api.upsertCampaign(c);
      setDirty(false);
      if (!quiet) api.showToast('ok', 'Draft saved', c.name);
      if (!draft.id) window.location.hash = 'builder:' + c.id;
      return c;
    } catch (e) {
      api.showToast('warn', 'Couldn’t save', errorMessage(e));
      return null;
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    const later = when === 'later';
    const at = later ? new Date(sendAt) : null;
    if (later && (!at || at.getTime() < Date.now())) { api.showToast('warn', 'Pick a future time', 'Or choose "Now" to send immediately.'); return; }
    if (!later && !window.confirm(`Send “${draft.subject || draft.name}” to ${audience?.count.toLocaleString() ?? 0} contacts now?`)) return;
    const c = dirty || !draft.id ? await save(true) : campaign;
    if (!c) return;
    setBusy('send');
    try {
      const r = await campaignsApi.send(c.id, at ? at.toISOString() : null);
      api.upsertCampaign(r);
      api.showToast('ok', later ? 'Campaign scheduled' : 'Sending started', later ? fmtDate(r.scheduledAt!) : `${audience?.count ?? 0} recipients`);
      api.refresh();
    } catch (e) {
      api.showToast('warn', 'Couldn’t send', errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const test = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise(r => setTimeout(r, 0));
    setBusy('test');
    campaignsApi.test(draft, testTo)
      .then(r => api.showToast('ok', 'Test email sent', `Check ${r.to}.`))
      .catch(e => api.showToast('warn', 'Test failed', errorMessage(e)))
      .finally(() => setBusy(''));
  };

  const openPreview = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise(r => setTimeout(r, 0));
    setBusy('preview');
    campaignsApi.preview(draft).then(r => setPreview(r.html)).catch(e => api.showToast('warn', 'Preview failed', errorMessage(e))).finally(() => setBusy(''));
  };

  const act = (action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !window.confirm(status === 'scheduled' ? 'Unschedule this campaign? It goes back to drafts.' : 'Stop sending? Recipients not reached yet will be skipped.')) return;
    setBusy('action');
    campaignsApi.action(campaign!.id, action).then(r => { api.upsertCampaign(r); api.refresh(); })
      .catch(e => api.showToast('warn', 'Couldn’t update campaign', errorMessage(e))).finally(() => setBusy(''));
  };

  const duplicate = () => campaignsApi.duplicate(campaign!.id).then(c => { api.upsertCampaign(c); window.location.hash = 'builder:' + c.id; api.showToast('ok', 'Copied to a new draft', c.name); })
    .catch(e => api.showToast('warn', 'Couldn’t duplicate', errorMessage(e)));

  const remove = () => {
    if (!campaign || !window.confirm(`Delete “${campaign.name}”? This can't be undone.`)) return;
    campaignsApi.remove(campaign.id).then(() => { api.removeCampaign(campaign.id); window.location.hash = 'all'; api.showToast('ok', 'Campaign deleted', campaign.name); })
      .catch(e => api.showToast('warn', 'Couldn’t delete', errorMessage(e)));
  };

  const block = draft.content.blocks.find(b => b.id === selected) ?? null;
  const hasFooter = draft.content.blocks.some(b => b.type === 'footer');
  const width = device === 'desktop' ? 600 : 375;
  const sendLabel = when === 'later' ? (status === 'scheduled' ? 'Update schedule' : 'Schedule campaign') : 'Send now';
  const stats = campaign?.stats;
  const progress = useMemo(() => (stats && stats.total ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0), [stats]);

  if (missing) {
    return <div className="nf-card nf-empty-card"><div className="nf-empty-title">Campaign not found</div><a href="#all">Back to campaigns</a></div>;
  }

  return (
    <section style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {editable && (
        <div className="nf-builder-side" style={{ width: 190 }}>
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
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="nf-row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(['desktop', 'mobile'] as const).map(d => (
            <button key={d} type="button" className={'nf-device-btn' + (device === d ? ' nf-device-btn--active' : '')} onClick={() => setDevice(d)}>{d === 'desktop' ? '🖥️ Desktop' : '📱 Mobile'}</button>
          ))}
          <button type="button" className="nf-device-btn" onClick={openPreview} disabled={busy === 'preview'}>{busy === 'preview' ? 'Rendering…' : '👁 Preview email'}</button>
          {editable && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#A5A8BD', marginLeft: 6 }}>Click a block to select · click text to edit</span>}
        </div>
        <Canvas content={draft.content} editable={editable} selected={selected} products={products} settings={api.settings} width={width}
          onSelect={setSelected} onChange={changeBlock} onRemove={removeBlock} onMove={moveBlock} onPickImage={pickImage} />
      </div>

      <div className="nf-builder-side" style={{ width: 244 }}>
        {editable && block ? (
          <BlockPanel block={block} accent={draft.content.accent} products={products} onBack={() => setSelected(null)}
            onChange={patch => changeBlock(block.id, patch)} onAccent={accent => { setDraft(d => ({ ...d, content: { ...d.content, accent } })); setDirty(true); }}
            onProducts={addProducts} onPickImage={() => pickImage(block.id)} onOpenSettings={onOpenSettings} />
        ) : (
          <>
            <div className="nf-row">
              <span className="nf-panel-title">Campaign</span>
              <span className="nf-ml-auto" style={{ fontSize: 10, fontWeight: 800, color: STATUS_STYLE[status][0], background: STATUS_STYLE[status][1], borderRadius: 99, padding: '3px 9px', textTransform: 'uppercase' }}>{status}</span>
            </div>

            {campaign && !editable && stats && (
              <div className="nf-status-card">
                {(status === 'sending' || status === 'paused') && (
                  <>
                    <div className="nf-row" style={{ fontSize: 11, fontWeight: 700, color: '#5B5E75' }}><span>Progress</span><span className="nf-ml-auto" style={{ fontWeight: 800, color: '#14152A' }}>{(stats.sent + stats.failed).toLocaleString()} / {stats.total.toLocaleString()}</span></div>
                    <div className="nf-bar-track" style={{ height: 6, marginTop: 5 }}><div className="nf-bar-fill" style={{ width: progress + '%', background: '#4F46E5' }} /></div>
                  </>
                )}
                <div className="nf-stat-grid">
                  <div><span>Sent</span><b>{stats.sent.toLocaleString()}</b></div>
                  <div><span>Opened</span><b>{pct(stats.opens, stats.sent)}</b></div>
                  <div><span>Clicked</span><b>{pct(stats.clicks, stats.sent)}</b></div>
                  <div><span>Revenue</span><b>{money(stats.revenue)}</b></div>
                  <div><span>Orders</span><b>{stats.orders.toLocaleString()}</b></div>
                  <div><span>Failed</span><b style={{ color: stats.failed ? '#E02424' : undefined }}>{stats.failed.toLocaleString()}</b></div>
                </div>
                {campaign.finishedAt && <div className="nf-hint">Finished {fmtDate(campaign.finishedAt)}</div>}
                <div className="nf-col" style={{ gap: 6, marginTop: 10 }}>
                  {status === 'sending' && <button type="button" className="nf-btn-ghost" disabled={!!busy} onClick={() => act('pause')}>Pause sending</button>}
                  {status === 'paused' && <button type="button" className="nf-btn-primary" disabled={!!busy} onClick={() => act('resume')}>Resume sending</button>}
                  {(status === 'sending' || status === 'paused') && <button type="button" className="nf-btn-danger" disabled={!!busy} onClick={() => act('cancel')}>Stop campaign</button>}
                  <button type="button" className="nf-btn-ghost" onClick={duplicate}>Duplicate as new draft</button>
                </div>
              </div>
            )}

            {editable && (
              <>
                <label><span style={LABEL}>Name (internal)</span>
                  <div className="nf-row" style={{ gap: 6 }}>
                    <select className="nf-field" style={{ width: 54, padding: '7px 4px' }} value={draft.emoji} onChange={e => edit({ emoji: e.target.value })} aria-label="Icon">
                      {campaignsConfig.emojis.map(em => <option key={em} value={em}>{em}</option>)}
                    </select>
                    <input className="nf-field" value={draft.name} onChange={e => edit({ name: e.target.value })} />
                  </div>
                </label>
                <label><span style={LABEL}>Subject line</span>
                  <input className="nf-field" style={{ fontWeight: 700 }} value={draft.subject} placeholder="e.g. {first_name|Hi}, the summer drop is here" onChange={e => edit({ subject: e.target.value })} />
                </label>
                <div className="nf-row" style={{ gap: 6, marginTop: 6 }}><span style={{ fontSize: 11, fontWeight: 800, color: '#A5A8BD' }}>✨ Generate with AI</span><SoonBadge /></div>
                <label><span style={LABEL}>Preview text</span>
                  <input className="nf-field" value={draft.preheader} placeholder="Shown after the subject in the inbox" onChange={e => edit({ preheader: e.target.value })} />
                </label>
                <label><span style={LABEL}>Audience</span>
                  <select className="nf-field" value={draft.segment} onChange={e => edit({ segment: e.target.value })}>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.label} ({s.count.toLocaleString()})</option>)}
                  </select>
                </label>
                {audience && audience.count === 0 && (
                  <div className="nf-hint" style={{ color: '#C2620A' }}>No contacts in this audience yet. <button type="button" className="nf-link-btn" onClick={onOpenSettings}>Get subscribers</button></div>
                )}
                <span style={LABEL}>Send time</span>
                <div className="nf-segmented" style={{ width: '100%' }}>
                  {(['now', 'later'] as const).map(w => (
                    <button key={w} type="button" className={'nf-segmented-btn' + (when === w ? ' nf-segmented-btn--active' : '')} style={{ flex: 1 }} onClick={() => setWhen(w)}>{w === 'now' ? 'Now' : 'Schedule'}</button>
                  ))}
                </div>
                {when === 'later' && (
                  <>
                    <input className="nf-field" type="datetime-local" style={{ marginTop: 6 }} value={sendAt} onChange={e => setSendAt(e.target.value)} />
                    <div className="nf-hint">Your browser's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</div>
                  </>
                )}
                {status === 'scheduled' && campaign?.scheduledAt && (
                  <div className="nf-hint" style={{ color: '#4F46E5', fontWeight: 700 }}>Scheduled for {fmtDate(campaign.scheduledAt)}. <button type="button" className="nf-link-btn" onClick={() => act('cancel')}>Unschedule</button></div>
                )}
                <button type="button" className="nf-btn-primary nf-btn-primary--shadow" style={{ width: '100%', marginTop: 16, padding: 10 }}
                  disabled={!!busy || !smtpReady} title={smtpReady ? undefined : 'Connect an SMTP provider first'} onClick={send}>
                  {busy === 'send' ? 'Starting…' : sendLabel}
                </button>
                <button type="button" className="nf-btn-ghost" style={{ width: '100%', marginTop: 8 }} disabled={!!busy || (!dirty && !!draft.id)} onClick={() => save()}>
                  {busy === 'save' ? 'Saving…' : dirty || !draft.id ? 'Save draft' : 'Saved ✓'}
                </button>
                <span style={LABEL}>Send test email</span>
                <div className="nf-row" style={{ gap: 6 }}>
                  <input className="nf-field" value={testTo} onChange={e => setTestTo(e.target.value)} aria-label="Test recipient" />
                  <button type="button" className="nf-btn-ghost nf-noshrink" disabled={!!busy || !smtpReady} onClick={test}>{busy === 'test' ? '…' : 'Send'}</button>
                </div>
              </>
            )}
            {campaign && (status === 'draft' || status === 'cancelled' || status === 'sent') && (
              <button type="button" className="nf-btn-danger" style={{ marginTop: 14 }} onClick={remove}>Delete campaign</button>
            )}
          </>
        )}
      </div>

      {preview !== null && (
        <Modal width={700} title={`Preview · ${device === 'desktop' ? 'Desktop' : 'Mobile'}`} onClose={() => setPreview(null)} footer={<span className="nf-hint">Rendered by the server exactly as sent, with your name in the merge fields. Links aren't tracked in previews.</span>}>
          <iframe title="Email preview" sandbox="" srcDoc={preview} style={{ width: device === 'desktop' ? 640 : 375, maxWidth: '100%', height: '62vh', border: '1px solid #ECEDF4', borderRadius: 10, display: 'block', margin: '0 auto' }} />
        </Modal>
      )}
    </section>
  );
}
