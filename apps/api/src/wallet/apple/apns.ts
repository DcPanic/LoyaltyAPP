import http2 from 'node:http2';
import { env, appleWalletConfigured } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

let session: http2.ClientHttp2Session | null = null;

function getSession(): http2.ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session;
  session = http2.connect(env.APPLE_APNS_HOST, {
    // Certificate-based APNs authentication with the same pass certificate
    // Apple issues for the pass type identifier.
    key: env.APPLE_PASS_KEY_PEM,
    cert: env.APPLE_PASS_CERT_PEM,
    passphrase: env.APPLE_PASS_KEY_PASSPHRASE,
  });
  session.on('error', (err) => logger.error({ err }, 'APNs session error'));
  session.on('close', () => {
    session = null;
  });
  return session;
}

/**
 * Wallet update push: an empty payload tells the device to call our pass web
 * service and pull the new state. Invalid tokens are reported so the caller can
 * drop the stale device registration.
 */
export async function pushPassUpdate(pushToken: string): Promise<{ ok: boolean; unregister: boolean }> {
  if (!appleWalletConfigured) return { ok: false, unregister: false };

  return new Promise((resolve) => {
    try {
      const client = getSession();
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        'apns-topic': env.APPLE_APNS_TOPIC ?? env.APPLE_PASS_TYPE_IDENTIFIER!,
        'apns-push-type': 'background',
        'apns-priority': '5',
        'content-type': 'application/json',
      });

      let status = 0;
      let body = '';
      req.setEncoding('utf8');
      req.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
      });
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('error', (err) => {
        logger.error({ err }, 'APNs request failed');
        resolve({ ok: false, unregister: false });
      });
      req.on('end', () => {
        const unregister = status === 410 || (status === 400 && body.includes('BadDeviceToken'));
        if (status !== 200) logger.warn({ status, body }, 'APNs push rejected');
        resolve({ ok: status === 200, unregister });
      });

      req.end(JSON.stringify({}));
    } catch (err) {
      logger.error({ err }, 'APNs push failed');
      resolve({ ok: false, unregister: false });
    }
  });
}
