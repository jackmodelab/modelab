import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientScreeningRow } from '@/types/database';

/** A parsed questionnaire response. Keys map to the form field names. */
export type ScreeningAnswers = Record<string, string | string[]>;

export type ClientScreening = Omit<ClientScreeningRow, 'answers'> & {
  answers: ScreeningAnswers;
};

/**
 * Loads the pre-screening row for a given client, or null if not yet completed.
 */
export async function getScreeningForClient(
  clientId: string
): Promise<ClientScreening | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('client_screenings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!data) return null;
  return data as unknown as ClientScreening;
}

/**
 * Convenience boolean: has this client completed the required pre-screening?
 */
export async function hasCompletedScreening(clientId: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('client_screenings')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();
  return !!data;
}
