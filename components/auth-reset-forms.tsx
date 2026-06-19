'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordReset, updatePassword, type AuthState } from '@/lib/auth/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={pending ? { opacity: 0.6 } : undefined}>
      {pending ? 'Working…' : label} <span className="arrow">&rarr;</span>
    </button>
  );
}

/** Step 1 — request a reset link by email. */
export function RequestResetForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(requestPasswordReset, undefined);

  return (
    <form action={formAction}>
      {state?.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="auth-success" role="status">
          {state.success}
        </p>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>

      <SubmitButton label="Send reset link" />
    </form>
  );
}

/** Step 2 — set a new password (needs the recovery session from the email link). */
export function SetPasswordForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(updatePassword, undefined);

  return (
    <form action={formAction}>
      {state?.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          placeholder="At least 12 characters"
        />
      </div>

      <div className="field">
        <label htmlFor="confirm">Confirm new password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Re-enter password"
        />
      </div>

      <SubmitButton label="Set new password" />
    </form>
  );
}
