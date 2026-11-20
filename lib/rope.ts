/**
 * A hanging gift tag on a flexible string, simulated with position Verlet.
 *
 * Points 0..segments are the string: point 0 is pinned EXACTLY at the knot
 * (0, 0) every step, the last string point is the tag's hole. One extra point
 * below the hole is the tag's center of mass, joined to the hole by a rigid
 * distance constraint, so the tag swings and turns ABOUT THE HOLE relative to
 * the string. Units: CSS px, seconds; y points down. Pure and client-safe:
 * no imports, no randomness, no clock (time is part of the state).
 */
export type RopeConfig = {
  /** Number of string segments. */
  segments: number;
  /** Knot-to-hole string length, px. */
  stringLength: number;
  /** Hole-to-center-of-mass distance of the tag, px. */
  tagDrop: number;
};

export type RopeInput = {
  /** Smoothed scroll speed, px/s, signed (down is +). */
  scrollVelocity: number;
  /** Strength of the always-on idle breeze, 0..1. */
  breeze: number;
  /** Wind strength multiplier (1 for the hero, lower for quieter tags). */
  gain: number;
};

export type RopeState = {
  x: number[];
  y: number[];
  px: number[];
  py: number[];
  /** Unsimulated time carried to the next call, s. */
  carry: number;
  /** Simulated time, s (drives the breeze and turbulence phases). */
  time: number;
};

export const STEP = 1 / 120;
export const MAX_SUBSTEPS = 4;
export const ITERATIONS = 10;
/** Gravity, px/s^2: with ~260px from knot to the tag's center this gives a ~2s swing. */
export const GRAVITY = 2500;
/** Velocity kept per 1/60s (frame-rate independent). */
export const DAMPING_PER_60 = 0.97;
/** Extra air drag on the light string points, per 1/60s: the string trails the tag. */
export const STRING_DRAG_PER_60 = 0.8;
/** Wind acceleration at full strength on the string, px/s^2; the tag gets TAG_WIND x this. */
export const WIND_ACCEL = 105;
export const TAG_WIND = 3;
/** Wind on the string at the hole (sheltered near the knot), x WIND_ACCEL. */
export const STRING_EXPOSURE = 1.2;
/** Scroll speed giving tanh(1) of full wind, px/s. */
export const SPEED_SCALE = 1800;
/** Idle breeze acceleration on the tag at breeze = 1, px/s^2. */
export const BREEZE_ACCEL = 26;
/** Inverse masses: a string point and the paper tag weigh the same, so the
 * twine as a whole outweighs the tag: the string leans with the wind and the
 * lighter, wind-catching tag turns further about the hole. */
export const STRING_INV_MASS = 1;
export const TAG_INV_MASS = 1;

export const DEFAULT_CONFIG: RopeConfig = { segments: 9, stringLength: 110, tagDrop: 150 };

function count(config: RopeConfig) {
  return config.segments + 2; // string points (segments + 1) plus the tag's center
}

/** A rope hanging straight down, optionally swung by `angleDeg` about the knot. */
export function createRope(config: RopeConfig = DEFAULT_CONFIG, angleDeg = 0, lift = 0): RopeState {
  const n = count(config);
  const x: number[] = [];
  const y: number[] = [];
  const a = (angleDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const along =
      i <= config.segments
        ? (config.stringLength * i) / config.segments
        : config.stringLength + config.tagDrop;
    x.push(Math.sin(a) * along);
    y.push(Math.cos(a) * along - lift * (along / (config.stringLength + config.tagDrop)));
  }
  return { x, y, px: [...x], py: [...y], carry: 0, time: 0 };
}

function invMass(config: RopeConfig, i: number) {
  if (i === 0) return 0;
  return i === config.segments + 1 ? TAG_INV_MASS : STRING_INV_MASS;
}

/** Horizontal wind acceleration on the string (the tag gets TAG_WIND times this). */
export function windAccel(input: RopeInput, time: number): number {
  const v = Number.isFinite(input.scrollVelocity) ? input.scrollVelocity : 0;
  const gain = Number.isFinite(input.gain) ? input.gain : 0;
  const push = -WIND_ACCEL * gain * Math.tanh(v / SPEED_SCALE);
  // Gusty, not a clean push: two slow sines with incommensurate periods.
  const gust =
    1 + 0.22 * Math.sin((2 * Math.PI * time) / 1.3) + 0.14 * Math.sin((2 * Math.PI * time) / 0.77);
  return push * gust;
}

/** The idle breeze: a tiny, slowly drifting sideways force (three sines). */
export function breezeAccel(input: RopeInput, time: number): number {
  const amount = Number.isFinite(input.breeze) ? Math.min(Math.max(input.breeze, 0), 1) : 0;
  const t = time;
  return (
    BREEZE_ACCEL *
    amount *
    (Math.sin((2 * Math.PI * t) / 6.3) +
      0.5 * Math.sin((2 * Math.PI * t) / 3.7 + 1.1) +
      0.3 * Math.sin((2 * Math.PI * t) / 9.1 + 2.3))
  );
}

