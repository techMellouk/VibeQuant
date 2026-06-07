/**
 * In-memory activity log (see CURSOR.md §8).
 *
 * Process-scoped ring buffer — fine for the MVP. Swap for a database when
 * persistence across restarts / multiple instances is needed.
 */

import type { ActivityEvent, ActivityType } from "./types";

const MAX_EVENTS = 500;
const events: ActivityEvent[] = [];

let counter = 0;
function nextId(): string {
  counter += 1;
  return `evt_${Date.now().toString(36)}_${counter}`;
}

export function logActivity(input: {
  type: ActivityType;
  description: string;
  marketQuestion?: string;
  reference?: string;
  costUsdc?: number;
  status?: string;
}): ActivityEvent {
  const event: ActivityEvent = {
    id: nextId(),
    timestamp: Date.now(),
    ...input,
  };
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  return event;
}

/** Most recent events first. */
export function getActivity(limit = 100): ActivityEvent[] {
  return events.slice(0, limit);
}

export function clearActivity(): void {
  events.length = 0;
}
