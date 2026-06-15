/**
 * Report templates — the starting structure a coach gets when they pick a report
 * type in the builder. These are pure data (no DB) so the new-report page can
 * prefill the form and the builder can swap structure when the type changes.
 *
 * Keep these in sync with the `report_type` enum
 * (20260615150000_client_reports.sql) and ReportContent in `./queries`.
 */
import type { ReportType } from '@/types/database';
import type { ReportContent } from './queries';

export type ReportTypeMeta = {
  value: ReportType;
  label: string;
  /** One-line description shown in the type picker. */
  blurb: string;
  /** Whether this type is tied to a reporting period (start/end dates). */
  hasPeriod: boolean;
  /** Default document title (the coach can edit it). */
  defaultTitle: string;
  /** Prefilled body the builder seeds when this type is chosen. */
  template: ReportContent;
};

/** A blank section/metric so "add" buttons have something to clone. */
export const EMPTY_SECTION = { heading: '', body: '' } as const;
export const EMPTY_METRIC = { label: '', value: '', unit: '', change: '' } as const;

export const REPORT_TYPES: ReportTypeMeta[] = [
  {
    value: 'progress',
    label: 'Progress report',
    blurb: 'A quick check-in on how a client is tracking against their goals.',
    hasPeriod: false,
    defaultTitle: 'Progress report',
    template: {
      metrics: [],
      sections: [
        { heading: 'Where things stand', body: '' },
        { heading: 'Wins since last time', body: '' },
        { heading: 'Focus for the next few weeks', body: '' },
      ],
    },
  },
  {
    value: 'quarterly',
    label: 'Quarterly review',
    blurb: 'The formal three-month review shared with the client.',
    hasPeriod: true,
    defaultTitle: 'Quarterly review',
    template: {
      metrics: [
        { label: 'Sessions completed', value: '', unit: '', change: '' },
        { label: 'Attendance', value: '', unit: '%', change: '' },
      ],
      sections: [
        { heading: 'Summary of the quarter', body: '' },
        { heading: 'Goals & progress', body: '' },
        { heading: 'Measurements & results', body: '' },
        { heading: 'What we worked on', body: '' },
        { heading: 'Plan for next quarter', body: '' },
      ],
    },
  },
  {
    value: 'results',
    label: 'Results / assessment',
    blurb: 'A data-led write-up of a scan, test or assessment.',
    hasPeriod: false,
    defaultTitle: 'Assessment results',
    template: {
      metrics: [
        { label: 'Weight', value: '', unit: 'kg', change: '' },
        { label: 'Body fat', value: '', unit: '%', change: '' },
        { label: 'Lean mass', value: '', unit: 'kg', change: '' },
      ],
      sections: [
        { heading: 'What we measured', body: '' },
        { heading: 'Results & interpretation', body: '' },
        { heading: 'Recommendations', body: '' },
      ],
    },
  },
  {
    value: 'general',
    label: 'General report',
    blurb: 'A blank report — add your own sections.',
    hasPeriod: false,
    defaultTitle: 'Report',
    template: {
      metrics: [],
      sections: [{ heading: '', body: '' }],
    },
  },
];

const BY_VALUE = new Map(REPORT_TYPES.map((t) => [t.value, t]));

export function reportTypeMeta(type: ReportType): ReportTypeMeta {
  return BY_VALUE.get(type) ?? REPORT_TYPES[0];
}

export function reportTypeLabel(type: ReportType): string {
  return reportTypeMeta(type).label;
}
