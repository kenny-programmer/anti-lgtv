"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrollToCenter } from "@/components/scroll-motion";
import { monoLabel } from "@/components/ui";

type Step = { title: string; body: string };

/**
 * Four numbered rows. On large screens a sticky column shows ONE step at a
 * time (numeral and title as a single unit): the row crossing the middle of
 * the viewport, or the row under the pointer or keyboard focus. Steps change
 * with a short sequenced motion (the old unit leaves, then the new one
 * arrives), never a scroll-driven crossfade. Tapping or pressing Enter on a
 * row glides it to the middle. Without JavaScript it is a plain ordered list.
 */
export function HowItWorks({ steps }: { steps: Step[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState<{ current: number; previous: number | null; change: number }>({
    current: 0,
    previous: null,
    change: 0,
  });
  const pinned = useRef<number | null>(null);

  const show = useCallback((index: number) => {
    setShown((state) =>
      state.current === index
        ? state
        : { current: index, previous: state.current, change: state.change + 1 },
    );
  }, []);

  // Which row is at the middle of the viewport? Before the first row: step 1;
  // after the last: step 4. Recomputed from geometry, so fast flings that skip
  // several rows land on the right one with no queue of stale changes.
  const fromScroll = useCallback(() => {
    if (pinned.current !== null) return;
    const rows = listRef.current ? Array.from(listRef.current.querySelectorAll("li")) : [];
    if (rows.length === 0) return;
    const middle = window.innerHeight / 2;
    let index = 0;
    rows.forEach((row, i) => {
      if (row.getBoundingClientRect().top <= middle) index = i;
    });
    show(index);
  }, [show]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    const rows = listRef.current ? Array.from(listRef.current.querySelectorAll("li")) : [];
    const observer = new IntersectionObserver(fromScroll, { rootMargin: "-45% 0px -45% 0px" });
    rows.forEach((row) => observer.observe(row));
    fromScroll();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fromScroll]);

  function pin(index: number | null) {
    pinned.current = index;
    if (index === null) fromScroll();
    else show(index);
  }

  return (
    <section
      id="how"
      aria-labelledby="how-title"
      data-ready={ready ? "" : undefined}
      className="how mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="col-span-12 lg:col-span-4">
        <div className="lg:sticky lg:top-32">
          <p className={`${monoLabel} text-muted`}>How it works</p>
          <h2
            id="how-title"
            tabIndex={-1}
            className="mt-4 font-serif text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-balance focus:outline-none"
          >
            Four steps, <em className="italic">one</em> draw.
          </h2>
          <div aria-hidden="true" className="step-sticky relative mt-10 h-60">
            {shown.previous !== null ? (
              <StepUnit
                key={`out-${shown.change}`}
                index={shown.previous}
                title={steps[shown.previous].title}
                className="step-exit"
              />
            ) : null}
            <StepUnit
              key={`in-${shown.change}`}
              index={shown.current}
              title={steps[shown.current].title}
              className={shown.change > 0 ? "step-enter" : ""}
            />
          </div>
        </div>
      </div>
      <ol
        ref={listRef}
        className="relative col-span-12 mt-12 border-t border-ink lg:col-span-8 lg:mt-2"
      >
        <span aria-hidden="true" className="ribbon-thread" />
        {steps.map((step, index) => (
          <li
            key={step.title}
            id={`step-${index + 1}`}
            tabIndex={0}
            onClick={(event) => void scrollToCenter(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void scrollToCenter(event.currentTarget);
              }
            }}
            onMouseEnter={() => pin(index)}
            onMouseLeave={() => pin(null)}
            onFocus={() => pin(index)}
            onBlur={() => pin(null)}
            className="step-row group relative grid cursor-pointer grid-cols-[3.5rem_1fr] items-baseline gap-x-5 py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[4.5rem_15rem_1fr] sm:gap-x-8"
          >
            <span aria-hidden="true" className="step-knot">
              <span className="step-knot-fill" />
            </span>
            <span
              aria-hidden="true"
              className="step-rule absolute inset-x-0 bottom-0 h-px bg-rule"
            />
            <span aria-hidden="true" className="block overflow-hidden pb-1">
              <span className="step-numeral block font-serif text-5xl leading-none text-ribbon sm:text-6xl">
                {index + 1}
              </span>
            </span>
            <h3 className="step-copy font-serif text-2xl leading-tight">
              {step.title}
              <span
                aria-hidden="true"
                className="ml-2 inline-block text-ribbon opacity-0 transition-quick group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100"
              >
                &rarr;
              </span>
            </h3>
            <p className="step-copy col-start-2 mt-2 max-w-[62ch] text-muted sm:col-start-3 sm:mt-0">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepUnit({
  index,
  title,
  className,
}: {
  index: number;
  title: string;
  className: string;
}) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <span className="block font-serif text-[9rem] leading-[0.9] text-ribbon">{index + 1}</span>
      <span className="mt-3 block font-serif text-2xl">{title}</span>
    </div>
  );
}
