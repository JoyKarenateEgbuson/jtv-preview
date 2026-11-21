import { serviceAccountProject, serviceAccountToken } from "../google";
import type { Store } from "./store";

// Firestore via its REST API, authenticated with the service account.
const SCOPE = "https://www.googleapis.com/auth/datastore";
const base = () =>
  `https://firestore.googleapis.com/v1/projects/${serviceAccountProject()}/databases/(default)/documents`;

type FsValue = Record<string, unknown>;

function enc(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: encFields(v as Record<string, unknown>) } };
}

function encFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, val] of Object.entries(obj)) if (val !== undefined) out[k] = enc(val);
  return out;
}

function dec(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(dec);
  }
  if ("mapValue" in v) return decFields((v.mapValue as { fields?: Record<string, FsValue> }).fields);
  return null;
}

function decFields(fields: Record<string, FsValue> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, dec(val)]));
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await serviceAccountToken(SCOPE);
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function fail(res: Response, what: string): Promise<never> {
  throw new Error(`Firestore ${what} failed: ${res.status} ${await res.text()}`);
}

export const firestoreStore: Store = {
  async get(col, id) {
    const res = await call(`${base()}/${col}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) return fail(res, "get");
    const doc = (await res.json()) as { fields?: Record<string, FsValue> };
    return { ...decFields(doc.fields), id } as never;
  },

  async list(col, where) {
    const structuredQuery: Record<string, unknown> = { from: [{ collectionId: col }] };
    if (where) {
      structuredQuery.where = {
        fieldFilter: { field: { fieldPath: where.field }, op: "EQUAL", value: enc(where.value) },
      };
    }
    const res = await call(`${base()}:runQuery`, {
      method: "POST",
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) return fail(res, "query");
    const rows = (await res.json()) as { document?: { fields?: Record<string, FsValue> } }[];
    return rows.filter((r) => r.document).map((r) => decFields(r.document!.fields)) as never;
  },

  async set(col, doc) {
    const res = await call(`${base()}/${col}/${doc.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: encFields(doc) }),
    });
    if (!res.ok) await fail(res, "set");
  },

  async update(col, id, patch) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const res = await call(`${base()}/${col}/${id}?${mask}&currentDocument.exists=true`, {
      method: "PATCH",
      body: JSON.stringify({ fields: encFields(patch) }),
    });
    if (!res.ok) await fail(res, "update");
  },

  async remove(col, id) {
    const res = await call(`${base()}/${col}/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) await fail(res, "delete");
  },
};
