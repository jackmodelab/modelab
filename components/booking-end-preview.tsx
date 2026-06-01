'use client';

import { useEffect, useState } from 'react';

/**
 * Read-only "Ends" field for the booking form. Observes the sibling
 * #service_id and #starts_at form controls (by id) and shows the computed
 * end time = start + the selected service's duration_minutes.
 *
 * Intentionally decoupled from form submission: the booking <form> stays a
 * server component, so this island only reads the DOM and never owns the
 * inputs that post. Falls back to a 45-minute default to match the server.
 */
export function BookingEndPreview({ durations }: { durations: Record<string, number> }) {
  const [end, setEnd] = useState('—');

  useEffect(() => {
    const serviceEl = document.getElementById('service_id') as HTMLSelectElement | null;
    const startEl = document.getElementById('starts_at') as HTMLInputElement | null;
    if (!serviceEl || !startEl) return;

    const recompute = () => {
      const startVal = startEl.value;
      if (!startVal) {
        setEnd('—');
        return;
      }
      const start = new Date(startVal);
      if (Number.isNaN(start.getTime())) {
        setEnd('—');
        return;
      }
      const dur = durations[serviceEl.value] ?? 45;
      const finish = new Date(start.getTime() + dur * 60000);
      setEnd(
        finish.toLocaleString(undefined, {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      );
    };

    recompute();
    serviceEl.addEventListener('change', recompute);
    startEl.addEventListener('input', recompute);
    startEl.addEventListener('change', recompute);
    return () => {
      serviceEl.removeEventListener('change', recompute);
      startEl.removeEventListener('input', recompute);
      startEl.removeEventListener('change', recompute);
    };
  }, [durations]);

  return (
    <div className="p-field">
      <label htmlFor="ends_preview">Ends</label>
      <input id="ends_preview" type="text" value={end} readOnly tabIndex={-1} aria-readonly="true" />
      <span className="p-field-hint">Auto from service duration</span>
    </div>
  );
}
