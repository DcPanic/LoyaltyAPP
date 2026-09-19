'use client';

import { useActionState } from 'react';
import { registerAction, type FormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';

const initial: FormState = {};

const COUNTRIES = [
  ['CY', 'Cyprus'],
  ['GR', 'Greece'],
  ['GB', 'United Kingdom'],
  ['DE', 'Germany'],
  ['IE', 'Ireland'],
] as const;

const TIMEZONES = ['Asia/Nicosia', 'Europe/Athens', 'Europe/London', 'Europe/Berlin'] as const;

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initial);
  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action}>
      {state.error && <div className="alert error">{state.error}</div>}

      <div className="field">
        <label htmlFor="businessName">Café name</label>
        <input id="businessName" name="businessName" required placeholder="Coffee House" />
        {err('businessName') && <small className="hint">{err('businessName')}</small>}
      </div>
      <div className="field">
        <label htmlFor="ownerName">Your name</label>
        <input id="ownerName" name="ownerName" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        {err('email') && <small className="hint">{err('email')}</small>}
      </div>
      <div className="field">
        <label htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" placeholder="+357 22 123456" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
        <small className="hint">At least 10 characters.</small>
        {err('password') && <small className="hint">{err('password')}</small>}
      </div>

      <div className="grid cols-3">
        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" name="country" defaultValue="CY">
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue="EUR">
            <option value="EUR">EUR €</option>
            <option value="GBP">GBP £</option>
            <option value="USD">USD $</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="timezone">Timezone</label>
          <select id="timezone" name="timezone" defaultValue="Asia/Nicosia">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SubmitButton className="btn block lg" pendingLabel="Creating your café…">
        Create account
      </SubmitButton>
    </form>
  );
}
