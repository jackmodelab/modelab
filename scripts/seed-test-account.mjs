/**
 * Seeds MODE Lab test accounts + sample data.
 *
 *   npm run seed:test
 *
 * Requires a real Supabase project in .env.local and the schema applied
 * (migrations 0001 + 0002). Safe to re-run — it clears prior test data first.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || 'client@modelab.test';
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'jack@modelab.test';
const CLIENT_PW = process.env.TEST_CLIENT_PASSWORD;
const STAFF_PW = process.env.TEST_STAFF_PASSWORD;

if (!URL || !SERVICE_KEY || URL.includes('placeholder')) {
  console.error('\n✗ Supabase is not configured yet.');
  console.error('  Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local,');
  console.error('  apply the migrations, then re-run `npm run seed:test`.\n');
  process.exit(1);
}

// No baked-in default password — the caller must supply explicit test creds.
if (!CLIENT_PW || !STAFF_PW) {
  console.error('\n✗ Set TEST_CLIENT_PASSWORD and TEST_STAFF_PASSWORD in .env.local before seeding.\n');
  process.exit(1);
}

// Refuse to seed anything that isn't a local Supabase instance. This script
// creates an ACTIVE staff login; running it against prod/staging would plant a
// known-credential account in real client data.
if (!/localhost|127\.0\.0\.1|kong:8000/.test(URL)) {
  console.error('\n✗ Refusing to seed: this is not a local Supabase URL. Seeding is for local dev only.\n');
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const iso = (d) => d.toISOString();
const addDays = (n, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return d;
};
const addMins = (date, mins) => new Date(date.getTime() + mins * 60000);

/** Create the auth user, or fetch the existing one. Returns the user id. */
async function ensureUser(email, password, fullName) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error) return data.user.id;

  // Already exists → find them and reset the password so the test creds always work.
  let page = 1;
  for (;;) {
    const { data: list, error: listErr } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (listErr) throw listErr;
    const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      await db.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      return found.id;
    }
    if (list.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Could not create or find user ${email}: ${error.message}`);
}

async function lookup(table, col = 'slug') {
  const { data, error } = await db.from(table).select(`id,${col}`);
  if (error) throw error;
  return new Map(data.map((r) => [r[col], r.id]));
}

async function main() {
  console.log('→ Connecting to', URL);

  // ---- Catalog must exist (migrations 0001 + 0002) ----
  const [locs, svcs, pkgs] = await Promise.all([lookup('locations'), lookup('services'), lookup('packages')]);
  const kareela = locs.get('plus-fitness-kareela');
  if (!kareela || svcs.size === 0 || pkgs.size === 0) {
    console.error('\n✗ Catalog is empty. Apply migrations 0001_initial_schema.sql and 0002_seed_catalog.sql first.\n');
    process.exit(1);
  }

  // ---- Auth users (trigger creates a clients row for each) ----
  console.log('→ Creating auth users…');
  const clientUid = await ensureUser(CLIENT_EMAIL, CLIENT_PW, 'Alex Taylor');
  const staffUid = await ensureUser(STAFF_EMAIL, STAFF_PW, 'Jack');

  // Give the trigger a beat, then resolve the client row.
  await new Promise((r) => setTimeout(r, 400));
  const { data: clientRow } = await db.from('clients').select('id').eq('auth_user_id', clientUid).maybeSingle();
  if (!clientRow) throw new Error('clients row was not created by handle_new_user trigger.');
  const clientId = clientRow.id;

  // Staff also got an auto clients row — remove it so they show only as staff.
  await db.from('clients').delete().eq('auth_user_id', staffUid);

  // ---- Staff record ----
  console.log('→ Upserting staff record…');
  const { data: staffRow } = await db
    .from('staff')
    .upsert(
      { auth_user_id: staffUid, display_name: 'Jack', title: 'Exercise Scientist', is_active: true, credentials: ['B.Ex.Sci', 'First Aid'] },
      { onConflict: 'auth_user_id' }
    )
    .select('id')
    .single();
  const staffId = staffRow.id;

  // ---- Flesh out the client profile ----
  await db
    .from('clients')
    .update({ full_name: 'Alex Taylor', phone: '0400 000 000', discount_tier: 'standard', marketing_consent: true })
    .eq('id', clientId);

  // ---- Clean prior test data (idempotent) ----
  console.log('→ Clearing prior test data…');
  await db.from('bookings').delete().eq('client_id', clientId);
  await db.from('client_packages').delete().eq('client_id', clientId);
  await db.from('documents').delete().eq('client_id', clientId);
  await db.from('assessments').delete().eq('client_id', clientId);
  await db.from('client_assignments').delete().eq('client_id', clientId);
  await db.from('staff_availability').delete().eq('staff_id', staffId);
  await db.from('articles').delete().like('slug', 'kb-%');

  // ---- Client package (45-min pack, active) ----
  console.log('→ Seeding package, bookings, files, articles…');
  const { data: cp } = await db
    .from('client_packages')
    .insert({
      client_id: clientId,
      package_id: pkgs.get('pack-45'),
      status: 'active',
      purchased_at: iso(addDays(-10)),
      expires_at: iso(addDays(50)),
      sessions_remaining: { 'private-45': 3, 'private-30': 1, 'body-scan': 1 },
    })
    .select('id')
    .single();

  // ---- Bookings ----
  const mk = (svcSlug, start, dur, status) => ({
    client_id: clientId,
    staff_id: staffId,
    location_id: kareela,
    service_id: svcs.get(svcSlug),
    client_package_id: cp.id,
    starts_at: iso(start),
    ends_at: iso(addMins(start, dur)),
    status,
  });
  await db.from('bookings').insert([
    mk('private-45', addDays(2, 9, 0), 45, 'confirmed'),
    mk('private-30', addDays(6, 9, 30), 30, 'confirmed'),
    mk('private-45', addDays(-7, 9, 0), 45, 'completed'),
    mk('body-scan', addDays(-14, 8, 30), 20, 'completed'),
  ]);

  // ---- Documents (storage paths are placeholders; upload wiring comes later) ----
  await db.from('documents').insert([
    { client_id: clientId, uploaded_by_staff_id: staffId, title: 'Body Composition Scan — Baseline', file_type: 'PDF', storage_path: `client-files/${clientId}/baseline-scan.pdf`, description: 'Your starting numbers.' },
    { client_id: clientId, uploaded_by_staff_id: staffId, title: '4-Week Foundation Program', file_type: 'PDF', storage_path: `client-files/${clientId}/foundation-program.pdf`, description: 'Your tailored plan.' },
  ]);

  // ---- Assessment ----
  await db.from('assessments').insert({
    client_id: clientId,
    assessment_date: iso(addDays(-14)).slice(0, 10),
    type: 'body_comp',
    data: { weight_kg: 82.4, body_fat_pct: 22.1, skeletal_muscle_kg: 36.8 },
    notes: 'Baseline scan. Solid starting point.',
  });

  // ---- Client assignment ----
  await db.from('client_assignments').upsert(
    { client_id: clientId, staff_id: staffId, is_active: true },
    { onConflict: 'client_id,staff_id' }
  );

  // ---- Staff availability (weekly) ----
  const avail = [1, 2, 3, 4, 5].map((wd) => ({ staff_id: staffId, location_id: kareela, weekday: wd, start_time: '06:00', end_time: '19:00', is_active: true }));
  avail.push({ staff_id: staffId, location_id: kareela, weekday: 6, start_time: '07:00', end_time: '12:00', is_active: true });
  await db.from('staff_availability').insert(avail);

  // ---- Research articles ----
  await db.from('articles').insert([
    {
      slug: 'kb-why-we-scan',
      title: 'Why we scan before we program',
      excerpt: 'You can’t optimise what you haven’t measured. Here’s what the baseline scan tells us.',
      category: 'Methodology',
      members_only: true,
      published: true,
      published_at: iso(addDays(-5)),
      body: "Most training starts with a goal and a guess. We start with a measurement.\n\nThe body composition scan gives us your baseline — muscle, fat, and how it's distributed. That number isn't there to judge you. It's there so that in eight weeks, when we scan again, the progress is something you can read rather than something you have to take on faith.\n\nIt also tells us where to point the work. Two people who want to \"tone up\" often need almost opposite programs. The scan is how we tell the difference on day one instead of month three.\n\nThink of it as the engineering survey before the build. We don't pour the foundation until we know what the ground is doing.",
    },
    {
      slug: 'kb-fruit-sugars',
      title: 'Fruit sugars: what the evidence actually says',
      excerpt: 'The short version: whole fruit isn’t the problem. The longer version is more interesting.',
      category: 'Nutrition',
      members_only: true,
      published: true,
      published_at: iso(addDays(-12)),
      body: "Every few months someone tells you fruit is \"basically lollies.\" It isn't, and the reason is worth understanding.\n\nThe sugar in whole fruit comes packaged with fibre, water, and a structure your body has to work to break down. That packaging slows everything: the sugar arrives gradually, not all at once. Fruit juice strips the packaging away — which is why a glass of juice behaves very differently to the orange it came from.\n\nSo the practical rule we use with clients is simple. Eat the fruit. Be cautious with the juice. You don't need to fear an apple.",
    },
    {
      slug: 'kb-apt-plain-english',
      title: 'Anterior pelvic tilt, in plain English',
      excerpt: 'What it is, why it matters for your back, and the two movements we use to address it.',
      category: 'Biomechanics',
      members_only: true,
      published: true,
      published_at: iso(addDays(-20)),
      body: "Anterior pelvic tilt is a fancy name for a common picture: the front of the pelvis drops, the lower back arches a little more than it should, and the result is often a back that feels tight by the end of the day.\n\nIt's usually not a problem with your spine. It's a conversation between muscles — some doing too much, some checked out — and a lot of hours spent sitting.\n\nWe address it with two things, not twenty. First, we wake up the muscles that should be holding the pelvis level. Second, we give the over-tight ones a reason to let go. Do those consistently and the \"tight back\" tends to quieten down on its own.",
    },
  ]);

  console.log('\n✓ Seed complete.\n');
  console.log('  Member  →', CLIENT_EMAIL, '/', CLIENT_PW);
  console.log('  Staff   →', STAFF_EMAIL, '/', STAFF_PW);
  console.log('\n  Sign in at http://localhost:3000/login\n');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message || err);
  process.exit(1);
});
