import { describe, expect, it, vi } from "vitest";
import { Engine } from "../../../packages/eris/src/eris/engine/Engine";
import type { PhysicsModule } from "../../../packages/eris/src/eris/physics/PhysicsModule";
import type { NetDriver } from "../../../packages/eris/src/eris/net/NetDriver";
import type { World } from "../../../packages/eris/src/eris/world/World";

function makeNet(overrides?: Partial<NetDriver>): NetDriver {
  return {
    pollIncoming: vi.fn(),
    applyIncoming: vi.fn(),
    collectOutgoing: vi.fn(),
    flushOutgoing: vi.fn(),
    ...overrides
  };
}

function makePhysics(overrides?: Partial<PhysicsModule>): PhysicsModule {
  return {
    step: vi.fn(),
    ...overrides
  };
}

describe("Engine", () => {
  it("does not run systems before init()", () => {
    const engine = new Engine();

    let ran = false;
    engine.registerSystem({
      name: "preFrame.test",
      phase: "preFrame",
      run() {
        ran = true;
      }
    });

    engine.frame(1 / 60);
    expect(ran).toBe(false);
  });

  it("runs phases with fixed-step stepping and calls physics once per fixed tick", async () => {
    const physics = makePhysics();
    const net = makeNet();
    const engine = new Engine({ fixedDt: 0.1, maxFrameDt: 1, physics, net });

    const counts = {
      preFrame: 0,
      fixed: 0,
      postPhysicsFixed: 0,
      update: 0,
      late: 0,
      renderApply: 0
    };

    engine.registerSystems([
      { name: "count.preFrame", phase: "preFrame", run: () => void (counts.preFrame += 1) },
      { name: "count.fixed", phase: "fixed", run: () => void (counts.fixed += 1) },
      {
        name: "count.postPhysicsFixed",
        phase: "postPhysicsFixed",
        run: () => void (counts.postPhysicsFixed += 1)
      },
      { name: "count.update", phase: "update", run: () => void (counts.update += 1) },
      { name: "count.late", phase: "late", run: () => void (counts.late += 1) },
      { name: "count.renderApply", phase: "renderApply", run: () => void (counts.renderApply += 1) }
    ]);

    await engine.init();
    engine.frame(0.35);

    expect(counts.preFrame).toBe(1);
    expect(counts.fixed).toBe(3);
    expect(counts.postPhysicsFixed).toBe(3);
    expect(counts.update).toBe(1);
    expect(counts.late).toBe(1);
    expect(counts.renderApply).toBe(1);

    expect(physics.step).toHaveBeenCalledTimes(3);
    expect(physics.step).toHaveBeenNthCalledWith(1, 0.1);
    expect(physics.step).toHaveBeenNthCalledWith(2, 0.1);
    expect(physics.step).toHaveBeenNthCalledWith(3, 0.1);

    expect(net.pollIncoming).toHaveBeenCalledTimes(1);
    expect(net.applyIncoming).toHaveBeenCalledTimes(1);
    expect(net.collectOutgoing).toHaveBeenCalledTimes(1);
    expect(net.flushOutgoing).toHaveBeenCalledTimes(1);
  });

  it("orders systems by order then name within a phase", async () => {
    const engine = new Engine({ fixedDt: 0.1 });
    const ran: string[] = [];

    engine.registerSystems([
      { name: "b", phase: "update", order: 0, run: () => ran.push("b") },
      { name: "a", phase: "update", order: 0, run: () => ran.push("a") },
      { name: "c", phase: "update", order: 1, run: () => ran.push("c") }
    ]);

    await engine.init();
    engine.frame(0.016);

    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("clamps render alpha to [0..1] even when maxSubSteps is hit", async () => {
    const engine = new Engine({ fixedDt: 0.1, maxSubSteps: 2, maxFrameDt: 1 });
    let alpha: number | null = null;

    engine.registerSystem({
      name: "capture.alpha",
      phase: "renderApply",
      run(_world: World, dt: number) {
        alpha = dt;
      }
    });

    await engine.init();
    engine.frame(0.35); // would leave accumulator at 0.15 -> raw alpha 1.5 without clamping

    expect(alpha).toBe(1);
  });
});
