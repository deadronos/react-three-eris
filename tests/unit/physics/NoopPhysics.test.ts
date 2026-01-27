import { describe, expect, it } from "vitest";
import { NoopPhysics } from "../../../packages/eris/src/eris/physics/NoopPhysics";

describe("NoopPhysics", () => {
  it("does nothing", () => {
    expect(() => NoopPhysics.step(1 / 60)).not.toThrow();
  });
});

