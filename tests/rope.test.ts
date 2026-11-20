import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG as C,
  assemblyAngle,
  createRope,
  endSegmentAngle,
  isSettled,
  nudgeTag,
  stepRope,
  stringBend,
  tagAngle,
  type RopeInput,
  type RopeState,
} from "@/lib/rope";

const still: RopeInput = { scrollVelocity: 0, breeze: 0, gain: 1 };
const wind = (scrollVelocity: number): RopeInput => ({ scrollVelocity, breeze: 0, gain: 1 });

function simulate(state: RopeState, input: RopeInput, seconds: number, dt = 1 / 60) {
  const trace: { assembly: number; tag: number; relative: number; bend: number }[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    stepRope(state, C, input, dt);
    trace.push({
      assembly: assemblyAngle(state, C),
      tag: tagAngle(state, C),
      relative: tagAngle(state, C) - endSegmentAngle(state, C),
      bend: stringBend(state, C),
    });
  }
  return trace;
}

const maxAbs = (values: number[]) => Math.max(...values.map(Math.abs));

describe("rope", () => {
  it("never moves the knot, even in hard wind over thousands of steps", () => {
    const state = createRope(C, 6);
    for (let i = 0; i < 4000; i++) {
      stepRope(
        state,
        C,
        { scrollVelocity: i % 600 < 300 ? 6000 : -6000, breeze: 1, gain: 1 },
        1 / 60,
      );
      expect(state.x[0]).toBe(0);
      expect(state.y[0]).toBe(0);
    }
  });

  it("keeps every segment within 2% of its length after hard wind", () => {
    const state = createRope(C);
    simulate(state, wind(8000), 3);
    const segment = C.stringLength / C.segments;
    for (let i = 0; i < C.segments; i++) {
      const length = Math.hypot(state.x[i + 1] - state.x[i], state.y[i + 1] - state.y[i]);
      expect(Math.abs(length - segment) / segment).toBeLessThan(0.02);
    }
    const tag = Math.hypot(
      state.x[C.segments + 1] - state.x[C.segments],
      state.y[C.segments + 1] - state.y[C.segments],
    );
    expect(Math.abs(tag - C.tagDrop) / C.tagDrop).toBeLessThan(0.02);
  });

  it("settles to a straight vertical line with the tag at 0deg without wind", () => {
    const state = createRope(C, 6, 8);
    simulate(state, still, 8);
    expect(Math.abs(tagAngle(state, C))).toBeLessThan(0.2);
    expect(Math.abs(assemblyAngle(state, C))).toBeLessThan(0.2);
    expect(stringBend(state, C)).toBeLessThan(0.5);
    expect(isSettled(state, C)).toBe(true);
  });

  it("leans with the wind: scrolling down one way, up the other", () => {
    const down = createRope(C);
    const up = createRope(C);
    simulate(down, wind(1500), 4);
    simulate(up, wind(-1500), 4);
    expect(assemblyAngle(down, C)).toBeGreaterThan(1);
    expect(assemblyAngle(up, C)).toBeLessThan(-1);
  });

  it("curves the string and turns the tag relative to it in a steady, gusty wind", () => {
    const trace = simulate(createRope(C), wind(4000), 4);
    expect(Math.max(...trace.map((s) => s.bend))).toBeGreaterThan(0.3);
    expect(maxAbs(trace.map((s) => s.relative))).toBeGreaterThan(2);
    // The tag leans further than the string: it catches more wind.
    const last = trace.at(-1)!;
    expect(Math.abs(last.tag)).toBeGreaterThan(Math.abs(last.assembly));
  });

  it("swings back through vertical after the wind stops, then rests within 6s", () => {
    const state = createRope(C);
    simulate(state, wind(3000), 2);
    const after = simulate(state, still, 6);
    const signs = after.map((s) => Math.sign(s.assembly)).filter((v) => v !== 0);
    const crossings = signs.slice(1).filter((v, i) => v !== signs[i]).length;
    expect(crossings).toBeGreaterThanOrEqual(1);
    expect(isSettled(state, C)).toBe(true);
  });

  it("deflects further for faster scrolling, within the caps", () => {
    const peak = (speed: number) =>
      maxAbs(simulate(createRope(C), wind(speed), 3).map((s) => s.assembly));
    expect(peak(3000)).toBeGreaterThan(peak(500) * 2);
    const hard = simulate(createRope(C), wind(50000), 4);
    expect(maxAbs(hard.map((s) => s.assembly))).toBeLessThanOrEqual(10);
    expect(maxAbs(hard.map((s) => s.relative))).toBeLessThanOrEqual(15);
  });

  it("stays finite for any frame length, including 0 and half a second", () => {
    for (const dt of [0, 1 / 240, 1 / 60, 1 / 30, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = createRope(C, 6);
      for (let i = 0; i < 200; i++) stepRope(state, C, wind(5000), dt);
      expect(state.x.every(Number.isFinite)).toBe(true);
      expect(state.y.every(Number.isFinite)).toBe(true);
      expect(maxAbs([assemblyAngle(state, C)])).toBeLessThanOrEqual(10);
    }
  });

  it("is deterministic", () => {
    const run = () => {
      const state = createRope(C, 6);
      nudgeTag(state, C, 80);
      simulate(state, { scrollVelocity: 2000, breeze: 1, gain: 1 }, 3);
      return [...state.x, ...state.y];
    };
    expect(run()).toEqual(run());
  });
});
