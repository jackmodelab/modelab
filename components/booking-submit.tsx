'use client';

import { useFormStatus } from 'react-dom';

/**
 * Submit button for the booking form. Uses useFormStatus to disable itself and
 * show a pending label while the server action runs, preventing double-submits.
 * Must be rendered inside the <form> it submits.
 */
export function BookingSubmit({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  const idleLabel = mode === 'create' ? 'Create booking' : 'Save changes';
  const busyLabel = mode === 'create' ? 'Creating…' : 'Saving…';

  return (
    <button className="btn" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? busyLabel : idleLabel} {!pending && <span className="arrow">&rarr;</span>}
    </button>
  );
}
