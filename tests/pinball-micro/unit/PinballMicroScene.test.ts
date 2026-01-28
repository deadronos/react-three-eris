import { describe, expect, it, vi } from "vitest";
import { createEngine, type KeyboardInput } from "react-three-eris";
import {
  registerPinballMicroSystems,
  type PinballGameState
} from "../../../packages/pinball-micro/src/scene/PinballMicroScene";

function makeKeyboardInput(down: Set<string>): KeyboardInput {
  return {
    isDown(code) {
      return down.has(code);
    },
    dispose() {}
  };
}

describe("pinball-micro systems", () => {
  it("preFrame writes intent booleans and edge events", async () => {
    const engine = createEngine({ fixedDt: 1, maxFrameDt: 10 });
    registerPinballMicroSystems(engine);

    const down = new Set<string>(["KeyZ", "Space"]);
    engine.world.set("input.keyboard", makeKeyboardInput(down));

    await engine.init();
    engine.frame(0.016);

    expect(engine.world.get<boolean>("pinball.intent.left")).toBe(true);
    expect(engine.world.get<boolean>("pinball.intent.plungerHeld")).toBe(true);
    expect(engine.world.get<boolean>("pinball.intent.plungerReleased")).toBe(false);

    // Release space; next frame should emit plungerReleased.
    down.delete("Space");
    engine.frame(0.016);
    expect(engine.world.get<boolean>("pinball.intent.plungerHeld")).toBe(false);
    expect(engine.world.get<boolean>("pinball.intent.plungerReleased")).toBe(true);
  });

  it("fixed updates kinematic flipper pose", async () => {
    const engine = createEngine({ fixedDt: 0.1, maxFrameDt: 10 });
    registerPinballMicroSystems(engine);

    engine.world.set("input.keyboard", makeKeyboardInput(new Set(["KeyZ"])));

    const rb = {
      setNextKinematicTranslation: vi.fn(),
      setNextKinematicRotation: vi.fn()
    };
    engine.world.set("pinball.flipper.left", {
      side: "left",
      rb,
      pivot: { x: 0, y: 0, z: 0 },
      yaw: -0.25,
      restYaw: -0.25,
      upYaw: 0.62
    });

    await engine.init();
    engine.frame(0.1); // one fixed tick

    expect(rb.setNextKinematicTranslation).toHaveBeenCalled();
    expect(rb.setNextKinematicRotation).toHaveBeenCalled();

    const lf = engine.world.get<any>("pinball.flipper.left");
    expect(lf?.yaw).toBeCloseTo(0.62, 6);
  });

  it("plunger release applies impulse when ball is in lane", async () => {
    const engine = createEngine({ fixedDt: 0.1, maxFrameDt: 10 });
    registerPinballMicroSystems(engine);

    const down = new Set<string>(["Space"]);
    engine.world.set("input.keyboard", makeKeyboardInput(down));

    const ball = {
      translation: () => ({ x: 2.2, y: 0.3, z: 5.0 }),
      applyImpulse: vi.fn(),
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      setAngvel: vi.fn()
    };
    engine.world.set("pinball.ball.rb", ball);

    await engine.init();

    // Charge for one fixed tick.
    engine.frame(0.1);
    const game1 = engine.world.get<PinballGameState>("pinball.game");
    expect(game1?.plungerCharge).toBeGreaterThan(0);

    // Release.
    down.delete("Space");
    engine.frame(0.1);
    expect(ball.applyImpulse).toHaveBeenCalled();
    const impulse = (ball.applyImpulse as any).mock.calls[0][0];
    expect(impulse.z).toBeLessThan(0);
  });

  it("drain decrements balls and triggers game over", async () => {
    const engine = createEngine({ fixedDt: 0.1, maxFrameDt: 10 });
    registerPinballMicroSystems(engine);

    engine.world.set("input.keyboard", makeKeyboardInput(new Set()));

    const ball = {
      translation: () => ({ x: 0, y: -3, z: 0 }),
      setTranslation: vi.fn(),
      setLinvel: vi.fn(),
      setAngvel: vi.fn()
    };
    engine.world.set("pinball.ball.rb", ball);
    engine.world.set("pinball.game", { mode: "inPlay", score: 0, ballsRemaining: 1, plungerCharge: 0 });

    await engine.init();
    engine.frame(0.1);

    const game = engine.world.get<PinballGameState>("pinball.game");
    expect(game?.ballsRemaining).toBe(0);
    expect(game?.mode).toBe("gameOver");
  });
});
