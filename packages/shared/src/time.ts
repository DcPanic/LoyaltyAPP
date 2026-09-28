/**
 * Times, in the café's timezone rather than the reader's.
 *
 * A rota is the one screen where "your local time" is the wrong answer. A shift
 * is at eight in the morning at that café; an owner reading it from abroad, or
 * a barista whose phone came back from holiday still set to another zone, must
 * see the same eight o'clock as everyone else. Getting this wrong does not look
 * like a bug — it looks like someone turning up six hours late.
 *
 * Instants are stored and sent as UTC. Everything here converts for display, or
 * works out which UTC instant a café's local midnight falls on.
 */

/** The calendar date an instant falls on in `tz`, as YYYY-MM-DD. */
export function zonedDayKey(instant: Date | string, tz: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Clock time in `tz`, 24 hour, as HH:mm. */
export function zonedTime(instant: Date | string, tz: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * The instant at which a calendar date begins in `tz`.
 *
 * Found by taking the naive UTC midnight and correcting it by the zone's offset
 * at that moment, which is the only way to do this without shipping a timezone
 * database. Accurate except when a zone shifts its clocks exactly at midnight,
 * where the result can be an hour out — no café rosters anyone at that instant.
 */
export function zonedStartOfDay(dayKey: string, tz: string): Date {
  return zonedInstant(dayKey, '00:00', tz);
}

/**
 * The instant of a wall-clock time on a calendar date in `tz`.
 *
 * This is the other half of the same problem: an owner typing "08:00" means
 * eight o'clock at their café, not eight o'clock wherever the server happens to
 * be running. Storing the raw string would quietly shift every shift by the gap
 * between the two.
 */
export function zonedInstant(dayKey: string, clock: string, tz: string): Date {
  const naive = new Date(`${dayKey}T${clock}:00Z`);
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asZone = new Date(naive.toLocaleString('en-US', { timeZone: tz }));
  return new Date(naive.getTime() + (asUtc.getTime() - asZone.getTime()));
}

/** Shifts a YYYY-MM-DD forward or back, without touching any timezone. */
export function addDays(dayKey: string, days: number): string {
  // Noon keeps the arithmetic clear of daylight-saving jumps either side.
  const at = new Date(`${dayKey}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** Day of the week for a YYYY-MM-DD, 0 = Monday. */
export function weekdayIndex(dayKey: string): number {
  return (new Date(`${dayKey}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * The seven day keys of the week containing `dayKey`, Monday first.
 * Weeks start on Monday because that is how a rota is read and posted.
 */
export function weekDayKeys(dayKey: string): string[] {
  const monday = addDays(dayKey, -weekdayIndex(dayKey));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** How long a shift runs, in hours, to one decimal. */
export function hoursBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 10) / 10;
}
