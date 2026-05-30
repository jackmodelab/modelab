'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';
import { removeBookingFromCalendar, syncBookingToCalendar } from '@/lib/google/booking-sync';

/**
 * Member-initiated booking cancellation.
 * Applies the 24-hour policy: ≥24hr ahead → `cancelled_24hr_plus` (credit returns);
 * <24hr ahead → `cancelled_under_24hr` (credit consumed).
 * Credit-return bookkeeping happens on the server (TODO: wire to client_packages
 * once the credit-deduction model is decided — for now this only writes the
 * cancellation status and leaves sessions_remaining untouched).
 */
export async function cancelMemberBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = createSupabaseServer();

  // Fetch the booking to confirm ownership + compute lead time.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id,client_id,starts_at,status')
    .eq('id', id)
    .maybeSingle();
  if (!booking || (booking as { client_id: string }).client_id !== client.id) return;

  const startsAt = new Date((booking as { starts_at: string }).starts_at);
  const hoursAhead = (startsAt.getTime() - Date.now()) / 36e5;
  const status = hoursAhead >= 24 ? 'cancelled_24hr_plus' : 'cancelled_under_24hr';

  await supabase
    .from('bookings')
    .update({ status, cancellation_reason: 'Cancelled by member' } as never)
    .eq('id', id);

  await removeBookingFromCalendar(id); // pull it off the coach's calendar

  revalidatePath('/account/bookings');
  revalidatePath('/account');
}

/**
 * Member-initiated session request. Clients have no RLS insert path into
 * `bookings`, so the write goes through the service-role admin client. The
 * booking is created as `confirmed` and, if the chosen coach has linked their
 * Google Calendar, the session is added to it (with the client invited).
 */
export async function requestBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  // The pre-screening health questionnaire is mandatory before booking.
  if (!(await hasCompletedScreening(client.id))) {
    redirect('/account/screening');
  }

  const serviceId = String(formData.get('service_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const coachId = String(formData.get('coach_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  if (!serviceId || !locationId || !coachId || !startsAt) {
    redirect('/account/book?error=missing');
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) redirect('/account/book?error=missing');

  // Service-role client: bypasses RLS for the member insert (clients can't
  // insert into bookings directly) and reads the service duration.
  const admin = createSupabaseAdmin();
  const { data: service } = await admin
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .maybeSingle();
  const duration = (service as { duration_minutes: number } | null)?.duration_minutes ?? 45;
  const end = new Date(start.getTime() + duration * 60000);

  const { data: created } = await admin
    .from('bookings')
    .insert({
      client_id: client.id,
      staff_id: coachId,
      service_id: serviceId,
      location_id: locationId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'confirmed',
    } as never)
    .select('id')
    .single();

  const bookingId = (created as { id: string } | null)?.id;
  if (bookingId) await syncBookingToCalendar(bookingId); // adds to the coach's Google Calendar

  redirect(`/account/bookings?requested=1`);
}

/** Save profile updates (name + phone). Email is auth-managed and read-only here. */
export async function updateProfile(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  const full_name = String(formData.get('full_name') ?? '').trim().slice(0, 120);
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 40);

  const supabase = createSupabaseServer();
  await supabase
    .from('clients')
    .update({ full_name: full_name || null, phone: phone || null } as never)
    .eq('id', client.id);

  revalidatePath('/account');
  revalidatePath('/account/profile');
}
