import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { BookingForm } from '@/components/booking-form';
import type { BookingRow, ClientRow } from '@/types/database';

export const metadata = { title: 'Edit booking — MODE Lab' };

export default async function EditBookingPage({ params }: { params: { id: string } }) {
  await requireStaff();
  const supabase = createSupabaseServer();

  const [{ data: bookingData }, { data: clients }, { data: services }, { data: locations }] = await Promise.all([
    supabase.from('bookings').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('clients').select('id,full_name,email').order('full_name', { ascending: true }),
    supabase.from('services').select('id,name').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('locations').select('id,name,suburb').order('name', { ascending: true }),
  ]);

  const booking = bookingData as BookingRow | null;
  if (!booking) notFound();

  const clientOpts = ((clients ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => ({
    id: c.id,
    name: c.full_name || c.email,
  }));
  const serviceOpts = ((services ?? []) as { id: string; name: string }[]).map((s) => ({ id: s.id, name: s.name }));
  const locationOpts = ((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => ({
    id: l.id,
    name: l.suburb || l.name,
  }));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Edit booking</p>
          <h1>Edit booking.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/schedule">
            ← Calendar
          </Link>
        </div>
      </header>

      <BookingForm
        mode="edit"
        clients={clientOpts}
        services={serviceOpts}
        locations={locationOpts}
        booking={{
          id: booking.id,
          clientId: booking.client_id,
          serviceId: booking.service_id,
          locationId: booking.location_id,
          startsLocal: format(parseISO(booking.starts_at), "yyyy-MM-dd'T'HH:mm"),
          status: booking.status,
        }}
      />
    </>
  );
}
