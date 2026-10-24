import { useEffect, useState } from 'react';
import { config } from '../config';
import { NAV, PALETTE_ROUTES } from './nav';

const SOON = 'Coming soon';

export function Sidebar({ active }: { active: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside className="nf-sidebar">
      <div className="nf-sidebar-brand">
        <div className="nf-sidebar-logo">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9 6 9-6M4 19h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1z" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#14152A', letterSpacing: '-.2px' }}>Noonfy</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#8A8DA3', letterSpacing: '.4px', textTransform: 'uppercase' }}>Email Automation</div>
        </div>
      </div>

      <button type="button" className="nf-sidebar-search" onClick={() => setPaletteOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <span>Search…</span>
        <span className="nf-kbd">⌘K</span>
      </button>

      <nav className="nf-sidebar-nav">
        {NAV.map((g, gi) => (
          <div key={gi} style={{ marginTop: 10 }}>
            {g.label && <div className="nf-nav-group-label">{g.label}</div>}
            {g.items.map(it => {
              const isActive = it.key === active;
              return (
                <a key={it.key} href={it.href ?? undefined} aria-current={isActive ? 'page' : undefined}
                  aria-disabled={it.href ? undefined : true} title={it.href ? undefined : SOON}
                  className={'nf-nav-item' + (it.sub ? ' nf-nav-item--sub' : '') + (isActive ? ' nf-nav-item--active' : '') + (it.href ? '' : ' nf-nav-item--soon')}>
                  {it.icon && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#4F46E5' : '#8A8DA3'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={it.icon} /></svg>
                  )}
                  {/* Sub-items without an icon get a spacer; sub-items with one (e.g. Calendar) show both, as in the design. */}
                  {it.sub && <span style={{ width: 15, display: 'inline-block' }} />}
                  <span>{it.label}</span>
                  {it.badge && <span className="nf-nav-badge">{it.badge}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="nf-sidebar-user">
        <div className="nf-avatar">{config.user.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nf-ellipsis" style={{ fontSize: 12.5, fontWeight: 700, color: '#14152A' }}>{config.user.name}</div>
          <div className="nf-ellipsis" style={{ fontSize: 11, color: '#8A8DA3' }}>{config.site.host}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A0A3B8" strokeWidth="2" strokeLinecap="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </aside>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();
  const results = q ? PALETTE_ROUTES.filter(r => (r.label + ' ' + r.group).toLowerCase().includes(q)) : PALETTE_ROUTES.slice(0, 9);

  return (
    <div className="nf-palette-backdrop" onClick={onClose}>
      <div className="nf-palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={e => e.stopPropagation()}>
        <div className="nf-row" style={{ gap: 10, padding: '14px 16px', borderBottom: '1px solid #ECEDF4' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8DA3" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input autoFocus className="nf-palette-input" placeholder="Jump to a page or action…" value={query} onChange={e => setQuery(e.target.value)} />
          <span style={{ fontSize: 10, background: '#F3F3FA', borderRadius: 5, padding: '2px 6px', color: '#A0A3B8', fontWeight: 700 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: 8 }}>
          {results.map(r => (
            <a key={r.label + r.group} href={r.href ?? undefined} onClick={onClose} className="nf-palette-result"
              aria-disabled={r.href ? undefined : true} title={r.href ? undefined : SOON}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: r.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{r.glyph}</span>
              <span>{r.label}</span>
              <span className="nf-ml-auto" style={{ fontSize: 11, color: '#A0A3B8', fontWeight: 600 }}>{r.group}</span>
            </a>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#8A8DA3', fontSize: 13 }}>No matches — try “automations” or “revenue”.</div>
          )}
        </div>
      </div>
    </div>
  );
}
