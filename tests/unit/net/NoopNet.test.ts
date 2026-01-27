import { describe, expect, it } from "vitest";
import { NoopNet } from "../../../packages/eris/src/eris/net/NoopNet";
import { World } from "../../../packages/eris/src/eris/world/World";
import { NoopPhysics } from "../../../packages/eris/src/eris/physics/NoopPhysics";

describe("NoopNet", () => {
  it("implements the NetDriver interface and does nothing", () => {
    const world = new World({ fixedDt: 1 / 60, physics: NoopPhysics, net: NoopNet });

    expect(() => NoopNet.pollIncoming(0)).not.toThrow();
    expect(() => NoopNet.applyIncoming(world)).not.toThrow();
    expect(() => NoopNet.collectOutgoing(world)).not.toThrow();
    expect(() => NoopNet.flushOutgoing()).not.toThrow();
  });
});