function substep(state: RopeState, config: RopeConfig, input: RopeInput) {
  const n = count(config);
  const tag = config.segments + 1;
  const damping = Math.pow(DAMPING_PER_60, STEP * 60);
  const stringDamping = damping * Math.pow(STRING_DRAG_PER_60, STEP * 60);
  const wind = windAccel(input, state.time);
  const breeze = breezeAccel(input, state.time);
  for (let i = 1; i < n; i++) {
    // The ribbon shelters the top of the string; the wind grows toward the tag.
    // That uneven push is what curves the string.
    const exposure = i === tag ? TAG_WIND : STRING_EXPOSURE * Math.pow(i / config.segments, 2);
    const ax = wind * exposure + (i === tag ? breeze : (breeze * exposure) / TAG_WIND);
    const keep = i === tag ? damping : stringDamping;
    const vx = (state.x[i] - state.px[i]) * keep;
    const vy = (state.y[i] - state.py[i]) * keep;
    state.px[i] = state.x[i];
    state.py[i] = state.y[i];
    state.x[i] += vx + ax * STEP * STEP;
    state.y[i] += vy + GRAVITY * STEP * STEP;
  }
  const segment = config.stringLength / config.segments;
  for (let k = 0; k < ITERATIONS; k++) {
    for (let i = 0; i < n - 1; i++) {
      const j = i + 1;
      const rest = j === tag ? config.tagDrop : segment;
      const dx = state.x[j] - state.x[i];
      const dy = state.y[j] - state.y[i];
      const dist = Math.hypot(dx, dy) || 1e-9;
      const wi = invMass(config, i);
      const wj = invMass(config, j);
      const share = (dist - rest) / dist / (wi + wj);
      state.x[i] += dx * share * wi;
      state.y[i] += dy * share * wi;
      state.x[j] -= dx * share * wj;
      state.y[j] -= dy * share * wj;
    }
    // The knot never moves.
    state.x[0] = 0;
    state.y[0] = 0;
  }
  state.px[0] = 0;
  state.py[0] = 0;
  state.time += STEP;
}

/**
 * Advance by `dtSeconds` with a fixed internal step and an accumulator; at most
 * MAX_SUBSTEPS per call, so a long frame (tab switch) cannot explode or stall.
 * Mutates and returns `state`.
 */
export function stepRope(
  state: RopeState,
  config: RopeConfig,
  input: RopeInput,
  dtSeconds: number,
): RopeState {
  if (!(dtSeconds > 0)) return state;
  const dt = Number.isFinite(dtSeconds) ? dtSeconds : STEP * MAX_SUBSTEPS;
  state.carry = Math.min(state.carry + dt, STEP * MAX_SUBSTEPS);
  while (state.carry >= STEP - 1e-12) {
    substep(state, config, input);
    state.carry -= STEP;
  }
  return state;
}

/** Push the tag sideways: a velocity change of `dvx` px/s on its center of mass. */
export function nudgeTag(state: RopeState, config: RopeConfig, dvx: number): RopeState {
  const tag = config.segments + 1;
  if (Number.isFinite(dvx)) state.px[tag] -= dvx * STEP;
  return state;
}

/** The tag's rotation about the hole, degrees, CSS sense (clockwise +). */
export function tagAngle(state: RopeState, config: RopeConfig): number {
  const h = config.segments;
  const c = h + 1;
  return (-Math.atan2(state.x[c] - state.x[h], state.y[c] - state.y[h]) * 180) / Math.PI;
}

/** Angle of the whole assembly (knot to the tag's center) from vertical, CSS sense. */
export function assemblyAngle(state: RopeState, config: RopeConfig): number {
  const c = config.segments + 1;
  return (-Math.atan2(state.x[c], state.y[c]) * 180) / Math.PI;
}

/** Angle of the string's last segment (into the hole), CSS sense. */
export function endSegmentAngle(state: RopeState, config: RopeConfig): number {
  const h = config.segments;
  return (-Math.atan2(state.x[h] - state.x[h - 1], state.y[h] - state.y[h - 1]) * 180) / Math.PI;
}

/** Largest sideways distance of a string point from the straight knot-hole line, px. */
export function stringBend(state: RopeState, config: RopeConfig): number {
  const h = config.segments;
  const hx = state.x[h];
  const hy = state.y[h];
  const len = Math.hypot(hx, hy) || 1;
  let worst = 0;
  for (let i = 1; i < h; i++) {
    worst = Math.max(worst, Math.abs(state.x[i] * hy - state.y[i] * hx) / len);
  }
  return worst;
}

/** Smooth SVG path through the string points (quadratic curves through midpoints). */
export function ropePath(state: RopeState, config: RopeConfig): string {
  const h = config.segments;
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  let d = `M${f(state.x[0])} ${f(state.y[0])}`;
  for (let i = 1; i < h; i++) {
    const mx = (state.x[i] + state.x[i + 1]) / 2;
    const my = (state.y[i] + state.y[i + 1]) / 2;
    d += ` Q${f(state.x[i])} ${f(state.y[i])} ${f(mx)} ${f(my)}`;
  }
  d += ` L${f(state.x[h])} ${f(state.y[h])}`;
  return d;
}

export function isSettled(state: RopeState, config: RopeConfig): boolean {
  const c = config.segments + 1;
  return (
    Math.abs(tagAngle(state, config)) < 0.2 &&
    Math.abs(assemblyAngle(state, config)) < 0.2 &&
    Math.hypot(state.x[c] - state.px[c], state.y[c] - state.py[c]) / STEP < 2
  );
}
