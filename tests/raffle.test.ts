import { describe, expect, it } from "vitest";
import { drawAssignments } from "@/lib/raffle";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

describe("drawAssignments", () => {
  it.each([2, 3, 4, 5, 8, 12])(
    "gives everyone exactly one match and nobody themselves (n=%i)",
    (n) => {
      for (let run = 0; run < 300; run++) {
        const members = ids(n);
        const pairs = drawAssignments(members);
        expect(pairs).toHaveLength(n);
        expect(new Set(pairs.map((p) => p.giver))).toEqual(new Set(members));
        expect(new Set(pairs.map((p) => p.receiver))).toEqual(new Set(members));
        expect(pairs.every((p) => p.giver !== p.receiver)).toBe(true);
      }
    },
  );

  it("does not mutate its input", () => {
    const members = ids(5);
    const copy = [...members];
    drawAssignments(members);
    expect(members).toEqual(copy);
  });

  it("throws with fewer than two participants", () => {
    expect(() => drawAssignments([])).toThrow();
    expect(() => drawAssignments(["only"])).toThrow();
  });

  it("throws on duplicate ids", () => {
    expect(() => drawAssignments(["a", "b", "a"])).toThrow();
  });

  it("produces many different matchings across runs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(JSON.stringify(drawAssignments(ids(6))));
    expect(seen.size).toBeGreaterThan(10);
  });

  it("uses the injected random source", () => {
    expect(drawAssignments(ids(4), () => 0)).toEqual([
      { giver: "id-1", receiver: "id-2" },
      { giver: "id-2", receiver: "id-3" },
      { giver: "id-3", receiver: "id-0" },
      { giver: "id-0", receiver: "id-1" },
    ]);
  });
});
