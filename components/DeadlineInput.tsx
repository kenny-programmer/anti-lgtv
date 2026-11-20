"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export function DeadlineInput({ id, name }: { id: string; name: string }) {
  const [local, setLocal] = useState("");
  const parsed = local ? new Date(local) : null;
  const iso = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "";

  return (
    <>
      <input
        id={id}
        type="datetime-local"
        required
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        className={inputClass}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
