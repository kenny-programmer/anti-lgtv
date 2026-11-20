"use client";

import { useEffect, useRef } from "react";
import { createRope, nudgeTag, ropePath, stepRope, tagAngle, type RopeConfig } from "@/lib/rope";

/** Distance from the top of the tag body to the hole's center, px (GiftTag's --tag-hole-y). */
const HOLE_Y = 30;
const SEGMENTS = 9;

/** Event a child can dispatch to push the tag: `new CustomEvent(TAG_NUDGE, { bubbles: true, detail: { dvx } })`. */
export const TAG_NUDGE = "tag-nudge";

/**
 * A gift tag hanging from a flexible twine, moved by the "wind" of scrolling
 * (faster scroll, stronger push) and an always-on whisper of a breeze. The
 * twine's top is pinned to the knot (this box's top center); the tag hangs
 * from the end of the twine and turns about its hole. Physics in lib/rope.ts;
 * one requestAnimationFrame loop writes the SVG path and the tag transform
 * directly (no React state per frame). It sleeps while off screen or in a
 * hidden tab, and under reduced motion it simply hangs still.
 */
export function HangingTag({
  stringLength = 110,
  tagDrop = 150,
  gain = 1,
  breeze = 1,
  entrance = false,
  className = "",
  children,
}: {
  stringLength?: number;
  tagDrop?: number;
  gain?: number;
  breeze?: number;
  entrance?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<SVGPathElement>(null);
  const dashRef = useRef<SVGPathElement>(null);
  const straight = `M0 0 L0 ${stringLength}`;

  useEffect(() => {
    const root = rootRef.current;
    const tag = tagRef.current;
    const base = baseRef.current;
    const dash = dashRef.current;
    if (!root || !tag || !base || !dash) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const config: RopeConfig = { segments: SEGMENTS, stringLength, tagDrop };
    const state = entrance ? createRope(config, 6, 8) : createRope(config);
    let filtered = 0;
    let lastY = window.scrollY;
    let lastTime = 0;
    let frame = 0;
    let onScreen = true;
    let running = false;

    const draw = () => {
      const h = SEGMENTS;
      const c = h + 1;
      // Let the twine run into the eyelet along the tag's axis (it cannot kink there).
      const ax = state.x[h] - state.x[c];
      const ay = state.y[h] - state.y[c];
      const al = Math.hypot(ax, ay) || 1;
      const path = `${ropePath(state, config).replace(/ L[^ ]+ [^ ]+$/, "")} Q${(state.x[h] + (ax / al) * 10).toFixed(2)} ${(state.y[h] + (ay / al) * 10).toFixed(2)} ${state.x[h].toFixed(2)} ${state.y[h].toFixed(2)}`;
      base.setAttribute("d", path);
      dash.setAttribute("d", path);
      tag.style.transform = `translate(${state.x[h].toFixed(2)}px, ${(state.y[h] - stringLength).toFixed(2)}px) rotate(${tagAngle(state, config).toFixed(3)}deg)`;
    };

    const tick = (now: number) => {
      const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
      lastTime = now;
      const y = window.scrollY;
      const raw = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      // Smooth the scroll speed so single wheel ticks do not snap the tag.
      filtered += 0.2 * (raw - filtered);
      stepRope(state, config, { scrollVelocity: filtered, breeze, gain }, dt);
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || !onScreen || document.hidden) return;
      running = true;
      lastTime = 0;
      lastY = window.scrollY;
      tag.style.willChange = "transform";
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
      tag.style.willChange = "";
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    observer.observe(root);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const onNudge = (event: Event) => {
      const dvx = (event as CustomEvent<{ dvx?: number }>).detail?.dvx ?? 0;
      nudgeTag(state, config, dvx);
    };
    root.addEventListener(TAG_NUDGE, onNudge);

    draw();
    start();
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener(TAG_NUDGE, onNudge);
    };
  }, [stringLength, tagDrop, gain, breeze, entrance]);

  // A fine pointer moving across the tag brushes it, like a hand would.
  function brush(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !rootRef.current) return;
    const dvx = Math.max(-60, Math.min(60, event.movementX * 6));
    rootRef.current.dispatchEvent(new CustomEvent(TAG_NUDGE, { detail: { dvx: dvx * 0.35 } }));
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      style={{ paddingTop: stringLength - HOLE_Y }}
    >
      <div ref={tagRef} style={{ transformOrigin: `50% ${HOLE_Y}px` }} onPointerMove={brush}>
        {children}
      </div>
      <svg
        aria-hidden="true"
        className="rope pointer-events-none absolute left-1/2 top-0 overflow-visible"
        width="1"
        height="1"
      >
        <path ref={baseRef} d={straight} fill="none" stroke="var(--twine)" strokeWidth="2.5" />
        <path
          ref={dashRef}
          d={straight}
          fill="none"
          stroke="var(--ribbon)"
          strokeWidth="2.5"
          strokeDasharray="3 3"
        />
      </svg>
    </div>
  );
}
