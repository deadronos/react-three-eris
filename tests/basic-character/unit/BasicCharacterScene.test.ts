import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createEngine, type KeyboardInput } from "react-three-eris";
import { registerBasicCharacterSystems } from "../../../packages/basic-character/src/scene/BasicCharacterScene";

function makeKeyboardInput(down: Set<string>): KeyboardInput {
  return {
    isDown(code) {
      return down.has(code);
    },
    dispose() {}
  };
}

describe("basic-character systems", () => {
  it("preFrame writes normalized WASD intent to world state", async () => {
    const engine = createEngine({ fixedDt: 1, maxFrameDt: 10 });
    registerBasicCharacterSystems(engine);

    engine.world.set("input.keyboard", makeKeyboardInput(new Set(["KeyW", "KeyD"])));
    await engine.init();

    engine.frame(0.016);

    const move = engine.world.get<{ x: number; z: number }>("player.intent.move");
    expect(move).toBeTruthy();
    expect(move!.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(move!.z).toBeCloseTo(-Math.SQRT1_2, 6);
  });

  it("fixed moves a kinematic body via setNextKinematicTranslation()", async () => {
    const engine = createEngine({ fixedDt: 0.2, maxFrameDt: 10 });
    registerBasicCharacterSystems(engine);

    engine.world.set("input.keyboard", makeKeyboardInput(new Set(["KeyD"])));
    engine.world.set("player.speed", 5);

    const body = {
      translation: () => ({ x: 0, y: 1, z: 0 }),
      setNextKinematicTranslation: vi.fn()
    };
    engine.world.set("player.body", body);

    await engine.init();
    engine.frame(0.2); // exactly one fixed tick

    expect(body.setNextKinematicTranslation).toHaveBeenCalledTimes(1);
    expect(body.setNextKinematicTranslation).toHaveBeenCalledWith({ x: 1, y: 1, z: 0 });
  });

  it("renderApply writes body translation to the mesh position", async () => {
    const engine = createEngine({ fixedDt: 10, maxFrameDt: 10 }); // avoid running fixed
    registerBasicCharacterSystems(engine);

    engine.world.set("input.keyboard", makeKeyboardInput(new Set()));

    const mesh = new THREE.Object3D();
    engine.world.set("player.mesh", mesh);

    const body = {
      translation: () => ({ x: 2, y: 3, z: 4 }),
      setNextKinematicTranslation: vi.fn()
    };
    engine.world.set("player.body", body);

    await engine.init();
    engine.frame(0.016);

    expect(mesh.position.x).toBeCloseTo(2, 6);
    expect(mesh.position.y).toBeCloseTo(3, 6);
    expect(mesh.position.z).toBeCloseTo(4, 6);
  });
});

