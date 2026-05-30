import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';
import { BookFlow, type FlowAvailabilityBlock, type FlowCoach, type FlowLocation, type FlowService } from '@/components/account/book-flow';

export const metadata = { title: 'Book a session — MODE Lab' };

function toMinutes(timeStr: string) {
  // 'HH:MM:SS' or 'HH:MM'
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default async function BookPage() {
  const { client } = await requireClient();

  // Clients can browse services, coaches, and times freely, but the pre-screening
  // health questionnaire must be complete before a booking can be confirmed.
  const screeningComplete = client ? await hasCompletedScreening(client.id) : false;

  const supabase = createSupabaseServer();

  const [{ data: services }, { data: locations }, { data: staff }, { data: avail }] = await Promise.all([
    supabase
      .from('services')
      .select('id,name,duration_minutes,description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('locations').select('id,name,suburb,address').order('name', { ascending: true }),
    supabase.from('staff').select('id,display_name,title,bio').eq('is_active', true),
    supabase.from('staff_availability').select('staff_id,weekday,start_time,end_time,location_id,is_active'),
  ]);

  const svcRows = (services ?? []) as { id: string; name: string; duration_minutes: number; description: string | null }[];
  const flowServices: FlowService[] = svcRows.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.duration_minutes,
    blurb: s.description,
  }));

  const locRows = (locations ?? []) as { id: string; name: string; suburb: string | null; address: string | null }[];
  const flowLocations: FlowLocation[] = locRows.map((l) => ({
    id: l.id,
    name: l.suburb || l.name,
    address: l.address ?? '',
  }));

  const staffRows = (staff ?? []) as { id: string; display_name: string; title: string | null; bio: string | null }[];
  const flowCoaches: FlowCoach[] = staffRows.map((s) => {
    const parts = (s.display_name || '').trim().split(/\s+/);
    const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || s.display_name[0]?.toUpperCase() || '?';
    return { id: s.id, name: s.display_name, initials, title: s.title, bio: s.bio };
  });

  const availRows = (avail ?? []) as {
    staff_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    location_id: string | null;
    is_active: boolean;
  }[];
  const flowAvailability: FlowAvailabilityBlock[] = availRows
    .filter((b) => b.is_active)
    .map((b) => ({
      coachId: b.staff_id,
      locationId: b.location_id,
      weekday: b.weekday,
      startMinute: toMinutes(b.start_time),
      endMinute: toMinutes(b.end_time),
    }));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member · Book</p>
          <h1>Book a session.</h1>
        </div>
      </header>

      <BookFlow
        services={flowServices}
        locations={flowLocations}
        coaches={flowCoaches}
        availability={flowAvailability}
        screeningComplete={screeningComplete}
      />
    </>
  );
}
