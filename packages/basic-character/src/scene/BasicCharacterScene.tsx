import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { Engine, KeyboardInput, System } from "react-three-eris";

type MoveIntent = { x: number; z: number };

export function registerBasicCharacterSystems(engine: Engine) {
  const systems: System[] = [
    {
      name: "basicCharacter.input",
      phase: "preFrame",
      run(world) {
        const kb = world.get<KeyboardInput>("input.keyboard");
        if (!kb) return;

        const x = (kb.isDown("KeyD") ? 1 : 0) - (kb.isDown("KeyA") ? 1 : 0);
        const z = (kb.isDown("KeyS") ? 1 : 0) - (kb.isDown("KeyW") ? 1 : 0);

        const len = Math.hypot(x, z);
        const move: MoveIntent = len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
        world.set("player.intent.move", move);
      }
    },
    {
      name: "basicCharacter.fixedMove",
      phase: "fixed",
      run(world, dt) {
        const move = world.get<MoveIntent>("player.intent.move") ?? { x: 0, z: 0 };
        const speed = world.get<number>("player.speed") ?? 4;

        const body = world.get<any>("player.body");
        if (!body) return;

        const t = body.translation();
        const next = { x: t.x + move.x * speed * dt, y: t.y, z: t.z + move.z * speed * dt };
        if (typeof body.setNextKinematicTranslation === "function") {
          body.setNextKinematicTranslation(next);
        }
      }
    },
    {
      name: "basicCharacter.renderApply",
      phase: "renderApply",
      run(world) {
        const body = world.get<any>("player.body");
        const mesh = world.get<THREE.Object3D>("player.mesh");
        if (!body || !mesh) return;

        const t = body.translation();
        mesh.position.set(t.x, t.y, t.z);
      }
    }
  ];

  engine.registerSystems(systems);
}

export function BasicCharacterScene(props: { engine: Engine }) {
  const { engine } = props;
  const playerRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (!playerRef.current) return;
    engine.world.set("player.mesh", playerRef.current);
  }, [engine]);

  useEffect(() => {
    let cancelled = false;

    void engine.init().then(() => {
      if (cancelled) return;

      if (engine.world.has("player.body")) return;

      const physics: any = engine.world.physics;
      if (physics?.kind !== "rapier") return;

      const RAPIER = physics.rapier;
      const world = physics.world;
      if (!RAPIER || !world) return;

      // Ground: a simple static collider.
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0)
      );

      // Player: kinematic body that we'll move by setting the next translation each fixed tick.
      const rb = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0)
      );
      world.createCollider(RAPIER.ColliderDesc.capsule(0.45, 0.25), rb);

      engine.world.set("player.body", rb);
      engine.world.set("player.speed", 5);
    });

    return () => {
      cancelled = true;
    };
  }, [engine]);

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#222833" />
      </mesh>

      <mesh ref={playerRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f6b73c" />
      </mesh>
    </>
  );
}
