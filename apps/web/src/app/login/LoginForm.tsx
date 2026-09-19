'use client';

import { useActionState } from 'react';
import { loginAction, type FormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';

const initial: FormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initial);

  return (
    <form action={action}>
      {state.error && <div className="alert error">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <SubmitButton className="btn block lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
