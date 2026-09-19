'use client';

import { useEffect, useRef, useState } from 'react';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

/**
 * Camera scanning with the browser's own BarcodeDetector where it exists
 * (Chrome/Android, recent Safari). Everywhere else the barista types the member
 * code, and the React Native staff app has a native scanner.
 */
export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (code: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(true);
  const [manual, setManual] = useState('');

  useEffect(() => {
    const Detector = (
      globalThis as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;

    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }

    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const detector = new Detector({ formats: ['qr_code'] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              onResult(value.trim());
              return;
            }
          } catch {
            /* keep scanning */
          }
          frame = requestAnimationFrame(() => void tick());
        };
        frame = requestAnimationFrame(() => void tick());
      } catch {
        setSupported(false);
        onError('Camera access was refused — enter the member code instead.');
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult, onError]);

  return (
    <div style={{ marginBottom: '1rem' }}>
      {supported ? (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: '100%',
            borderRadius: 'var(--radius)',
            background: '#000',
            aspectRatio: '4 / 3',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div className="alert info">
          This browser cannot use the camera for scanning. Enter the member code shown under the
          customer&apos;s QR.
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim().length >= 4) onResult(manual.trim());
        }}
        style={{ marginTop: '0.6rem' }}
      >
        <div className="row">
          <input
            aria-label="Member code"
            placeholder="Member code"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            style={{ flex: 1 }}
          />
          <button className="btn secondary" type="submit">
            Find
          </button>
        </div>
      </form>
    </div>
  );
}
