import { describe, expect, it } from "vitest";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";

const deadline = new Date("2030-01-10T12:00:00Z");

describe("getGroupStatus", () => {
  it("is open before the deadline", () => {
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, new Date("2030-01-10T11:59:59Z"))).toBe("open");
  });

  it("is closed at exactly the deadline and after it", () => {
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, deadline)).toBe("closed");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, new Date("2030-02-01T00:00:00Z"))).toBe("closed");
  });

  it("is raffled once raffledAt is set, regardless of the clock", () => {
    const raffledAt = new Date("2030-01-11T00:00:00Z");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt }, new Date("2030-01-01T00:00:00Z"))).toBe("raffled");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt }, new Date("2031-01-01T00:00:00Z"))).toBe("raffled");
  });

  it("requires at least 3 members for a raffle", () => {
    expect(MIN_MEMBERS).toBe(3);
  });
});
