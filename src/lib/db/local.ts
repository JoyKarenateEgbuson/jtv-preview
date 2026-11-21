import { promises as fs } from "node:fs";
import path from "node:path";
import type { Doc, Store } from "./store";

// Dev-only JSON file database, so the app works before Google is set up.
const dir = path.join(process.cwd(), ".data");
const file = path.join(dir, "db.json");

type Data = Record<string, Record<string, Doc>>;

// Shared across route bundles in dev so writes never interleave.
const g = globalThis as { __jtvDbChain?: Promise<unknown> };

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__jtvDbChain ?? Promise.resolve()).then(fn, fn);
  g.__jtvDbChain = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Data> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Data;
  } catch {
    return {};
  }
}

async function save(data: Data) {
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

export const localStore: Store = {
  get: (col, id) => locked(async () => ((await load())[col]?.[id] as never) ?? null),

  list: (col, where) =>
    locked(async () => {
      const all = Object.values((await load())[col] ?? {});
      const rows = where ? all.filter((d) => d[where.field] === where.value) : all;
      return rows as never;
    }),

  set: (col, doc) =>
    locked(async () => {
      const data = await load();
      (data[col] ??= {})[doc.id] = doc;
      await save(data);
    }),

  update: (col, id, patch) =>
    locked(async () => {
      const data = await load();
      const existing = data[col]?.[id];
      if (!existing) throw new Error(`${col}/${id} not found`);
      data[col][id] = { ...existing, ...patch, id };
      await save(data);
    }),

  remove: (col, id) =>
    locked(async () => {
      const data = await load();
      if (data[col]) delete data[col][id];
      await save(data);
    }),
};
