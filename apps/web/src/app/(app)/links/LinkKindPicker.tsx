'use client';

import { useState } from 'react';

/**
 * Picking what kind of row to add.
 *
 * Choosing the kind fills in a sensible label and swaps the second field, because
 * Wi-Fi is the one kind that carries a password to show rather than an address
 * to open. Asking for both and ignoring one is how people end up staring at a
 * form wondering which half matters.
 */
const KINDS = [
  { value: 'INSTAGRAM', label: 'Instagram', suggested: 'Follow us on Instagram', hint: 'https://instagram.com/yourcafe' },
  { value: 'TIKTOK', label: 'TikTok', suggested: 'Our TikTok', hint: 'https://tiktok.com/@yourcafe' },
  { value: 'FACEBOOK', label: 'Facebook', suggested: 'Find us on Facebook', hint: 'https://facebook.com/yourcafe' },
  { value: 'MENU', label: 'Menu', suggested: 'View our menu', hint: 'A link to your menu' },
  { value: 'REVIEW', label: 'Review', suggested: 'Leave a Google review', hint: 'Your Google Maps link' },
  { value: 'ORDER', label: 'Order', suggested: 'Order for delivery', hint: 'Your ordering page' },
  { value: 'WIFI', label: 'Wi-Fi', suggested: 'Connect to Wi-Fi', hint: '' },
  { value: 'CUSTOM', label: 'Something else', suggested: '', hint: 'Any web address' },
] as const;

export function LinkKindPicker() {
  const [kind, setKind] = useState<string>('INSTAGRAM');
  const chosen = KINDS.find((k) => k.value === kind)!;
  const isWifi = kind === 'WIFI';

  return (
    <>
      <div className="field">
        <label htmlFor="kind">What is it</label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="label">What the customer sees</label>
        <input
          id="label"
          name="label"
          type="text"
          required
          maxLength={60}
          // Keyed so changing the kind refreshes the suggested wording rather
          // than leaving the previous one in place.
          key={kind}
          defaultValue={chosen.suggested}
          placeholder="Follow us on Instagram"
        />
      </div>

      {isWifi ? (
        <div className="field">
          <label htmlFor="value">Wi-Fi password</label>
          <input id="value" name="value" type="text" required maxLength={160} />
          <small className="hint">
            Shown only after the customer taps the row — it is not printed on the page.
          </small>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="url">Web address</label>
          <input id="url" name="url" type="url" required placeholder={chosen.hint} />
          <small className="hint">Must start with https://</small>
        </div>
      )}
    </>
  );
}
