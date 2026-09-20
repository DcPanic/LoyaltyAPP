'use client';

import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Keeps the card one tap away on the phone's home screen. Android and desktop
 * Chrome offer a real install prompt; iOS has no API for it, so there we show
 * the two steps instead of pretending.
 */
export function AddToHomeScreen({ businessName }: { businessName: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (installed) return null;

  return (
    <div className="card">
      <h3>Keep your card on your phone</h3>
      {prompt ? (
        <>
          <p className="hint">
            Add {businessName} to your home screen and your stamps are always one tap away.
          </p>
          <button
            className="btn block"
            type="button"
            onClick={() => {
              void prompt.prompt().then(() => setPrompt(null));
            }}
          >
            Add to home screen
          </button>
        </>
      ) : isIos ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Tap <strong>Share</strong> at the bottom of Safari, then{' '}
          <strong>Add to Home Screen</strong> — your card gets its own icon, just like an app.
        </p>
      ) : (
        <p className="hint" style={{ marginBottom: 0 }}>
          Open your browser menu and choose <strong>Add to Home screen</strong> to keep this card
          one tap away.
        </p>
      )}
    </div>
  );
}
