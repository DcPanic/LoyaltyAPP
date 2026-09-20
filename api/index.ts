/**
 * Serverless entry point for the API.
 *
 * The same Express application that `apps/api/src/server.ts` listens with,
 * exported as a handler instead. Hosting platforms that run functions rather
 * than long-lived servers (Vercel and friends) import this; nothing about the
 * routes, the tenancy rules or the stamp engine changes.
 */
import { createApp } from '../apps/api/dist/app.js';

export default createApp();
