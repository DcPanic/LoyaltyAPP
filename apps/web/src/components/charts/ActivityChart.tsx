'use client';

import { useState } from 'react';
import './chart-tokens.css';

export interface SeriesPoint {
  date: string;
  stamps: number;
  joins: number;
  redemptions: number;
}

const W = 720;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 34 };

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * Daily stamps. One series, one axis: joins and redemptions live in their own
 * small multiples below rather than fighting for this scale.
 */
export function ActivityChart({ series }: { series: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (series.length === 0) {
    return <p className="empty">No activity yet — your first stamps will show up here.</p>;
  }

  const max = niceMax(Math.max(...series.map((p) => p.stamps), 1));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / series.length;
  const barW = Math.max(2, slot - 2); // 2px surface gap between bars
  const ticks = [0, max / 2, max];

  const point = hover !== null ? series[hover] : undefined;

  return (
    <div className="viz-root" style={{ position: 'relative' }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Stamps per day over the last ${series.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--viz-grid)"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--viz-axis)">
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        {series.map((p, i) => {
          const h = max > 0 ? (p.stamps / max) * plotH : 0;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = PAD.top + plotH - h;
          return (
            <g key={p.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, p.stamps > 0 ? 2 : 0)}
                rx={Math.min(4, barW / 2)}
                fill="var(--viz-series)"
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              {/* Hit target wider than the mark. */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--viz-axis)"
          strokeWidth={1}
        />

        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text
            key={i}
            x={PAD.left + i * slot + slot / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            fill="var(--viz-axis)"
          >
            {formatDay(series[i]!.date)}
          </text>
        ))}
      </svg>

      {point && (
        <div
          className="viz-tooltip"
          style={{
            left: `${((PAD.left + hover! * slot + slot / 2) / W) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <strong>{point.stamps}</strong> stamps · {formatDay(point.date)}
          <br />
          {point.joins} joined · {point.redemptions} rewards used
        </div>
      )}

      <details className="viz-table">
        <summary>View as table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Stamps</th>
                <th>New members</th>
                <th>Rewards redeemed</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{formatDay(p.date)}</td>
                  <td>{p.stamps}</td>
                  <td>{p.joins}</td>
                  <td>{p.redemptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Compact companion series, kept off the stamps axis on purpose. */
export function Sparkline({
  series,
  field,
  label,
}: {
  series: SeriesPoint[];
  field: 'joins' | 'redemptions';
  label: string;
}) {
  const values = series.map((p) => p[field]);
  const max = Math.max(...values, 1);
  const w = 260;
  const h = 44;
  const slot = w / Math.max(values.length, 1);

  return (
    <div className="viz-root">
      <div className="spread" style={{ marginBottom: '0.3rem' }}>
        <small className="hint">{label}</small>
        <small>
          <strong>{values.reduce((a, b) => a + b, 0)}</strong> in {series.length} days
        </small>
      </div>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {values.map((v, i) => {
          const barH = (v / max) * (h - 4);
          return (
            <rect
              key={i}
              x={i * slot}
              y={h - barH}
              width={Math.max(1.5, slot - 2)}
              height={Math.max(barH, v > 0 ? 2 : 0)}
              rx={2}
              fill="var(--viz-series)"
              opacity={0.75}
            >
              <title>{`${v} on ${series[i]!.date}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
