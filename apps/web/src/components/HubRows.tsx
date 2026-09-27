'use client';

import { useState } from 'react';
import { MiniGame } from './MiniGame';
import { SuggestionForm } from './SuggestionForm';

export type HubKind =
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'FACEBOOK'
  | 'MENU'
  | 'REVIEW'
  | 'ORDER'
  | 'WIFI'
  | 'CUSTOM';

export interface HubLink {
  id: string;
  kind: HubKind;
  label: string;
  url: string | null;
  value: string | null;
}

/** Each kind gets its own colour so the list is scannable rather than uniform. */
const TINT: Record<HubKind | 'REWARDS' | 'NOTE' | 'GAME', string> = {
  REWARDS: '#FF5D8F',
  INSTAGRAM: '#E1306C',
  TIKTOK: '#111827',
  FACEBOOK: '#1877F2',
  MENU: '#FFB020',
  REVIEW: '#4285F4',
  ORDER: '#2ED3A0',
  WIFI: '#4CC3FF',
  CUSTOM: '#8B5CF6',
  NOTE: '#8B5CF6',
  GAME: '#2ED3A0',
};

function Glyph({ kind }: { kind: HubKind | 'REWARDS' | 'NOTE' | 'GAME' }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' } as const;
  switch (kind) {
    case 'INSTAGRAM':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.68.8.9 1.4.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2a3.9 3.9 0 0 1-.9 1.4c-.4.4-.8.68-1.4.9-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.9 3.9 0 0 1-1.4-.9 3.9 3.9 0 0 1-.9-1.4c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.5-1 .9-1.4.4-.42.8-.68 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 3.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2Zm0 10.9a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6Zm6.9-11.1a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0Z" />
        </svg>
      );
    case 'TIKTOK':
      return (
        <svg {...common} aria-hidden>
          <path d="M16.6 2h-3v13.1a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.2 5.9V8.9a7 7 0 0 0 4 1.3V7A4.1 4.1 0 0 1 16.6 2Z" />
        </svg>
      );
    case 'FACEBOOK':
      return (
        <svg {...common} aria-hidden>
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case 'REVIEW':
      return (
        <svg {...common} aria-hidden>
          <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2Z" />
        </svg>
      );
    case 'MENU':
      return (
        <svg {...common} aria-hidden>
          <path d="M4 5h16v2.2H4V5Zm0 5.9h16v2.2H4v-2.2ZM4 16.8h11V19H4v-2.2Z" />
        </svg>
      );
    case 'ORDER':
      return (
        <svg {...common} aria-hidden>
          <path d="M7 4h10l1.6 3.4H5.4L7 4Zm-2.6 5.6h15.2L18 20.4a1.6 1.6 0 0 1-1.6 1.3H7.6A1.6 1.6 0 0 1 6 20.4L4.4 9.6Z" />
        </svg>
      );
    case 'WIFI':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 18.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Zm0-4.9c1.5 0 2.9.6 4 1.6l-1.7 1.8a3.4 3.4 0 0 0-4.6 0L8 15.3a5.8 5.8 0 0 1 4-1.6Zm0-4.8c2.8 0 5.3 1.1 7.2 2.9l-1.7 1.8A8 8 0 0 0 12 11.2a8 8 0 0 0-5.5 2.4l-1.7-1.8A10.2 10.2 0 0 1 12 8.9Zm0-4.8c4 0 7.7 1.6 10.4 4.2l-1.7 1.8A12.5 12.5 0 0 0 12 6.6c-3.4 0-6.4 1.3-8.7 3.5L1.6 8.3A14.7 14.7 0 0 1 12 4.1Z" />
        </svg>
      );
    case 'REWARDS':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 21s-7.6-4.6-9.4-9A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.4 5.4C19.6 16.4 12 21 12 21Z" />
        </svg>
      );
    case 'NOTE':
      return (
        <svg {...common} aria-hidden>
          <path d="M4 4h16v10.4H8.6L4 19V4Zm3.4 3.4v2.2h9.2V7.4H7.4Z" />
        </svg>
      );
    case 'GAME':
      return (
        <svg {...common} aria-hidden>
          <path d="M3.6 5h16.8v14H3.6V5Zm2.2 2.2v9.6h12.4V7.2H5.8Zm1.7 1.7h3v3h-3v-3Zm4.8 0h3v3h-3v-3Z" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4 1.6 1.6 1.4-1.4a1.7 1.7 0 1 1 2.4 2.4l-2.8 2.8a1.7 1.7 0 0 1-2.4 0l-1.6 1.7Zm2.8-2.8a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4-1.6-1.6-1.4 1.4a1.7 1.7 0 1 1-2.4-2.4l2.8-2.8a1.7 1.7 0 0 1 2.4 0l1.6-1.7Z" />
        </svg>
      );
  }
}

