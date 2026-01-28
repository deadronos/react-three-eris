import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Engine, KeyboardInput, System } from "react-three-eris";

export type PinballMode = "ready" | "inPlay" | "gameOver";

export type PinballGameState = {
  mode: PinballMode;
  score: number;
  ballsRemaining: number;
  plungerCharge: number; // 0..1
};

type PinballConfig = {
  tableHalfWidth: number;
  tableHalfLength: number;
  tableFloorHalfThickness: number;
  ballRadius: number;
  ballStart: { x: number; y: number; z: number };
  drainY: number;
  drainZ: number;
  plungerChargeSeconds: number;
  plungerImpulseMin: number;
  plungerImpulseMax: number;
  flipperSpeedRadPerSec: number;
  bumperKickImpulse: number;
  bumperScore: number;
  bumperCooldownSeconds: number;
};

type FlipperSide = "left" | "right";

type FlipperState = {
  side: FlipperSide;
  rb: any;
  pivot: { x: number; y: number; z: number };
  yaw: number;
  restYaw: number;
  upYaw: number;
};

type BumperState = {
  id: string;
  center: { x: number; y: number; z: number };
  radius: number;
  cooldownUntil: number;
};

// Visual and physics constants for flippers (kept in sync).
const FLIPPER_HALF_LEN = 0.75;
const FLIPPER_HALF_H = 0.09;
const FLIPPER_HALF_W = 0.18;

function getConfig(world: Engine["world"]): PinballConfig {
  const existing = world.get<PinballConfig>("pinball.config");
  if (existing) return existing;

  const cfg: PinballConfig = {
    tableHalfWidth: 3.1,
    tableHalfLength: 6.2,
    tableFloorHalfThickness: 0.12,
    ballRadius: 0.2,
    ballStart: { x: 2.45, y: 0.35, z: 5.5 },
    drainY: -2,
    drainZ: 6.4,
    plungerChargeSeconds: 0.9,
    plungerImpulseMin: 8,
    plungerImpulseMax: 22,
    flipperSpeedRadPerSec: 11,
    bumperKickImpulse: 8,
    bumperScore: 100,
    bumperCooldownSeconds: 0.18
  };

  world.set("pinball.config", cfg);
  return cfg;
}

function getOrInitGame(world: Engine["world"]): PinballGameState {
  const existing = world.get<PinballGameState>("pinball.game");
  if (existing) return existing;
  const next: PinballGameState = { mode: "ready", score: 0, ballsRemaining: 3, plungerCharge: 0 };
  world.set("pinball.game", next);
  return next;
}

