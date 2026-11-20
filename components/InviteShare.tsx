"use client";

import { useState } from "react";
import { GiftTag } from "@/components/GiftTag";
import { HangingTag } from "@/components/HangingTag";
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
      <HangingTag
        stringLength={64}
        tagDrop={90}
        gain={0.4}
        breeze={0.4}
        className="order-first mb-10 w-[19rem] max-w-full"
      >
        <div
          key={copied === "code" ? "copied" : "idle"}
          className={copied === "code" ? "tick-tag" : ""}
        >
          <GiftTag label="Invite code" stringLength={0}>
            <p className="whitespace-nowrap font-mono text-[1.9rem] font-medium leading-tight tracking-[0.1em]">
              {code}
            </p>
          </GiftTag>
        </div>
        {/* The tag itself copies the code too. */}
        <button
          type="button"
          onClick={() => copy("code")}
          aria-label={`Copy invite code ${code}`}
          className="absolute inset-0 cursor-copy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        />
      </HangingTag>
      <p className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </p>
      <div className="order-last mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => copy("code")}
          className={`${buttonSecondary} ${copied === "code" ? "tick" : ""}`}
        >
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => copy("link")}
          className={`${buttonSecondary} ${copied === "link" ? "tick" : ""}`}
        >
          {copied === "link" ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
