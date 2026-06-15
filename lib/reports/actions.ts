'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ReportContent, ReportMetric, ReportSection } from '@/lib/reports/queries';
import type { ReportType } from '@/types/database';

const VALID_TYPES = new Set<ReportType>(['progress', 'quarterly', 'results', 'general']);

function coerceType(raw: string): ReportType {
  return VALID_TYPES.has(raw as ReportType) ? (raw as ReportType) : 'progress';
}

/**
 * Build the structured `content` from the builder form. Sections and metrics are
 * submitted as parallel arrays (e.g. every section contributes one
 * `section_heading` + one `section_body`), so we zip them back together and drop
 * any row the coach left completely blank.
 */
function buildContent(formData: FormData): ReportContent {
  const headings = formData.getAll('section_heading').map(String);
  const bodies = formData.getAll('section_body').map(String);
  const sections: ReportSection[] = headings
    .map((heading, i) => ({ heading: heading.trim(), body: (bodies[i] ?? '').trim() }))
    .filter((s) => s.heading || s.body);

  const labels = formData.getAll('metric_label').map(String);
  const values = formData.getAll('metric_value').map(String);
  const units = formData.getAll('metric_unit').map(String);
  const changes = formData.getAll('metric_change').map(String);
  const metrics: ReportMetric[] = labels
    .map((label, i) => ({
      label: label.trim(),
      value: (values[i] ?? '').trim(),
      unit: (units[i] ?? '').trim(),
      change: (changes[i] ?? '').trim(),
    }))
    .filter((m) => m.label || m.value);

  return { sections, metrics };
}

/** Shared field read used by create + update. Returns null if it can't proceed. */
function readReportFields(formData: FormData) {
  const client_id = String(formData.get('client_id') ?? '');
  const type = coerceType(String(formData.get('type') ?? 'progress'));
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const period_start = String(formData.get('period_start') ?? '').trim();
  const period_end = String(formData.get('period_end') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim().slice(0, 4000);

  if (!client_id) return null;

  return {
    client_id,
    type,
    title: title || 'Report',
    period_start: period_start || null,
    period_end: period_end || null,
    summary: summary || null,
    content: buildContent(formData) as unknown,
  };
}

/** Create a new report (always starts as a private draft). */
export async function createReport(formData: FormData) {
  const { staff } = await requireStaff();
  const fields = readReportFields(formData);
  if (!fields) redirect('/portal/reports?error=client');

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('client_reports')
    .insert({ ...fields, author_staff_id: staff.id, status: 'draft' } as never)
    .select('id')
    .single();

  if (error) redirect(`/portal/clients/${fields.client_id}?report_error=1`);

  const id = (data as { id: string } | null)?.id;
  revalidatePath(`/portal/clients/${fields.client_id}`);
  revalidatePath('/portal/reports');
  redirect(id ? `/portal/reports/${id}?report_created=1` : '/portal/reports');
}

/** Edit an existing report's fields/content. */
export async function updateReport(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const fields = readReportFields(formData);
  if (!id || !fields) redirect('/portal/reports');

  const supabase = await createSupabaseServer();
  await supabase.from('client_reports').update(fields as never).eq('id', id);

  revalidatePath(`/portal/reports/${id}`);
  revalidatePath(`/portal/clients/${fields.client_id}`);
  revalidatePath('/portal/reports');
  redirect(`/portal/reports/${id}?report_saved=1`);
}

/**
 * Publish or return a report to draft. Publishing stamps `published_at` the
 * first time; returning to draft also pulls it from the member portal (a draft
 * can never be shared — RLS requires published + shared).
 */
export async function setReportStatus(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const publish = String(formData.get('status') ?? '') === 'published';
  if (!id) return;

  const supabase = await createSupabaseServer();
  const patch = publish
    ? { status: 'published', published_at: new Date().toISOString() }
    : { status: 'draft', shared_with_client: false };
  await supabase.from('client_reports').update(patch as never).eq('id', id);

  revalidatePath(`/portal/reports/${id}`);
  revalidatePath('/portal/reports');
}

/** Toggle whether a (published) report is visible in the client's portal. */
export async function setReportShare(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const shared = String(formData.get('shared') ?? '') === 'true';
  if (!id) return;

  const supabase = await createSupabaseServer();
  // Sharing implies the report is finalised — publish it if needed so RLS lets
  // the member see it (published + shared are both required).
  const patch = shared
    ? { shared_with_client: true, status: 'published', published_at: new Date().toISOString() }
    : { shared_with_client: false };
  await supabase.from('client_reports').update(patch as never).eq('id', id);

  revalidatePath(`/portal/reports/${id}`);
  revalidatePath('/portal/reports');
}

/** Permanently delete a report. */
export async function deleteReport(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const clientId = String(formData.get('client_id') ?? '');
  if (!id) redirect('/portal/reports');

  const supabase = await createSupabaseServer();
  await supabase.from('client_reports').delete().eq('id', id);

  revalidatePath('/portal/reports');
  if (clientId) {
    revalidatePath(`/portal/clients/${clientId}`);
    redirect(`/portal/clients/${clientId}?report_deleted=1`);
  }
  redirect('/portal/reports?report_deleted=1');
}
