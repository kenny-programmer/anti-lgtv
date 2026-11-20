"use client";

import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { GiftTag } from "@/components/GiftTag";
import { TAG_NUDGE } from "@/components/HangingTag";
import { prefersReducedMotion, scrollToCenter } from "@/components/scroll-motion";
import { monoLabel } from "@/components/ui";
import { buildRevealSequence } from "@/lib/reveal-sequence";

// Invented sample names for the demo only.
const SAMPLE_NAMES = ["Maya", "Jonas", "Priya", "Tomas", "Aiko", "Leila", "Sam", "Nadia"];

type Phase = "idle" | "rolling" | "done";

/**
 * The landing page's sample tag, as a live demo of the reveal: it rolls
 * through invented names with the same sequence as the real reveal and lands
 * on one. Nothing here touches a group, the database or a server action.
 */
export function TagDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState("");
  const [run, setRun] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function draw() {
    if (phase === "rolling") return;
    // Randomness lives in the click handler only, never in render.
    const pool = SAMPLE_NAMES.filter((name) => name !== shown);
    const finalName = pool[Math.floor(Math.random() * pool.length)];
    const decoys = SAMPLE_NAMES.filter((name) => name !== finalName);

    if (window.innerWidth < 1024 && bodyRef.current) await scrollToCenter(bodyRef.current);
    if (cancelled.current) return;

    if (prefersReducedMotion()) {
      setShown(finalName);
      setPhase("done");
      setRun((value) => value + 1);
      return;
    }
    setPhase("rolling");
    for (const frame of buildRevealSequence(decoys, finalName, { frames: 18 })) {
      if (cancelled.current) return;
      setShown(frame.name);
      await new Promise((resolve) => window.setTimeout(resolve, frame.delayMs));
    }
    if (cancelled.current) return;
    setPhase("done");
    setRun((value) => value + 1);
    // The result lands with a small push, so the tag swings and settles.
    rootRef.current?.dispatchEvent(
      new CustomEvent(TAG_NUDGE, { bubbles: true, detail: { dvx: 70 } }),
    );
  }

  const celebrate = phase === "done";

  return (
    <div ref={rootRef} className="demo-hint-arrow-host">
      <div key={run} className="relative">
        <GiftTag
          stringLength={0}
          className="[--tag-tilt:0deg]"
          bodyClassName="lg:pb-8 lg:pt-[5.5rem]"
          footer={
            <div className="flex items-baseline justify-between gap-3">
              <span className={monoLabel}>From:</span>
              <span className="font-serif text-2xl italic">Secret Santa</span>
            </div>
          }
        >
          <div ref={bodyRef} className="relative">
            <span
              aria-hidden="true"
              className={`${monoLabel} demo-hint absolute -top-[1.6rem] right-0 flex items-center gap-1.5`}
            >
              Try it <span className="demo-hint-arrow">&rarr;</span>
            </span>
            <div
              aria-hidden="true"
              className="mt-3 flex h-16 items-end overflow-hidden bg-ink px-3 pb-2"
            >
              {phase === "idle" ? (
                <span className={`${monoLabel} pb-0.5 text-paper`}>Hidden until the draw</span>
              ) : phase === "rolling" ? (
                <span
                  key={shown}
                  className="flap font-serif text-[2rem] leading-none italic text-paper/80"
                >
                  {shown}
                </span>
              ) : (
                <span className="font-serif text-[2rem] leading-none text-paper">{shown}</span>
              )}
            </div>
            {celebrate ? (
              <span
                aria-hidden="true"
                className="stamp stamp-slam absolute -bottom-5 right-1 bg-kraft px-2 py-0.5 font-mono text-2xl font-medium uppercase leading-tight tracking-[0.06em]"
              >
                Drawn
              </span>
            ) : null}
            <p className="mt-6 max-w-[16rem] text-sm leading-snug lg:mb-10">
              Demo only. Real draws happen inside your group, and only you see your own tag.
            </p>
          </div>
        </GiftTag>
        <button
          type="button"
          onClick={() => void draw()}
          aria-label="Try it: draw a sample name"
          className="demo-button absolute inset-0 z-20 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        />
        {celebrate ? <Confetti /> : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {phase === "done" ? `Demo result: ${shown}` : ""}
      </p>
    </div>
  );
}
