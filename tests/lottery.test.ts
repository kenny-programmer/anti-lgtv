import { describe, expect, it } from "vitest";
import {
  BALL_COUNT,
  BALL_R,
  BOWL,
  MIN_TUMBLE,
  ballPosition,
  chosenBall,
  isInsideBowl,
  lotteryFrame,
  phaseAt,
  pickStart,
  restPosition,
  timeline,
} from "@/lib/lottery";

const times = Array.from({ length: 1200 }, (_, i) => i * 0.01);

describe("lottery bowl", () => {
  it("keeps every ball inside the bowl interior at all times", () => {
    for (let i = 0; i < BALL_COUNT; i++) {
      expect(isInsideBowl(restPosition(i))).toBe(true);
      for (const t of times) expect(isInsideBowl(ballPosition(i, t))).toBe(true);
    }
  });

  it("keeps the settling balls inside the bowl after the pick", () => {
    const pickAt = MIN_TUMBLE;
    for (const t of times) {
      const frame = lotteryFrame(t, pickAt, 3);
      frame.balls.forEach((ball, i) => {
        if (i !== 3) expect(isInsideBowl(ball)).toBe(true);
      });
    }
  });

  it("interior means below the mouth and within the glass", () => {
    expect(isInsideBowl({ x: BOWL.cx, y: BOWL.cy })).toBe(true);
    expect(isInsideBowl({ x: BOWL.cx, y: BOWL.mouthY })).toBe(false);
    expect(isInsideBowl({ x: BOWL.cx + BOWL.r, y: BOWL.cy })).toBe(false);
  });

  it("is deterministic", () => {
    for (const t of [0, 0.3, 1.7, 2.9, 4.4]) {
      expect(lotteryFrame(t, 2.5, 5)).toEqual(lotteryFrame(t, 2.5, 5));
      expect(ballPosition(7, t)).toEqual(ballPosition(7, t));
    }
  });

  it("orders the phases and bounds the total duration", () => {
    const line = timeline(MIN_TUMBLE);
    expect(line.pick).toBe(MIN_TUMBLE);
    expect(line.pick).toBeLessThan(line.open);
    expect(line.open).toBeLessThan(line.paper);
    expect(line.paper).toBeLessThan(line.travel);
    expect(line.travel).toBeLessThan(line.end);
    expect(line.end).toBeGreaterThanOrEqual(5);
    expect(line.end).toBeLessThanOrEqual(7);
    const order = ["tumble", "pick", "open", "paper", "travel", "done"];
    let last = 0;
    for (const t of times) {
      const index = order.indexOf(phaseAt(t, MIN_TUMBLE));
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
    expect(last).toBe(order.length - 1);
  });

  it("honours the minimum tumble when the name arrives early", () => {
    expect(pickStart(0.3)).toBe(MIN_TUMBLE);
    expect(phaseAt(MIN_TUMBLE - 0.01, pickStart(0.3))).toBe("tumble");
    expect(phaseAt(MIN_TUMBLE + 0.01, pickStart(0.3))).toBe("pick");
  });

  it("never reveals before the name arrives", () => {
    expect(pickStart(null)).toBeNull();
    for (const t of times) {
      expect(phaseAt(t, null)).toBe("tumble");
      expect(lotteryFrame(t, null, 0).paper.opacity).toBe(0);
    }
    // A late answer (4.2 s) starts the pick then, not earlier.
    expect(pickStart(4.2)).toBe(4.2);
    expect(phaseAt(4.19, pickStart(4.2))).toBe("tumble");
    expect(lotteryFrame(4.19, 4.2, 0).paper.opacity).toBe(0);
  });

  it("lifts the chosen ball out through the mouth, clear of the rim", () => {
    const line = timeline(MIN_TUMBLE);
    const start = chosenBall(line.pick, MIN_TUMBLE, 2);
    expect(isInsideBowl(start)).toBe(true);
    const end = chosenBall(line.open, MIN_TUMBLE, 2);
    expect(end.x).toBeCloseTo(BOWL.cx);
    expect(end.y + BALL_R * end.scale).toBeLessThan(BOWL.rimY);
    // While it is still at the glass's height it is inside the interior or in the neck.
    for (let t = line.pick; t <= line.open; t += 0.01) {
      const p = chosenBall(t, MIN_TUMBLE, 2);
      if (p.y > BOWL.mouthY) {
        expect(isInsideBowl(p) || Math.abs(p.x - BOWL.cx) < 1e-6).toBe(true);
      }
    }
  });

  it("shows the paper only after the ball opens and lands it on the tag at the end", () => {
    const line = timeline(MIN_TUMBLE);
    expect(lotteryFrame(line.open, MIN_TUMBLE, 0).paper.opacity).toBe(0);
    expect(lotteryFrame(line.travel, MIN_TUMBLE, 0).paper.unroll).toBeCloseTo(1);
    const end = lotteryFrame(line.end, MIN_TUMBLE, 0);
    expect(end.paper.travel).toBe(1);
    expect(end.tagOpacity).toBe(1);
    expect(end.bowlOpacity).toBe(0);
  });
});
