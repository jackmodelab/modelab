import { createBooking, updateBooking } from '@/lib/portal/actions';
import { BookingEndPreview } from '@/components/booking-end-preview';
import { BookingSubmit } from '@/components/booking-submit';

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
 * the Supabase auth-cookie round-trip, so this stays server-rendered.) The two
 * interactive bits — the computed end-time preview and the pending submit
 * state — are isolated client islands that don't own the posting inputs.
 */
export function BookingForm({
  mode,
  clients,
  services,
  locations,
  serviceDurations,
  booking,
}: {
  mode: 'create' | 'edit';
  clients: Option[];
  services: Option[];
  locations: Option[];
  serviceDurations: Record<string, number>;
  booking?: ExistingBooking;
}) {
  const action = mode === 'create' ? createBooking : updateBooking;

  return (
    <form action={action} className="p-form">
      {mode === 'edit' && booking && <input type="hidden" name="id" value={booking.id} />}

      <div className="p-field">
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

      <div className="p-form-row-2">
        <div className="p-field">
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
        <div className="p-field">
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

      <div className="p-form-row-2">
        <div className="p-field">
          <label htmlFor="starts_at">Starts</label>
          <input id="starts_at" name="starts_at" type="datetime-local" defaultValue={booking?.startsLocal ?? ''} required />
        </div>
        <BookingEndPreview durations={serviceDurations} />
      </div>

      {mode === 'edit' && (
        <div className="p-field">
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

      <div className="p-form-actions">
        <BookingSubmit mode={mode} />
        <a className="link-arrow" href="/portal/schedule">
          Cancel
        </a>
      </div>
    </form>
  );
}
