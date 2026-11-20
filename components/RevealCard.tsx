"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { revealMatchAction } from "@/app/groups/[groupId]/actions";
import { Confetti } from "@/components/Confetti";
import { FormAlert } from "@/components/FormAlert";
import { GiftTag } from "@/components/GiftTag";
import { HangingTag, TAG_NUDGE } from "@/components/HangingTag";
import { LotteryStage } from "@/components/LotteryStage";
import { prefersReducedMotion, scrollToCenter } from "@/components/scroll-motion";
import { buttonPrimary, monoLabel } from "@/components/ui";
import { BALL_COUNT } from "@/lib/lottery";

type Phase = "idle" | "loading" | "drawing" | "done";

/** What the tag shows: sealed, ready for the paper to land, or the drawn name. */
export type TagFace = "waiting" | "landing" | "done";

/**
 * The hanging gift tag of the reveal. `tagRef` wraps the whole hanging tag
 * (twine included) so the lottery stage can fade it; `nameRef` is the
 * (invisible) name the paper lands on.
 */
export function RevealTag({
  face,
  name,
  celebrate = false,
  tagRef,
  nameRef,
  doneRef,
}: {
  face: TagFace;
  name: string | null;
  celebrate?: boolean;
  tagRef?: RefObject<HTMLDivElement | null>;
  nameRef?: RefObject<HTMLSpanElement | null>;
  doneRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={tagRef}>
      <HangingTag stringLength={64} tagDrop={110} gain={0.4} breeze={0.4}>
        <div ref={doneRef} className="relative">
          {face === "waiting" ? (
            <GiftTag stringLength={0}>
              <div className="min-h-[6.5rem]">
                <div className="flex h-[3.25rem] items-end bg-ink px-3 pb-2.5">
                  <span className={`${monoLabel} text-paper`}>Hidden until you open it</span>
                </div>
              </div>
              <div className="h-10" />
            </GiftTag>
          ) : (
            <GiftTag label={null} stringLength={0}>
              {/* Purely visual: the name is announced once by the status element. */}
              <div aria-hidden="true">
                <p className={monoLabel}>You are gifting</p>
                <p className="mt-2 min-h-[6.5rem] overflow-hidden break-words font-serif text-[2.9rem] leading-[1.02] tracking-[-0.01em] text-ink">
                  <span ref={nameRef} className={face === "landing" ? "invisible" : undefined}>
                    {name}
                  </span>
                </p>
                <div className="h-10" />
                {face === "done" ? (
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
          )}
          {celebrate ? <Confetti /> : null}
        </div>
      </HangingTag>
    </div>
  );
}

export function RevealCard({
  groupId,
  revealedName,
}: {
  groupId: string;
  decoys: string[];
  revealedName: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(revealedName ? "done" : "idle");
  const [name, setName] = useState<string | null>(revealedName);
  const [paperOut, setPaperOut] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const tagRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  function stop(message: string) {
    // The bowl goes; the sealed tag fades back in.
    const tag = tagRef.current;
    if (tag) {
      tag.style.transition = "opacity 300ms ease-out";
      tag.style.opacity = "1";
    }
    setPhase("idle");
    setName(null);
    setError(message);
  }

  async function reveal() {
    setError(null);
    const animate = !prefersReducedMotion();
    if (animate) {
      if (tagRef.current) tagRef.current.style.transition = "";
      // Randomness lives in the click handler only: which ball gets picked.
      setChosen(Math.floor(Math.random() * BALL_COUNT));
      setPaperOut(false);
      setPhase("drawing");
    } else {
      setPhase("loading");
    }
    try {
      const result = await revealMatchAction(groupId);
      if (cancelled.current) return;
      if (!result.ok) {
        stop(result.error);
        return;
      }
      setName(result.name);
      if (!animate) setPhase("done");
    } catch {
      if (!cancelled.current) stop("Something went wrong. Please try again.");
    }
  }

  // Presentation only: on a phone, glide the tag to the middle of the screen
  // first, then run the reveal.
  const sectionRef = useRef<HTMLElement>(null);
  async function centerThenReveal() {
    if (sectionRef.current) await scrollToCenter(sectionRef.current);
    await reveal();
  }

  const doneRef = useRef<HTMLDivElement>(null);
  // Presentation only: celebrate a reveal that happens on this visit, not a
  // tag that was already open when the page loaded.
  const celebrate = phase === "done" && revealedName === null;
  useEffect(() => {
    // The tag lands with a small push and swings to rest.
    if (celebrate) {
      doneRef.current?.dispatchEvent(
        new CustomEvent(TAG_NUDGE, { bubbles: true, detail: { dvx: 60 } }),
      );
    }
  }, [celebrate]);

  const face: TagFace =
    phase === "done" ? "done" : phase === "drawing" && paperOut ? "landing" : "waiting";
  const busy = phase === "loading" || phase === "drawing";

  return (
    <section ref={sectionRef}>
      {/* The tag and the bowl share this box, so nothing below moves. */}
      <div className="relative w-[19rem] max-w-full">
        <RevealTag
          face={face}
          name={name}
          celebrate={celebrate}
          tagRef={tagRef}
          nameRef={nameRef}
          doneRef={doneRef}
        />
        {phase === "drawing" ? (
          <LotteryStage
            name={name}
            chosen={chosen}
            getTag={() => tagRef.current}
            getTarget={() => nameRef.current}
            onPaper={() => setPaperOut(true)}
            onDone={() => setPhase("done")}
          />
        ) : null}
      </div>
      {phase === "done" ? (
        <p className="mt-8 text-muted">Keep it secret. Only you can see this.</p>
      ) : (
        <>
          <p className={`${monoLabel} mt-10 text-muted`}>The names are drawn</p>
          <h2 className="mt-3 max-w-[18ch] font-serif text-[2rem] leading-tight tracking-[-0.01em]">
            Ready to find out who you are gifting?
          </h2>
          <button
            type="button"
            onClick={() => void centerThenReveal()}
            disabled={busy}
            className={`${buttonPrimary} mt-6`}
          >
            {busy ? "Shuffling..." : "Reveal my match"}
          </button>
          {error ? (
            <FormAlert trigger={error} className="mt-3 text-sm font-medium text-accent">
              {error}
            </FormAlert>
          ) : null}
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {phase === "done" && name
          ? `You are gifting ${name}`
          : phase === "drawing" || phase === "loading"
            ? "Drawing your match"
            : ""}
      </p>
    </section>
  );
}
