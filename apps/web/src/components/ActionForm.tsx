'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/actions/admin';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = {};

/**
 * Small wrapper so every admin form reports success and failure the same way.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className = 'btn',
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initial);

  return (
    <form action={formAction}>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && state.message && (
        <div className="alert success" style={{ wordBreak: 'break-all' }}>
          {state.message}
        </div>
      )}
      {children}
      <SubmitButton className={className} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
