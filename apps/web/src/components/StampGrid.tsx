export function StampGrid({ stamps, required }: { stamps: number; required: number }) {
  const filled = Math.min(stamps, required);
  return (
    <div
      className="stamp-grid"
      role="img"
      aria-label={`${stamps} of ${required} stamps collected`}
    >
      {Array.from({ length: required }, (_, i) => (
        <span key={i} className={`stamp-dot${i < filled ? ' filled' : ''}`} aria-hidden>
          {i < filled ? '☕' : ''}
        </span>
      ))}
    </div>
  );
}

export function StampProgress({ stamps, required }: { stamps: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((stamps / required) * 100)) : 0;
  return (
    <div className="progress" role="img" aria-label={`${pct}% towards the next reward`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
