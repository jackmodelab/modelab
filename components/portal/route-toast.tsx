'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/portal/icons';

/** Query-flag → toast copy. Set by server-action redirects (e.g. ?created=1). */
const MESSAGES: Record<string, string> = {
  created: 'Booking created.',
  updated: 'Booking updated.',
  saved: 'Changes saved.',
  report_created: 'Report created.',
  report_saved: 'Report saved.',
  report_deleted: 'Report deleted.',
};

/**
 * Shows a transient success toast after a server action redirects with a flag,
 * then strips the flag from the URL so a refresh doesn't re-fire it. Rendered
 * once in the portal layout; renders nothing when no flag is present.
 */
export function RouteToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const key = Object.keys(MESSAGES).find((k) => params.get(k));
    if (!key) return;

    setMsg(MESSAGES[key]);
    router.replace(pathname, { scroll: false }); // drop the flag from the URL
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  if (!msg) return null;

  return (
    <div className="toast-stack">
      <div className="toast" role="status">
        <Icon.check /> {msg}
      </div>
    </div>
  );
}
