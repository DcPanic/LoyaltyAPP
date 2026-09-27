'use client';

import { useState } from 'react';

/**
 * The note box on the counter page.
 *
 * Anonymous by default: the contact field is optional and labelled as being
 * only for an answer, because someone about to complain should not have to
 * identify themselves first.
 */
export function SuggestionForm({ slug }: { slug: string }) {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (state === 'sent') {
    return (
      <div className="center">
        <p style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>✅</p>
        <p style={{ marginBottom: 0 }}>
          <strong>Thank you</strong> — the café has it.
        </p>
      </div>
    );
  }

  async function send() {
    if (message.trim().length < 3) {
      setError('Please write a little more.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), contact: contact.trim() || null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'Could not send that');
      }
      setState('sent');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not send that');
    }
  }

  return (
    <div className="field">
      <label htmlFor="suggestion">What would you tell the owner?</label>
      <textarea
        id="suggestion"
        rows={4}
        value={message}
        maxLength={2000}
        placeholder="Anything — the coffee, the music, an idea."
        onChange={(e) => setMessage(e.target.value)}
      />

      <label htmlFor="suggestion-contact" style={{ marginTop: '0.6rem' }}>
        Your email or phone (optional)
      </label>
      <input
        id="suggestion-contact"
        type="text"
        value={contact}
        placeholder="Only if you would like an answer"
        onChange={(e) => setContact(e.target.value)}
      />

      {error && <p className="hint error">{error}</p>}

      <button
        type="button"
        className="btn block lg"
        style={{ marginTop: '0.8rem' }}
        disabled={state === 'sending'}
        onClick={() => void send()}
      >
        {state === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}
