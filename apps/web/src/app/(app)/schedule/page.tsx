import {
  addDays,
  hoursBetween,
  weekDayKeys,
  zonedDayKey,
  zonedStartOfDay,
  zonedTime,
} from '@loyaltyapp/shared';
import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import {
  addShiftAction,
  deleteShiftAction,
  publishScheduleAction,
  setScheduleVisibilityAction,
} from '@/app/actions/admin';

interface Shift {
  id: string;
  staffMembershipId: string;
  staffName: string;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  note: string | null;
  published: boolean;
}

interface Person {
  id: string;
  name: string;
  role: string;
  seesFullSchedule: boolean;
}

export const metadata = { title: 'Schedule — LoyaltyApp' };

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A day key as "3 Mar", in the café's own calendar. */
const dayLabel = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const monthLabel = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requirePermission('schedule:manage');
  const { week } = await searchParams;

  // Everything below is worked out in the café's timezone, never the reader's.
  // A rota read from abroad, or on a phone still set to another country, has to
  // show the same clock as the one on the wall.
  const business = await api<{ timezone: string }>('/v1/business');
  const tz = business.timezone;

  const days = weekDayKeys(week ?? zonedDayKey(new Date(), tz));
  const from = zonedStartOfDay(days[0]!, tz);
  const to = zonedStartOfDay(addDays(days[6]!, 1), tz);

  const [schedule, people, locations] = await Promise.all([
    api<{ items: Shift[] }>(
      `/v1/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    ),
    api<{ items: Person[] }>('/v1/schedule/people'),
    api<{ items: { id: string; name: string }[] }>('/v1/business/locations'),
  ]);

  const week_ = days.map((dayKey, i) => ({
    dayKey,
    name: DAY_NAMES[i]!,
    shifts: schedule.items.filter((s) => zonedDayKey(s.startsAt, tz) === dayKey),
  }));

  const unpublished = schedule.items.filter((s) => !s.published).length;
  const totalHours =
    Math.round(schedule.items.reduce((t, s) => t + hoursBetween(s.startsAt, s.endsAt), 0) * 10) /
    10;

  return (
    <>
      <div className="topbar">
        <h1>Schedule</h1>
        <div className="row">
          <a className="btn secondary" href={`/schedule?week=${addDays(days[0]!, -7)}`}>
            ‹ Previous
          </a>
          <a className="btn secondary" href={`/schedule?week=${addDays(days[0]!, 7)}`}>
            Next ›
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
{monthLabel(days[0]!)} — {monthLabel(days[6]!)}
          </h2>
          <span className="hint">
            {schedule.items.length} shifts · {totalHours} hours
          </span>
        </div>

        {/* Nothing here reaches the team until this is pressed. A week that is
            still being worked out should not have anyone booking their life
            around it. */}
        <p className="hint">
          {unpublished === 0 && schedule.items.length > 0
            ? 'The whole week is published — your team can see it.'
            : unpublished > 0
              ? `${unpublished} shift${unpublished === 1 ? '' : 's'} not published yet. Your team cannot see ${unpublished === 1 ? 'it' : 'them'}.`
              : 'Nothing on this week yet.'}
        </p>

        <div className="row">
          <ActionForm action={publishScheduleAction} submitLabel="Publish this week">
            <input type="hidden" name="from" value={from.toISOString()} />
            <input type="hidden" name="to" value={to.toISOString()} />
          </ActionForm>
          <ActionForm action={publishScheduleAction} submitLabel="Take it back" className="btn secondary">
            <input type="hidden" name="from" value={from.toISOString()} />
            <input type="hidden" name="to" value={to.toISOString()} />
            <input type="hidden" name="undo" value="1" />
          </ActionForm>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Add a shift</h2>
        </div>
        <ActionForm action={addShiftAction} submitLabel="Add">
          <div className="grid cols-3">
            <div className="field">
              <label htmlFor="staffMembershipId">Who</label>
              <select id="staffMembershipId" name="staffMembershipId" required>
                {people.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">Day</label>
              <input id="date" name="date" type="date" defaultValue={days[0]!} required />
            </div>
            <div className="field">
              <label htmlFor="locationId">Where (optional)</label>
              <select id="locationId" name="locationId">
                <option value="">Anywhere</option>
                {locations.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid cols-3">
            <div className="field">
              <label htmlFor="start">From</label>
              <input id="start" name="start" type="time" defaultValue="08:00" required />
            </div>
            <div className="field">
              <label htmlFor="end">To</label>
              <input id="end" name="end" type="time" defaultValue="16:00" required />
              <small className="hint">An end before the start means it runs overnight.</small>
            </div>
            <div className="field">
              <label htmlFor="note">Note (optional)</label>
              <input id="note" name="note" type="text" placeholder="Opening, deliveries…" />
            </div>
          </div>
        </ActionForm>
      </div>

      {week_.map((day) => (
        <div className="card" key={day.name}>
          <div className="card-header">
            <h2>{day.name}</h2>
            <span className="hint">
              {dayLabel(day.dayKey)}
            </span>
          </div>

          {day.shifts.length === 0 ? (
            <p className="hint">Nobody on.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {day.shifts.map((shift) => (
                <div key={shift.id} className="search-result" style={{ cursor: 'default' }}>
                  <div>
                    <strong>{shift.staffName}</strong>
                    <div className="hint">
                      {zonedTime(shift.startsAt, tz)} – {zonedTime(shift.endsAt, tz)} ·{' '}
                      {hoursBetween(shift.startsAt, shift.endsAt)}h
                      {shift.locationName ? ` · ${shift.locationName}` : ''}
                      {shift.note ? ` · ${shift.note}` : ''}
                      {!shift.published ? ' · not published' : ''}
                    </div>
                  </div>
                  <ActionForm action={deleteShiftAction} submitLabel="Remove" className="btn secondary">
                    <input type="hidden" name="id" value={shift.id} />
                  </ActionForm>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <div className="card-header">
          <h2>Who sees the whole week</h2>
        </div>
        <p className="hint">
          Everyone sees the week by default, which lets the team sort a swap out between
          themselves. Turn it off for anyone who should only see their own shifts.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {people.items.map((p) => (
            <div key={p.id} className="search-result" style={{ cursor: 'default' }}>
              <div>
                <strong>{p.name}</strong>
                <div className="hint">
                  {p.role.toLowerCase()} ·{' '}
                  {p.seesFullSchedule ? 'sees the whole week' : 'sees only their own shifts'}
                </div>
              </div>
              <ActionForm
                action={setScheduleVisibilityAction}
                submitLabel={p.seesFullSchedule ? 'Only their own' : 'Whole week'}
                className="btn secondary"
              >
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="seesFullSchedule" value={p.seesFullSchedule ? '0' : '1'} />
              </ActionForm>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
