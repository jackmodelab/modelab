import { createBooking, updateBooking } from '@/lib/portal/actions';

type Option = { id: string; name: string };

export type ExistingBooking = {
  id: string;
  clientId: string;
  serviceId: string;
  locationId: string;
  startsLocal: string; // "yyyy-MM-ddTHH:mm"
  status: string;
};

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled_24hr_plus', label: 'Cancelled' },
];

/**
 * Server component — renders a plain progressive-enhancement form bound to a
 * server action. (Invoking server actions from a 'use client' component breaks
 * the Supabase auth-cookie round-trip, so this stays server-rendered.)
 */
export function BookingForm({
  mode,
  clients,
  services,
  locations,
  booking,
}: {
  mode: 'create' | 'edit';
  clients: Option[];
  services: Option[];
  locations: Option[];
  booking?: ExistingBooking;
}) {
  const action = mode === 'create' ? createBooking : updateBooking;

  return (
    <form action={action} className="stack" style={{ maxWidth: '560px' }}>
      {mode === 'edit' && booking && <input type="hidden" name="id" value={booking.id} />}

      <div className="field">
        <label htmlFor="client_id">Client</label>
        <select id="client_id" name="client_id" defaultValue={booking?.clientId ?? ''} required>
          <option value="" disabled>
            Select a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-2" style={{ gap: '1.2rem' }}>
        <div className="field">
          <label htmlFor="service_id">Service</label>
          <select id="service_id" name="service_id" defaultValue={booking?.serviceId ?? ''} required>
            <option value="" disabled>
              Select…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="location_id">Location</label>
          <select id="location_id" name="location_id" defaultValue={booking?.locationId ?? ''} required>
            <option value="" disabled>
              Select…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: '1.2rem' }}>
        <div className="field">
          <label htmlFor="starts_at">Starts</label>
          <input id="starts_at" name="starts_at" type="datetime-local" defaultValue={booking?.startsLocal ?? ''} required />
        </div>
        {mode === 'edit' && (
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={booking?.status ?? 'confirmed'}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <button className="btn" type="submit">
          {mode === 'create' ? 'Create booking' : 'Save changes'} <span className="arrow">&rarr;</span>
        </button>
        <a className="text-link" href="/portal/schedule" style={{ display: 'inline-flex' }}>
          Cancel
        </a>
      </div>
    </form>
  );
}
