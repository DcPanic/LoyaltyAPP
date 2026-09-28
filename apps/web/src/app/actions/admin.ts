'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function toState(err: unknown): ActionState {
  if (err instanceof ApiError) {
    const details = err.details as { path: string; message: string }[] | undefined;
    const first = details?.[0];
    return { error: first ? `${first.path}: ${first.message}` : err.message };
  }
  return { error: 'Something went wrong. Please try again.' };
}

const str = (form: FormData, key: string): string | undefined => {
  const value = form.get(key);
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim();
};
const num = (form: FormData, key: string): number | undefined => {
  const value = str(form, key);
  return value === undefined ? undefined : Number(value);
};
const bool = (form: FormData, key: string): boolean => form.get(key) === 'on';

/* ------------------------------------------------------------- branding ---- */

export async function updateBusinessAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await api('/v1/business', {
      method: 'PATCH',
      body: {
        name: str(form, 'name'),
        logoUrl: str(form, 'logoUrl') ?? null,
        coverImageUrl: str(form, 'coverImageUrl') ?? null,
        primaryColor: str(form, 'primaryColor'),
        secondaryColor: str(form, 'secondaryColor'),
        contactEmail: str(form, 'contactEmail') ?? null,
        contactPhone: str(form, 'contactPhone') ?? null,
        addressLine: str(form, 'addressLine') ?? null,
        city: str(form, 'city') ?? null,
        timezone: str(form, 'timezone'),
        currency: str(form, 'currency'),
        privacyPolicyUrl: str(form, 'privacyPolicyUrl') ?? null,
        termsUrl: str(form, 'termsUrl') ?? null,
      },
    });
    revalidatePath('/settings');
    return { ok: true, message: 'Branding saved — wallet cards will use it from the next update.' };
  } catch (err) {
    return toState(err);
  }
}

/* -------------------------------------------------------------- program ---- */

export async function updateProgramAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = str(form, 'id');
  const amounts = str(form, 'allowedStampAmounts')
    ?.split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);

  try {
    const body = {
      name: str(form, 'name'),
      description: str(form, 'description') ?? null,
      stampsRequired: num(form, 'stampsRequired'),
      rewardName: str(form, 'rewardName'),
      rewardDescription: str(form, 'rewardDescription') ?? null,
      rewardImageUrl: str(form, 'rewardImageUrl') ?? null,
      rewardExpiryDays: num(form, 'rewardExpiryDays') ?? null,
      allowedStampAmounts: amounts && amounts.length > 0 ? amounts : undefined,
      maxStampsPerVisit: num(form, 'maxStampsPerVisit'),
      selfServiceCooldownSeconds: num(form, 'selfServiceCooldownSeconds'),
      shareAcrossLocations: bool(form, 'shareAcrossLocations'),
      isActive: bool(form, 'isActive'),
    };
    if (id) await api(`/v1/programs/${id}`, { method: 'PATCH', body });
    else await api('/v1/programs', { method: 'POST', body });
    revalidatePath('/loyalty');
    return { ok: true, message: 'Loyalty program saved.' };
  } catch (err) {
    return toState(err);
  }
}

/* -------------------------------------------------------------- rewards ---- */

export async function saveRewardAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  const body = {
    name: str(form, 'name'),
    description: str(form, 'description') ?? null,
    imageUrl: str(form, 'imageUrl') ?? null,
    stampsRequired: num(form, 'stampsRequired'),
    expiryDays: num(form, 'expiryDays') ?? null,
    isActive: bool(form, 'isActive'),
  };
  try {
    if (id) await api(`/v1/rewards/${id}`, { method: 'PATCH', body });
    else await api('/v1/rewards', { method: 'POST', body: { ...body, programId: str(form, 'programId') } });
    revalidatePath('/rewards');
    return { ok: true, message: 'Reward saved.' };
  } catch (err) {
    return toState(err);
  }
}

/* ------------------------------------------------------------ locations ---- */

