import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { addAvailability, deleteAvailability, toggleAvailability } from '@/lib/portal/actions';
import type { StaffAvailabilityRow } from '@/types/database';

export const metadata = { title: 'Availability — MODE Lab' };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

export default async function AvailabilityPage() {
  const { staff } = await requireStaff();
  const supabase = createSupabaseServer();

  const [{ data: avail }, { data: locations }] = await Promise.all([
    supabase.from('staff_availability').select('*').eq('staff_id', staff.id),
    supabase.from('locations').select('id,name,suburb,status'),
  ]);

  const blocks = (avail ?? []) as StaffAvailabilityRow[];
  const locs = (locations ?? []) as { id: string; name: string; suburb: string | null }[];
  const locName = new Map(locs.map((l) => [l.id, l.suburb || l.name]));

  const byDay = new Map<number, StaffAvailabilityRow[]>();
  for (const b of blocks) {
    const list = byDay.get(b.weekday) ?? [];
    list.push(b);
    byDay.set(b.weekday, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Availability</p>
          <h1>Your weekly availability.</h1>
        </div>
        <div className="page-head-actions">
          <a className="btn btn--ghost" href="/portal/schedule">
            View calendar
          </a>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '60ch', marginBottom: '1.5rem', fontSize: '13.5px' }}>
        These are the recurring windows you&rsquo;re open to train. They&rsquo;ll drive the slots clients can book once
        the booking flow is live.
      </p>

      {/* Add a block */}
      <form action={addAvailability} className="p-form" style={{ maxWidth: 'none', display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr 1.4fr auto', gap: 14, alignItems: 'end', padding: 20, marginBottom: 20 }}>
        <div className="p-field">
          <label htmlFor="weekday">Day</label>
          <select id="weekday" name="weekday" defaultValue="1">
            {DISPLAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="p-field">
          <label htmlFor="start_time">From</label>
          <input id="start_time" name="start_time" type="time" defaultValue="06:00" required />
        </div>
        <div className="p-field">
          <label htmlFor="end_time">To</label>
          <input id="end_time" name="end_time" type="time" defaultValue="12:00" required />
        </div>
        <div className="p-field">
          <label htmlFor="location_id">Location</label>
          <select id="location_id" name="location_id" defaultValue="any">
            <option value="any">Any location</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.suburb || l.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">
          Add block
        </button>
      </form>

      {/* Current blocks */}
      <section className="surface">
        <div className="surface-head">
          <h2>
            Recurring blocks
            <span className="count">{blocks.length} total</span>
          </h2>
        </div>
        <div className="surface-body">
          {blocks.length === 0 ? (
            <p className="empty">No availability set yet. Add your first block above.</p>
          ) : (
            DISPLAY_ORDER.filter((d) => byDay.has(d)).map((d) => (
              <div key={d}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--slate-soft)', padding: '14px 20px 4px' }}>
                  {WEEKDAYS[d]}
                </div>
                {byDay.get(d)!.map((b) => (
                  <div className="row-item" key={b.id}>
                    <div className="ri-main">
                      <div className="ri-title">
                        {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                      </div>
                      <div className="ri-sub">
                        {b.location_id ? locName.get(b.location_id) ?? 'Location' : 'Any location'}
                      </div>
                    </div>
                    <div className="ri-actions">
                      <span className={`pill ${b.is_active ? 'pill--ok' : ''}`}>
                        {b.is_active ? 'Open' : 'Off'}
                      </span>
                      <form action={toggleAvailability} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="next" value={(!b.is_active).toString()} />
                        <button className="avail-block-btn" type="submit">
                          {b.is_active ? 'Turn off' : 'Turn on'}
                        </button>
                      </form>
                      <form action={deleteAvailability} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="avail-block-btn is-danger" type="submit">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
