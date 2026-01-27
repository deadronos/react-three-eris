import { describe, expect, it } from "vitest";

describe("render/index", () => {
  it("is importable (placeholder module)", async () => {
    await expect(import("../../../packages/eris/src/eris/render/index")).resolves.toBeTruthy();
  });
});

