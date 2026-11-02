// A tiny typed "event bus" (spec: "A small event system connects the modules").
// Modules announce what happened (`emit`) and others react (`on`), without knowing about each other.
// Example: a tap, a button and the Enter key all emit 'object:selected'; the info panel and the
// 3D view both listen, and none of them import each other.

/** Every event in the game and the data it carries. Add new events here. */
export interface GameEvents {
  /** An object was selected (or `null` = selection cleared). */
  'object:selected': { id: string | null };
  /** Move the camera to look at an object (`null` = back to the whole-system overview). */
  'camera:focus': { id: string | null };
  /** Zoom the camera: factor < 1 moves closer, > 1 moves away. */
  'camera:zoom': { factor: number };
}

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Subscribe. Returns a function that unsubscribes (call it when you are done listening). */
  on<K extends keyof Events>(name: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    // Copy first so a listener that unsubscribes itself does not disturb the loop.
    for (const listener of [...(this.listeners.get(name) ?? [])]) {
      try {
        (listener as Listener<Events[K]>)(payload);
      } catch (error) {
        // One broken listener must not stop the others from running.
        console.error(`Listener for "${String(name)}" failed`, error);
      }
    }
  }
}
