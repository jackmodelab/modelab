'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { createBlock, createBookingFromCalendar } from '@/lib/portal/actions';

export type SlotOption = { id: string; name: string };

/** Format a Date as the value a <input type="datetime-local"> expects. */
const dtLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/**
 * Quick-action popup opened from a calendar cell: book a client into the slot,
 * or block the time out. Both submit through server actions and report back so
 * the calendar can close + refresh in place (no navigation).
 */
export function SlotModal({
  start,
  clients,
  services,
  locations,
  serviceDurations,
  onClose,
  onDone,
}: {
  start: Date;
  clients: SlotOption[];
  services: SlotOption[];
  locations: SlotOption[];
  serviceDurations: Record<string, number>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [tab, setTab] = useState<'book' | 'block'>('book');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startLocal = dtLocal(start);
  // Default booking length from the first service; default block is one hour.
  const firstService = services[0]?.id;
  const blockEndLocal = dtLocal(new Date(start.getTime() + 60 * 60000));

  const submit = (fd: FormData, action: (f: FormData) => Promise<{ ok: true } | { error: string }>, ok: string) => {
    setError(null);
    startTransition(async () => {
      const res = await action(fd);
      if ('error' in res) setError(res.error);
      else onDone(ok);
    });
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="p-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
        <h3 id="slot-modal-title">{format(start, 'EEE d MMM · h:mmaaa')}</h3>

        <div className="slot-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'book'}
            className={`slot-tab ${tab === 'book' ? 'is-active' : ''}`}
            onClick={() => { setTab('book'); setError(null); }}
          >
            Book a client
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'block'}
            className={`slot-tab ${tab === 'block' ? 'is-active' : ''}`}
            onClick={() => { setTab('block'); setError(null); }}
          >
            Block time
          </button>
        </div>

        {error && <div className="p-form-banner" role="alert">{error}</div>}

        {tab === 'book' ? (
          <form
            className="p-form slot-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget), createBookingFromCalendar, 'Booked.');
            }}
          >
            <div className="p-field">
              <label htmlFor="slot-client">Client</label>
              <select id="slot-client" name="client_id" defaultValue="" required>
                <option value="" disabled>Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="p-form-row-2">
              <div className="p-field">
                <label htmlFor="slot-service">Service</label>
                <select id="slot-service" name="service_id" defaultValue={firstService ?? ''} required>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{serviceDurations[s.id] ? ` · ${serviceDurations[s.id]}min` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-field">
                <label htmlFor="slot-location">Location</label>
                <select id="slot-location" name="location_id" defaultValue={locations[0]?.id ?? ''} required>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-field">
              <label htmlFor="slot-start">Starts</label>
              <input id="slot-start" name="starts_at" type="datetime-local" defaultValue={startLocal} required />
            </div>

            <div className="p-modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={pending || clients.length === 0}>
                {pending ? 'Booking…' : 'Book'}
              </button>
            </div>
            {clients.length === 0 && (
              <p className="slot-hint">No clients yet — add one first.</p>
            )}
          </form>
        ) : (
          <form
            className="p-form slot-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget), createBlock, 'Time blocked.');
            }}
          >
            <div className="p-form-row-2">
              <div className="p-field">
                <label htmlFor="block-start">From</label>
                <input id="block-start" name="starts_at" type="datetime-local" defaultValue={startLocal} required />
              </div>
              <div className="p-field">
                <label htmlFor="block-end">To</label>
                <input id="block-end" name="ends_at" type="datetime-local" defaultValue={blockEndLocal} required />
              </div>
            </div>
            <div className="p-field">
              <label htmlFor="block-reason">Reason (optional)</label>
              <input id="block-reason" name="reason" placeholder="Lunch, admin, leave…" maxLength={200} autoComplete="off" />
            </div>
            <div className="p-modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={pending}>
                {pending ? 'Blocking…' : 'Block time'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
