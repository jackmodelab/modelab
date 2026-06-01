import Link from 'next/link';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { BookingForm } from '@/components/booking-form';
import type { ClientRow } from '@/types/database';

export const metadata = { title: 'New booking — MODE Lab' };

export default async function NewBookingPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireStaff();
  const supabase = createSupabaseServer();

  const [{ data: clients }, { data: services }, { data: locations }] = await Promise.all([
    supabase.from('clients').select('id,full_name,email').order('full_name', { ascending: true }),
    supabase.from('services').select('id,name,duration_minutes').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('locations').select('id,name,suburb').order('name', { ascending: true }),
  ]);

  const clientOpts = ((clients ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => ({
    id: c.id,
    name: c.full_name || c.email,
  }));
  const serviceRows = (services ?? []) as { id: string; name: string; duration_minutes: number | null }[];
  const serviceOpts = serviceRows.map((s) => ({ id: s.id, name: s.name }));
  const serviceDurations = Object.fromEntries(serviceRows.map((s) => [s.id, s.duration_minutes ?? 45]));
  const locationOpts = ((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => ({
    id: l.id,
    name: l.suburb || l.name,
  }));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · New booking</p>
          <h1>Create a booking.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/schedule">
            ← Calendar
          </Link>
        </div>
      </header>

      {searchParams.error && (
        <div className="p-form-banner" role="alert">
          Couldn’t create that booking — please check the client, service, location and start time, then try again.
        </div>
      )}

      <BookingForm
        mode="create"
        clients={clientOpts}
        services={serviceOpts}
        locations={locationOpts}
        serviceDurations={serviceDurations}
      />
    </>
  );
}
