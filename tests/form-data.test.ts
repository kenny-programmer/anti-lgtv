import { describe, expect, it } from "vitest";
import { readString } from "@/lib/form-data";

describe("readString", () => {
  it("returns a string entry as-is", () => {
    const formData = new FormData();
    formData.set("name", "Ada Lovelace");
    expect(readString(formData, "name")).toBe("Ada Lovelace");
  });

  it("returns an empty string for a missing key", () => {
    expect(readString(new FormData(), "name")).toBe("");
  });

  it("returns an empty string for a File entry", () => {
    const formData = new FormData();
    formData.set("name", new File(["hello"], "hello.txt", { type: "text/plain" }));
    expect(readString(formData, "name")).toBe("");
  });

  it("returns an empty string for an empty string entry", () => {
    const formData = new FormData();
    formData.set("name", "");
    expect(readString(formData, "name")).toBe("");
  });
});
