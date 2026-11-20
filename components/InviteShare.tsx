"use client";

import { useState } from "react";
import { GiftTag } from "@/components/GiftTag";
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
    // `contents` lets the section above place the tag first and the buttons last.
    <div className="contents">
      <GiftTag
        label="Invite code"
        stringLength={64}
        className="order-first mb-10 w-[19rem] max-w-full"
      >
        <p className="whitespace-nowrap font-mono text-[1.9rem] font-medium leading-tight tracking-[0.1em]">
          {code}
        </p>
      </GiftTag>
      <div className="order-last mt-7 flex flex-wrap gap-3">
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
