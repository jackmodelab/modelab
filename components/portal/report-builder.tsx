'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/portal/icons';
import { REPORT_TYPES, reportTypeMeta, EMPTY_SECTION, EMPTY_METRIC } from '@/lib/reports/templates';
import type { ReportContent, ReportMetric, ReportSection } from '@/lib/reports/queries';
import type { ReportType } from '@/types/database';

type ClientOption = { id: string; name: string };

export type ReportBuilderDefaults = {
  client_id: string;
  type: ReportType;
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  content: ReportContent;
};

type Keyed<T> = T & { _key: number };

/**
 * Staff-facing report editor. Drives both "new" and "edit": the difference is the
 * `action` (createReport / updateReport) and whether an `id` hidden field is set.
 * Sections + metrics are dynamic and submit as parallel arrays the server action
 * zips back together. Custom CSS only — no Tailwind.
 */
export function ReportBuilder({
  action,
  clients,
  preselectedClient,
  reportId,
  defaults,
  cancelHref,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients?: ClientOption[];
  preselectedClient?: ClientOption;
  reportId?: string;
  defaults?: ReportBuilderDefaults;
  cancelHref: string;
  submitLabel: string;
}) {
  const isEdit = Boolean(reportId);

  const seed = defaults ?? {
    client_id: preselectedClient?.id ?? '',
    type: 'progress' as ReportType,
    title: reportTypeMeta('progress').defaultTitle,
    period_start: null,
    period_end: null,
    summary: '',
    content: reportTypeMeta('progress').template,
  };

  const initialSections = seed.content.sections.length ? seed.content.sections : [EMPTY_SECTION];
  const initialMetrics = seed.content.metrics;

  const [type, setType] = useState<ReportType>(seed.type);
  const [title, setTitle] = useState(seed.title);
  const [sections, setSections] = useState<Keyed<ReportSection>[]>(() =>
    initialSections.map((s, i) => ({ ...s, _key: i })),
  );
  const [metrics, setMetrics] = useState<Keyed<ReportMetric>[]>(() =>
    initialMetrics.map((m, i) => ({ ...m, _key: i })),
  );

  // Monotonic key counters (read/written only in handlers, never during render).
  const sectionKey = useRef(initialSections.length);
  const metricKey = useRef(initialMetrics.length);

  const meta = reportTypeMeta(type);

  /** Switching type re-seeds the structure from that type's template (create only). */
  function onTypeChange(next: ReportType) {
    setType(next);
    if (isEdit) return; // don't wipe an existing report's content
    const tmpl = reportTypeMeta(next);
    const nextSections = tmpl.template.sections.length ? tmpl.template.sections : [EMPTY_SECTION];
    setSections(nextSections.map((s) => ({ ...s, _key: sectionKey.current++ })));
    setMetrics(tmpl.template.metrics.map((m) => ({ ...m, _key: metricKey.current++ })));
    // Only overwrite the title if the coach hasn't customised it.
    setTitle((prev) => (REPORT_TYPES.some((t) => t.defaultTitle === prev) || !prev ? tmpl.defaultTitle : prev));
  }

  const addSection = () => setSections((s) => [...s, { ...EMPTY_SECTION, _key: sectionKey.current++ }]);
  const removeSection = (key: number) => setSections((s) => (s.length > 1 ? s.filter((x) => x._key !== key) : s));
  const moveSection = (key: number, dir: -1 | 1) =>
    setSections((s) => {
      const i = s.findIndex((x) => x._key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const addMetric = () => setMetrics((m) => [...m, { ...EMPTY_METRIC, _key: metricKey.current++ }]);
  const removeMetric = (key: number) => setMetrics((m) => m.filter((x) => x._key !== key));

  return (
    <form action={action} className="p-form rb-form">
      {isEdit && <input type="hidden" name="id" value={reportId} />}

      {/* ---- Who & what ---- */}
      <section className="surface">
        <div className="surface-head">
          <h2>Details</h2>
        </div>
        <div className="surface-body--pad">
          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="client_id">Client</label>
              {preselectedClient || isEdit ? (
                <>
                  <input type="hidden" name="client_id" value={seed.client_id} />
                  <input value={preselectedClient?.name ?? 'This client'} readOnly disabled />
                </>
              ) : (
                <select id="client_id" name="client_id" defaultValue="" required>
                  <option value="" disabled>
                    Choose a client…
                  </option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="p-field">
              <label htmlFor="type">Report type</label>
              <select id="type" name="type" value={type} onChange={(e) => onTypeChange(e.target.value as ReportType)}>
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="p-field-hint">{meta.blurb}</span>
            </div>
          </div>

          <div className="p-field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>

          {meta.hasPeriod && (
            <div className="p-form-row-2">
              <div className="p-field">
                <label htmlFor="period_start">Period start</label>
                <input id="period_start" name="period_start" type="date" defaultValue={seed.period_start ?? ''} />
              </div>
              <div className="p-field">
                <label htmlFor="period_end">Period end</label>
                <input id="period_end" name="period_end" type="date" defaultValue={seed.period_end ?? ''} />
              </div>
            </div>
          )}

          <div className="p-field">
            <label htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={4000}
              defaultValue={seed.summary ?? ''}
              placeholder="A short overview that opens the report…"
            />
          </div>
        </div>
      </section>

      {/* ---- Key numbers ---- */}
      <section className="surface">
        <div className="surface-head">
          <h2>
            Key numbers
            <span className="count">{metrics.length}</span>
          </h2>
          <button type="button" className="btn btn--mini btn--ghost" onClick={addMetric}>
            <Icon.plus /> Add metric
          </button>
        </div>
        <div className="surface-body--pad">
          {metrics.length === 0 ? (
            <p className="p-field-hint" style={{ margin: 0 }}>
              Optional. Add measurable results (weight, body fat, sessions…) to show as a stat strip.
            </p>
          ) : (
            <div className="rb-metrics">
              {metrics.map((m) => (
                <div className="rb-metric-row" key={m._key}>
                  <input name="metric_label" defaultValue={m.label} placeholder="Label e.g. Body fat" aria-label="Metric label" />
                  <input name="metric_value" defaultValue={m.value} placeholder="Value" aria-label="Metric value" />
                  <input name="metric_unit" defaultValue={m.unit ?? ''} placeholder="Unit" aria-label="Metric unit" />
                  <input name="metric_change" defaultValue={m.change ?? ''} placeholder="Change e.g. -2.1" aria-label="Metric change" />
                  <button
                    type="button"
                    className="btn btn--mini btn--danger"
                    onClick={() => removeMetric(m._key)}
                    title="Remove metric"
                    aria-label="Remove metric"
                  >
                    <Icon.trash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---- Written sections ---- */}
      <section className="surface">
        <div className="surface-head">
          <h2>
            Sections
            <span className="count">{sections.length}</span>
          </h2>
          <button type="button" className="btn btn--mini btn--ghost" onClick={addSection}>
            <Icon.plus /> Add section
          </button>
        </div>
        <div className="surface-body--pad rb-sections">
          {sections.map((s, i) => (
            <div className="rb-section" key={s._key}>
              <div className="rb-section-head">
                <input
                  name="section_heading"
                  defaultValue={s.heading}
                  placeholder="Section heading"
                  aria-label="Section heading"
                  className="rb-section-heading"
                />
                <div className="rb-section-tools">
                  <button
                    type="button"
                    className="rb-icon-btn"
                    onClick={() => moveSection(s._key, -1)}
                    disabled={i === 0}
                    title="Move up"
                    aria-label="Move section up"
                  >
                    <Icon.chevronD className="rb-flip" />
                  </button>
                  <button
                    type="button"
                    className="rb-icon-btn"
                    onClick={() => moveSection(s._key, 1)}
                    disabled={i === sections.length - 1}
                    title="Move down"
                    aria-label="Move section down"
                  >
                    <Icon.chevronD />
                  </button>
                  <button
                    type="button"
                    className="rb-icon-btn rb-icon-btn--danger"
                    onClick={() => removeSection(s._key)}
                    disabled={sections.length <= 1}
                    title="Remove section"
                    aria-label="Remove section"
                  >
                    <Icon.trash />
                  </button>
                </div>
              </div>
              <textarea
                name="section_body"
                defaultValue={s.body}
                rows={4}
                placeholder="Write this section…"
                aria-label="Section body"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="p-form-actions">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="link-arrow" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
