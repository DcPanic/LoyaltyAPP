'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Something to do while the coffee is made.
 *
 * A memory game rather than a puzzle with a fixed answer: it fits a phone held
 * in one hand, a round lasts about as long as a flat white takes, and it can be
 * abandoned halfway without losing anything. It keeps no state anywhere — the
 * café gets nothing from it except a customer still holding their page.
 */

const FACES = ['☕', '🥐', '🍰', '🧁', '🍪', '🥯'];

interface Tile {
  id: number;
  face: string;
  flipped: boolean;
  matched: boolean;
}

function freshDeck(): Tile[] {
  const deck = [...FACES, ...FACES].map((face, id) => ({
    id,
    face,
    flipped: false,
    matched: false,
  }));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export function MiniGame() {
  const [tiles, setTiles] = useState<Tile[]>(freshDeck);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const done = tiles.every((t) => t.matched);

  // Two tiles are showing: either they match and stay, or they turn back over
  // after long enough to have seen them.
  useEffect(() => {
    if (picked.length !== 2) return;
    const [a, b] = picked;
    const first = tiles.find((t) => t.id === a);
    const second = tiles.find((t) => t.id === b);
    const isPair = first && second && first.face === second.face;

    const timer = setTimeout(
      () => {
        setTiles((current) =>
          current.map((t) =>
            t.id === a || t.id === b
              ? { ...t, matched: Boolean(isPair), flipped: Boolean(isPair) }
              : t,
          ),
        );
        setPicked([]);
      },
      isPair ? 260 : 760,
    );
    return () => clearTimeout(timer);
  }, [picked, tiles]);

  const flip = useCallback(
    (id: number) => {
      if (picked.length === 2) return;
      setTiles((current) =>
        current.map((t) => (t.id === id && !t.matched ? { ...t, flipped: true } : t)),
      );
      setPicked((current) => {
        if (current.includes(id) || current.length === 2) return current;
        const next = [...current, id];
        if (next.length === 2) setMoves((m) => m + 1);
        return next;
      });
    },
    [picked.length],
  );

  function restart() {
    setTiles(freshDeck());
    setPicked([]);
    setMoves(0);
  }

  return (
    <div className="center">
      <p className="hint" style={{ marginBottom: '0.6rem' }}>
        {done ? `Done in ${moves} tries.` : 'Find the matching pairs.'}
      </p>

      <div className="game-grid">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`game-tile${tile.flipped || tile.matched ? ' flipped' : ''}${tile.matched ? ' matched' : ''}`}
            onClick={() => flip(tile.id)}
            aria-label={tile.flipped || tile.matched ? tile.face : 'Hidden tile'}
          >
            <span>{tile.flipped || tile.matched ? tile.face : ''}</span>
          </button>
        ))}
      </div>

      <button type="button" className="btn secondary" style={{ marginTop: '0.9rem' }} onClick={restart}>
        {done ? 'Play again' : 'Start over'}
      </button>
    </div>
  );
}
