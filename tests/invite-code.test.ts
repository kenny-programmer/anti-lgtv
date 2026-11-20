import { describe, expect, it } from "vitest";
import { formatInviteCode, generateInviteCode, normalizeInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("always returns 8 characters from A-Z and 0-9", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("does not repeat across many calls", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(codes.size).toBe(1000);
  });
});

describe("formatInviteCode", () => {
  it("splits the code into two groups of four", () => {
    expect(formatInviteCode("ABCD1234")).toBe("ABCD-1234");
    expect(formatInviteCode("1A2B3C4D")).toBe("1A2B-3C4D");
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["ABCD1234", "ABCD1234"],
    ["ABCD-1234", "ABCD1234"],
    ["abcd-1234", "ABCD1234"],
    ["  ab cd-12 34  ", "ABCD1234"],
    ["1a2b-3c4d", "1A2B3C4D"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each(["", "ABCD-123", "ABCD-12345", "ABC!-1234", "ABCD_1234", "nope"])(
    "rejects %j",
    (input) => {
      expect(normalizeInviteCode(input)).toBeNull();
    },
  );
});
