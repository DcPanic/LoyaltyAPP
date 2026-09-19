import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface AuditInput {
  businessId: string;
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/** Audit writes must never break the operation they describe. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: input.businessId,
        actorUserId: input.actorUserId ?? null,
        actorLabel: input.actorLabel,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as never,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'Failed to write audit log');
  }
}
