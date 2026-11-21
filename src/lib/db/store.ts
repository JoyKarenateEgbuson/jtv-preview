import { dbMode } from "../config";
import { firestoreStore } from "./firestore";

export type Doc = Record<string, unknown> & { id: string };

export interface Store {
  get<T extends Doc>(col: string, id: string): Promise<T | null>;
  list<T extends Doc>(col: string, where?: { field: string; value: string | boolean }): Promise<T[]>;
  set<T extends Doc>(col: string, doc: T): Promise<void>;
  update(col: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(col: string, id: string): Promise<void>;
}

// The local JSON store uses node:fs, so it is loaded only on demand (dev mode),
// keeping it out of the Cloudflare Worker's code path.
const lazyLocal = new Proxy({} as Store, {
  get:
    (_target, method: string) =>
    async (...args: unknown[]) => {
      const { localStore } = await import("./local");
      return (localStore as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args);
    },
});

export const store = (): Store => (dbMode() === "firestore" ? firestoreStore : lazyLocal);
