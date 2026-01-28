# PHASES.md — react-three-eris

This document defines the phase model in react-three-eris: what runs where, why it’s structured this way, and what each phase is allowed to do.

react-three-eris is built around three core ideas:

1. **Stable ordering** (systems always run in a predictable sequence)
2. **Fixed-step simulation** (authoritative gameplay + physics at a constant dt)
3. **Render decoupling** (rendering is allowed to run at a different rate than simulation)

---

## Phase List

Recommended phase set:

```ts
export type Phase =
  | "preFrame"          // input polling, net polling, command buffering
  | "fixed"             // deterministic gameplay step at fixedDt
  | "postPhysicsFixed"  // collision/trigger interpretation after physics
  | "update"            // variable-rate systems (non-authoritative)
  | "late"              // camera, smoothing, presentation constraints
  | "renderApply";      // write to Three objects (transforms, uniforms)
```

A system subscribes to exactly one phase, and the scheduler runs phases in a fixed order.

---

## Why Fixed vs Variable?

### Fixed-step is for authority
Use fixed-step for:
- gameplay that must be stable across different frame rates
- anything that interacts tightly with physics
- tick-indexed networking / replay / rollback readiness
- consistent AI timing, cooldowns, resource production, etc.

### Variable-step is for presentation
Use variable-step for:
- effects, audio, particles
- UI sampling, non-critical timers
- camera smoothing inputs (the smoothing itself is usually in `late`)

If something must be “true” for the world, it belongs in fixed-step.

---

## The Frame Algorithm

At a high level, one render frame calls:

1. `preFrame` once
2. `fixed` and `postPhysicsFixed` 0..N times depending on accumulated time
3. `update` once
4. `late` once
5. `renderApply` once

Pseudo-code:

```ts
preFrame(dt)

accumulator += clamp(dt)
subSteps = 0
while accumulator >= fixedDt && subSteps < maxSubSteps:
  fixed(fixedDt)
  physics.step(fixedDt)
  postPhysicsFixed(fixedDt)
  capturePoseSnapshot()
  tick++
  accumulator -= fixedDt
  subSteps++

// If we hit maxSubSteps and still have >= fixedDt of debt, we soft-drop the
// remainder so the accumulator can't grow without bound.
if subSteps == maxSubSteps && accumulator > fixedDt:
  accumulator = fixedDt

alpha = clamp(accumulator / fixedDt, 0, 1)

update(dt)
late(dt)
// Note: renderApply receives `alpha` in the `dt` parameter for legacy reasons.
// Prefer reading `ctx.alpha` when available.
renderApply(alpha)
```

---

## Phase Contracts (What is allowed / not allowed)

### preFrame
**Purpose**
- Collect inputs and external signals
- Build a command buffer for the upcoming tick(s)

**Allowed**
- Read device input
- Read UI intent from a store
- Poll networking receive queues (if enabled)
- Append commands to an input/command buffer
- Prepare per-frame debug toggles

**Avoid**
- Mutating authoritative simulation state directly
- Writing transforms to Three objects

**Typical systems**
- `InputSystem`
- `NetworkPollSystem`
- `DevToolsSystem` (read toggles, not applying world changes)

---

### fixed
**Purpose**
- Authoritative gameplay step

**Allowed**
- Consume buffered commands and translate into intent
- Update authoritative state at `fixedDt`
- Queue impulses/forces for physics
- Spawn/despawn entities (prefer deterministic IDs)
- Advance tick-indexed subsystems (AI, economy, crafting)

**Avoid**
- Using frame dt (must use fixedDt)
- Doing GPU/renderer work
- Calling expensive async APIs

**Typical systems**
- `CommandsToIntentSystem`
- `GameplayFixedSystem`
- `CharacterControllerFixedSystem` (compute desired translation / motor outputs)
- `ForcesAndImpulsesSystem`

---

### postPhysicsFixed
**Purpose**
- Interpret physics results and convert them into gameplay events

**Allowed**
- Read contact pairs, intersection events, query results
- Set derived flags (grounded, wall contact, trigger states)
- Emit gameplay events (damage, pickups, enter/exit trigger)
- Stabilize state that depends on physics (e.g., landing detection)

**Avoid**
- Doing additional physics stepping
- Writing to Three objects
- Frame-rate-dependent logic

**Typical systems**
- `ContactsToEventsSystem`
- `GroundingSystem`
- `TriggerEnterExitSystem`

---

### update
**Purpose**
- Variable-rate “soft” simulation

**Allowed**
- Effects, particles, audio
- Non-authoritative timers
- UI sampling (read-only or coarse updates)

**Avoid**
- Mutating authoritative state that must match across clients/server
- Spawning authoritative entities unless explicitly marked cosmetic

**Typical systems**
- `ParticleSpawnSystem`
- `AudioSystem`
- `UiSamplingSystem`

---

### late
**Purpose**
- Presentation pass that depends on finalized world state for the frame

**Allowed**
- Camera follow and smoothing
- Presentation-only constraints and look-at targets
- Update debug visualizers (not the authoritative world)

**Avoid**
- Any authoritative game logic
- Physics mutations

**Typical systems**
- `CameraFollowSystem`
- `DebugDrawSystem` (drawing only)

---

### renderApply
**Purpose**
- Apply interpolated state to Three objects

**Input**
- `alpha` in [0..1], representing how far the render frame is between two fixed ticks

**Important note (dt vs alpha)**

For historical reasons, the engine passes `alpha` as the `dt` argument to systems
in `renderApply`. Newer systems should prefer reading `ctx.alpha` (a `SystemContext`)
instead of treating `dt` as seconds.

**Allowed**
- Read pose history buffers and interpolate
- Write `Object3D.position/quaternion/scale`
- Write instanced matrices
- Update uniforms/material params
- Run view-only animations that do not feed back into simulation

**Avoid**
- Reading input devices
- Changing simulation state
- Creating/destroying lots of Three objects per frame (prefer React lifecycle)

**Typical systems**
- `TransformApplySystem`
- `InstancedMeshApplySystem`
- `MaterialUniformSystem`

---

## Ordering Within a Phase

Systems can include an optional `order` number. Lower runs earlier.

Guidelines:
- Keep most phases with few systems; prefer composition inside a module
- Use `order` only when necessary to express dependencies
- Document cross-system dependencies in code comments

---

## Interpolation and Pose History

Because render frames and fixed steps don’t align, render should *not* directly use “current tick” transforms only.

Recommended:
- Maintain per-body/entity:
  - `prevPose`
  - `currPose`
- On each fixed tick:
  - move `currPose` → `prevPose`
  - fill new `currPose` from authoritative physics results
- On render:
  - interpolate with `alpha`

This prevents jitter and makes camera smoothing easier.

---

## Pause, Slow-Mo, Single-Step

react-three-eris should support these debug behaviors cleanly:

- **Pause**: stop accumulating dt, but allow `renderApply` (and optionally `late`) to run
- **Single-step**: run exactly one fixed tick on demand
- **Time scale**: multiply dt before accumulating (careful with networking)

These are best implemented in the scheduler, not sprinkled into systems.

---

## Common Pitfalls

- Doing authoritative gameplay in `update` (frame-rate dependent bugs)
- Calling React state setters from fixed-step systems (feedback loops)
- Mutating Three objects outside `renderApply` (hard-to-debug ordering issues)
- Using variable dt inside physics stepping (unstable results)

---

## Recommended Rule of Thumb

- If it must be correct: **fixed**
- If it depends on physics results: **postPhysicsFixed**
- If it’s just presentation: **late** or **renderApply**
- If it’s cosmetic: **update**
