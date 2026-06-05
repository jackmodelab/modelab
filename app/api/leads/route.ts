import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_LEN = { name: 120, email: 200, phone: 40, interest: 120, message: 4000 };

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Public contact-form intake → `leads`.
 *
 * The `leads` table allows anonymous INSERT by RLS ("anyone submits a lead"),
 * so the write goes through the cookie-scoped anon client (least privilege — no
 * service-role key needed here). Anti-spam: a honeypot field that real users
 * never see/fill, plus a per-IP rate limit. Real notification email to Jack is
 * a follow-up (no email provider wired yet); for now a written row is the
 * source of truth and staff see it under the leads view.
 */
export async function POST(request: NextRequest) {
  // Per-IP throttle: 5 submissions / 10 min.
  const ip = clientIp(request.headers);
  const limit = rateLimit(`leads:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: a hidden field bots tend to fill. Pretend success, write nothing.
  if (clean(body.company, 200)) {
    return NextResponse.json({ ok: true });
  }

  const email = clean(body.email, MAX_LEN.email).toLowerCase();
  const name = clean(body.name, MAX_LEN.name);
  const phone = clean(body.phone, MAX_LEN.phone);
  const interest = clean(body.interest, MAX_LEN.interest);
  const message = clean(body.message, MAX_LEN.message);

  // Minimal validation — email is the one field we truly need to follow up.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.from('leads').insert({
    email,
    name: name || null,
    phone: phone || null,
    source: 'contact_form',
    message: message || null,
    metadata: interest ? { interest } : {},
  } as never);

  if (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
