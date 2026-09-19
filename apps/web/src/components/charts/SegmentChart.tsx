import './chart-tokens.css';

const ORDER = ['NEW', 'ACTIVE', 'VIP', 'AT_RISK', 'LOST'] as const;
type SegmentKey = (typeof ORDER)[number];

const LABELS: Record<SegmentKey, string> = {
  NEW: 'New',
  ACTIVE: 'Active',
  VIP: 'VIP',
  AT_RISK: 'At risk',
  LOST: 'Lost',
};

const EXPLAIN: Record<SegmentKey, string> = {
  NEW: 'Joined in the last 14 days',
  ACTIVE: 'Coming back regularly',
  VIP: '20+ stamps in 60 days',
  AT_RISK: 'Nothing for 30 days',
  LOST: 'Nothing for 90 days',
};

/**
 * Customer segments. Colour carries identity and every bar is directly labelled,
 * so the reading never depends on telling two hues apart.
 */
export function SegmentChart({ segments }: { segments: Record<string, number> }) {
  const total = ORDER.reduce((sum, key) => sum + (segments[key] ?? 0), 0);

  if (total === 0) {
    return <p className="empty">Segments appear once customers start collecting stamps.</p>;
  }

  return (
    <div className="viz-root">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.7rem' }}>
        {ORDER.map((key) => {
          const value = segments[key] ?? 0;
          const pct = Math.round((value / total) * 100);
          return (
            <li key={key}>
              <div className="spread" style={{ marginBottom: '0.25rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <i
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: `var(--seg-${key.toLowerCase()})`,
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ fontSize: '0.9rem' }}>{LABELS[key]}</strong>
                  <small className="hint">{EXPLAIN[key]}</small>
                </span>
                <span style={{ fontSize: '0.9rem' }}>
                  <strong>{value}</strong> <small className="hint">({pct}%)</small>
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  background: 'var(--cream)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${pct}%`,
                    height: '100%',
                    background: `var(--seg-${key.toLowerCase()})`,
                    borderRadius: 999,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