export async function saveLocationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  const body = {
    name: str(form, 'name'),
    addressLine: str(form, 'addressLine') ?? null,
    city: str(form, 'city') ?? null,
    phone: str(form, 'phone') ?? null,
    isActive: form.get('isActive') === null ? undefined : bool(form, 'isActive'),
  };
  try {
    if (id) await api(`/v1/business/locations/${id}`, { method: 'PATCH', body });
    else await api('/v1/business/locations', { method: 'POST', body });
    revalidatePath('/locations');
    return { ok: true, message: 'Location saved.' };
  } catch (err) {
    return toState(err);
  }
}

/* ---------------------------------------------------------------- staff ---- */

export async function inviteStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const result = await api<{ inviteUrl: string }>('/v1/staff/invite', {
      method: 'POST',
      body: {
        name: str(form, 'name'),
        email: str(form, 'email'),
        role: str(form, 'role') ?? 'STAFF',
        locationIds: form.getAll('locationIds').map(String).filter(Boolean),
      },
    });
    revalidatePath('/staff');
    return { ok: true, message: `Invitation link: ${result.inviteUrl}` };
  } catch (err) {
    return toState(err);
  }
}

export async function updateStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing staff member' };
  try {
    await api(`/v1/staff/${id}`, {
      method: 'PATCH',
      body: {
        role: str(form, 'role'),
        isActive: form.get('isActive') === null ? undefined : bool(form, 'isActive'),
        locationIds: form.getAll('locationIds').map(String).filter(Boolean),
      },
    });
    revalidatePath('/staff');
    return { ok: true, message: 'Staff member updated.' };
  } catch (err) {
    return toState(err);
  }
}

export async function removeStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing staff member' };
  try {
    await api(`/v1/staff/${id}`, { method: 'DELETE' });
    revalidatePath('/staff');
    return { ok: true, message: 'Staff member deactivated.' };
  } catch (err) {
    return toState(err);
  }
}

/* ------------------------------------------------------------------ nfc ---- */

export async function createTagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await api('/v1/nfc', {
      method: 'POST',
      body: { label: str(form, 'label'), locationId: str(form, 'locationId') ?? null },
    });
    revalidatePath('/nfc');
    return { ok: true, message: 'Tag registered — write its link to the NFC sticker.' };
  } catch (err) {
    return toState(err);
  }
}

export async function toggleTagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing tag' };
  try {
    await api(`/v1/nfc/${id}`, {
      method: 'PATCH',
      body: { isActive: form.get('isActive') === 'true' },
    });
    revalidatePath('/nfc');
    return { ok: true, message: 'Tag updated.' };
  } catch (err) {
    return toState(err);
  }
}

/* ------------------------------------------------------------ campaigns ---- */

export async function saveCampaignAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  const body = {
    name: str(form, 'name'),
    type: str(form, 'type'),
    message: str(form, 'message'),
    segments: form.getAll('segments').map(String).filter(Boolean),
    startsAt: str(form, 'startsAt') ? new Date(str(form, 'startsAt')!).toISOString() : null,
    endsAt: str(form, 'endsAt') ? new Date(str(form, 'endsAt')!).toISOString() : null,
    stampMultiplier: num(form, 'stampMultiplier'),
    isActive: bool(form, 'isActive'),
  };
  try {
    if (id) await api(`/v1/campaigns/${id}`, { method: 'PATCH', body });
    else await api('/v1/campaigns', { method: 'POST', body });
    revalidatePath('/campaigns');
    return { ok: true, message: 'Campaign saved.' };
  } catch (err) {
    return toState(err);
  }
}

export async function runCampaignAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing campaign' };
  try {
    const result = await api<{ audienceSize: number }>(`/v1/campaigns/${id}/run`, {
      method: 'POST',
    });
    revalidatePath('/campaigns');
    return { ok: true, message: `Campaign matched ${result.audienceSize} customers.` };
  } catch (err) {
    return toState(err);
  }
}

/* ------------------------------------------------------------ customers ---- */

