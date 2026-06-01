'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  startOfWeek,
  startOfMonth,
  addDays,
  addWeeks,
  addMonths,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import { Icon } from '@/components/portal/icons';

export type CalBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  serviceName: string;
  locationName: string;
  status: string;
  notes?: string | null;
};

/** Merged open availability intervals (decimal hours) per weekday (0=Sun). */
export type WorkingMap = Record<number, { start: number; end: number }[]>;

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START_HOUR = 6;
const HOURS = Array.from({ length: 14 }, (_, i) => i + START_HOUR); // 06:00 → 19:00
const END_HOUR = START_HOUR + HOURS.length;
const PX_PER_HOUR = 56;
const HEADER_PX = 52;

const isCancelled = (s: string) => s.startsWith('cancelled') || s === 'no_show';
const isDone = (s: string) => s === 'completed';
const eventClass = (s: string) => (isDone(s) ? 'event is-done' : isCancelled(s) ? 'event is-cancelled' : 'event');

// ---- Day-of attendance (visual only — not persisted) ----
type Tone = 'neutral' | 'info' | 'active' | 'done' | 'danger' | 'muted';
const ATTENDANCE: { key: string; label: string; tone: Tone }[] = [
  { key: 'scheduled', label: 'Scheduled', tone: 'neutral' },
  { key: 'arrived', label: 'Arrived', tone: 'info' },
  { key: 'in_session', label: 'In-session', tone: 'active' },
  { key: 'completed', label: 'Completed', tone: 'done' },
  { key: 'no_show', label: 'No-show', tone: 'danger' },
  { key: 'cancelled', label: 'Cancelled', tone: 'muted' },
];
const attMeta = (key: string) => ATTENDANCE.find((o) => o.key === key) ?? ATTENDANCE[0];
function deriveAttendance(status: string): string {
  if (status === 'completed') return 'completed';
  if (status === 'no_show') return 'no_show';
  if (status.startsWith('cancelled')) return 'cancelled';
  return 'scheduled';
}

const keyOf = (d: Date) => format(d, 'yyyy-MM-dd');

