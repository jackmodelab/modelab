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
import { DEFAULT_DURATION_MINUTES } from '@/lib/booking/time';
import { siteOrigin } from '@/lib/site-url';

// Postgres error code raised when the `bookings_no_overlap_per_staff` exclusion
// constraint rejects a double-booking (ARC-2 backstop).
const EXCLUSION_VIOLATION = '23P01';

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
  const duration =
    (service as { duration_minutes: number } | null)?.duration_minutes ?? DEFAULT_DURATION_MINUTES;
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

/**
 * Create a booking from the calendar quick-book popup. Same as `createBooking`
 * but returns a result instead of redirecting, so the calendar can close its
 * modal in place and refresh via revalidation rather than navigating away.
 */
export async function createBookingFromCalendar(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const { staff } = await requireStaff();
  const row = await buildBookingRow(formData);
  if (!row) return { error: 'Pick a client, service, location and start time.' };

  const supabase = await createSupabaseServer();
  const { data: created, error } = await supabase
    .from('bookings')
    .insert({ ...row, staff_id: staff.id, status: 'confirmed' } as never)
    .select('id')
    .single();
  if (error) {
    return {
      error:
        error.code === EXCLUSION_VIOLATION
          ? 'That time overlaps an existing booking.'
          : 'Could not create that booking.',
    };
  }

  const bookingId = (created as { id: string } | null)?.id;
  if (bookingId) await syncBookingToCalendar(bookingId);

  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
  return { ok: true };
}

// MULTI-COACH: AUTHORIZATION MODEL — DECISION, 2026-06. (ARC-1 launch-blocker
// for "Como / second coach"; grep `MULTI-COACH:` for every site.)
// The booking write paths below act on a booking by `id` with no ownership
// check, so ANY active staff member can edit/cancel/accept/decline ANY coach's
// booking; the availability/block edits act by `id` the same way; the clients
// list is shared. The studio is a single operator (Jack) at launch, so this is
// the handoff's "fine for a single trusted operator" case — no scoping needed.
// When a second coach is added and they should be siloed, scope writes to the
// owning coach: load the row's `staff_id`, compare to the signed-in `staff.id`,
// and reject the mismatch (or allow only via a `client_assignments` link).
// Calendar sync already targets the booking's own coach, so scoping is a guard,
// not a rewrite.
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
  await requireStaff(); // MULTI-COACH: scope to the request's owning coach
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();
  // Only a still-pending request can be accepted (guards against double-action).
  // The overlap constraint (ARC-2) can reject this if the requested time now
  // clashes with a confirmed session — swallow that so it leaves the request
  // pending rather than 500ing; the coach can reschedule or decline it.
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' } as never)
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!error && (updated as { id: string } | null)?.id) {
    await syncBookingToCalendar(id); // create the event now that it's confirmed
  }

  revalidatePath('/portal/requests');
  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
}

/** Decline a member's pending request (no calendar event was ever created). */
export async function declineBookingRequest(formData: FormData) {
  await requireStaff(); // MULTI-COACH: scope to the request's owning coach
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
  await requireStaff(); // MULTI-COACH: scope to staff_availability.staff_id
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').delete().eq('id', id);
  revalidatePath('/portal/availability');
}

export async function toggleAvailability(formData: FormData) {
  await requireStaff(); // MULTI-COACH: scope to staff_availability.staff_id
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').update({ is_active: next } as never).eq('id', id);
  revalidatePath('/portal/availability');
}

/** Edit the time window and/or location of an existing availability block. */
export async function updateAvailability(formData: FormData) {
  await requireStaff(); // MULTI-COACH: scope to staff_availability.staff_id
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

// =============================================================================
// CALENDAR BLOCKS — one-off blocked-out time (lunch, admin, leave, …)
// =============================================================================

/** Block out a one-off time range on the signed-in coach's calendar. */
export async function createBlock(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const { staff } = await requireStaff();
  const startsLocal = String(formData.get('starts_at') ?? '');
  const endsLocal = String(formData.get('ends_at') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200);

  if (!startsLocal || !endsLocal) return { error: 'Pick a start and end time.' };
  const start = new Date(startsLocal); // datetime-local → server tz
  const end = new Date(endsLocal);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'That start or end time is invalid.' };
  }
  if (end <= start) return { error: 'End must be after start.' };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('staff_blocks').insert({
    staff_id: staff.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    reason: reason || null,
  } as never);
  if (error) return { error: 'Could not block that time.' };

  revalidatePath('/portal/schedule');
  return { ok: true };
}

/** Remove a one-off block. */
export async function deleteBlock(formData: FormData) {
  await requireStaff(); // MULTI-COACH: scope to staff_blocks.staff_id
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_blocks').delete().eq('id', id);
  revalidatePath('/portal/schedule');
}

