"use client";

import { useEffect, useRef, useState } from "react";
import { revealMatchAction } from "@/app/groups/[groupId]/actions";
import { Confetti } from "@/components/Confetti";
import { GiftTag } from "@/components/GiftTag";
import { buttonPrimary, monoLabel } from "@/components/ui";
import { buildRevealSequence } from "@/lib/reveal-sequence";

type Phase = "idle" | "loading" | "rolling" | "done";

export function RevealCard({
  groupId,
  decoys,
  revealedName,
}: {
  groupId: string;
  decoys: string[];
  revealedName: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(revealedName ? "done" : "idle");
  const [shown, setShown] = useState(revealedName ?? "");
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function reveal() {
    setPhase("loading");
    setError(null);
    try {
      const result = await revealMatchAction(groupId);
      if (!result.ok) {
        setPhase("idle");
        setError(result.error);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setShown(result.name);
        setPhase("done");
        return;
      }
      setPhase("rolling");
      for (const frame of buildRevealSequence(decoys, result.name)) {
        if (cancelled.current) return;
        setShown(frame.name);
        await new Promise((resolve) => window.setTimeout(resolve, frame.delayMs));
      }
      if (!cancelled.current) setPhase("done");
    } catch {
      setPhase("idle");
      setError("Something went wrong. Please try again.");
    }
  }

  const waiting = phase === "idle" || phase === "loading";
  // Presentation only: celebrate a reveal that happens on this visit, not a
  // tag that was already open when the page loaded.
  const celebrate = phase === "done" && revealedName === null;

  return (
    <section>
      {waiting ? (
        <>
          <GiftTag stringLength={64} className="w-[19rem] max-w-full">
            <div className="min-h-[6.5rem]">
              <div className="flex h-[3.25rem] items-end bg-ink px-3 pb-2.5">
                <span className={`${monoLabel} text-paper`}>Hidden until you open it</span>
              </div>
            </div>
            <div className="h-10" />
          </GiftTag>
          <p className={`${monoLabel} mt-10 text-muted`}>The names are drawn</p>
          <h2 className="mt-3 max-w-[18ch] font-serif text-[2rem] leading-tight tracking-[-0.01em]">
            Ready to find out who you are gifting?
          </h2>
          <button
            type="button"
            onClick={reveal}
            disabled={phase === "loading"}
            className={`${buttonPrimary} mt-6`}
          >
            {phase === "loading" ? "Shuffling..." : "Reveal my match"}
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-accent">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className={`relative ${celebrate ? "tag-pendulum" : ""}`}>
            <GiftTag label={null} stringLength={64} className="w-[19rem] max-w-full">
              {/* Purely visual: the rolling names must not be announced, and the final
                name is announced once by the status element below. */}
              <div aria-hidden="true">
                <p className={monoLabel}>{phase === "done" ? "You are gifting" : "Drawing..."}</p>
                <p
                  key={phase}
                  className={`mt-2 min-h-[6.5rem] overflow-hidden break-words font-serif text-[2.9rem] leading-[1.02] tracking-[-0.01em] ${
                    phase === "done" ? "text-ink" : "text-ink/70"
                  }`}
                >
                  {phase === "rolling" ? (
                    <span key={shown} className="flap">
                      {shown}
                    </span>
                  ) : (
                    shown
                  )}
                </p>
                <div className="h-10" />
                {phase === "done" ? (
                  <span
                    className={`stamp absolute bottom-5 right-5 px-2 py-0.5 font-mono text-2xl font-medium uppercase leading-tight tracking-[0.06em] ${
                      celebrate ? "stamp-slam" : ""
                    }`}
                  >
                    Drawn
                  </span>
                ) : null}
              </div>
            </GiftTag>
            {celebrate ? <Confetti /> : null}
          </div>
          {phase === "done" ? (
            <p className="mt-8 text-muted">Keep it secret. Only you can see this.</p>
          ) : null}
        </>
      )}
      <p className="sr-only" role="status">
        {phase === "done" ? `You are gifting ${shown}` : ""}
      </p>
    </section>
  );
}
