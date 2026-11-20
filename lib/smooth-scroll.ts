/** Pure helpers for the eased, button-triggered scroll motion. */

export const MIN_DURATION = 500;
export const MAX_DURATION = 1100;

export function easeInOutCubic(t: number): number {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Longer trips take longer, but never under 500ms or over 1100ms. */
export function scrollDuration(distancePx: number): number {
  const distance = Math.abs(distancePx);
  if (!Number.isFinite(distance)) return MAX_DURATION;
  return Math.round(Math.min(MAX_DURATION, MIN_DURATION + Math.sqrt(distance) * 12));
}

export function clampScrollTop(top: number, maxTop: number): number {
  if (!Number.isFinite(top)) return 0;
  return Math.min(Math.max(0, maxTop), Math.max(0, top));
}
