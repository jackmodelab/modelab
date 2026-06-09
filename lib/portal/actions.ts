'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';
import {
  removeBookingFromCalendar,
  syncBookingToCalendar,
  upsertBookingCalendar,
} from '@/lib/google/booking-sync';

// Statuses where the session is off the calendar (event should be removed).
const CANCELLED_STATUSES = new Set([
  'cancelled_24hr_plus',
  'cancelled_under_24hr',
  'no_show',
  'rescheduled',
]);

const VALID_STATUS = new Set([
  'confirmed',
  'completed',
  'cancelled_24hr_plus',
  'cancelled_under_24hr',
  'no_show',
  'rescheduled',
]);

/** Read + validate the shared booking fields. Returns the row to write, or an error. */
async function buildBookingRow(formData: FormData) {
  const client_id = String(formData.get('client_id') ?? '');
  const service_id = String(formData.get('service_id') ?? '');
  const location_id = String(formData.get('location_id') ?? '');
  const startsLocal = String(formData.get('starts_at') ?? '');

  if (!client_id || !service_id || !location_id || !startsLocal) return null;

  const start = new Date(startsLocal); // datetime-local is interpreted in server tz
  if (Number.isNaN(start.getTime())) return null;

  const supabase = await createSupabaseServer();
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', service_id)
    .maybeSingle();
  const duration = (service as { duration_minutes: number } | null)?.duration_minutes ?? 45;
  const end = new Date(start.getTime() + duration * 60000);

  return {
    client_id,
    service_id,
    location_id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  };
}

/** Create a new booking for the signed-in trainer. */
export async function createBooking(formData: FormData) {
  const { staff } = await requireStaff();
  const row = await buildBookingRow(formData);
  if (!row) redirect('/portal/bookings/new?error=1');

  const supabase = await createSupabaseServer();
  const { data: created } = await supabase
    .from('bookings')
    .insert({ ...row, staff_id: staff.id, status: 'confirmed' } as never)
    .select('id')
    .single();

  const bookingId = (created as { id: string } | null)?.id;
  if (bookingId) await syncBookingToCalendar(bookingId); // adds to the coach's Google Calendar

  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
  redirect('/portal/schedule?created=1');
}

// AUTHORIZATION MODEL (multi-coach) — DECISION, 2026-06.
// `updateBooking` / `cancelBooking` let ANY active staff member edit or cancel
// ANY coach's booking, and the clients list is shared. The studio is a single
// operator (Jack) at launch, so this is the handoff's "fine for a single trusted
// operator" case — no scoping needed.
// When a second coach is added and they should be siloed, scope writes to the
// owning coach: load the booking's `staff_id`, compare to the signed-in
// `staff.id`, and reject the mismatch (or allow only via a `client_assignments`
// link). Calendar sync already targets the booking's own coach, so scoping is a
// guard, not a rewrite.
/** Edit an existing booking (reschedule, change service/location/status). */
export async function updateBooking(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const row = await buildBookingRow(formData);
  if (!id) redirect('/portal/schedule');
  if (!row) redirect(`/portal/bookings/${id}/edit?error=1`);

  const statusRaw = String(formData.get('status') ?? 'confirmed');
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'confirmed';

  const supabase = await createSupabaseServer();
  await supabase
    .from('bookings')
    .update({ ...row, status } as never)
    .eq('id', id);

  // Keep Google Calendar in step: drop the event if cancelled/no-show,
  // otherwise patch it (or create one if the coach connected after booking).
  if (CANCELLED_STATUSES.has(status)) {
    await removeBookingFromCalendar(id);
  } else {
    await upsertBookingCalendar(id);
  }

  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
  redirect('/portal/schedule?updated=1');
}

/**
 * Accept a member's pending specific-time request: flip it to `confirmed` and
 * add it to the coach's Google Calendar (the event isn't created until now).
 */
export async function acceptBookingRequest(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();
  // Only a still-pending request can be accepted (guards against double-action).
  const { data: updated } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' } as never)
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if ((updated as { id: string } | null)?.id) {
    await syncBookingToCalendar(id); // create the event now that it's confirmed
  }

  revalidatePath('/portal/requests');
  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
}

/** Decline a member's pending request (no calendar event was ever created). */
export async function declineBookingRequest(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled_24hr_plus',
      cancellation_reason: 'Request declined by trainer',
    } as never)
    .eq('id', id)
    .eq('status', 'pending');

  revalidatePath('/portal/requests');
  revalidatePath('/portal');
}

