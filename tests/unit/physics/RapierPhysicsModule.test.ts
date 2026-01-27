import { describe, expect, it, vi } from "vitest";
import { RapierPhysicsModule } from "../../../packages/eris/src/eris/physics/RapierPhysicsModule";

describe("RapierPhysicsModule", () => {
  it("initializes via an injected loader (unit-test friendly)", async () => {
    const init = vi.fn(async () => {});

    class WorldMock {
      integrationParameters: Record<string, unknown> = {};
      step = vi.fn();
      constructor(_gravity: unknown) {}
    }

    const physics = new RapierPhysicsModule({
      loader: async () => ({ default: { init, World: WorldMock } })
    });

    await physics.init();

    expect(init).toHaveBeenCalledTimes(1);
    expect(physics.rapier).toBeTruthy();
    expect(physics.world).toBeInstanceOf(WorldMock);
  });

  it("sets integrationParameters.dt and calls world.step()", () => {
    const physics = new RapierPhysicsModule({
      // Don't load anything for this test.
      loader: async () => ({ default: {} })
    });

    const world = {
      integrationParameters: {} as Record<string, unknown>,
      step: vi.fn()
    };
    physics.world = world;

    physics.step(0.05);

    expect(world.integrationParameters.dt).toBeCloseTo(0.05, 6);
    expect(world.step).toHaveBeenCalledTimes(1);
  });
});

