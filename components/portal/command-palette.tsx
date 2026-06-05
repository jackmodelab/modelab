'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconKey } from './icons';

export type PaletteClient = { id: string; name: string; email: string };

type Action = { id: string; title: string; sub: string; icon: IconKey; href: string };

const ACTIONS: Action[] = [
  { id: 'go-today', title: 'Go to Today', sub: 'Overview', icon: 'dashboard', href: '/portal' },
  { id: 'go-schedule', title: 'Go to Calendar', sub: 'Week view', icon: 'calendar', href: '/portal/schedule' },
  { id: 'go-availability', title: 'Edit availability', sub: 'Weekly blocks', icon: 'clock', href: '/portal/availability' },
  { id: 'go-clients', title: 'Browse clients', sub: 'Library', icon: 'users', href: '/portal/clients' },
  { id: 'new-booking', title: 'Create new booking', sub: 'Form', icon: 'plus', href: '/portal/bookings/new' },
];

/**
 * Staff command palette. Renders the topbar search trigger and a ⌘K-activated
 * overlay that jumps to portal pages or a client's detail. Read-only navigation
 * — no data mutations.
 */
export function CommandPalette({ clients }: { clients: PaletteClient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      // Focus after paint.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const lc = q.trim().toLowerCase();
  const matchedActions = useMemo(
    () => (lc ? ACTIONS.filter((a) => a.title.toLowerCase().includes(lc) || a.sub.toLowerCase().includes(lc)) : ACTIONS),
    [lc],
  );
  const matchedClients = useMemo(
    () =>
      lc
        ? clients
            .filter((c) => c.name.toLowerCase().includes(lc) || c.email.toLowerCase().includes(lc))
            .slice(0, 6)
        : [],
    [lc, clients],
  );

  type Flat = { key: string; title: string; sub: string; icon: IconKey; go: () => void };
  const flat: Flat[] = [
    ...matchedActions.map((a) => ({ key: a.id, title: a.title, sub: a.sub, icon: a.icon, go: () => navigate(a.href) })),
    ...matchedClients.map((c) => ({
      key: c.id,
      title: c.name,
      sub: c.email,
      icon: 'users' as IconKey,
      go: () => navigate(`/portal/clients/${c.id}`),
    })),
  ];

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  useEffect(() => setIdx(0), [q]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[idx]?.go(); }
  };

  return (
    <>
      <button className="search-pill" type="button" onClick={() => setOpen(true)} aria-label="Search">
        <Icon.search />
        <span>Search clients, bookings…</span>
        <span className="kbd">⌘ K</span>
      </button>

      {open && (
        <div className="palette-backdrop" onClick={() => setOpen(false)}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="palette-input"
              placeholder="Search clients, or jump to…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="palette-list">
              {flat.length === 0 ? (
                <div className="palette-empty">No matches.</div>
              ) : (
                <>
                  {matchedActions.length > 0 && <div className="palette-section">Jump to</div>}
                  {matchedActions.map((a, i) => {
                    const Ico = Icon[a.icon];
                    return (
                      <button
                        key={a.id}
                        className={`palette-item ${i === idx ? 'is-active' : ''}`}
                        onMouseEnter={() => setIdx(i)}
                        onClick={() => navigate(a.href)}
                      >
                        <Ico />
                        <div className="palette-item-text">
                          <div className="palette-item-title">{a.title}</div>
                          <div className="palette-item-sub">{a.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                  {matchedClients.length > 0 && <div className="palette-section">Clients</div>}
                  {matchedClients.map((c, i) => {
                    const fi = matchedActions.length + i;
                    return (
                      <button
                        key={c.id}
                        className={`palette-item ${fi === idx ? 'is-active' : ''}`}
                        onMouseEnter={() => setIdx(fi)}
                        onClick={() => navigate(`/portal/clients/${c.id}`)}
                      >
                        <Icon.users />
                        <div className="palette-item-text">
                          <div className="palette-item-title">{c.name}</div>
                          <div className="palette-item-sub">{c.email}</div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            <div className="palette-foot">
              <div><span className="kbd">↑↓</span>Navigate</div>
              <div><span className="kbd">↵</span>Select</div>
              <div><span className="kbd">esc</span>Close</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
