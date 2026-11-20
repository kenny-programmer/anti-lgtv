import { describe, expect, it } from "vitest";
import { pathAndSearch, safeReturnTo, signInPath } from "@/lib/return-to";

describe("safeReturnTo", () => {
  it("accepts same-site paths with a query", () => {
    expect(safeReturnTo("/groups/join?code=ABCD-1234")).toBe("/groups/join?code=ABCD-1234");
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
  });
  it.each([
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "groups/join",
    "/a\nb",
    "",
  ])("rejects %j", (value) => {
    expect(safeReturnTo(value)).toBeUndefined();
  });
  it("rejects null, undefined and very long values", () => {
    expect(safeReturnTo(null)).toBeUndefined();
    expect(safeReturnTo(undefined)).toBeUndefined();
    expect(safeReturnTo("/" + "a".repeat(600))).toBeUndefined();
  });
});

describe("signInPath and pathAndSearch", () => {
  it("round-trips an invite path through the query string", () => {
    const back = new URL(signInPath("/groups/join?code=ABCD-1234"), "https://x.test");
    expect(back.pathname).toBe("/sign-in");
    expect(safeReturnTo(back.searchParams.get("returnTo"))).toBe("/groups/join?code=ABCD-1234");
  });
  it("keeps only path and query of a full URL", () => {
    expect(pathAndSearch("https://xmaslgtv.netlify.app/groups/join?code=ABCD-1234#x")).toBe(
      "/groups/join?code=ABCD-1234",
    );
  });
});
