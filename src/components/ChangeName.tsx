"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Modal from "./Modal";

/** Shown on share links: "Viewing as Joy · Change", so each person in a group can use their own name. */
export default function ChangeName({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/share/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: value }),
    });
    setBusy(false);
    if (!res.ok) return setError("Please enter a name");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setError("");
          setOpen(true);
        }}
        className="text-sm text-cream/70 hover:text-cream"
        title="Change the name shown on your comments and the video"
      >
        Viewing as <b className="text-cream">{name}</b> · <span className="underline">Change</span>
      </button>
      {open && (
        <Modal title="Who's watching?" onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-cream/70">
            This name goes on the video as a watermark and on every comment you leave from now on. Comments you already
            posted keep the name they were posted with.
          </p>
          <input
            className="field"
            autoFocus
            value={value}
            maxLength={60}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && save()}
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn" disabled={busy || !value.trim()} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}
