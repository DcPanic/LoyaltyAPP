import { env, mailConfigured } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { sendMail, verificationEmail } from './mail.js';

const TTL_HOURS = 24;

/**
 * Proving someone can read the address they signed up with.
 *
 * Only the hash of the link is stored, for the same reason refresh tokens are:
 * a copy of the database should not hand anyone a working way in. Issuing a new
 * link retires the outstanding ones, so a forwarded old email cannot be used
 * after someone asked for a fresh one.
 */
export async function issueVerification(userId: string): Promise<{
  sent: boolean;
  /** Returned only when nothing could be sent, so the flow can still finish. */
  link: string | null;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw badRequest('No such account');
  if (user.emailVerifiedAt) return { sent: false, link: null };

  const token = randomToken(32);

  await prisma.$transaction([
    prisma.emailVerification.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.emailVerification.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + TTL_HOURS * 3_600_000),
      },
    }),
  ]);

  const link = `${env.APP_URL}/verify?token=${encodeURIComponent(token)}`;
  const { sent } = await sendMail({ to: user.email, ...verificationEmail(user.name, link) });

  if (!sent) {
    // Without a provider this is the only way the person finishes signing up.
    // It goes to the café's own logs and to the caller, never to a stranger.
    logger.warn(
      { email: user.email, link, configured: mailConfigured },
      'Verification email not sent — handing the link back instead',
    );
  }

  return { sent, link: sent ? null : link };
}

/** Consumes a link. One use, and only before it expires. */
export async function consumeVerification(token: string): Promise<{ userId: string }> {
  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    throw badRequest('That confirmation link has expired or was already used');
  }

  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { userId: record.userId };
}
