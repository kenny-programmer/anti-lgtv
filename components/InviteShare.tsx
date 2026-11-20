"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/ui";

export function InviteShare({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? code : `${window.location.origin}/groups/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div>
      <p className="font-mono text-3xl font-bold tracking-widest text-primary">{code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("code")} className={buttonSecondary}>
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button type="button" onClick={() => copy("link")} className={buttonSecondary}>
          {copied === "link" ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
