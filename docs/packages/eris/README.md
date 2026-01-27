# react-three-eris (packages/eris)

react-three-eris is a small "runtime kernel" for React Three Fiber apps.

It provides:
- An engine-like fixed-step scheduler (phases + stable ordering)
- Manual/authoritative physics stepping (Rapier optional)
- A single React adapter component (`EngineLoop`) to bridge R3F render frames to the engine
- Networking hooks (noop by default)

## Install (workspace)

This repo uses a pnpm workspace. Apps depend on:

```json
{
  "dependencies": {
    "react-three-eris": "workspace:*"
  }
}
```

## Public API (high level)

- `createEngine`, `Engine`
- `EngineLoop` (R3F adapter)
- `Phase`, `System`
- `World` (engine-owned world container)
- `createRapierPhysics` / `RapierPhysicsModule` (optional)
- `NoopNet`

## Runtime model

Each render frame:
1) runs `preFrame` once
2) runs 0..N fixed ticks (`fixed` -> `physics.step` -> `postPhysicsFixed`)
3) runs `update`, `late`, `renderApply` once (renderApply receives `alpha`)

The engine owns time/ordering; apps register systems instead of scattering `useFrame`.

