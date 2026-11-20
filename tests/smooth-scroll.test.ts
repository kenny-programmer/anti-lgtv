import { describe, expect, it } from "vitest";
import { clampScrollTop, easeInOutCubic, scrollDuration } from "@/lib/smooth-scroll";

describe("easeInOutCubic", () => {
  it("starts at 0, ends at 1, passes 0.5 at the middle and clamps outside", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("is monotonic and slow at both ends", () => {
    const xs = Array.from({ length: 101 }, (_, i) => easeInOutCubic(i / 100));
    xs.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(xs[i]));
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("scrollDuration", () => {
  it("grows with distance and stays between 500 and 1100 ms", () => {
    expect(scrollDuration(0)).toBe(500);
    expect(scrollDuration(400)).toBeGreaterThan(scrollDuration(100));
    expect(scrollDuration(-800)).toBe(scrollDuration(800));
    expect(scrollDuration(100000)).toBe(1100);
  });
});

describe("clampScrollTop", () => {
  it("keeps the target inside the scrollable range", () => {
    expect(clampScrollTop(-50, 1000)).toBe(0);
    expect(clampScrollTop(400, 1000)).toBe(400);
    expect(clampScrollTop(5000, 1000)).toBe(1000);
    expect(clampScrollTop(Number.NaN, 1000)).toBe(0);
  });
});