function setGame(world: Engine["world"], patch: Partial<PinballGameState>): void {
  const g = getOrInitGame(world);
  world.set("pinball.game", { ...g, ...patch });
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function yawToQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

function setColliderYaw(desc: any, yaw: number): any {
  if (desc && typeof desc.setRotation === "function") {
    return desc.setRotation(yawToQuat(yaw));
  }
  return desc;
}

function setRigidBodyPoseKinematic(rb: any, pivot: { x: number; y: number; z: number }, yaw: number): void {
  if (!rb) return;

  const q = yawToQuat(yaw);
  if (typeof rb.setNextKinematicTranslation === "function") {
    rb.setNextKinematicTranslation(pivot);
  }
  if (typeof rb.setNextKinematicRotation === "function") {
    rb.setNextKinematicRotation(q);
  } else if (typeof rb.setNextKinematicRotation === "undefined" && typeof rb.setNextKinematicPosition === "function") {
    // Some rapier builds expose setNextKinematicPosition(pos: Isometry)
    rb.setNextKinematicPosition({ translation: pivot, rotation: q });
  }
}

function resetBall(rb: any, cfg: PinballConfig): void {
  if (!rb) return;
  if (typeof rb.setTranslation === "function") rb.setTranslation(cfg.ballStart, true);
  if (typeof rb.setLinvel === "function") rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  if (typeof rb.setAngvel === "function") rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  // Some builds support sleeping/waking; keep it defensive.
  if (typeof rb.wakeUp === "function") rb.wakeUp();
}

function applyImpulse(rb: any, impulse: { x: number; y: number; z: number }): void {
  if (!rb) return;
  if (typeof rb.applyImpulse === "function") rb.applyImpulse(impulse, true);
}

export function registerPinballMicroSystems(engine: Engine) {
  const systems: System[] = [
    {
      name: "pinball.input",
      phase: "preFrame",
      run(world) {
        const kb = world.get<KeyboardInput>("input.keyboard");
        if (!kb) return;

        const prev = world.get<any>("pinball.input.prev") ?? {
          left: false,
          right: false,
          plunger: false,
          reset: false,
          debug: false
        };

        const left = kb.isDown("KeyZ") || kb.isDown("ArrowLeft");
        const right = kb.isDown("Slash") || kb.isDown("ArrowRight");
        const plunger = kb.isDown("Space");
        const reset = kb.isDown("KeyR");
        const debug = kb.isDown("KeyD");

        world.set("pinball.intent.left", left);
        world.set("pinball.intent.right", right);
        world.set("pinball.intent.plungerHeld", plunger);
        world.set("pinball.intent.plungerReleased", !plunger && prev.plunger);
        world.set("pinball.intent.resetPressed", reset && !prev.reset);
        world.set("pinball.intent.debugPressed", debug && !prev.debug);

        world.set("pinball.input.prev", { left, right, plunger, reset, debug });
      }
    },
    {
      name: "pinball.fixed.controls",
      phase: "fixed",
      run(world, dt) {
        const cfg = getConfig(world);
        const game = getOrInitGame(world);
        const resetPressed = world.get<boolean>("pinball.intent.resetPressed") ?? false;
        const debugPressed = world.get<boolean>("pinball.intent.debugPressed") ?? false;

        if (debugPressed) {
          const on = world.get<boolean>("pinball.debug") ?? false;
          world.set("pinball.debug", !on);
        }

        const ball = world.get<any>("pinball.ball.rb");
        if (resetPressed) {
          setGame(world, { mode: "ready", score: 0, ballsRemaining: 3, plungerCharge: 0 });
          resetBall(ball, cfg);
          return;
        }

        // Flippers (kinematic)
        const leftHeld = world.get<boolean>("pinball.intent.left") ?? false;
        const rightHeld = world.get<boolean>("pinball.intent.right") ?? false;

        const lf = world.get<FlipperState>("pinball.flipper.left");
        const rf = world.get<FlipperState>("pinball.flipper.right");
        if (lf) {
          const target = leftHeld ? lf.upYaw : lf.restYaw;
          const step = cfg.flipperSpeedRadPerSec * dt;
          const nextYaw = Math.abs(target - lf.yaw) <= step ? target : lf.yaw + Math.sign(target - lf.yaw) * step;
          lf.yaw = nextYaw;
          world.set("pinball.flipper.left", lf);
          setRigidBodyPoseKinematic(lf.rb, lf.pivot, lf.yaw);
        }
        if (rf) {
          const target = rightHeld ? rf.upYaw : rf.restYaw;
          const step = cfg.flipperSpeedRadPerSec * dt;
          const nextYaw = Math.abs(target - rf.yaw) <= step ? target : rf.yaw + Math.sign(target - rf.yaw) * step;
          rf.yaw = nextYaw;
          world.set("pinball.flipper.right", rf);
          setRigidBodyPoseKinematic(rf.rb, rf.pivot, rf.yaw);
        }

        // Plunger
        if (game.mode === "gameOver") {
          // no-op until reset
          return;
        }

        const plungerHeld = world.get<boolean>("pinball.intent.plungerHeld") ?? false;
        const plungerReleased = world.get<boolean>("pinball.intent.plungerReleased") ?? false;

        let charge = game.plungerCharge;
        if (plungerHeld) {
          charge = clamp01(charge + dt / cfg.plungerChargeSeconds);
          setGame(world, { plungerCharge: charge });
        }

        if (plungerReleased) {
          const impulseMag = cfg.plungerImpulseMin + (cfg.plungerImpulseMax - cfg.plungerImpulseMin) * charge;

          // Only launch if the ball is in the lane region.
          const t = ball?.translation?.();
          const inLane = t && t.x > 1.8 && t.z > 3.8;
          if (inLane) {
            applyImpulse(ball, { x: 0, y: 0, z: -impulseMag });
            setGame(world, { mode: "inPlay" });
          }
          setGame(world, { plungerCharge: 0 });
        }
      }
    },
    {
      name: "pinball.postPhysics.bumpers",
      phase: "postPhysicsFixed",
      run(world) {
        const cfg = getConfig(world);
        const ball = world.get<any>("pinball.ball.rb");
        const game = getOrInitGame(world);
        if (!ball || game.mode !== "inPlay") return;

        const t = ball.translation?.();
        if (!t) return;

        const bumpers = world.get<BumperState[]>("pinball.bumpers") ?? [];
        if (bumpers.length === 0) return;

        let scored = 0;
        const now = world.now;

        for (const b of bumpers) {
          if (now < b.cooldownUntil) continue;

          const dx = t.x - b.center.x;
          const dz = t.z - b.center.z;
          const dist = Math.hypot(dx, dz);
          const hitDist = b.radius + cfg.ballRadius;
          if (dist <= hitDist) {
            const nx = dist > 1e-6 ? dx / dist : 0;
            const nz = dist > 1e-6 ? dz / dist : 1;
            applyImpulse(ball, { x: nx * cfg.bumperKickImpulse, y: 0, z: nz * cfg.bumperKickImpulse });
            b.cooldownUntil = now + cfg.bumperCooldownSeconds;
            scored += cfg.bumperScore;
          }
        }

        if (scored !== 0) {
          setGame(world, { score: game.score + scored });
          world.set("pinball.bumpers", bumpers);
        }
      }
    },
    {
      name: "pinball.postPhysics.drain",
      phase: "postPhysicsFixed",
      run(world) {
        const cfg = getConfig(world);
        const ball = world.get<any>("pinball.ball.rb");
        if (!ball) return;

        const game = getOrInitGame(world);
        if (game.mode === "gameOver") return;

        const t = ball.translation?.();
        if (!t) return;

        const drained = t.y < cfg.drainY || t.z > cfg.drainZ;
        if (!drained) return;

        const remaining = Math.max(0, (game.ballsRemaining ?? 0) - 1);
        if (remaining > 0) {
          setGame(world, { ballsRemaining: remaining, mode: "ready", plungerCharge: 0 });
          resetBall(ball, cfg);
        } else {
          setGame(world, { ballsRemaining: 0, mode: "gameOver", plungerCharge: 0 });
        }
      }
    },
    {
      name: "pinball.renderApply",
      phase: "renderApply",
      run(world) {
        const debugGroup = world.get<THREE.Object3D>("pinball.mesh.debug");
        if (debugGroup) {
          const on = world.get<boolean>("pinball.debug") ?? false;
          debugGroup.visible = on;
        }

        const ball = world.get<any>("pinball.ball.rb");
        const ballMesh = world.get<THREE.Object3D>("pinball.mesh.ball");
        if (ball && ballMesh) {
          const t = ball.translation?.();
          if (t) ballMesh.position.set(t.x, t.y, t.z);
        }

        const lf = world.get<FlipperState>("pinball.flipper.left");
        const rf = world.get<FlipperState>("pinball.flipper.right");
        const leftGroup = world.get<THREE.Object3D>("pinball.mesh.flipper.left");
        const rightGroup = world.get<THREE.Object3D>("pinball.mesh.flipper.right");

        if (lf && leftGroup) {
          leftGroup.position.set(lf.pivot.x, lf.pivot.y, lf.pivot.z);
          leftGroup.rotation.set(0, lf.yaw, 0);
        }
        if (rf && rightGroup) {
          rightGroup.position.set(rf.pivot.x, rf.pivot.y, rf.pivot.z);
          rightGroup.rotation.set(0, rf.yaw, 0);
        }
      }
    }
  ];

  engine.registerSystems(systems);
}

export function PinballMicroScene(props: { engine: Engine }) {
  const { engine } = props;

  const ballRef = useRef<THREE.Mesh>(null);
  const leftFlipperGroupRef = useRef<THREE.Group>(null);
  const rightFlipperGroupRef = useRef<THREE.Group>(null);
  const debugGroupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (ballRef.current) engine.world.set("pinball.mesh.ball", ballRef.current);
    if (leftFlipperGroupRef.current) engine.world.set("pinball.mesh.flipper.left", leftFlipperGroupRef.current);
    if (rightFlipperGroupRef.current) engine.world.set("pinball.mesh.flipper.right", rightFlipperGroupRef.current);
    if (debugGroupRef.current) engine.world.set("pinball.mesh.debug", debugGroupRef.current);
  }, [engine]);

  const cfg = useMemo(() => getConfig(engine.world), [engine]);

  useEffect(() => {
    let cancelled = false;

    void engine.init().then(() => {
      if (cancelled) return;
      if (engine.world.has("pinball.physicsBuilt")) return;

      const physics: any = engine.world.physics;
      if (physics?.kind !== "rapier") return;
      const RAPIER = physics.rapier;
      const world = physics.world;
      if (!RAPIER || !world) return;

      // Floor (table): use a finite floor so the ball can fall off to drain.
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(cfg.tableHalfWidth, cfg.tableFloorHalfThickness, cfg.tableHalfLength).setTranslation(
          0,
          -cfg.tableFloorHalfThickness,
          0
        )
      );

      // Side walls (slightly taller than the ball).
      const wallH = 0.55;
      const wallT = 0.15;
      const wallY = wallH / 2;
      const wallZ = -0.3; // keep the bottom area more open

      world.createCollider(
        RAPIER.ColliderDesc.cuboid(wallT, wallH / 2, cfg.tableHalfLength - 0.7)
          .setTranslation(-cfg.tableHalfWidth - wallT, wallY, wallZ)
          .setRestitution(0.2)
          .setFriction(0.6)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(wallT, wallH / 2, cfg.tableHalfLength - 0.7)
          .setTranslation(cfg.tableHalfWidth + wallT, wallY, wallZ)
          .setRestitution(0.2)
          .setFriction(0.6)
      );
      // Back wall (top).
      // Instead of a perfectly flat back wall (which tends to bounce the ball
      // straight back down the center), use a shallow V-shape to add lateral
      // deflection and make the play feel more "pinball".
      const backZ = -cfg.tableHalfLength - wallT;
      const backYaw = 0.32;
      world.createCollider(
        setColliderYaw(
          RAPIER.ColliderDesc.cuboid(cfg.tableHalfWidth * 0.65, wallH / 2, wallT)
            .setTranslation(-cfg.tableHalfWidth * 0.2, wallY, backZ)
            .setRestitution(0.22)
            .setFriction(0.6),
          +backYaw
        )
      );
      world.createCollider(
        setColliderYaw(
          RAPIER.ColliderDesc.cuboid(cfg.tableHalfWidth * 0.65, wallH / 2, wallT)
            .setTranslation(cfg.tableHalfWidth * 0.2, wallY, backZ)
            .setRestitution(0.22)
            .setFriction(0.6),
          -backYaw
        )
      );

      // Plunger lane guide wall (keeps the ball on the right at the start).
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.08, 0.35, 1.7)
          .setTranslation(1.85, 0.35, 4.9)
          .setRestitution(0.1)
          .setFriction(0.7)
      );

      // Bumpers (static colliders). We also keep a small gameplay array for scoring + kick.
      const bumpers: BumperState[] = [
        { id: "b1", center: { x: -1.2, y: 0.25, z: -3.2 }, radius: 0.5, cooldownUntil: 0 },
        { id: "b2", center: { x: 0.0, y: 0.25, z: -4.3 }, radius: 0.5, cooldownUntil: 0 },
        { id: "b3", center: { x: 1.1, y: 0.25, z: -3.0 }, radius: 0.5, cooldownUntil: 0 }
      ];
      for (const b of bumpers) {
        world.createCollider(
          RAPIER.ColliderDesc.ball(b.radius)
            .setTranslation(b.center.x, b.center.y, b.center.z)
            .setRestitution(0.9)
            .setFriction(0.2)
        );
      }
      engine.world.set("pinball.bumpers", bumpers);

      // Ball
      const rbDesc: any = RAPIER.RigidBodyDesc.dynamic().setTranslation(cfg.ballStart.x, cfg.ballStart.y, cfg.ballStart.z);
      if (typeof rbDesc.setLinearDamping === "function") rbDesc.setLinearDamping(0.15);
      if (typeof rbDesc.setAngularDamping === "function") rbDesc.setAngularDamping(0.35);
      if (typeof rbDesc.setCcdEnabled === "function") rbDesc.setCcdEnabled(true);
      const ballRb = world.createRigidBody(rbDesc);
      const ballColDesc: any = RAPIER.ColliderDesc.ball(cfg.ballRadius)
        .setRestitution(0.55)
        .setFriction(0.55);
      if (typeof ballColDesc.setDensity === "function") ballColDesc.setDensity(1.0);
      world.createCollider(ballColDesc, ballRb);
      engine.world.set("pinball.ball.rb", ballRb);

      // Flippers (kinematic). Each flipper is a kinematic body at the pivot, with a cuboid collider offset.
      const flipperY = 0.18;

      // Spread pivots slightly so the flippers don't overlap visually or physically.
      const leftPivot = { x: -1.55, y: flipperY, z: 4.35 };
      const rightPivot = { x: 1.55, y: flipperY, z: 4.35 };

      const leftRb = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(leftPivot.x, leftPivot.y, leftPivot.z)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(FLIPPER_HALF_LEN, FLIPPER_HALF_H, FLIPPER_HALF_W)
          .setTranslation(FLIPPER_HALF_LEN, 0, 0)
          .setRestitution(0.25)
          .setFriction(0.9),
        leftRb
      );

      const rightRb = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(rightPivot.x, rightPivot.y, rightPivot.z)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(FLIPPER_HALF_LEN, FLIPPER_HALF_H, FLIPPER_HALF_W)
          .setTranslation(-FLIPPER_HALF_LEN, 0, 0)
          .setRestitution(0.25)
          .setFriction(0.9),
        rightRb
      );

      const left: FlipperState = {
        side: "left",
        rb: leftRb,
        pivot: leftPivot,
        yaw: -0.25,
        restYaw: -0.25,
        upYaw: 0.62
      };
      const right: FlipperState = {
        side: "right",
        rb: rightRb,
        pivot: rightPivot,
        // IMPORTANT: keep yaw near 0 so the collider offset (-X) stays on the left
        // side of the pivot. A +π yaw would flip it into the plunger lane.
        yaw: 0.25,
        restYaw: 0.25,
        upYaw: -0.62
      };
      engine.world.set("pinball.flipper.left", left);
      engine.world.set("pinball.flipper.right", right);
      setRigidBodyPoseKinematic(leftRb, leftPivot, left.yaw);
      setRigidBodyPoseKinematic(rightRb, rightPivot, right.yaw);

      // Game state defaults
      getOrInitGame(engine.world);

      engine.world.set("pinball.physicsBuilt", true);
    });

    return () => {
      cancelled = true;
    };
  }, [engine, cfg]);

  return (
    <>
      {/* Table visual */}
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[cfg.tableHalfWidth * 2.2, cfg.tableHalfLength * 2.2]} />
        <meshStandardMaterial color="#1c2433" />
      </mesh>

      {/* Decorative bounds */}
      <mesh castShadow position={[0, 0.28, -cfg.tableHalfLength - 0.18]}>
        <boxGeometry args={[cfg.tableHalfWidth * 2.1, 0.55, 0.25]} />
        <meshStandardMaterial color="#2b3650" />
      </mesh>
      <mesh castShadow position={[-cfg.tableHalfWidth - 0.18, 0.28, -0.3]}>
        <boxGeometry args={[0.25, 0.55, (cfg.tableHalfLength - 0.7) * 2]} />
        <meshStandardMaterial color="#2b3650" />
      </mesh>
      <mesh castShadow position={[cfg.tableHalfWidth + 0.18, 0.28, -0.3]}>
        <boxGeometry args={[0.25, 0.55, (cfg.tableHalfLength - 0.7) * 2]} />
        <meshStandardMaterial color="#2b3650" />
      </mesh>

      {/* Bumpers (visual only; physics are separate colliders) */}
      <Bumpers />

      {/* Ball */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[cfg.ballRadius, 24, 24]} />
        <meshStandardMaterial color="#e8eefc" metalness={0.35} roughness={0.25} />
      </mesh>

      {/* Flippers */}
      <group ref={leftFlipperGroupRef}>
        <mesh castShadow position={[FLIPPER_HALF_LEN, 0, 0]}>
          <boxGeometry args={[FLIPPER_HALF_LEN * 2, FLIPPER_HALF_H * 2, FLIPPER_HALF_W * 2]} />
          <meshStandardMaterial color="#f72585" />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#3a4766" />
        </mesh>
      </group>

      <group ref={rightFlipperGroupRef}>
        <mesh castShadow position={[-FLIPPER_HALF_LEN, 0, 0]}>
          <boxGeometry args={[FLIPPER_HALF_LEN * 2, FLIPPER_HALF_H * 2, FLIPPER_HALF_W * 2]} />
          <meshStandardMaterial color="#4cc9f0" />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#3a4766" />
        </mesh>
      </group>

      {/* A hint of the plunger lane */}
      <mesh position={[2.2, 0.25, 4.9]}>
        <boxGeometry args={[0.06, 0.5, 3.4]} />
        <meshStandardMaterial color="#32405e" />
      </mesh>

      {/* Debug proxies (toggle with D) */}
      <group ref={debugGroupRef} visible={false}>
        <mesh position={[0, -cfg.tableFloorHalfThickness, 0]}>
          <boxGeometry
            args={[
              cfg.tableHalfWidth * 2,
              cfg.tableFloorHalfThickness * 2,
              cfg.tableHalfLength * 2
            ]}
          />
          <meshBasicMaterial color="#7df9ff" wireframe transparent opacity={0.35} />
        </mesh>

        <mesh position={[0, 0.02, cfg.drainZ]}>
          <boxGeometry args={[cfg.tableHalfWidth * 2, 0.04, 0.04]} />
          <meshBasicMaterial color="#ff4d6d" transparent opacity={0.8} />
        </mesh>
      </group>
    </>
  );
}

function Bumpers() {
  const bumpers = useMemo(
    () => [
      { pos: new THREE.Vector3(-1.2, 0.25, -3.2), color: "#ffd166" },
      { pos: new THREE.Vector3(0.0, 0.25, -4.3), color: "#06d6a0" },
      { pos: new THREE.Vector3(1.1, 0.25, -3.0), color: "#ffd6ff" }
    ],
    []
  );

  return (
    <>
      {bumpers.map((b, i) => (
        <mesh key={i} position={b.pos.toArray()} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.3, 24]} />
          <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.18} />
        </mesh>
      ))}
    </>
  );
}