export function BookingCalendar({
  bookings,
  working = {},
}: {
  bookings: CalBooking[];
  working?: WorkingMap;
}) {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [miniMonth, setMiniMonth] = useState<Date>(() => startOfMonth(new Date()));
  // Local, non-persistent day-of attendance overrides keyed by booking id.
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const now = new Date();

  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const k = keyOf(parseISO(b.startsAt));
      const list = m.get(k) ?? [];
      list.push(b);
      m.set(k, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [bookings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const setAtt = (id: string, key: string) => {
    setAttendance((a) => ({ ...a, [id]: key }));
    setToast(`Marked ${attMeta(key).label.toLowerCase()}.`);
  };

  const attOf = (b: CalBooking) => attendance[b.id] ?? deriveAttendance(b.status);

  const eventStyle = (b: CalBooking) => {
    const start = parseISO(b.startsAt);
    const end = parseISO(b.endsAt);
    const startH = start.getHours() + start.getMinutes() / 60;
    const durH = Math.max(0.25, (end.getTime() - start.getTime()) / 3_600_000);
    return { top: `${(startH - START_HOUR) * PX_PER_HOUR}px`, height: `${Math.max(28, durH * PX_PER_HOUR - 2)}px` };
  };

  // Non-working ranges (complement of open availability) within the visible window.
  const nonWorking = (weekday: number) => {
    const open = (working[weekday] ?? []).slice().sort((a, b) => a.start - b.start);
    const out: { start: number; end: number }[] = [];
    let cursor = START_HOUR;
    for (const w of open) {
      const s = Math.max(w.start, START_HOUR);
      const e = Math.min(w.end, END_HOUR);
      if (s > cursor) out.push({ start: cursor, end: Math.min(s, END_HOUR) });
      cursor = Math.max(cursor, e);
      if (cursor >= END_HOUR) break;
    }
    if (cursor < END_HOUR) out.push({ start: cursor, end: END_HOUR });
    return out;
  };

  const nowLineTop = useMemo(() => {
    if (!weekDays.some((d) => isSameDay(d, now))) return null;
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < START_HOUR || h > END_HOUR) return null;
    return HEADER_PX + (h - START_HOUR) * PX_PER_HOUR;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays]);

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(addDays(weekStart, 6), 'd MMM yyyy')}`;
  const selectedList = byDay.get(keyOf(anchor)) ?? [];

  // Mini-month cells
  const miniCells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(miniMonth), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [miniMonth]);

  return (
    <div className="cal-layout">
      <div className="surface">
        <div className="cal-toolbar">
          <div className="cal-title">{weekLabel}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="cal-mode">
              <button type="button" className="active">Week</button>
            </div>
            <div className="cal-nav">
              <button type="button" aria-label="Previous week" onClick={() => setAnchor((d) => addWeeks(d, -1))}>
                <Icon.chevronL />
              </button>
              <button
                type="button"
                className="today-btn"
                onClick={() => { setAnchor(new Date()); setMiniMonth(startOfMonth(new Date())); }}
              >
                Today
              </button>
              <button type="button" aria-label="Next week" onClick={() => setAnchor((d) => addWeeks(d, 1))}>
                <Icon.chevronR />
              </button>
            </div>
          </div>
        </div>

        <div className="week">
          <div className="week-header">
            <div className="week-corner" />
            {weekDays.map((d) => (
              <div key={keyOf(d)} className={`week-day ${isSameDay(d, now) ? 'is-today' : ''}`}>
                <div className="week-day-name">{DOW[(d.getDay() + 6) % 7]}</div>
                <div className="week-day-num">{format(d, 'd')}</div>
              </div>
            ))}
          </div>

          <div className="week-grid">
            <div className="hour-col">
              {HOURS.map((h) => (
                <div key={h} className="hour-cell" style={{ position: 'relative' }}>
                  <span className="hour-label">{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            {weekDays.map((d) => {
              const dayB = byDay.get(keyOf(d)) ?? [];
              const nw = nonWorking(d.getDay());
              return (
                <div
                  key={keyOf(d)}
                  className={`day-col ${isSameDay(d, now) ? 'is-today' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Focus ${format(d, 'EEEE d MMMM')}`}
                  onClick={() => setAnchor(d)}
                  onKeyDown={(e) => {
                    // Only act on the column itself — let event links handle their own keys.
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAnchor(d);
                    }
                  }}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="hour-cell" />
                  ))}
                  {nw.map((r, i) => (
                    <div
                      key={`nw-${i}`}
                      className="non-working"
                      style={{ top: `${(r.start - START_HOUR) * PX_PER_HOUR}px`, height: `${(r.end - r.start) * PX_PER_HOUR}px` }}
                    />
                  ))}
                  {dayB.map((b) => {
                    const att = attMeta(attOf(b));
                    return (
                      <a
                        key={b.id}
                        className={eventClass(b.status)}
                        style={eventStyle(b)}
                        href={`/portal/bookings/${b.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        title={`${b.clientName} — ${b.serviceName} · ${att.label}`}
                      >
                        <div className="event-time">
                          <span className={`event-att-dot att--${att.tone}`} />
                          {format(parseISO(b.startsAt), 'HH:mm')}
                        </div>
                        <div className="event-name">{b.clientName.split(' ')[0]}</div>
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {nowLineTop != null && <div className="now-line" style={{ top: `${nowLineTop}px` }} />}
        </div>
      </div>

      {/* Side: mini-month + day detail */}
      <div className="cal-side">
        <div className="surface">
          <div className="mini-cal">
            <div className="mini-cal-head">
              <div className="mini-cal-title">{format(miniMonth, 'MMMM yyyy')}</div>
              <div className="mini-cal-nav">
                <button type="button" aria-label="Previous month" onClick={() => setMiniMonth((m) => addMonths(m, -1))}>‹</button>
                <button type="button" aria-label="Next month" onClick={() => setMiniMonth((m) => addMonths(m, 1))}>›</button>
              </div>
            </div>
            <div className="mini-grid">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="mini-weekday">{d}</div>
              ))}
              {miniCells.map((d) => {
                const outside = d.getMonth() !== miniMonth.getMonth();
                const has = (byDay.get(keyOf(d)) ?? []).length > 0;
                return (
                  <button
                    key={keyOf(d)}
                    type="button"
                    className={`mini-day ${outside ? 'outside' : ''} ${isSameDay(d, now) ? 'is-today' : ''} ${isSameDay(d, anchor) ? 'is-selected' : ''} ${has ? 'has-events' : ''}`}
                    onClick={() => setAnchor(new Date(d))}
                  >
                    {format(d, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section className="surface" style={{ marginTop: 20 }}>
          <div className="surface-head">
            <h2>
              {format(anchor, 'EEE d MMM')}
              <span className="count">{selectedList.length}</span>
            </h2>
            <a className="link-arrow" href="/portal/bookings/new">Add <Icon.arrowR /></a>
          </div>
          <div className="surface-body">
            {selectedList.length === 0 ? (
              <p className="empty">Nothing scheduled.</p>
            ) : (
              selectedList.map((b) => (
                <div className="row-item day-row" key={b.id} style={{ padding: '12px 16px' }}>
                  <div className="ri-main">
                    <div className="ri-title" style={{ fontSize: 13 }}>{b.clientName}</div>
                    <div className="ri-sub">{format(parseISO(b.startsAt), 'h:mmaaa')} · {b.serviceName}</div>
                    <div className="ri-sub" style={{ marginTop: 1 }}>{b.locationName}</div>
                    {b.notes && (
                      <div className="day-row-note" title={b.notes}>
                        <span className="day-row-note-ico">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </span>
                        <span className="day-row-note-text">{b.notes}</span>
                      </div>
                    )}
                    <div className="day-row-controls">
                      <AttendanceSelect value={attOf(b)} onChange={(k) => setAtt(b.id, k)} />
                    </div>
                  </div>
                  <div className="ri-actions" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <a className="btn btn--mini btn--ghost" href={`/portal/bookings/${b.id}/edit`}>Edit</a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="toast-stack">
          <div className="toast"><Icon.check /><span>{toast}</span></div>
        </div>
      )}
    </div>
  );
}

function AttendanceSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = attMeta(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="att-select" ref={ref}>
      <button
        type="button"
        className={`att-trigger att--${meta.tone}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="att-dot" />
        <span className="att-label">{meta.label}</span>
        <svg className="att-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="att-menu" role="listbox">
          {ATTENDANCE.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="option"
              aria-selected={opt.key === value}
              className={`att-option att--${opt.tone} ${opt.key === value ? 'is-selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onChange(opt.key); setOpen(false); }}
            >
              <span className="att-dot" />
              <span className="att-label">{opt.label}</span>
              {opt.key === value && (
                <svg className="att-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