/** Add a weekly recurring availability block for the signed-in staff member. */
export async function addAvailability(formData: FormData) {
  const { staff } = await requireStaff();
  const weekday = Number(formData.get('weekday'));
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const locationRaw = String(formData.get('location_id') ?? '');

  if (Number.isNaN(weekday) || !start_time || !end_time) return;
  if (end_time <= start_time) return; // end must be after start

  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').insert({
    staff_id: staff.id,
    weekday,
    start_time,
    end_time,
    location_id: locationRaw && locationRaw !== 'any' ? locationRaw : null,
    is_active: true,
  } as never);
  revalidatePath('/portal/availability');
}

export async function deleteAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').delete().eq('id', id);
  revalidatePath('/portal/availability');
}

export async function toggleAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').update({ is_active: next } as never).eq('id', id);
  revalidatePath('/portal/availability');
}

/** Edit the time window and/or location of an existing availability block. */
export async function updateAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const locationRaw = String(formData.get('location_id') ?? '');

  if (!id || !start_time || !end_time) return;
  if (end_time <= start_time) return; // end must be after start

  const supabase = await createSupabaseServer();
  await supabase
    .from('staff_availability')
    .update({
      start_time,
      end_time,
      location_id: locationRaw && locationRaw !== 'any' ? locationRaw : null,
    } as never)
    .eq('id', id);
  revalidatePath('/portal/availability');
}

/** Staff-initiated cancellation (no client penalty). */
export async function cancelBooking(id: string) {
  await requireStaff();
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase
    .from('bookings')
    .update({ status: 'cancelled_24hr_plus', cancellation_reason: 'Cancelled by staff' } as never)
    .eq('id', id);
  await removeBookingFromCalendar(id); // pull it off the coach's calendar
  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
}

// =============================================================================
// CLIENT LIFECYCLE — archive / reactivate / hard delete
// =============================================================================

/** Archive a client: keep their data but drop them from active lists + portal. */
export async function archiveClient(formData: FormData) {
  const { staff } = await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();
  await supabase
    .from('clients')
    .update({ archived_at: new Date().toISOString(), archived_by: staff.id } as never)
    .eq('id', id);

  revalidatePath('/portal/clients');
  revalidatePath(`/portal/clients/${id}`);
  redirect(`/portal/clients/${id}?archived=1`);
}

/**
 * Reactivate an archived client and email them a fresh sign-in link. The auth
 * user is untouched by archiving, so a password-reset email is the simplest way
 * to hand access back (mirrors lib/auth/actions.ts → requestPasswordReset).
 */
export async function reactivateClient(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();
  const { data: client } = await supabase
    .from('clients')
    .select('email')
    .eq('id', id)
    .maybeSingle();

  await supabase
    .from('clients')
    .update({ archived_at: null, archived_by: null } as never)
    .eq('id', id);

  // Re-establish the client's access with a reset/sign-in email. Best-effort —
  // a mail hiccup must not block the reactivation itself.
  const email = (client as { email: string } | null)?.email;
  if (email) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    });
  }

  revalidatePath('/portal/clients');
  revalidatePath(`/portal/clients/${id}`);
  redirect(`/portal/clients/${id}?reactivated=1`);
}

/**
 * Permanently delete a client. Guarded by a typed-name confirmation. When the
 * client has an auth user we delete THAT (auth.users → clients is ON DELETE
 * CASCADE, which then cascades to bookings / packages / documents / etc.);
 * otherwise we delete the clients row directly. Storage objects don't cascade,
 * so we sweep the client's folder in the private bucket first (best-effort).
 */
export async function deleteClient(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const confirmName = String(formData.get('confirm_name') ?? '').trim();
  if (!id) redirect('/portal/clients');

  const supabase = await createSupabaseServer();
  const { data: client } = await supabase
    .from('clients')
    .select('full_name, auth_user_id')
    .eq('id', id)
    .maybeSingle();

  const row = client as { full_name: string | null; auth_user_id: string | null } | null;
  if (!row) redirect('/portal/clients');

  const expected = (row.full_name ?? '').trim();
  if (!expected || confirmName.toLowerCase() !== expected.toLowerCase()) {
    redirect(`/portal/clients/${id}?error=name`);
  }

  const admin = createSupabaseAdmin();

  // Sweep stored files (path convention: <client_id>/<file>). No cascade here.
  const { data: objects } = await admin.storage.from('client-files').list(id);
  if (objects && objects.length > 0) {
    await admin.storage.from('client-files').remove(objects.map((o) => `${id}/${o.name}`));
  }

  if (row.auth_user_id) {
    await admin.auth.admin.deleteUser(row.auth_user_id); // cascades to clients + children
  } else {
    await admin.from('clients').delete().eq('id', id);
  }

  revalidatePath('/portal/clients');
  redirect('/portal/clients?deleted=1');
}

