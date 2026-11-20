export type RevealFrame = { name: string; delayMs: number };

export function buildRevealSequence(
  decoys: string[],
  finalName: string,
  options: { frames?: number; random?: () => number } = {},
): RevealFrame[] {
  const frames = options.frames ?? 26;
  const random = options.random ?? Math.random;
  const pool = [...new Set(decoys)].filter((name) => name !== finalName);
  if (pool.length === 0) return [{ name: finalName, delayMs: 0 }];

  const sequence: RevealFrame[] = [];
  let previous: string | null = null;
  for (let i = 0; i < frames - 1; i++) {
    const progress = i / (frames - 1);
    const delayMs = Math.round(45 + progress * progress * 330);
    const candidates = pool.length > 1 ? pool.filter((name) => name !== previous) : pool;
    const name = candidates[Math.floor(random() * candidates.length)];
    sequence.push({ name, delayMs });
    previous = name;
  }
  sequence.push({ name: finalName, delayMs: 0 });
  return sequence;
}
