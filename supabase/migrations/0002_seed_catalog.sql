-- supabase/migrations/0002_seed_catalog.sql
-- Catalog data: locations, services, packages. Idempotent (re-runnable).

-- LOCATIONS ------------------------------------------------------------------
insert into locations (slug, name, suburb, postcode, state, status, opens_at) values
  ('plus-fitness-kareela', 'Plus Fitness Kareela', 'Kareela', '2232', 'NSW', 'active', null),
  ('como',                 'Como',                 'Como',    '2226', 'NSW', 'coming_soon', null)
on conflict (slug) do update set
  name = excluded.name, suburb = excluded.suburb, postcode = excluded.postcode,
  state = excluded.state, status = excluded.status;

-- SERVICES -------------------------------------------------------------------
insert into services (slug, name, duration_minutes, base_price_cents, description, sort_order) values
  ('private-45',      '45-Minute Private Session', 45, 8000, 'One-to-one training programmed to your latest scan.', 1),
  ('private-30',      '30-Minute Private Session', 30, 6000, 'Focused, efficient session for check-ins and tight schedules.', 2),
  ('body-scan',       'Body Composition Scan',     20, 3000, 'Your baseline and proof of progress.', 3),
  ('program-support', 'Custom Program & Support',   0, 5000, 'A tailored program plus ongoing support.', 4)
on conflict (slug) do update set
  name = excluded.name, duration_minutes = excluded.duration_minutes,
  base_price_cents = excluded.base_price_cents, description = excluded.description,
  sort_order = excluded.sort_order;

-- PACKAGES -------------------------------------------------------------------
insert into packages (slug, name, price_cents, is_recurring, validity_days, tagline, includes, session_allocations, is_hero_offer, sort_order) values
  ('kickstart', 'Kickstart', 9900, false, 60,
    'The whole system, once.',
    '["1× 45-minute private session","1× body composition scan","1× 30-minute check-in","1× four-week pre-made program"]'::jsonb,
    '{"private-45":1,"private-30":1,"body-scan":1}'::jsonb,
    true, 1),
  ('pack-45', '45-Minute Pack', 38500, false, 60,
    NULL,
    '["4× 45-minute sessions","1× 30-minute check-in","1× body composition scan","Ongoing support","Tailored program"]'::jsonb,
    '{"private-45":4,"private-30":1,"body-scan":1}'::jsonb,
    false, 2),
  ('pack-30', '30-Minute Pack', 29500, false, 60,
    NULL,
    '["4× 30-minute sessions","1× 30-minute check-in","1× body composition scan","Ongoing support","Tailored program"]'::jsonb,
    '{"private-30":5,"body-scan":1}'::jsonb,
    false, 3),
  ('monthly', 'Monthly', 13500, true, 30,
    NULL,
    '["1× 45-minute session","1× 30-minute check-in","1× body composition scan","Ongoing support","Tailored program"]'::jsonb,
    '{"private-45":1,"private-30":1,"body-scan":1}'::jsonb,
    false, 4)
on conflict (slug) do update set
  name = excluded.name, price_cents = excluded.price_cents, is_recurring = excluded.is_recurring,
  validity_days = excluded.validity_days, includes = excluded.includes,
  session_allocations = excluded.session_allocations, is_hero_offer = excluded.is_hero_offer,
  sort_order = excluded.sort_order;
