// The lottery-bowl reveal as pure functions of time (seconds since the click).
// Client-safe and deterministic: no randomness, no clock. Coordinates are in
// the stage's 300 x 300 SVG viewBox (y grows downwards).

export type Point = { x: number; y: number };
export type LotteryPhase = "tumble" | "pick" | "open" | "paper" | "travel" | "done";

export const STAGE = 300;
export const BALL_COUNT = 14;
export const BALL_R = 12.5;
/** The balls tumble at least this long, even when the name is already here. */
export const MIN_TUMBLE = 2.5;
/** Bowl fade-in (and waiting-tag fade-out) at the start. */
export const ENTER = 0.35;

const R = 84;
const CX = 150;
const CY = 206;
const MOUTH_HALF = 42;
const MOUTH_Y = CY - Math.sqrt(R * R - MOUTH_HALF * MOUTH_HALF);

export const BOWL = {
  cx: CX,
  cy: CY,
  /** Outer radius of the glass. */
  r: R,
  mouthHalf: MOUTH_HALF,
  /** Where the glass sphere is cut open for the neck. */
  mouthY: MOUTH_Y,
  /** Top of the neck, where the rim lip sits. */
  neckY: MOUTH_Y - 11,
  /** Top edge of the rim lip. */
  rimY: MOUTH_Y - 19,
  /** Bottom of the bowl (the foot sits here). */
  bottomY: CY + R,
} as const;

/** Ball centres stay within this radius of the bowl centre... */
const INNER = R - 1 - BALL_R - 2;
/** ...and below this line (under the neck). */
const TOP_LIMIT = MOUTH_Y + BALL_R + 3;
/** Where the chosen ball is presented, above the mouth. */
export const PRESENT: Point = { x: CX, y: 66 };
export const PRESENT_SCALE = 2.2;
/** Where the unrolled paper sits before it travels to the tag. */
export const PAPER_AT: Point = { x: CX, y: 38 };

const PICK = 1.0;
const OPEN = 0.55;
const PAPER_RISE = 0.35;
const UNROLL = 0.55;
const HOLD = 0.4;
const TRAVEL = 0.85;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpPoint = (a: Point, b: Point, u: number): Point => ({
  x: lerp(a.x, b.x, u),
  y: lerp(a.y, b.y, u),
});

export function isInsideBowl(p: Point): boolean {
  return p.y >= TOP_LIMIT - 1e-6 && Math.hypot(p.x - CX, p.y - CY) <= INNER + 1e-6;
}

/** Projects a point into the (convex) interior: under the neck, within the glass. */
function clampToBowl(p: Point): Point {
  const y = Math.max(p.y, TOP_LIMIT);
  const dx = p.x - CX;
  const dy = y - CY;
  const d = Math.hypot(dx, dy);
  if (d <= INNER) return { x: p.x, y };
  return { x: CX + (dx / d) * INNER, y: CY + (dy / d) * INNER };
}

/** The balls at rest: a pile in the bottom of the bowl, row by row. */
const REST: Point[] = (() => {
  const spots: Point[] = [];
  for (let row = 0; spots.length < BALL_COUNT; row++) {
    const y = CY + INNER - row * BALL_R * Math.sqrt(3);
    const half = Math.sqrt(Math.max(0, INNER * INNER - (y - CY) ** 2));
    const n = Math.floor((2 * half) / (2 * BALL_R)) + 1;
    for (let k = 0; k < n && spots.length < BALL_COUNT; k++) {
      spots.push(clampToBowl({ x: CX + (k - (n - 1) / 2) * 2 * BALL_R, y }));
    }
  }
  return spots;
})();

export function restPosition(index: number): Point {
  return REST[index % BALL_COUNT];
}

/** Free tumble: a swirl with each ball on its own breathing orbit, bouncing. */
function tumble(index: number, t: number): Point {
  const i = index;
  const angle = i * 2.39996 + (2.1 + 0.35 * (i % 4)) * t + 0.5 * Math.sin(1.3 * t + i);
  const radius = INNER * (0.4 + 0.6 * Math.abs(Math.sin(0.8 + 0.37 * i + (1.1 + 0.13 * (i % 5)) * t)));
  const bounce = 16 * Math.abs(Math.sin((3.1 + 0.2 * (i % 3)) * t + i));
  return clampToBowl({
    x: CX + radius * Math.cos(angle),
    y: CY + 12 + radius * Math.sin(angle) * 0.85 - bounce,
  });
}

/** A ball while the bowl is being shaken: from rest into the tumble. */
export function ballPosition(index: number, t: number): Point {
  return lerpPoint(restPosition(index), tumble(index, t), ease(t / 0.6));
}

