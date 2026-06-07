/** Minimal runtime-agnostic typed event emitter (no Node `events` dependency). */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    const set = (this.listeners[event] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.listeners[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch {
        // A throwing listener must not break the emit loop or the engine.
      }
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
