'use client';

import { useActionState } from 'react';
import { acceptInviteAction, type FormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';

const initial: FormState = {};

export function InviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, action] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action}>
      {state.error && <div className="alert error">{state.error}</div>}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" defaultValue={defaultName} required />
      </div>
      <div className="field">
        <label htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
        <small className="hint">At least 10 characters.</small>
      </div>
      <SubmitButton className="btn block lg" pendingLabel="Setting up…">
        Join the team
      </SubmitButton>
    </form>
  );
}
