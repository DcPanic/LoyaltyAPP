import { env, mailConfigured } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Sending email.
 *
 * One provider is supported and it is chosen by configuration, not by code: a
 * café that has not connected one still has a working platform, it simply does
 * not send. Everywhere that sends something also returns the link it would have
 * sent when nothing is configured, so the flow can be finished by hand rather
 * than dead-ending — the same way staff invitations already hand back their URL.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Attempts delivery. Never throws: an email that did not go out must not undo
 * the thing it was reporting, and the caller has a fallback either way.
 */
export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  if (!mailConfigured) return { sent: false };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY!}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ status: res.status, detail }, 'Email provider refused the message');
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    logger.error({ err }, 'Could not reach the email provider');
    return { sent: false };
  }
}

/** Plain, short, and the link in full — a confirmation nobody should puzzle over. */
export function verificationEmail(name: string, link: string): Omit<Mail, 'to'> {
  return {
    subject: 'Confirm your email',
    text: [
      `Hi ${name},`,
      '',
      'Confirm this address to finish setting up your café account:',
      link,
      '',
      'The link works for 24 hours. If you did not sign up, ignore this.',
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      '<p>Confirm this address to finish setting up your café account.</p>',
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;`,
      'background:#6F4E37;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">',
      'Confirm my email</a></p>',
      `<p style="color:#7A6A5D;font-size:14px">Or paste this in: ${escapeHtml(link)}</p>`,
      '<p style="color:#7A6A5D;font-size:14px">The link works for 24 hours. ',
      'If you did not sign up, ignore this.</p>',
    ].join(''),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