/** When the pick starts: once the name is here and the minimum tumble is done. */
export function pickStart(nameArrivedAt: number | null): number | null {
  return nameArrivedAt === null ? null : Math.max(MIN_TUMBLE, nameArrivedAt);
}

export type Timeline = {
  pick: number;
  open: number;
  paper: number;
  unroll: number;
  travel: number;
  end: number;
};

export function timeline(pickAt: number): Timeline {
  const open = pickAt + PICK;
  const paper = open + OPEN * 0.8;
  const unroll = paper + PAPER_RISE;
  const travel = unroll + UNROLL + HOLD;
  return { pick: pickAt, open, paper, unroll, travel, end: travel + TRAVEL };
}

export function phaseAt(t: number, pickAt: number | null): LotteryPhase {
  if (pickAt === null || t < pickAt) return "tumble";
  const line = timeline(pickAt);
  if (t < line.open) return "pick";
  if (t < line.paper) return "open";
  if (t < line.travel) return "paper";
  if (t < line.end) return "travel";
  return "done";
}

/** The chosen ball: to the mouth, straight up the neck, then presented larger. */
export function chosenBall(t: number, pickAt: number, index: number): Point & { scale: number } {
  const from = ballPosition(index, pickAt);
  const u = (t - pickAt) / PICK;
  if (u <= 0) return { ...from, scale: 1 };
  const mouth = { x: CX, y: TOP_LIMIT };
  if (u < 0.3) return { ...lerpPoint(from, mouth, ease(u / 0.3)), scale: 1 };
  const up = lerpPoint(mouth, PRESENT, ease((u - 0.3) / 0.45));
  return { ...up, scale: lerp(1, PRESENT_SCALE, ease((u - 0.6) / 0.4)) };
}

export type LotteryFrame = {
  phase: LotteryPhase;
  /** The bowl, its balls and the foot. */
  bowlOpacity: number;
  /** Degrees, about the bowl's foot. */
  bowlRotation: number;
  balls: Point[];
  chosen: Point & { scale: number; opacity: number };
  /** The top half of the chosen ball, in ball units, relative to its centre. */
  lid: { dx: number; dy: number; rotate: number; opacity: number };
  base: { dy: number };
  paper: {
    opacity: number;
    /** 0 at the ball's centre, 1 at PAPER_AT. */
    rise: number;
    /** 0 rolled up, 1 open. */
    unroll: number;
    /** 0 at PAPER_AT, 1 on the tag. */
    travel: number;
    rollsOpacity: number;
    slipOpacity: number;
  };
  tagOpacity: number;
};

export function lotteryFrame(t: number, pickAt: number | null, chosenIndex: number): LotteryFrame {
  const phase = phaseAt(t, pickAt);
  const line = pickAt === null ? null : timeline(pickAt);
  const enter = ease(t / ENTER);
  const sincePick = line ? t - line.pick : -1;

  const wobble =
    2.4 * Math.sin(2 * Math.PI * 1.1 * t) * ease(t / 0.5) * (line ? 1 - ease(sincePick / 0.4) : 1);
  const settle = line ? ease(sincePick / 0.7) : 0;
  const balls = Array.from({ length: BALL_COUNT }, (_, i) =>
    lerpPoint(ballPosition(i, t), restPosition(i), settle),
  );

  const chosen = line
    ? chosenBall(t, line.pick, chosenIndex)
    : { ...balls[chosenIndex % BALL_COUNT], scale: 1 };
  const opened = line ? ease((t - line.open) / OPEN) : 0;
  // The bowl clears out of the way before the tag comes back, so they never mix.
  const leave = line ? ease((t - line.travel + 0.25) / 0.45) : 0;

  return {
    phase,
    bowlOpacity: enter * (1 - leave),
    bowlRotation: wobble,
    balls,
    chosen: { ...chosen, opacity: enter * (1 - leave) },
    lid: {
      dx: 15 * opened,
      dy: -13 * opened,
      rotate: 58 * opened,
      opacity: line ? 1 - ease((t - line.unroll) / 0.35) : 1,
    },
    base: { dy: 3 * opened },
    paper: {
      opacity: line && t >= line.paper ? 1 : 0,
      rise: line ? easeOut((t - line.paper) / PAPER_RISE) : 0,
      unroll: line ? ease((t - line.unroll) / UNROLL) : 0,
      travel: line ? ease((t - line.travel) / TRAVEL) : 0,
      rollsOpacity: line ? 1 - ease((t - line.travel) / (TRAVEL * 0.3)) : 1,
      slipOpacity: line ? 1 - ease((t - line.travel - TRAVEL * 0.7) / (TRAVEL * 0.3)) : 1,
    },
    tagOpacity: line && t >= line.travel ? ease((t - line.travel - 0.05) / 0.4) : 1 - enter,
  };
}
