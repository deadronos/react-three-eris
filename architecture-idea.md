# react-three-eris – Architecture Idea

This document outlines the proposed monorepo architecture, goals, and core concepts for **react-three-eris**.

---

## Goals

- Provide a small, engine-like orchestration layer for React Three Fiber
- Own time, ordering, fixed-step simulation, and physics stepping
- Be physics-authoritative by default (Rapier stepped manually)
- Allow applications to *subscribe systems* instead of scattering `useFrame`
- Keep networking planned but noop by default
- Remain framework-light, ECS-friendly, and library-oriented

---

## Monorepo Layout (pnpm workspace)

```
react-three-eris/
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json

  packages/
    eris/                     # Library package
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        eris/
          index.ts
          engine/
          react/
          world/
          physics/
          input/
          render/
          net/

    basic-character/           # Example app (fully separate)
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        main.tsx
        App.tsx
        scene/
          BasicCharacterScene.tsx
```

---

## Package Responsibilities

### `packages/eris` (react-three-eris)

The reusable library.

**Exports**
- `createEngine`
- `EngineLoop` (R3F adapter)
- `System`, `Phase` types
- `NoopNet`

**Does**
- Own the game loop and scheduler
- Step Rapier explicitly
- Coordinate phases
- Provide extension points (systems, net driver)

**Does NOT**
- Own scene graph
- Own UI or React state
- Enforce ECS

---

### `packages/basic-character`

A real example app consuming the library via:

```
"react-three-eris": "workspace:*"
```

- Demonstrates character controller style movement
- Has its own Vite, React, Three setup
- Uses `<EngineLoop />` once

---

## Core Concepts

### Phases

```ts
type Phase =
  | "preFrame"          // input, net poll
  | "fixed"             // gameplay intent + forces
  | "postPhysicsFixed"  // collisions, triggers
  | "update"            // variable-rate systems
  | "late"              // camera, smoothing
  | "renderApply";      // write to Three
```

Systems subscribe to exactly one phase.

---

### Systems

```ts
interface System {
  name: string;
  phase: Phase;
  order?: number;
  run(world: World, dt: number): void;
}
```

Apps register systems; the engine controls execution order.

---

### Engine Runtime (Framework-agnostic)

- Fixed timestep accumulator
- Deterministic ordering
- Physics stepped inside fixed loop
- Networking hooks exist but default to noop

React is **not** involved here.

---

### React Adapter (`EngineLoop`)

- Single R3F hook-in
- Uses `useFrame` priorities
- Bridges R3F render frames to the engine runtime

Apps never call `useFrame` for simulation.

---

## Physics Model (Authoritative)

- Rapier `World` is owned by the engine
- `integrationParameters.dt` is set manually
- Physics is stepped explicitly inside fixed loop
- Gameplay writes *intent* (forces, impulses)
- Physics produces authoritative poses

---

## Character Controller Style

- Player characters are kinematic
- Driven by intent → velocity → KinematicCharacterController resolution
- Dynamic bodies remain fully simulated
- Collisions and grounding resolved post-physics

This enables:
- Stable movement
- Smooth camera
- Future rollback / reconciliation

---

## Networking (Planned)

```ts
interface NetDriver {
  pollIncoming(now: number): void;
  applyIncoming(world: World): void;
  collectOutgoing(world: World): void;
  flushOutgoing(): void;
}
```

Default: `NoopNet`

Later: swap in WebSocket / WebRTC / server authority without changing the loop.

---

## Naming

**react-three-eris**
- React integration layer
- Three is the renderer, not the owner
- Eris represents orchestration and ordering

---

## Non-goals

- No scene abstraction
- No opinionated ECS
- No React state replacement
- No automatic networking

---

## Summary

react-three-eris provides a clean, explicit boundary between:

- **Simulation**
- **Physics**
- **Rendering**
- **React**

It enables engine-style structure in R3F apps while remaining small, composable, and future-proof.