function Row({
  kind,
  label,
  sub,
  href,
  onClick,
  highlight,
}: {
  kind: HubKind | 'REWARDS' | 'NOTE' | 'GAME';
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const inner = (
    <>
      <span className="hub-icon" style={{ background: TINT[kind] }}>
        <Glyph kind={kind} />
      </span>
      <span className="hub-text">
        <span className="hub-label">{label}</span>
        {sub && <span className="hub-sub">{sub}</span>}
      </span>
      <span className="hub-chevron" aria-hidden>
        ›
      </span>
    </>
  );

  const className = `hub-row${highlight ? ' hub-row-primary' : ''}`;
  return href ? (
    <a className={className} href={href} target="_blank" rel="noreferrer noopener">
      {inner}
    </a>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

/**
 * The page the code on the counter opens.
 *
 * A café has more to say than "join our loyalty scheme", and this is the one
 * thing every customer scans. The card stays first and looks it; everything
 * else the café added follows in the order they chose. Tapping the first row
 * reveals the sign-up form in place rather than sending anyone to another page,
 * because the whole point is that this took one scan.
 */
export function HubRows({
  slug,
  links,
  rewardsLabel,
  rewardsSub,
  suggestions,
  game,
  children,
}: {
  slug: string;
  links: HubLink[];
  rewardsLabel: string;
  rewardsSub: string;
  suggestions: boolean;
  game: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<'join' | 'note' | 'game' | null>(null);
  const [wifi, setWifi] = useState<string | null>(null);

  return (
    <div className="hub">
      <Row
        kind="REWARDS"
        label={rewardsLabel}
        sub={rewardsSub}
        highlight
        onClick={() => setOpen(open === 'join' ? null : 'join')}
      />

      {open === 'join' && <div className="hub-panel">{children}</div>}

      {links.map((link) =>
        link.kind === 'WIFI' ? (
          <div key={link.id}>
            <Row
              kind="WIFI"
              label={link.label}
              sub={wifi ? undefined : 'Tap to see the password'}
              onClick={() => setWifi(wifi ? null : link.value)}
            />
            {wifi && (
              <div className="hub-panel center">
                <p className="hint" style={{ marginBottom: '0.4rem' }}>
                  Wi-Fi password
                </p>
                <p className="member-code" style={{ fontSize: '1.3rem', color: 'inherit' }}>
                  {wifi}
                </p>
              </div>
            )}
          </div>
        ) : (
          <Row key={link.id} kind={link.kind} label={link.label} href={link.url ?? '#'} />
        ),
      )}

      {suggestions && (
        <Row
          kind="NOTE"
          label="Leave us a note"
          sub="Anonymous unless you say otherwise"
          onClick={() => setOpen(open === 'note' ? null : 'note')}
        />
      )}
      {open === 'note' && (
        <div className="hub-panel">
          <SuggestionForm slug={slug} />
        </div>
      )}

      {game && (
        <Row
          kind="GAME"
          label="Play while you wait"
          onClick={() => setOpen(open === 'game' ? null : 'game')}
        />
      )}
      {open === 'game' && (
        <div className="hub-panel">
          <MiniGame />
        </div>
      )}
    </div>
  );
}