/** Staff-initiated cancellation (no client penalty). */
export async function cancelBooking(id: string) {
  await requireStaff(); // MULTI-COACH: scope to the booking's owning coach
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

const DISCOUNT_TIERS = new Set(['standard', 'student_senior', 'friends_family']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite a client to the portal. Creates an auth user (Supabase emails them a
 * link to set their own password), fills in the rest of their profile on the
 * `clients` row that the `handle_new_user` trigger creates/adopts, and assigns
 * them to the inviting coach (client_assignments → "their clients").
 *
 * The set-password link lands on /auth/callback?next=/reset-password, mirroring
 * the password-recovery flow (lib/auth/actions.ts → requestPasswordReset).
 */
export async function inviteClient(formData: FormData) {
  const { staff } = await requireStaff();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const date_of_birth = String(formData.get('date_of_birth') ?? '').trim();
  const health_notes = String(formData.get('health_notes') ?? '').trim();
  const tierRaw = String(formData.get('discount_tier') ?? 'standard');
  const discount_tier = DISCOUNT_TIERS.has(tierRaw) ? tierRaw : 'standard';
  const marketing_consent = formData.get('marketing_consent') === 'on';

  if (!email || !EMAIL_RE.test(email)) redirect('/portal/clients/new?error=email');

  // inviteUserByEmail + admin writes need the service role (creates the auth
  // user, then the trigger creates/adopts the clients row regardless of RLS).
  const admin = createSupabaseAdmin();

  // Already has portal access? Don't re-invite an account that can already sign in.
  const { data: existing } = await admin
    .from('clients')
    .select('auth_user_id')
    .eq('email', email)
    .maybeSingle();
  if ((existing as { auth_user_id: string | null } | null)?.auth_user_id) {
    redirect('/portal/clients/new?error=dupe');
  }

  // Send the invite. The handle_new_user trigger creates the clients row (or
  // adopts a staff-created stub with the same email) as the auth user is made.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name || null },
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });

  const invitedUserId = invited?.user?.id;
  if (inviteErr || !invitedUserId) {
    // Supabase reports an existing auth user as "already been registered".
    const dupe = /registered|already exists|email_exists/i.test(inviteErr?.message ?? '');
    redirect(`/portal/clients/new?error=${dupe ? 'dupe' : '1'}`);
  }

  // Fill in the rest of the profile on the row the trigger just created/adopted.
  const { data: clientRow } = await admin
    .from('clients')
    .update({
      full_name: full_name || null,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      health_notes: health_notes || null,
      discount_tier,
      marketing_consent,
    } as never)
    .eq('auth_user_id', invitedUserId)
    .select('id')
    .single();

  const id = (clientRow as { id: string } | null)?.id;

  // Add them to the inviting coach's clients (idempotent on re-invite).
  if (id) {
    await admin
      .from('client_assignments')
      .upsert({ client_id: id, staff_id: staff.id, is_active: true } as never, {
        onConflict: 'client_id,staff_id',
      });
  }

  revalidatePath('/portal/clients');
  redirect(id ? `/portal/clients/${id}?invited=1` : '/portal/clients');
}

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
      redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
    });
  }

  revalidatePath('/portal/clients');
  revalidatePath(`/portal/clients/${id}`);
  redirect(`/portal/clients/${id}?reactivated=1`);
}

/**
 * Re-send the set-up email to a client who was invited but hasn't created their
 * account yet (never set a password / signed in).
 *
 * inviteUserByEmail creates the auth user immediately, so a re-invite would fail
 * with "already registered" once the first invite has gone out. For an account
 * that already exists we therefore re-send via resetPasswordForEmail (same
 * /reset-password landing — works as a first-time "set your password" link too).
 * The only time we fall back to inviteUserByEmail is a login-less stub row that
 * has no auth user yet, where a reset email would have nothing to target.
 */
export async function resendInvite(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const admin = createSupabaseAdmin();
  const { data: client } = await admin
    .from('clients')
    .select('email, auth_user_id')
    .eq('id', id)
    .maybeSingle();

  const row = client as { email: string; auth_user_id: string | null } | null;
  // Best-effort — a mail hiccup must not surface as a hard error to staff.
  if (row?.email) {
    const redirectTo = `${await siteOrigin()}/auth/callback?next=/reset-password`;
    if (row.auth_user_id) {
      await admin.auth.resetPasswordForEmail(row.email, { redirectTo });
    } else {
      await admin.auth.admin.inviteUserByEmail(row.email, { redirectTo });
    }
  }

  revalidatePath('/portal/clients');
  revalidatePath(`/portal/clients/${id}`);
  redirect(`/portal/clients/${id}?reinvited=1`);
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

// Allowlisted client-upload types (F-4 / T-4). A client-supplied `file.type` is
// not trusted on its own — the file's leading "magic" bytes must also match the
// claimed type's family, so a renamed/spoofed file can't slip an unexpected type
// (e.g. an .html or .svg with a stored-XSS payload) into the shared bucket.
const ALLOWED_UPLOAD_TYPES: { mimes: string[]; magic: number[][] }[] = [
  { mimes: ['application/pdf'], magic: [[0x25, 0x50, 0x44, 0x46]] }, // "%PDF"
  { mimes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { mimes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  { mimes: ['image/webp'], magic: [[0x52, 0x49, 0x46, 0x46]] }, // "RIFF" (….WEBP)
  { mimes: ['image/gif'], magic: [[0x47, 0x49, 0x46, 0x38]] }, // "GIF8"
  {
    // Office Open XML (docx / xlsx / pptx) are ZIP containers.
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    magic: [[0x50, 0x4b, 0x03, 0x04]], // "PK\x03\x04"
  },
  {
    // Legacy Office (doc / xls / ppt) are OLE compound files.
    mimes: ['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'],
    magic: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  },
];

/**
 * True if the upload is an allowlisted type whose leading bytes match the
 * declared content-type's family. Rejects unknown MIME types outright and
 * spoofed ones whose magic bytes don't line up (F-4).
 */
async function isAllowedUpload(file: File): Promise<boolean> {
  const group = ALLOWED_UPLOAD_TYPES.find((g) => g.mimes.includes(file.type));
  if (!group) return false;
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return group.magic.some((sig) => sig.every((byte, i) => header[i] === byte));
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
  if (!(await isAllowedUpload(file))) {
    redirect(`/portal/clients/${clientId}?file_error=type`);
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
