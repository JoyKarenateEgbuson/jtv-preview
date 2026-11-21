"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Person } from "@/lib/types";
import CopyButton from "../CopyButton";

export default function PeopleManager({ people }: { people: Person[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"client" | "guest">("client");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/admin/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind }),
    });
    setBusy(false);
    setName("");
    router.refresh();
  }

  async function regenerate(p: Person) {
    if (!confirm(`Make a new private link for ${p.name}? Their old link will stop working.`)) return;
    await fetch(`/api/admin/people/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateLink: true }),
    });
    router.refresh();
  }

  async function remove(p: Person) {
    if (!confirm(`Delete ${p.name}? Their page stops working immediately.`)) return;
    await fetch(`/api/admin/people/${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Add a person</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <input className="field" placeholder="Name (e.g. Tosin)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "client" | "guest")}>
            <option value="client">Client (regular)</option>
            <option value="guest">One-time guest</option>
          </select>
          <button type="button" className="btn" disabled={busy || !name.trim()} onClick={create}>Add</button>
        </div>
        <p className="mt-2 text-xs text-stone">
          Everyone gets a private page. Guests always have the watermark on and downloads off. Clients follow each video&apos;s settings.
        </p>
      </div>

      <ul className="space-y-2">
        {people.length === 0 && <li className="text-sm text-stone">No one yet.</li>}
        {people.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center gap-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-stone">{p.kind === "guest" ? "One-time guest" : "Client"}</p>
            </div>
            <CopyButton path={`/c/${p.token}`} label="Copy page link" />
            <a className="btn btn-ghost" href={`/c/${p.token}`} target="_blank" rel="noreferrer">Open</a>
            <button type="button" className="btn btn-ghost" onClick={() => regenerate(p)}>New link</button>
            <button type="button" className="btn btn-danger" onClick={() => remove(p)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
