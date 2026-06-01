import Link from 'next/link';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { addAvailability } from '@/lib/portal/actions';
import { AvailBlock } from '@/components/portal/avail-block';
import type { StaffAvailabilityRow } from '@/types/database';

export const metadata = { title: 'Availability — MODE Lab' };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

export default async function AvailabilityPage() {
  const { staff } = await requireStaff();
  const supabase = createSupabaseServer();

  // 0 = Sun … 6 = Sat, matching the DB weekday column
  const todayWeekday = new Date().getDay();

  const [{ data: avail }, { data: locations }] = await Promise.all([
    supabase.from('staff_availability').select('*').eq('staff_id', staff.id),
    supabase.from('locations').select('id,name,suburb,status'),
  ]);

  const blocks = (avail ?? []) as StaffAvailabilityRow[];
  const locs = (locations ?? []) as { id: string; name: string; suburb: string | null }[];

  // Normalised location list — used in the add form and passed to AvailBlock for edit
  const locOptions = locs.map((l) => ({ id: l.id, name: l.suburb || l.name }));

  // Group blocks by weekday, sorted by start_time within each day
  const byDay = new Map<number, StaffAvailabilityRow[]>();
  for (const b of blocks) {
    const list = byDay.get(b.weekday) ?? [];
    list.push(b);
    byDay.set(b.weekday, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const activeCount = blocks.filter((b) => b.is_active).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Availability</p>
          <h1>Your weekly availability.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/schedule">
            View calendar
          </Link>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '60ch', marginBottom: '1.75rem', fontSize: '13.5px', lineHeight: 1.55 }}>
        These are the recurring windows you&rsquo;re open to train. They&rsquo;ll drive the slots
        clients can book once the booking flow is live.
      </p>

      {/* ── Add a block — clean 2×2 layout ── */}
      <div className="avail-form-card">
        <p className="avail-form-title">Add a block</p>
        <form action={addAvailability} className="avail-form-body">
          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="avail-weekday">Day</label>
              <select id="avail-weekday" name="weekday" defaultValue="1">
                {DISPLAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-field">
              <label htmlFor="avail-location">Location</label>
              <select id="avail-location" name="location_id" defaultValue="any">
                <option value="any">Any location</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.suburb || l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="avail-start">From</label>
              <input id="avail-start" name="start_time" type="time" defaultValue="06:00" required />
            </div>
            <div className="p-field">
              <label htmlFor="avail-end">To</label>
              <input id="avail-end" name="end_time" type="time" defaultValue="12:00" required />
            </div>
          </div>

          <button className="btn" type="submit">
            Add block →
          </button>
        </form>
      </div>

      {/* ── Recurring blocks list ── */}
      <section className="surface">
        <div className="surface-head">
          <h2>
            Recurring blocks
            <span className="count">
              {blocks.length} total · {activeCount} open
            </span>
          </h2>
        </div>

        <div className="surface-body">
          {blocks.length === 0 ? (
            <p className="empty">No availability set yet. Add your first block above.</p>
          ) : (
            DISPLAY_ORDER.filter((d) => byDay.has(d)).map((d) => (
              <div key={d}>
                {/* Day heading — highlighted if it's today */}
                <div className="avail-day-label">
                  {WEEKDAYS[d]}
                  {d === todayWeekday && (
                    <span className="avail-day-today">today</span>
                  )}
                </div>

                {byDay.get(d)!.map((b) => (
                  <AvailBlock
                    key={b.id}
                    block={{
                      id: b.id,
                      start_time: b.start_time,
                      end_time: b.end_time,
                      location_id: b.location_id,
                      is_active: b.is_active,
                    }}
                    locations={locOptions}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
