import { clampScrollTop, easeInOutCubic, scrollDuration } from "@/lib/smooth-scroll";

// Browser-only helpers for the designed, button-triggered scroll. Import them
// from client components and call them from event handlers or effects only.

const TAKEOVER_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
let cancelActive: (() => void) | null = null;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The sticky header's height, read from `scroll-padding-top` on <html>. */
export function headerOffset(): number {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}

/**
 * An eased (easeInOutCubic) scroll to `top`, 500-1100ms depending on distance.
 * Each frame writes an INSTANT scroll so nothing else smooths it. Any wheel,
 * touch, key or pointer input hands control straight back to the user. Under
 * reduced motion it jumps. Resolves when finished or cancelled.
 */
export function smoothScrollTo(top: number): Promise<void> {
  cancelActive?.();
  const maxTop = document.documentElement.scrollHeight - window.innerHeight;
  const target = clampScrollTop(top, maxTop);
  const start = window.scrollY;
  const distance = target - start;
  if (prefersReducedMotion() || Math.abs(distance) < 2) {
    window.scrollTo({ top: target, behavior: "instant" });
    return Promise.resolve();
  }
  const duration = scrollDuration(distance);

  return new Promise((resolve) => {
    let frame = 0;
    const startedAt = performance.now();
    const finish = () => {
      window.cancelAnimationFrame(frame);
      TAKEOVER_EVENTS.forEach((type) => window.removeEventListener(type, finish));
      if (cancelActive === finish) cancelActive = null;
      resolve();
    };
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      window.scrollTo({ top: start + distance * easeInOutCubic(progress), behavior: "instant" });
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else finish();
    };
    TAKEOVER_EVENTS.forEach((type) => window.addEventListener(type, finish, { passive: true }));
    cancelActive = finish;
    frame = window.requestAnimationFrame(tick);
  });
}

/** Scroll so the element sits in the middle of the space below the sticky header. */
export function scrollToCenter(element: Element): Promise<void> {
  const rect = element.getBoundingClientRect();
  const offset = headerOffset();
  const room = window.innerHeight - offset;
  const top =
    rect.height >= room
      ? window.scrollY + rect.top - offset
      : window.scrollY + rect.top - offset - (room - rect.height) / 2;
  return smoothScrollTo(top);
}

/** Scroll an element to just under the sticky header. */
export function scrollToTop(element: Element): Promise<void> {
  return smoothScrollTo(window.scrollY + element.getBoundingClientRect().top - headerOffset());
}
