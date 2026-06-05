'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthState } from '@/lib/auth/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={pending ? { opacity: 0.6 } : undefined}>
      {pending ? 'Working…' : label} <span className="arrow">&rarr;</span>
    </button>
  );
}

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next?: string }) {
  const action = mode === 'login' ? signIn : signUp;
  const [state, formAction] = useFormState<AuthState, FormData>(action, undefined);

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

      {mode === 'signup' && (
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" type="text" autoComplete="name" placeholder="Your name" />
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
        />
        {mode === 'login' && (
          <p style={{ marginTop: '0.5rem', textAlign: 'right' }}>
            <Link className="text-link" href="/forgot-password" style={{ fontSize: '0.82rem' }}>
              Forgot password?
            </Link>
          </p>
        )}
      </div>

      {next && <input type="hidden" name="next" value={next} />}

      <SubmitButton label={mode === 'login' ? 'Sign in' : 'Create account'} />
    </form>
  );
}
