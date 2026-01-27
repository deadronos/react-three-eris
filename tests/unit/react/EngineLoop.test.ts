import { describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => {
  return { useFrame: vi.fn() };
});

describe("EngineLoop", () => {
  it("exports a React component function", async () => {
    const mod = await import("../../../packages/eris/src/eris/react/EngineLoop");
    expect(typeof mod.EngineLoop).toBe("function");
  });
});

