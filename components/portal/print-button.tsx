'use client';

import { Icon } from '@/components/portal/icons';

/** Print / save-as-PDF trigger. Hidden when printing (.no-print). */
export function PrintButton({ label = 'Print / save PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn btn--mini btn--ghost no-print" onClick={() => window.print()}>
      <Icon.download /> {label}
    </button>
  );
}
