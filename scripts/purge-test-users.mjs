/**
 * Find (and optionally delete) any Supabase Auth users whose email ends in
 * `@modelab.test` — the dev-only test logins from seed-test-pair.mjs (JACK-1).
 *
 *   node scripts/purge-test-users.mjs            # DRY RUN — list only, deletes nothing
 *   node scripts/purge-test-users.mjs --confirm  # actually delete them
 *
 * Uses the SERVICE ROLE key from .env.local, so it targets whatever project that
 * file points at (currently production). Deleting an auth user cascades to its
 * clients/staff rows. It ONLY ever touches @modelab.test addresses — your real
 * login (jack@modehealthcorp.com.au) and any real client are never matched.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { assertNotProd } from './_prod-guard.mjs';

config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRM = process.argv.includes('--confirm');
const TEST_SUFFIX = '@modelab.test';

if (!URL || !SERVICE_KEY || URL.includes('placeholder')) {
  console.error('\n✗ Supabase is not configured in .env.local.\n');
  process.exit(1);
}

assertNotProd(URL);

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function listTestUsers() {
  const matches = [];
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(TEST_SUFFIX)) matches.push(u);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return matches;
}

async function main() {
  console.log('→ Project:', URL);
  console.log(`→ Mode:   ${CONFIRM ? 'DELETE (--confirm)' : 'DRY RUN (list only)'}\n`);

  const users = await listTestUsers();

  if (users.length === 0) {
    console.log(`✓ No "${TEST_SUFFIX}" users found. Nothing to delete — JACK-1 is already clean.\n`);
    return;
  }

  console.log(`Found ${users.length} test user(s):`);
  for (const u of users) {
    console.log(`  • ${u.email}   id=${u.id}   created=${u.created_at}`);
  }
  console.log('');

  if (!CONFIRM) {
    console.log('DRY RUN — nothing deleted. Re-run with --confirm to delete the above.\n');
    return;
  }

  for (const u of users) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) {
      console.error(`  ✗ Failed to delete ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✓ Deleted ${u.email}`);
    }
  }
  console.log('\n✓ Done.\n');
}

main().catch((err) => {
  console.error('\n✗ Failed:', err.message || err);
  process.exit(1);
});
