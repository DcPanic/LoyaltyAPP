'use server';

import { redirect } from 'next/navigation';
import { loginSchema, registerSchema, acceptInviteSchema } from '@loyaltyapp/shared';
import { api, ApiError } from '@/lib/api';
import { clearTokens, storeTokens, type Session } from '@/lib/session';

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

type AuthResponse = Session & { accessToken: string; refreshToken: string };

function fieldErrors(err: unknown): FormState {
  if (err instanceof ApiError) {
    const details = err.details as { path: string; message: string }[] | undefined;
    return {
      error: err.message,
      fieldErrors: details?.reduce<Record<string, string>>(
        (acc, d) => ({ ...acc, [d.path]: d.message }),
        {},
      ),
    };
  }
  return { error: 'Something went wrong. Please try again.' };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Enter your email and password' };

  let destination = '/dashboard';
  try {
    const res = await api<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: parsed.data,
      auth: false,
    });
    await storeTokens(res.accessToken, res.refreshToken);
    destination = res.user.permissions.includes('analytics:read') ? '/dashboard' : '/stamp';
  } catch (err) {
    return fieldErrors(err);
  }
  redirect(destination);
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    ownerName: formData.get('ownerName'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password'),
    country: formData.get('country') || 'CY',
    currency: formData.get('currency') || 'EUR',
    timezone: formData.get('timezone') || 'Asia/Nicosia',
  });
  if (!parsed.success) {
    return {
      error: 'Please check the form',
      fieldErrors: parsed.error.issues.reduce<Record<string, string>>(
        (acc, i) => ({ ...acc, [i.path.join('.')]: i.message }),
        {},
      ),
    };
  }

  let link: string | null = null;
  try {
    const res = await api<AuthResponse & { verificationLink?: string | null }>(
      '/v1/auth/register',
      { method: 'POST', body: parsed.data, auth: false },
    );
    await storeTokens(res.accessToken, res.refreshToken);

    // With no email provider connected the API hands the confirmation link back
    // rather than leaving the café unable to finish. Carrying it through means
    // signing up works on day one and stops working differently on day two.
    if (res.verificationLink) link = res.verificationLink;
  } catch (err) {
    return fieldErrors(err);
  }
  redirect(link ? `/dashboard?welcome=1&confirm=${encodeURIComponent(link)}` : '/dashboard?welcome=1');
}

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get('token'),
    name: formData.get('name'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      error: 'Please check the form',
      fieldErrors: parsed.error.issues.reduce<Record<string, string>>(
        (acc, i) => ({ ...acc, [i.path.join('.')]: i.message }),
        {},
      ),
    };
  }

  let destination = '/stamp';
  try {
    const res = await api<AuthResponse>('/v1/auth/accept-invite', {
      method: 'POST',
      body: parsed.data,
      auth: false,
    });
    await storeTokens(res.accessToken, res.refreshToken);
    destination = res.user.permissions.includes('analytics:read') ? '/dashboard' : '/stamp';
  } catch (err) {
    return fieldErrors(err);
  }
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await clearTokens();
  redirect('/login');
}


/** Asks for the confirmation email again. */
export async function resendVerificationAction(): Promise<{ ok: boolean; link?: string | null }> {
  try {
    const res = await api<{ sent: boolean; verificationLink: string | null }>(
      '/v1/auth/resend-verification',
      { method: 'POST' },
    );
    return { ok: true, link: res.verificationLink };
  } catch {
    return { ok: false };
  }
}
