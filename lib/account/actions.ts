'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';

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

  revalidatePath('/account/bookings');
  revalidatePath('/account');
}

/**
 * Member-initiated session request. The current schema does not yet have a
 * `booking_requests` table or a client-RLS path that lets a member insert into
 * `bookings`, so this action currently bounces to /account/bookings with a
 * ?requested=1 flag and a note in the booking notes. Replace with a real
 * server-side write once the booking-request flow lands.
 */
export async function requestBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  // The pre-screening health questionnaire is mandatory before booking.
  if (!(await hasCompletedScreening(client.id))) {
    redirect('/account/screening');
  }

  // Validate inputs are present — we don't write to bookings yet.
  const serviceId = String(formData.get('service_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const coachId = String(formData.get('coach_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  if (!serviceId || !locationId || !coachId || !startsAt) {
    redirect('/account/book?error=missing');
  }

  // TODO: write to bookings (or booking_requests) via service-role client.
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
