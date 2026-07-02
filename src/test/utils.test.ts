import { describe, expect, it } from "vitest";
import { ensureInside, messageKey, safeFilename, stableHash } from "../shared/utils";

describe("shared utils", () => {
  it("creates stable hashes", () => {
    expect(stableHash("same")).toBe(stableHash("same"));
    expect(stableHash("same")).not.toBe(stableHash("different"));
  });

  it("sanitizes filenames", () => {
    expect(safeFilename('a/b:c*d?"e<f>g|h')).toBe("a-b-c-d-e-f-g-h");
  });

  it("builds message keys", () => {
    expect(messageKey("chat", "message")).toBe("chat::message");
  });

  it("prevents path traversal", () => {
    expect(() => ensureInside("/tmp/root", "../escape")).toThrow(/outside/);
    expect(ensureInside("/tmp/root", "files/a.txt")).toBe("/tmp/root/files/a.txt");
  });
});
