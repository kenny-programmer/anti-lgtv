import { describe, expect, it } from "vitest";
import { formatCountdown } from "@/lib/countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it("says closed at or below zero", () => {
    expect(formatCountdown(0)).toBe("closed");
    expect(formatCountdown(-5_000)).toBe("closed");
  });

  it("handles under a minute", () => {
    expect(formatCountdown(30_000)).toBe("less than a minute left");
  });

  it("shows minutes, hours and days", () => {
    expect(formatCountdown(5 * MIN)).toBe("5m left");
    expect(formatCountdown(HOUR)).toBe("1h 0m left");
    expect(formatCountdown(HOUR + 5 * MIN)).toBe("1h 5m left");
    expect(formatCountdown(2 * DAY + 3 * HOUR + 59 * MIN)).toBe("2d 3h left");
  });
});

describe("formatCountdown non-finite input", () => {
  it("returns empty text for NaN, Infinity and -Infinity", () => {
    expect(formatCountdown(NaN)).toBe("");
    expect(formatCountdown(Infinity)).toBe("");
    expect(formatCountdown(-Infinity)).toBe("");
  });
});
