"use client";

import { useState } from "react";
import { GiftTag } from "@/components/GiftTag";
import { HangingTag } from "@/components/HangingTag";
import { buttonSecondary } from "@/components/ui";

// The async clipboard API needs a secure context and a permission some browsers withhold; the
// textarea route works without either.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(field);
    }
  }
}

export function InviteShare({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [failed, setFailed] = useState(false);

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? code : `${window.location.origin}/groups/join?code=${code}`;
    setFailed(false);
    if (await copyText(text)) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } else {
      setCopied(null);
      setFailed(true);
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
        {copied ? "Copied" : failed ? "Could not copy. Select the code and copy it by hand." : ""}
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
        {failed ? (
          <p className="basis-full text-sm text-accent" role="alert">
            Could not copy. Select the code and copy it by hand.
          </p>
        ) : null}
      </div>
    </div>
  );
}
