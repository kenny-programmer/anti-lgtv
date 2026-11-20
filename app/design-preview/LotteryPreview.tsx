"use client";

import { useRef } from "react";
import { LotteryStage } from "@/components/LotteryStage";
import { RevealTag } from "@/components/RevealCard";
import { pickStart, timeline } from "@/lib/lottery";

// Dev-only: one frame of the lottery reveal at time `t` (seconds), with an
// invented name, so each phase can be screenshotted.
const NAME = "Rosalind";

export function LotteryPreview({ t }: { t: number }) {
  const tagRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const line = timeline(pickStart(0) ?? 0);
  const done = t >= line.end;
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
        reveal-lottery t={t.toFixed(2)}s (end {line.end.toFixed(2)}s)
      </p>
      <div className="ribbon-edge mt-6" />
      <div className="relative w-[19rem] max-w-full">
        <RevealTag
          face={done ? "done" : t >= line.paper ? "landing" : "waiting"}
          name={NAME}
          tagRef={tagRef}
          nameRef={nameRef}
        />
        {done ? null : (
          <LotteryStage
            name={NAME}
            chosen={6}
            time={t}
            getTag={() => tagRef.current}
            getTarget={() => nameRef.current}
          />
        )}
      </div>
      <p className="mt-10 text-muted">Text below the reserved box.</p>
    </main>
  );
}