export async function createCustomerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const result = await api<{ memberPageUrl: string }>('/v1/customers', {
      method: 'POST',
      body: {
        firstName: str(form, 'firstName'),
        lastName: str(form, 'lastName') ?? null,
        phone: str(form, 'phone') ?? null,
        email: str(form, 'email') ?? null,
        birthday: str(form, 'birthday') ?? null,
        marketingConsent: bool(form, 'marketingConsent'),
      },
    });
    revalidatePath('/customers');
    return { ok: true, message: `Customer added. Card link: ${result.memberPageUrl}` };
  } catch (err) {
    return toState(err);
  }
}

export async function adjustStampsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await api('/v1/stamping/adjust', {
      method: 'POST',
      body: {
        membershipId: str(form, 'membershipId'),
        stamps: num(form, 'stamps'),
        reason: str(form, 'reason'),
      },
    });
    revalidatePath(`/customers/${str(form, 'customerId')}`);
    return { ok: true, message: 'Balance corrected and written to the activity log.' };
  } catch (err) {
    return toState(err);
  }
}

export async function deleteCustomerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = str(form, 'customerId');
  if (!id) return { error: 'Missing customer' };
  try {
    await api(`/v1/customers/${id}`, { method: 'DELETE' });
    revalidatePath('/customers');
    return { ok: true, message: 'Customer erased. Their wallet passes were revoked.' };
  } catch (err) {
    return toState(err);
  }
}

export async function setConsentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'customerId');
  if (!id) return { error: 'Missing customer' };
  try {
    await api(`/v1/customers/${id}/consent`, {
      method: 'POST',
      body: { marketingConsent: form.get('granted') === 'true', source: 'dashboard' },
    });
    revalidatePath(`/customers/${id}`);
    return { ok: true, message: 'Consent updated.' };
  } catch (err) {
    return toState(err);
  }
}

/* ----------------------------------------------------------------- rota ---- */

/**
 * The form gives a date and two clock times; the API wants two instants.
 * A shift that ends earlier in the day than it starts is an overnight one, so
 * the end belongs to the next day rather than being an error.
 */
function shiftTimes(form: FormData): { startsAt: string; endsAt: string } | null {
  const date = str(form, 'date');
  const start = str(form, 'start');
  const end = str(form, 'end');
  if (!date || !start || !end) return null;

  const startsAt = new Date(`${date}T${start}`);
  const endsAt = new Date(`${date}T${end}`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);

  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export async function addShiftAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const times = shiftTimes(form);
  if (!times) return { error: 'Give a date, a start and an end.' };

  try {
    await api('/v1/schedule', {
      method: 'POST',
      body: {
        staffMembershipId: str(form, 'staffMembershipId'),
        locationId: str(form, 'locationId') ?? null,
        note: str(form, 'note') ?? null,
        ...times,
      },
    });
    revalidatePath('/schedule');
    return { ok: true, message: 'Shift added.' };
  } catch (err) {
    return toState(err);
  }
}

export async function deleteShiftAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing shift.' };
  try {
    await api(`/v1/schedule/${id}`, { method: 'DELETE' });
    revalidatePath('/schedule');
    return { ok: true, message: 'Shift removed.' };
  } catch (err) {
    return toState(err);
  }
}

export async function publishScheduleAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const from = str(form, 'from');
  const to = str(form, 'to');
  const undo = form.get('undo') === '1';
  if (!from || !to) return { error: 'Missing week.' };

  try {
    const result = await api<{ published?: number; unpublished?: number }>(
      `/v1/schedule/${undo ? 'unpublish' : 'publish'}`,
      { method: 'POST', body: { from, to } },
    );
    revalidatePath('/schedule');
    return {
      ok: true,
      message: undo
        ? `Taken back from the team (${result.unpublished ?? 0} shifts).`
        : `The team can see it now (${result.published ?? 0} shifts).`,
    };
  } catch (err) {
    return toState(err);
  }
}

export async function setScheduleVisibilityAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing staff member.' };
  try {
    await api(`/v1/staff/${id}`, {
      method: 'PATCH',
      body: { seesFullSchedule: form.get('seesFullSchedule') === '1' },
    });
    revalidatePath('/schedule');
    return { ok: true, message: 'Saved.' };
  } catch (err) {
    return toState(err);
  }
}
