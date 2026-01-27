import { describe, expect, it } from "vitest";
import { World } from "../../../packages/eris/src/eris/world/World";
import { NoopPhysics } from "../../../packages/eris/src/eris/physics/NoopPhysics";
import { NoopNet } from "../../../packages/eris/src/eris/net/NoopNet";

describe("World", () => {
  it("stores arbitrary keyed state", () => {
    const world = new World({ fixedDt: 1 / 60, physics: NoopPhysics, net: NoopNet });

    expect(world.get<number>("x")).toBeUndefined();
    world.set("x", 123);
    expect(world.get<number>("x")).toBe(123);
    expect(world.has("x")).toBe(true);

    world.delete("x");
    expect(world.has("x")).toBe(false);
  });
});

