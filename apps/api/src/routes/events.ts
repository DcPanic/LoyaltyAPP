import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { bus } from '../lib/events.js';

export const eventsRouter: Router = Router();

/**
 * Server-sent events, scoped to one tenant. This is what keeps the web dashboard
 * in step with stamps taken on the React Native app without a refresh.
 */
eventsRouter.get('/stream', (req, res) => {
  const ctx = auth(req);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');

  const unsubscribe = bus.subscribe(ctx.businessId, (event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});
