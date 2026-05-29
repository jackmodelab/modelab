'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';

export type CalBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  serviceName: string;
  locationName: string;
  status: string;
};

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const isCancelled = (s: string) => s.startsWith('cancelled') || s === 'no_show';
const isDone = (s: string) => s === 'completed';

export function BookingCalendar({ bookings }: { bookings: CalBooking[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const key = format(parseISO(b.startsAt), 'yyyy-MM-dd');
      const list = m.get(key) ?? [];
      list.push(b);
      m.set(key, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [bookings]);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const keyOf = (d: Date) => format(d, 'yyyy-MM-dd');
  const today = new Date();

  const selectedList = byDay.get(keyOf(selected)) ?? [];

  return (
    <div className="cal-layout">
      <div>
        <div className="cal-toolbar">
          <h2>{format(cursor, 'MMMM yyyy')}</h2>
          <div className="cal-nav">
            <button type="button" aria-label="Previous month" onClick={() => setCursor((c) => addMonths(c, -1))}>
              &larr;
            </button>
            <button type="button" className="today-btn" onClick={() => { setCursor(startOfMonth(new Date())); setSelected(new Date()); }}>
              Today
            </button>
            <button type="button" aria-label="Next month" onClick={() => setCursor((c) => addMonths(c, 1))}>
              &rarr;
            </button>
          </div>
        </div>

        <div className="cal">
          <div className="cal-dow">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {days.map((d) => {
              const list = byDay.get(keyOf(d)) ?? [];
              const outside = !isSameMonth(d, cursor);
              const classes = [
                'cal-cell',
                outside ? 'is-outside' : '',
                isSameDay(d, today) ? 'is-today' : '',
                isSameDay(d, selected) ? 'is-selected' : '',
              ].join(' ');
              return (
                <div key={keyOf(d)} className={classes} onClick={() => setSelected(d)}>
                  <span className="cal-num">{format(d, 'd')}</span>
                  {list.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className={`cal-chip ${isCancelled(b.status) ? 'is-cancelled' : isDone(b.status) ? 'is-done' : ''}`}
                      title={`${format(parseISO(b.startsAt), 'h:mm a')} · ${b.clientName} · ${b.serviceName}`}
                    >
                      {format(parseISO(b.startsAt), 'h:mm')} {b.clientName.split(' ')[0]}
                    </span>
                  ))}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail */}
      <section className="panel day-panel">
        <div className="panel-head">
          <h2>{format(selected, 'EEE d MMM')}</h2>
          <span className="when">{selectedList.length} session{selectedList.length === 1 ? '' : 's'}</span>
        </div>
        <div className="panel-body">
          {selectedList.length === 0 ? (
            <p className="empty">Nothing booked this day.</p>
          ) : (
            selectedList.map((b) => (
              <div className="row-item" key={b.id}>
                <div className="ri-main">
                  <div className="ri-title">{b.clientName}</div>
                  <div className="ri-sub">
                    {format(parseISO(b.startsAt), 'h:mm a')}–{format(parseISO(b.endsAt), 'h:mm a')} · {b.serviceName} · {b.locationName}
                  </div>
                </div>
                <div className="ri-meta" style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  {isCancelled(b.status) ? (
                    <span className="tag tag--muted">Cancelled</span>
                  ) : isDone(b.status) ? (
                    <span className="tag">Done</span>
                  ) : (
                    <span className="tag tag--ok">{b.status === 'rescheduled' ? 'Rescheduled' : 'Confirmed'}</span>
                  )}
                  <a className="btn-mini btn-mini--neutral" href={`/portal/bookings/${b.id}/edit`}>
                    Edit
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
