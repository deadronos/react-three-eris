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
- `EngineContainer` (React helper for init + retry-by-recreation)
- `Phase`, `System`
- `SystemContext` (extra per-run metadata; includes `alpha` for renderApply)
- `World` (engine-owned world container)
- `StateKey`, `createStateKey` (typed keys for `World.state`)
- `createRapierPhysics` / `RapierPhysicsModule` (optional)
- `NoopNet`

## Runtime model

Each render frame:
1) runs `preFrame` once
2) runs 0..N fixed ticks (`fixed` -> `physics.step` -> `postPhysicsFixed`)
3) runs `update`, `late`, `renderApply` once (renderApply receives `alpha`)

The engine owns time/ordering; apps register systems instead of scattering `useFrame`.

## Stepping details (maxSubSteps + soft-drop)

Fixed stepping is driven by an accumulator. If a frame is "over budget" (dt large)
and the engine hits `maxSubSteps`, Eris uses a **soft-drop** policy:

- it runs `maxSubSteps` fixed ticks
- if there's still >= `fixedDt` of debt remaining, it discards the remainder
  so the accumulator can't grow without bound

This avoids a permanent backlog spiral while keeping interpolation (`alpha`) stable.

## dt vs alpha (renderApply)

For historical reasons, systems in `renderApply` receive **alpha** (0..1) in the
`dt` parameter.

New systems should prefer the optional third argument: `ctx: SystemContext`, and
read `ctx.alpha` explicitly.

## Typed World state keys

`World.state` is a string-keyed map for app/adapter state. To reduce accidental
key collisions and improve type safety, you can use typed keys:

- `createStateKey<T>("some.namespaced.key")`
- `world.getKey(key)` / `world.setKey(key, value)`

Recommended convention: use namespaced keys like `"pkg.feature"`.

## Engine init + retry (EngineContainer)

If you want React to own init lifecycle (and support retries when modules fail),
use `EngineContainer` with a `createEngine()` factory. Retrying recreates a fresh
engine instance.

