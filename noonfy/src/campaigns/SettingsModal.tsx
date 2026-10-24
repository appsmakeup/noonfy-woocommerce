import { useState } from 'react';
import { errorMessage } from '../api';
import { Modal, Toggle } from '../shared/ui';
import { campaignsApi } from './api';
import type { CampaignSettings } from './types';
import type { CampaignsApi } from './useCampaigns';

const LABEL = { fontSize: 11, fontWeight: 800, color: '#5B5E75', marginBottom: 5, display: 'block' } as const;

/** Store-wide campaign settings plus the WooCommerce customer sync. */
export function SettingsModal({ api, onClose }: { api: CampaignsApi; onClose: () => void }) {
  const [form, setForm] = useState<CampaignSettings>(api.settings);
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState<{ running: boolean; processed: number; message: string }>({ running: false, processed: 0, message: '' });
  const [consent, setConsent] = useState(false);
  const { summary } = api.overview;
  const set = (patch: Partial<CampaignSettings>) => setForm(f => ({ ...f, ...patch }));

  const save = () => {
    setSaving(true);
    api.saveSettings(form).then(() => { api.showToast('ok', 'Settings saved', ''); onClose(); }).catch(() => undefined).finally(() => setSaving(false));
  };

  const runSync = async (subscribe: boolean) => {
    setSync({ running: true, processed: 0, message: '' });
    let page = 1, processed = 0;
    try {
      for (;;) {
        const r = await campaignsApi.sync(page, subscribe, consent);
        processed += r.processed;
        setSync({ running: true, processed, message: '' });
        if (r.done) {
          if (r.campaigns && r.segments && r.summary) api.setOverview({ campaigns: r.campaigns, segments: r.segments, summary: r.summary, smtpReady: !!r.smtpReady });
          break;
        }
        page = r.nextPage;
      }
      setSync({ running: false, processed, message: `Done: ${processed.toLocaleString()} orders checked.` });
    } catch (e) {
      setSync({ running: false, processed, message: errorMessage(e) });
    }
  };

  return (
    <Modal title="Campaign settings" onClose={onClose} footer={(
      <>
        <button type="button" className="nf-btn-ghost nf-ml-auto" onClick={onClose}>Cancel</button>
        <button type="button" className="nf-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save settings'}</button>
      </>
    )}>
      <div className="nf-col" style={{ gap: 16 }}>
        <div>
          <span style={LABEL}>Who can receive campaigns</span>
          {([
            ['optin', 'Only people who opted in', 'Recommended. Contacts who ticked the checkout or My Account checkbox, or that you imported with consent.'],
            ['all', 'All customers (unless they unsubscribed)', 'Also includes customers who never opted in. In the EU/UK and several other countries this needs prior consent; you are responsible for having it.'],
          ] as const).map(([key, title, help]) => (
            <label key={key} className={'nf-choice' + (form.audienceMode === key ? ' nf-choice--active' : '')}>
              <input type="radio" name="audienceMode" checked={form.audienceMode === key} onChange={() => set({ audienceMode: key })} />
              <span><b>{title}</b><span className="nf-hint" style={{ display: 'block', marginTop: 2 }}>{help}</span></span>
            </label>
          ))}
        </div>

        <div>
          <span style={LABEL}>Checkout opt-in</span>
          <div className="nf-row" style={{ gap: 9 }}>
            <Toggle size="lg" on={form.checkoutOptin} onChange={() => set({ checkoutOptin: !form.checkoutOptin })} label="Show opt-in checkbox at checkout" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3C3F55' }}>Show an unticked checkbox at checkout (classic and block checkout)</span>
          </div>
          <input className="nf-field" style={{ marginTop: 8 }} value={form.optinLabel} onChange={e => set({ optinLabel: e.target.value })} aria-label="Checkbox label" />
          <div className="nf-hint">Customers can also change this under My Account → Account details.</div>
        </div>

        <label>
          <span style={LABEL}>Store address (shown in every email footer)</span>
          <input className="nf-field" value={form.companyAddress} placeholder="Store name · street · city postcode" onChange={e => set({ companyAddress: e.target.value })} />
          <div className="nf-hint">Anti-spam laws (e.g. CAN-SPAM) require a postal address in marketing email.</div>
        </label>

        <label>
          <span style={LABEL}>Emails per batch</span>
          <input className="nf-field" type="number" min={10} max={500} value={form.batchSize} onChange={e => set({ batchSize: +e.target.value || 50 })} style={{ width: 110 }} />
          <div className="nf-hint">Lower this if your SMTP provider rate-limits you.</div>
        </label>

        <div className="nf-sync-box">
          <span style={LABEL}>Contacts</span>
          <div className="nf-stat-grid" style={{ marginTop: 0 }}>
            <div><span>Subscribed</span><b>{summary.subscribed.toLocaleString()}</b></div>
            <div><span>Customers, no opt-in</span><b>{summary.customersNotOptedIn.toLocaleString()}</b></div>
            <div><span>Unsubscribed</span><b>{summary.unsubscribed.toLocaleString()}</b></div>
          </div>
          <div className="nf-hint" style={{ marginTop: 8 }}>New orders are added automatically. Sync once to bring in existing customers and their order history.</div>
          <div className="nf-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="nf-btn-ghost" disabled={sync.running} onClick={() => runSync(false)}>{sync.running ? `Syncing… ${sync.processed.toLocaleString()}` : 'Sync WooCommerce customers'}</button>
          </div>
          <label className="nf-row" style={{ gap: 8, marginTop: 12, alignItems: 'flex-start', fontSize: 12, fontWeight: 600, color: '#3C3F55' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>I confirm my existing customers agreed to receive marketing email from this store.</span>
          </label>
          <button type="button" className="nf-btn-ghost" style={{ marginTop: 8 }} disabled={!consent || sync.running} onClick={() => runSync(true)}>Sync and mark customers as subscribed</button>
          {sync.message && <div className="nf-hint" style={{ marginTop: 6 }}>{sync.message}</div>}
        </div>
      </div>
    </Modal>
  );
}
