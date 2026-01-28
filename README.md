# react-three-eris

An engine-like runtime kernel for React Three Fiber (R3F).

react-three-eris exists because many R3F apps eventually want "game engine" structure:
- deterministic ordering (no scattered `useFrame` calls)
- fixed-step simulation for authoritative gameplay
- explicit, manually-stepped physics (Rapier)
- clear boundaries between simulation, physics, rendering, and React

This repo is a pnpm workspace monorepo with a small core library plus optional adapters and example apps.

## Rationale

R3F is an excellent renderer and scene authoring layer, but it is not an engine loop.
If every feature owns its own `useFrame`, you tend to get:
- unpredictable ordering issues ("why is the camera one frame behind?")
- mixed fixed/variable timestep logic
- physics stepping that depends on render framerate
- hard-to-debug feedback loops between React state and simulation

react-three-eris puts a minimal orchestration layer around R3F:
- the engine owns time and phase ordering
- apps register systems to phases
- React mounts a single adapter component (`EngineLoop`) to drive the engine
- physics is stepped manually inside the fixed loop (physics-authoritative by default)

It stays "framework-light": no scene graph ownership, no UI opinion, no enforced ECS.

## Packages

### `packages/eris` (published name: `react-three-eris`)

The reusable library:
- `createEngine` / `Engine`: fixed-step scheduler, phase ordering, net hooks
- `Phase`, `System` types
- `EngineLoop`: React Three Fiber adapter (one hook-in)
- Physics module boundary with a Rapier implementation (optional)
- Net driver boundary with a noop default (planned for future networking)

Core idea: systems subscribe to exactly one phase:
- `preFrame`: input/net polling, command buffering
- `fixed`: authoritative gameplay step (fixed dt)
- `postPhysicsFixed`: interpret contacts/triggers after stepping physics
- `update`: variable-rate non-authoritative systems
- `late`: camera/presentation smoothing
- `renderApply`: write to Three objects (receives `alpha` for interpolation)

### `packages/eris-ecs-miniplex-adapter`

An optional ECS adapter for `react-three-eris` using `miniplex`.

Rationale:
- keep the core engine ECS-agnostic
- provide a small bridge for teams that want a lightweight ECS without rewriting the loop

### `packages/basic-character`

Example app (separate Vite + React + R3F project) that consumes the library via `workspace:*`.

Demonstrates:
- registering systems instead of `useFrame` for simulation
- fixed-step movement intent (WASD)
- minimal Rapier setup under engine ownership

## Repo Layout

```
react-three-eris/
  packages/
    eris/
    eris-ecs-miniplex-adapter/
    basic-character/
  tests/
  docs/
```

Package-specific docs live in `docs/packages/*`.

## Getting Started

Requirements:
- Node.js (recent)
- pnpm (see `package.json` "packageManager")

Install:

```sh
pnpm install
```

Run the example:

```sh
pnpm dev
```

Typecheck:

```sh
pnpm typecheck
```

Run tests (Vitest):

```sh
pnpm test
```

## Project Status

This is early-stage and intentionally minimal.
The goal is a solid runtime boundary and phase model that can scale up (netcode, rollback, tooling)
without turning the library into a full engine.