// =============================================================================
// CLIENT DOCUMENTS — staff upload / delete (private `client-files` bucket)
// =============================================================================

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Sanitise a filename for use inside a Storage object path. */
function safeFilename(name: string): string {
  return (name || 'file')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(-120);
}

/** Upload a file and share it with a client (staff only). */
export async function uploadClientDocument(formData: FormData) {
  const { staff } = await requireStaff();
  const clientId = String(formData.get('client_id') ?? '');
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000);
  const file = formData.get('file');

  if (!clientId || !(file instanceof File) || file.size === 0) {
    redirect(`/portal/clients/${clientId}?file_error=missing`);
  }
  if (file.size > MAX_FILE_BYTES) {
    redirect(`/portal/clients/${clientId}?file_error=size`);
  }

  const path = `${clientId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const supabase = await createSupabaseServer();

  const { error: upErr } = await supabase.storage
    .from('client-files')
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) {
    redirect(`/portal/clients/${clientId}?file_error=upload`);
  }

  await supabase.from('documents').insert({
    client_id: clientId,
    uploaded_by_staff_id: staff.id,
    title: title || file.name,
    description: description || null,
    storage_path: path,
    file_type: file.type || null,
  } as never);

  revalidatePath(`/portal/clients/${clientId}`);
  redirect(`/portal/clients/${clientId}?file=1`);
}

/** Remove a shared document (storage object + row). */
export async function deleteClientDocument(formData: FormData) {
  await requireStaff();
  const documentId = String(formData.get('document_id') ?? '');
  const clientId = String(formData.get('client_id') ?? '');
  if (!documentId) return;

  const supabase = await createSupabaseServer();
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle();

  const storagePath = (doc as { storage_path: string } | null)?.storage_path;
  if (storagePath) await supabase.storage.from('client-files').remove([storagePath]);
  await supabase.from('documents').delete().eq('id', documentId);

  revalidatePath(`/portal/clients/${clientId}`);
}

/** Save the signed-in coach's profile (display name, title, bio). */
export async function updateStaffProfile(formData: FormData) {
  const { staff } = await requireStaff();
  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 120);
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 2000);

  const supabase = await createSupabaseServer();
  await supabase
    .from('staff')
    .update({ display_name: display_name || staff.display_name, title: title || null, bio: bio || null } as never)
    .eq('id', staff.id);

  revalidatePath('/portal/profile');
  revalidatePath('/portal');
}

/**
 * Mint a short-lived signed URL for a client document so staff can download it.
 * Files live in the private Supabase Storage `client-files` bucket and have no
 * public URL — the only way to hand one to the browser is a signed URL minted
 * server-side from the row's `storage_path`. Returns `{ error }` (never throws)
 * so the client button can surface a graceful message on dummy/missing objects.
 */
export async function getDocumentSignedUrl(
  documentId: string,
): Promise<{ url: string } | { error: string }> {
  await requireStaff();
  if (!documentId) return { error: 'Missing document.' };

  const supabase = await createSupabaseServer();
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle();

  const storagePath = (doc as { storage_path: string } | null)?.storage_path;
  if (!storagePath) return { error: 'File not found.' };

  const { data, error } = await supabase.storage
    .from('client-files')
    .createSignedUrl(storagePath, 60, { download: true }); // 60s, forces a download

  if (error || !data?.signedUrl) return { error: 'File unavailable.' };
  return { url: data.signedUrl };
}

/** Disconnect the signed-in coach's Google Calendar (clears stored tokens). */
export async function disconnectGoogleCalendar() {
  const { staff } = await requireStaff();
  const admin = createSupabaseAdmin();
  await admin.from('staff_google_credentials').delete().eq('staff_id', staff.id);
  await admin
    .from('staff')
    .update({
      google_calendar_email: null,
      google_calendar_connected_at: null,
    } as never)
    .eq('id', staff.id);
  revalidatePath('/portal/profile');
}
