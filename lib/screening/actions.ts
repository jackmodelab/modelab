'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ScreeningAnswers } from '@/lib/screening/queries';

export type ScreeningActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Mandatory free-text / value fields.
const REQUIRED_TEXT = [
  'q01_first_name',
  'q01_surname',
  'q02_dob',
  'q03_mobile',
  'q03_email',
  'q04_ec_name',
  'q04_ec_mobile',
  'q08_medications',
  'q10_allergies',
  'q11_surgical',
  'q27_days_week',
  'q27_session_min',
  'q29_sleep_hours',
];

// Mandatory single-choice (radio / select) fields.
const REQUIRED_CHOICE = [
  'q02_sex',
  'q13_family_cardiac',
  'q15_current_pain',
  'q18_advised_modify',
  'q19_training_status',
  'q20_rt_experience',
  'q24_primary_goal',
  'q30_stress',
];

// Mandatory multi-select fields (at least one box ticked).
const REQUIRED_MULTI = [
  'q06_cardiac_symptoms',
  'q07_conditions',
  'q16_past_injuries',
];

// Mandatory consent declarations (must be checked).
const REQUIRED_CONSENT = [
  'decl_accurate',
  'decl_understand',
  'decl_scope',
  'decl_anthro',
];

export async function submitScreening(
  _prevState: ScreeningActionState,
  formData: FormData
): Promise<ScreeningActionState> {
  const { client } = await requireClient();
  if (!client) {
    return { error: 'We are still setting up your profile. Please refresh and try again.' };
  }

  // Collect every submitted field into the answers object. Repeated keys
  // (checkbox groups) accumulate into arrays.
  const answers: ScreeningAnswers = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith('$')) continue; // skip framework internals
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (key in answers) {
      const existing = answers[key];
      answers[key] = Array.isArray(existing) ? [...existing, value] : [existing as string, value];
    } else {
      answers[key] = value;
    }
  }

  const fieldErrors: Record<string, string> = {};

  for (const key of REQUIRED_TEXT) {
    const v = answers[key];
    if (!v || (typeof v === 'string' && v.length === 0)) {
      fieldErrors[key] = 'This field is required.';
    }
  }
  for (const key of REQUIRED_CHOICE) {
    if (!answers[key]) fieldErrors[key] = 'Please select an option.';
  }
  for (const key of REQUIRED_MULTI) {
    const v = answers[key];
    const count = Array.isArray(v) ? v.length : v ? 1 : 0;
    if (count === 0) fieldErrors[key] = 'Please select at least one option.';
  }
  for (const key of REQUIRED_CONSENT) {
    if (answers[key] !== 'on') fieldErrors[key] = 'Required to proceed.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: 'Some required items are missing. Please review the highlighted fields.',
      fieldErrors,
    };
  }

  const supabase = createSupabaseServer();

  const { error } = await supabase
    .from('client_screenings')
    .upsert(
      {
        client_id: client.id,
        answers,
        submitted_at: new Date().toISOString(),
      } as never,
      { onConflict: 'client_id' }
    );

  if (error) {
    return { error: error.message };
  }

  // Keep the core client record in sync with the identification section.
  const first = (answers['q01_first_name'] as string) || '';
  const surname = (answers['q01_surname'] as string) || '';
  const fullName = [first, answers['q01_middle'] as string, surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  await supabase
    .from('clients')
    .update({
      full_name: fullName || null,
      phone: (answers['q03_mobile'] as string) || null,
      date_of_birth: (answers['q02_dob'] as string) || null,
      emergency_contact: {
        name: (answers['q04_ec_name'] as string) || null,
        relationship: (answers['q04_ec_relationship'] as string) || null,
        phone: (answers['q04_ec_mobile'] as string) || null,
      },
    } as never)
    .eq('id', client.id);

  revalidatePath('/account');
  revalidatePath('/account/screening');
  revalidatePath('/account/book');
  redirect('/account/screening?completed=1');
}
