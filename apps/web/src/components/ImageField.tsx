'use client';

import { useRef, useState } from 'react';

/**
 * One picture on a settings form: choose a file, or paste an address.
 *
 * The upload happens as soon as a file is chosen, and what it produces is put
 * into a hidden input under the field's own name. The surrounding form is
 * unchanged — it still submits one text value — so a café that already hosts
 * its artwork somewhere can keep pasting an address instead.
 */
export function ImageField({
  name,
  kind,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  kind: 'logo' | 'cover' | 'reward';
  label: string;
  hint?: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${kind}`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !data.url) throw new Error(data.message ?? 'Upload failed');
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="field">
      <label htmlFor={`${name}-file`}>{label}</label>

      <input type="hidden" name={name} value={url} />

      <input
        id={`${name}-file`}
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {hint && <p className="hint">{hint}</p>}
      {busy && <p className="hint">Uploading…</p>}
      {error && <p className="hint error">{error}</p>}

      {url && !busy && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            style={{ marginTop: '0.5rem', maxWidth: '100%', maxHeight: 160, borderRadius: 8 }}
          />
          <div className="row" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
            <button type="button" className="btn secondary sm" onClick={() => setUrl('')}>
              Remove
            </button>
          </div>
        </>
      )}

      <details style={{ marginTop: '0.5rem' }}>
        <summary className="hint">Or use a picture that is already online</summary>
        <input
          type="text"
          value={url}
          placeholder="https://…"
          onChange={(e) => setUrl(e.target.value)}
          style={{ marginTop: '0.5rem' }}
        />
      </details>
    </div>
  );
}
