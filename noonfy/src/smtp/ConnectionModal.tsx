import { useState } from 'react';
import { api, errorMessage } from '../api';
import { config, type Connection, type ConnectionInput, type Encryption, type TestResult } from '../config';
import type { SmtpApi } from './useSmtpState';
import { Modal, Toggle } from '../shared/ui';

const ENCRYPTIONS: { key: Encryption; label: string }[] = [
  { key: 'tls', label: 'TLS (STARTTLS)' }, { key: 'ssl', label: 'SSL' }, { key: 'none', label: 'None' },
];

function fromPreset(provider: string, nextPriority: number): ConnectionInput {
  const p = config.presets[provider] ?? config.presets.smtp;
  return {
    provider, name: p.label, host: p.host, port: p.port, encryption: p.encryption, username: p.username, password: '',
    fromEmail: '', fromName: '', priority: nextPriority, weight: 0, dailyLimit: 0, enabled: true,
  };
}

function fromConnection(c: Connection): ConnectionInput {
  const { id: _id, hasPassword: _h, createdAt: _c, lastTest: _l, ...rest } = c;
  return { ...rest, password: '' };
}

/** Add / edit an SMTP connection, with an inline "test before saving". */
export function ConnectionModal({ api: smtp }: { api: SmtpApi }) {
  const { state, update, saveConnection, deleteConnection } = smtp;
  const editing = state.editing!;
  const existing = state.connections.find(c => c.id === editing.id);
  const nextPriority = Math.max(0, ...state.connections.map(c => c.priority)) + 1;
  const [form, setForm] = useState<ConnectionInput>(() =>
    existing ? fromConnection(existing) : fromPreset(editing.preset ?? 'smtp', nextPriority));
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'delete'>('');
  const [test, setTest] = useState<TestResult | null>(null);

  const preset = config.presets[form.provider] ?? config.presets.smtp;
  const set = (patch: Partial<ConnectionInput>) => { setForm(f => ({ ...f, ...patch })); setTest(null); };
  const close = () => update({ editing: null });

  const changeProvider = (provider: string) => {
    const next = fromPreset(provider, form.priority);
    // Keep what the user typed that isn't provider-specific.
    set({ ...next, password: form.password, fromEmail: form.fromEmail, fromName: form.fromName, priority: form.priority, weight: form.weight, dailyLimit: form.dailyLimit, enabled: form.enabled });
  };

  const runTest = () => {
    setBusy('test'); setTest(null);
    api.testConfig({ ...form, id: existing?.id })
      .then(setTest)
      .catch(e => setTest({ ok: false, latencyMs: null, error: errorMessage(e) }))
      .finally(() => setBusy(''));
  };

  const save = () => {
    setBusy('save');
    saveConnection(existing?.id ?? '', form).then(close).catch(() => undefined).finally(() => setBusy(''));
  };

  const remove = () => {
    if (!existing || !window.confirm(`Delete “${existing.name}”? Email will stop routing through it.`)) return;
    setBusy('delete');
    deleteConnection(existing).catch(() => undefined).finally(() => setBusy(''));
  };

  const num = (v: string) => (v === '' ? 0 : parseInt(v, 10) || 0);
  const needsPassword = !existing?.hasPassword && form.username !== '';

  return (
    <Modal
      title={existing ? 'Edit connection' : 'Add connection'}
      onClose={close}
      footer={(
        <>
          {existing && <button type="button" className="nf-btn-danger" onClick={remove} disabled={!!busy}>Delete</button>}
          <button type="button" className="nf-btn-ghost nf-ml-auto" onClick={runTest} disabled={!!busy || !form.host}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" className="nf-btn-primary" onClick={save} disabled={!!busy || !form.host || (needsPassword && !form.password)}>
            {busy === 'save' ? 'Saving…' : existing ? 'Save changes' : 'Add connection'}
          </button>
        </>
      )}
    >
      <div className="nf-form-grid">
        <label className="nf-span2">
          <span className="nf-label">Provider</span>
          <select className="nf-field" value={form.provider} onChange={e => changeProvider(e.target.value)}>
            {Object.entries(config.presets).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </select>
          {preset.help && <div className="nf-hint">{preset.help}</div>}
        </label>

        <label className="nf-span2">
          <span className="nf-label">Connection name</span>
          <input className="nf-field" value={form.name} onChange={e => set({ name: e.target.value })} />
        </label>

        <label className="nf-span2">
          <span className="nf-label">SMTP host</span>
          <input className="nf-field nf-mono" value={form.host} placeholder="smtp.example.com" onChange={e => set({ host: e.target.value })} />
        </label>

        <label>
          <span className="nf-label">Port</span>
          <input className="nf-field" type="number" min={1} max={65535} value={form.port} onChange={e => set({ port: num(e.target.value) })} />
        </label>
        <label>
          <span className="nf-label">Encryption</span>
          <select className="nf-field" value={form.encryption} onChange={e => set({ encryption: e.target.value as Encryption })}>
            {ENCRYPTIONS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>

        <label>
          <span className="nf-label">{preset.usernameLabel}</span>
          <input className="nf-field" value={form.username} disabled={!!preset.username} autoComplete="off" onChange={e => set({ username: e.target.value })} />
        </label>
        <label>
          <span className="nf-label">{preset.passwordLabel}</span>
          <input className="nf-field" type="password" value={form.password} autoComplete="new-password"
            placeholder={existing?.hasPassword ? 'Saved (leave blank to keep)' : ''} onChange={e => set({ password: e.target.value })} />
        </label>

        <label>
          <span className="nf-label">From email (optional)</span>
          <input className="nf-field" value={form.fromEmail} placeholder={state.fromEmail || 'Uses the default sender'} onChange={e => set({ fromEmail: e.target.value })} />
        </label>
        <label>
          <span className="nf-label">From name (optional)</span>
          <input className="nf-field" value={form.fromName} placeholder={state.fromName} onChange={e => set({ fromName: e.target.value })} />
        </label>
        <div className="nf-span2 nf-hint" style={{ marginTop: -6 }}>Most providers only accept a from address on a domain you've verified with them.</div>

        <label>
          <span className="nf-label">Priority (1 = first)</span>
          <input className="nf-field" type="number" min={1} max={99} value={form.priority} onChange={e => set({ priority: num(e.target.value) })} />
        </label>
        <label>
          <span className="nf-label">Weight % (weighted strategy)</span>
          <input className="nf-field" type="number" min={0} max={100} value={form.weight} onChange={e => set({ weight: num(e.target.value) })} />
        </label>
        <label>
          <span className="nf-label">Daily limit (0 = unlimited)</span>
          <input className="nf-field" type="number" min={0} value={form.dailyLimit} onChange={e => set({ dailyLimit: num(e.target.value) })} />
        </label>
        <div>
          <span className="nf-label">Enabled</span>
          <div className="nf-row" style={{ gap: 9, minHeight: 34 }}>
            <Toggle size="lg" on={form.enabled} onChange={() => set({ enabled: !form.enabled })} label="Enabled" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5B5E75' }}>{form.enabled ? 'Routing email' : 'Paused'}</span>
          </div>
        </div>
      </div>

      {test && (
        <div className="nf-test-result" role="status">
          <span className="nf-tag" style={test.ok ? { color: '#0E9F6E', background: '#EDF9F1' } : { color: '#E02424', background: '#FDEDED' }}>{test.ok ? 'PASS' : 'FAIL'}</span>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{test.ok ? `Connected and authenticated in ${test.latencyMs}ms.` : test.error}</span>
        </div>
      )}
    </Modal>
  );
}
