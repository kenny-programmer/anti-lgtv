"use client";

import { useEffect, useRef, useState } from "react";
import { revealMatchAction } from "@/app/groups/[groupId]/actions";
import { buttonPrimary, cardClass } from "@/components/ui";
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

  return (
    <section className={`${cardClass} text-center`}>
      {waiting ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            The names are drawn
          </p>
          <h2 className="mt-2 text-2xl font-bold">Ready to find out who you are gifting?</h2>
          <button
            type="button"
            onClick={reveal}
            disabled={phase === "loading"}
            className={`${buttonPrimary} mt-6 px-8 py-3 text-base`}
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
          {/* Purely visual: the rolling names must not be announced, and the final
              name is announced once by the status element below. */}
          <div aria-hidden="true">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              {phase === "done" ? "You are gifting" : "Drawing..."}
            </p>
            <p
              key={phase}
              className={`mt-3 break-words text-5xl font-extrabold tracking-tight ${
                phase === "done" ? "animate-pop text-primary" : "text-foreground/60"
              }`}
            >
              {shown}
            </p>
          </div>
          {phase === "done" ? (
            <p className="mt-4 text-sm text-muted">Keep it secret. Only you can see this.</p>
          ) : null}
        </>
      )}
      <p className="sr-only" role="status">
        {phase === "done" ? `You are gifting ${shown}` : ""}
      </p>
    </section>
  );
}
