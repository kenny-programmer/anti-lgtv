import { describe, expect, it } from "vitest";
import { buildRevealSequence } from "@/lib/reveal-sequence";

const decoys = ["Ann", "Bob", "Cy", "Dee"];

describe("buildRevealSequence", () => {
  it("ends on the final name and never shows it earlier", () => {
    const sequence = buildRevealSequence(decoys, "Eve");
    expect(sequence).toHaveLength(26);
    expect(sequence.at(-1)?.name).toBe("Eve");
    expect(sequence.slice(0, -1).every((frame) => frame.name !== "Eve")).toBe(true);
  });

  it("removes the final name from the decoys", () => {
    const sequence = buildRevealSequence(["Eve", "Ann", "Bob"], "Eve");
    expect(sequence.slice(0, -1).some((frame) => frame.name === "Eve")).toBe(false);
  });

  it("slows down as it goes", () => {
    const delays = buildRevealSequence(decoys, "Eve").slice(0, -1).map((frame) => frame.delayMs);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    expect(delays.at(-1)).toBeGreaterThan(delays[0]);
  });

  it("never repeats the same name back to back when there are two or more decoys", () => {
    for (let run = 0; run < 100; run++) {
      const names = buildRevealSequence(decoys, "Eve").map((frame) => frame.name);
      for (let i = 1; i < names.length; i++) expect(names[i]).not.toBe(names[i - 1]);
    }
  });

  it("copes with no decoys", () => {
    const sequence = buildRevealSequence([], "Eve", { frames: 5 });
    expect(sequence).toEqual([{ name: "Eve", delayMs: 0 }]);
  });

  it("copes with decoys that contain only the final name", () => {
    const sequence = buildRevealSequence(["Eve"], "Eve");
    expect(sequence).toEqual([{ name: "Eve", delayMs: 0 }]);
  });

  it("is deterministic for an injected random source", () => {
    const a = buildRevealSequence(decoys, "Eve", { random: () => 0 });
    const b = buildRevealSequence(decoys, "Eve", { random: () => 0 });
    expect(a).toEqual(b);
  });
});
