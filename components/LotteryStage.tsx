"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  BALL_COUNT,
  BALL_R,
  BOWL,
  PAPER_AT,
  PRESENT,
  STAGE,
  lotteryFrame,
  pickStart,
  restPosition,
  type LotteryFrame,
} from "@/lib/lottery";

const TOPS = ["var(--ribbon)", "var(--kraft)", "var(--ink)", "var(--paper)"];
const NUMERALS = ["var(--cream)", "var(--ink)", "var(--paper)", "var(--ink)"];
const TOP_HALF = `M${-BALL_R} 0 A${BALL_R} ${BALL_R} 0 0 1 ${BALL_R} 0 Z`;
const BOTTOM_HALF = `M${-BALL_R} 0 A${BALL_R} ${BALL_R} 0 0 0 ${BALL_R} 0 Z`;
const { cx, cy, r, mouthHalf, mouthY, neckY, rimY, bottomY } = BOWL;
const GLASS = `M${cx - mouthHalf} ${neckY} L${cx - mouthHalf} ${mouthY} A${r} ${r} 0 1 0 ${cx + mouthHalf} ${mouthY} L${cx + mouthHalf} ${neckY}`;
/** The paper's size on its way out of the ball, relative to the name on the tag. */
const PAPER_SCALE = 0.62;
const line = {
  stroke: "var(--ink)",
  strokeWidth: 1.5,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

function Ball({
  index,
  lidRef,
  baseRef,
}: {
  index: number;
  lidRef?: RefObject<SVGGElement | null>;
  baseRef?: RefObject<SVGGElement | null>;
}) {
  const tone = index % TOPS.length;
  return (
    <>
      <g ref={baseRef}>
        <path d={BOTTOM_HALF} fill="var(--cream)" {...line} />
      </g>
      <g ref={lidRef}>
        <path d={TOP_HALF} fill={TOPS[tone]} {...line} />
        {tone !== 3 ? (
          <path
            d="M-8.6 -4.2 A9.6 9.6 0 0 1 -4.4 -8.6"
            fill="none"
            stroke="var(--cream)"
            strokeOpacity={0.7}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ) : null}
        <text
          x={1.5}
          y={-3.2}
          textAnchor="middle"
          className="font-mono"
          fontSize={7}
          fontWeight={500}
          fill={NUMERALS[tone]}
        >
          {String(index + 1).padStart(2, "0")}
        </text>
      </g>
    </>
  );
}

/**
 * The lottery-bowl reveal: a glass bowl of numbered capsules tumbles, one
 * rises out of the mouth and opens, a rolled paper inside unrolls with the
 * name, and the paper travels onto the element returned by `getTarget`
 * while the element from `getTag` fades back in.
 * Timeline and paths are pure functions in lib/lottery.ts; one
 * requestAnimationFrame loop writes transforms and opacity straight to the
 * DOM (no React state per frame) and pauses in a hidden tab. Decorative only:
 * the whole stage is aria-hidden; the caller announces the result.
 *
 * `name` stays null until the server has answered; the tumble runs on until
 * then. With `time` set, it renders that one frame and does not animate (for
 * the dev preview).
 */
export function LotteryStage({
  name,
  chosen,
  time,
  getTarget,
  getTag,
  onPaper,
  onDone,
}: {
  name: string | null;
  chosen: number;
  time?: number;
  getTarget?: () => HTMLElement | null;
  /** The tag, faded out while the bowl is up and back in as the paper lands. */
  getTag?: () => HTMLElement | null;
  onPaper?: () => void;
  onDone?: () => void;
}) {
  const chosenIndex = ((chosen % BALL_COUNT) + BALL_COUNT) % BALL_COUNT;
  const stageRef = useRef<HTMLDivElement>(null);
  const bowlRef = useRef<SVGGElement>(null);
  const ballRefs = useRef<(SVGGElement | null)[]>([]);
  const chosenRef = useRef<SVGGElement>(null);
  const lidRef = useRef<SVGGElement>(null);
  const baseRef = useRef<SVGGElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const rollLeftRef = useRef<HTMLSpanElement>(null);
  const rollRightRef = useRef<HTMLSpanElement>(null);
  const landing = useRef<{ x: number; y: number } | null>(null);

  const startRef = useRef(0);
  const arrivedRef = useRef<number | null>(null);
  const callbacks = useRef({ getTarget, getTag, onPaper, onDone });
  useEffect(() => {
    callbacks.current = { getTarget, getTag, onPaper, onDone };
  });

  /** Where the paper's centre must sit so its name covers the name on the tag. */
  function measureLanding() {
    const stage = stageRef.current;
    const target = callbacks.current.getTarget?.();
    const paper = paperRef.current;
    const text = textRef.current;
    const span = spanRef.current;
    if (!stage || !target || !paper || !text || !span) return;
    const s = stage.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const dx = text.offsetLeft + span.offsetLeft + span.offsetWidth / 2 - paper.offsetWidth / 2;
    const dy = text.offsetTop + span.offsetTop + span.offsetHeight / 2 - paper.offsetHeight / 2;
    landing.current = {
      x: tr.left + tr.width / 2 - s.left - dx,
      y: tr.top + tr.height / 2 - s.top - dy,
    };
  }

  function apply(f: LotteryFrame) {
    const stage = stageRef.current;
    if (!stage) return;
    const k = stage.clientWidth / STAGE;
    const sway = `rotate(${f.bowlRotation.toFixed(3)} ${cx} ${bottomY})`;
    bowlRef.current?.setAttribute("opacity", f.bowlOpacity.toFixed(3));
    bowlRef.current?.setAttribute("transform", sway);
    f.balls.forEach((ball, i) => {
      ballRefs.current[i]?.setAttribute(
        "transform",
        `translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})`,
      );
    });
    const c = f.chosen;
    chosenRef.current?.setAttribute("opacity", c.opacity.toFixed(3));
    chosenRef.current?.setAttribute(
      "transform",
      `${sway} translate(${c.x.toFixed(2)} ${c.y.toFixed(2)}) scale(${c.scale.toFixed(3)})`,
    );
    lidRef.current?.setAttribute(
      "transform",
      `translate(${f.lid.dx.toFixed(2)} ${f.lid.dy.toFixed(2)}) rotate(${f.lid.rotate.toFixed(2)} ${BALL_R} 0)`,
    );
    lidRef.current?.setAttribute("opacity", f.lid.opacity.toFixed(3));
    baseRef.current?.setAttribute("transform", `translate(0 ${f.base.dy.toFixed(2)})`);

    const p = f.paper;
    const paper = paperRef.current;
    if (paper) {
      const from = { x: PRESENT.x * k, y: PRESENT.y * k };
      const at = { x: PAPER_AT.x * k, y: PAPER_AT.y * k };
      const to = landing.current ?? at;
      const risen = { x: from.x + (at.x - from.x) * p.rise, y: from.y + (at.y - from.y) * p.rise };
      const x = risen.x + (to.x - risen.x) * p.travel;
      const y = risen.y + (to.y - risen.y) * p.travel - 18 * Math.sin(Math.PI * p.travel);
      const scale = PAPER_SCALE * k + (1 - PAPER_SCALE * k) * p.travel;
      paper.style.opacity = String(p.opacity);
      paper.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%) rotate(${(-2 * p.travel).toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      const u = Math.max(0.04, p.unroll);
      if (clipRef.current) clipRef.current.style.transform = `scaleX(${u.toFixed(4)})`;
      if (textRef.current) textRef.current.style.transform = `scaleX(${(1 / u).toFixed(4)})`;
      if (slipRef.current) slipRef.current.style.opacity = p.slipOpacity.toFixed(3);
      const half = (paper.offsetWidth / 2) * p.unroll;
      for (const [roll, sign] of [
        [rollLeftRef.current, -1],
        [rollRightRef.current, 1],
      ] as const) {
        if (!roll) continue;
        roll.style.opacity = p.rollsOpacity.toFixed(3);
        roll.style.transform = `translateX(${(sign * half).toFixed(2)}px)`;
      }
    }
    const tag = callbacks.current.getTag?.();
    if (tag) tag.style.opacity = f.tagOpacity.toFixed(3);
  }

  // Preview: one fixed frame, the name known from the start.
  useLayoutEffect(() => {
    if (time === undefined) return;
    const f = lotteryFrame(time, pickStart(0), chosenIndex);
    if (f.paper.travel > 0) measureLanding();
    apply(f);
  });

  // Live: one animation loop for the whole sequence.
  useEffect(() => {
    if (time !== undefined) return;
    startRef.current = performance.now();
    let frame = 0;
    let hiddenAt = 0;
    let paperShown = false;
    let finished = false;

    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      const f = lotteryFrame(t, pickStart(arrivedRef.current), chosenIndex);
      if (f.paper.opacity > 0 && !paperShown) {
        paperShown = true;
        callbacks.current.onPaper?.();
      }
      if (f.paper.travel > 0 && !landing.current) measureLanding();
      apply(f);
      if (f.phase === "done") {
        finished = true;
        callbacks.current.onDone?.();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (finished) return;
      if (document.hidden) {
        hiddenAt = performance.now();
        window.cancelAnimationFrame(frame);
      } else {
        // Pause the clock while hidden: resume where it left off.
        startRef.current += performance.now() - hiddenAt;
        frame = window.requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [time, chosenIndex]);

  // The moment the server's answer arrives decides when the pick may start.
  useEffect(() => {
    if (name !== null && arrivedRef.current === null) {
      arrivedRef.current = (performance.now() - startRef.current) / 1000;
    }
  }, [name]);

  const roll =
    "absolute -bottom-1.5 -top-1.5 left-1/2 -ml-[5px] w-[10px] rounded-full border-[1.5px] border-ink bg-paper";

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 aspect-square w-full"
    >
      <svg viewBox={`0 0 ${STAGE} ${STAGE}`} className="h-full w-full overflow-visible">
        <g ref={bowlRef} opacity={0}>
          <rect
            x={cx - 34}
            y={bottomY - 4}
            width={68}
            height={10}
            rx={2}
            fill="var(--kraft)"
            {...line}
            strokeWidth={1.75}
          />
          <path d={`${GLASS} Z`} fill="var(--ink)" fillOpacity={0.05} />
          {Array.from({ length: BALL_COUNT }, (_, i) => {
            if (i === chosenIndex) return null;
            const rest = restPosition(i);
            return (
              <g
                key={i}
                ref={(el) => {
                  ballRefs.current[i] = el;
                }}
                transform={`translate(${rest.x.toFixed(2)} ${rest.y.toFixed(2)})`}
              >
                <Ball index={i} />
              </g>
            );
          })}
          <path d={GLASS} fill="none" {...line} strokeWidth={1.75} />
          <path
            d={`M${cx - r + 14} ${cy - 6} A${r - 14} ${r - 14} 0 0 1 ${cx - 40} ${mouthY + 22}`}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.35}
            strokeWidth={1.25}
            strokeLinecap="round"
          />
          <path
            d={`M${cx + r - 12} ${cy + 18} A${r - 12} ${r - 12} 0 0 1 ${cx + r - 16} ${cy + 36}`}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.35}
            strokeWidth={1.25}
            strokeLinecap="round"
          />
          <rect
            x={cx - mouthHalf - 7}
            y={rimY}
            width={2 * (mouthHalf + 7)}
            height={neckY - rimY}
            rx={4}
            fill="var(--paper)"
            {...line}
            strokeWidth={1.75}
          />
        </g>
        <g ref={chosenRef} opacity={0}>
          <Ball index={chosenIndex} lidRef={lidRef} baseRef={baseRef} />
        </g>
      </svg>

      <div ref={paperRef} className="absolute left-0 top-0 opacity-0">
        <div ref={clipRef} className="relative overflow-hidden px-3 py-1.5">
          <div ref={slipRef} className="absolute inset-0 border-[1.5px] border-ink bg-cream" />
          <p
            ref={textRef}
            className="relative max-w-[16rem] break-words font-serif text-[2.9rem] leading-[1.02] tracking-[-0.01em] text-ink"
          >
            <span ref={spanRef}>{name ?? ""}</span>
          </p>
        </div>
        <span ref={rollLeftRef} className={roll} />
        <span ref={rollRightRef} className={roll} />
      </div>
    </div>
  );
}
