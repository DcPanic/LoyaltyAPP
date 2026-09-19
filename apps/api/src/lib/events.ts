import { EventEmitter } from 'node:events';

export type RealtimeEvent =
  | { type: 'stamp.added'; businessId: string; membershipId: string; customerId: string; stamps: number }
  | { type: 'stamp.removed'; businessId: string; membershipId: string; customerId: string; stamps: number }
  | { type: 'reward.earned'; businessId: string; membershipId: string; customerId: string }
  | { type: 'reward.redeemed'; businessId: string; membershipId: string; customerId: string }
  | { type: 'customer.created'; businessId: string; customerId: string }
  | { type: 'customer.updated'; businessId: string; customerId: string }
  | { type: 'customer.deleted'; businessId: string; customerId: string };

/**
 * In-process fan-out that backs the dashboard's SSE stream, so a stamp taken on
 * the React Native app shows up on the web dashboard without a refresh.
 * Swap for Redis pub/sub when the API runs on more than one instance.
 */
class Bus extends EventEmitter {
  publish(event: RealtimeEvent): void {
    this.emit(event.businessId, event);
    this.emit('*', event);
  }

  subscribe(businessId: string, listener: (event: RealtimeEvent) => void): () => void {
    this.on(businessId, listener);
    return () => this.off(businessId, listener);
  }
}

export const bus = new Bus();
bus.setMaxListeners(0);
