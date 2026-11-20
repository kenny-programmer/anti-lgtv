import { describe, expect, it } from "vitest";
import { toGoogleSignInUrl } from "@/lib/sign-in-url";

const AUTHKIT_URL =
  "https://api.workos.com/user_management/authorize?client_id=client_123&redirect_uri=https%3A%2F%2Fexample.netlify.app%2Fcallback&response_type=code&provider=authkit&screen_hint=sign-in&state=abc.def&code_challenge=xyz&code_challenge_method=S256";

describe("toGoogleSignInUrl", () => {
  it("replaces the hosted AuthKit provider with Google", () => {
    const url = new URL(toGoogleSignInUrl(AUTHKIT_URL));
    expect(url.searchParams.get("provider")).toBe("GoogleOAuth");
    expect(url.searchParams.getAll("provider")).toHaveLength(1);
  });

  it("keeps host, path and every other parameter unchanged", () => {
    const before = new URL(AUTHKIT_URL);
    const after = new URL(toGoogleSignInUrl(AUTHKIT_URL));
    expect(after.origin + after.pathname).toBe(before.origin + before.pathname);
    for (const key of ["client_id", "redirect_uri", "response_type", "state", "code_challenge", "code_challenge_method"]) {
      expect(after.searchParams.get(key)).toBe(before.searchParams.get(key));
    }
  });

  it("drops screen_hint, which WorkOS rejects together with a social provider", () => {
    const url = new URL(toGoogleSignInUrl(AUTHKIT_URL));
    expect(url.searchParams.has("screen_hint")).toBe(false);
  });

  it("adds the provider when the URL has none", () => {
    const url = new URL(toGoogleSignInUrl("https://api.workos.com/user_management/authorize?client_id=c"));
    expect(url.searchParams.get("provider")).toBe("GoogleOAuth");
  });
});
