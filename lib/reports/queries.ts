import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientReportRow } from '@/types/database';

/**
 * Structured body of a report. Stored in `client_reports.content` (jsonb) so the
 * shape can grow without a migration — mirrors the `client_screenings.answers`
 * pattern. The relational columns (title/type/period/status) live on the row.
 */
export type ReportMetric = {
  /** e.g. "Body fat" */
  label: string;
  /** e.g. "18.4" — kept as a string so coaches can write "—", ranges, etc. */
  value: string;
  /** e.g. "%", "kg" */
  unit?: string;
  /** e.g. "-2.1 vs last quarter" */
  change?: string;
};

export type ReportSection = {
  heading: string;
  body: string;
};

export type ReportContent = {
  metrics: ReportMetric[];
  sections: ReportSection[];
};

/** A report row with `content` narrowed from `Json` to our shape. */
export type ClientReport = Omit<ClientReportRow, 'content'> & {
  content: ReportContent;
};

/** Coerce the raw jsonb into a safe ReportContent (handles legacy/empty rows). */
export function parseContent(raw: unknown): ReportContent {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const metrics = Array.isArray(obj.metrics)
    ? (obj.metrics as ReportMetric[]).filter((m) => m && typeof m === 'object')
    : [];
  const sections = Array.isArray(obj.sections)
    ? (obj.sections as ReportSection[]).filter((s) => s && typeof s === 'object')
    : [];
  return { metrics, sections };
}

function hydrate(row: ClientReportRow): ClientReport {
  return { ...row, content: parseContent(row.content) };
}

/** All reports for one client, newest first (staff view). */
export async function getReportsForClient(clientId: string): Promise<ClientReport[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('client_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as ClientReportRow[]).map(hydrate);
}

/** A single report by id (RLS decides whether the caller may see it). */
export async function getReport(id: string): Promise<ClientReport | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('client_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data ? hydrate(data as ClientReportRow) : null;
}

/**
 * Reports visible to the signed-in member. RLS already restricts this to their
 * own published + shared rows, but we keep the filter explicit for clarity.
 */
export async function getReportsForMember(clientId: string): Promise<ClientReport[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('client_reports')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .eq('shared_with_client', true)
    .order('created_at', { ascending: false });
  return ((data ?? []) as ClientReportRow[]).map(hydrate);
}
