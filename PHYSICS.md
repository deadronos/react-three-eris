# PHYSICS.md — react-three-eris

This document defines the physics model for react-three-eris: **physics-authoritative** simulation with manual Rapier stepping, plus character controller rules.

The guiding principle is:

> Gameplay expresses intent; physics produces authoritative motion.

---

## High-Level Model

### Physics-authoritative means
- You do **not** set positions for dynamic bodies from gameplay.
- Gameplay writes:
  - forces / impulses
  - motor targets (desired velocity)
  - kinematic targets (for characters)
- Physics step produces:
  - final translations / rotations
  - velocities
  - contacts / intersections
- Gameplay reacts to physics outcomes in `postPhysicsFixed`.

This model is stable, easier to network later, and avoids “tug of war” between systems.

---

## Manual Stepping (Owned by the Engine)

react-three-eris steps Rapier inside the fixed-step loop:

1. Apply queued impulses/forces/kinematic targets
2. Set `integrationParameters.dt = fixedDt`
3. `world.step()`
4. Read back poses and events
5. Store pose history for interpolation

This guarantees:
- deterministic ordering
- consistent dt for physics
- clear boundaries between systems

---

## Body Types & Intended Use

### Static
- Level geometry, terrain, walls
- Never moves
- Used as collision world

### Dynamic
- Fully simulated rigid bodies (crates, projectiles, drones)
- Gameplay influences via impulses/forces or velocity targets
- Physics is the sole authority on final pose

### Kinematic (Position-based)
- Character controller bodies (player/NPC)
- Pose is set by a controller target each tick
- Still collides with world
- Can push dynamic bodies depending on settings

Rule: use dynamic for objects that should react physically; use kinematic for controlled agents.

---

## Forces, Impulses, and Motors

### Impulses
Use for:
- jumps
- explosions
- instant acceleration changes

### Forces
Use for:
- continuous acceleration
- thrusters
- gradual motion

### Velocity motors (common pattern)
Rather than “set position”, compute impulse toward desired velocity:

- `desiredV` from intent
- `deltaV = desiredV - currentV`
- `impulse = mass * deltaV` (optionally clamped)
- apply impulse in the fixed step

This tends to feel responsive while remaining physics-authoritative.

---

## Collision Layers & Filters

Engines usually standardize collision groups early.

Recommended approach:
- Define collision groups as bitmasks (`WORLD`, `CHARACTER`, `DYNAMIC`, `TRIGGER`, etc.)
- Store them in a single place in the physics module
- Require all colliders to declare their group and mask

Benefits:
- consistent behavior across systems
- easier queries and debugging

---

## Queries (Raycasts, Shapecasts, Overlaps)

Treat queries as part of the physics module API.

Guidelines:
- Queries should run during `fixed` or `postPhysicsFixed` (not render)
- Use consistent filters (same collision masks)
- Prefer performing queries in physics module and returning results to systems

This keeps query policy centralized.

---

## Events: Contacts, Intersections, Triggers

### Where to process events
- Read raw physics events after stepping
- Convert them into gameplay events during `postPhysicsFixed`

Recommended derived events:
- `onTriggerEnter`, `onTriggerExit`
- `onCollisionEnter`, `onCollisionExit`
- `grounded` state transitions
- `landed` events (airborne → grounded)

Avoid:
- applying damage directly inside physics step
- mixing event interpretation with stepping

---

## Pose History & Interpolation

Physics produces poses at fixed ticks. Rendering runs at a different rate.

Store:
- `prevPose` and `currPose` for each renderable body/entity

On each fixed tick:
- `prevPose = currPose`
- `currPose = poseFromRapier(body)`

On render:
- interpolate using `alpha = accumulator / fixedDt`

Interpolation rules:
- translation: linear lerp
- rotation: slerp (normalized quaternion)
- scale: typically static or lerped if needed

---

## Character Controller (Kinematic)

react-three-eris recommends a **kinematic character controller** approach.

### Goals
- stable movement on uneven surfaces
- controlled sliding against walls
- clean grounding detection
- predictable jump behavior

### Controller responsibilities (fixed step)
- convert input intent → desired local motion
- apply gravity integration for vertical velocity
- request move-and-slide resolution against world
- apply resulting translation to kinematic body target
- output derived flags: grounded, slope angle, step offset, etc.

### Important rule
Character movement logic runs in `fixed`. Grounding and trigger interpretation belongs in `postPhysicsFixed`.

---

## Character Controller Rules

### 1) Intent is not motion
Store intent separately:
- move axis (x/z)
- look yaw/pitch
- jump pressed
- sprint toggle

Do not mix “intent” with “current velocity” state.

### 2) Integrate vertical motion explicitly
Maintain vertical velocity in controller state:
- `vy += gravity * dt`
- if grounded and jump pressed: `vy = jumpSpeed`

Horizontal speed is typically driven by intent; vertical is physics/controller-driven.

### 3) Respect slopes and steps
Controller should:
- limit walkable slope angle
- allow configurable step height
- treat steep surfaces as walls (slide)

### 4) Don’t teleport
If you must correct position (network correction), do it at tick boundaries and preferably with smoothing unless it’s a hard snap.

### 5) Push behavior is explicit
If characters can push dynamic bodies:
- decide policy (push allowed? mass ratios? max impulse?)
- implement centrally (not ad-hoc in systems)

---

## Recommended API Shape (Physics + Character)

Minimal module surface:

```ts
class PhysicsModule {
  step(dt: number): void

  // registration
  createDynamic(...): BodyId
  createStatic(...): ColliderId
  createKinematicCharacter(...): CharacterId

  // queues
  queueImpulse(id: BodyId, impulse: Vec3): void
  queueForce(id: BodyId, force: Vec3): void
  setKinematicTarget(id: BodyId, pose: Pose): void

  // queries
  raycast(...): RayHit | null
}
```

Character controller module:

```ts
class CharacterControllerModule {
  fixedStep(dt: number): void
  getState(id: CharacterId): CharacterState
}
```

---

## Networking Readiness Notes (Even if Noop Today)

Physics-authoritative is a strong base for later networking.

To keep the door open:
- tag all fixed updates with a tick index
- store snapshots for a short rolling window
- keep input as commands with tick IDs
- make corrections happen only at fixed boundaries

You can stay noop today without changing the architecture later.

---

## Common Pitfalls

- Setting dynamic body transforms directly from gameplay each tick (fights physics)
- Mixing collision interpretation into the physics step (hard to debug)
- Running physics with variable dt (instability)
- Updating Three objects from physics module (breaks phase boundaries)

---

## Summary

react-three-eris treats physics as the authority over motion while keeping gameplay in control of intent.

- Fixed-step simulation
- Manual Rapier stepping
- Post-physics event interpretation
- Pose history interpolation for render
- Kinematic character controller as the default player movement model

This produces stable gameplay, clean layering, and a strong foundation for future networking.
