# eris-ecs-miniplex-adapter (packages/eris-ecs-miniplex-adapter)

This package is an optional ECS adapter for `react-three-eris` using `miniplex`.

Goal:
- Keep `react-three-eris` ECS-agnostic
- Provide a small bridge that lets systems read/write a Miniplex world during engine phases

## Install (workspace)

```json
{
  "dependencies": {
    "eris-ecs-miniplex-adapter": "workspace:*"
  }
}
```

## Usage

```ts
import { createEngine } from "react-three-eris";
import { createMiniplexAdapter, installMiniplexAdapter, ecsSystem } from "eris-ecs-miniplex-adapter";

const engine = createEngine();
const adapter = createMiniplexAdapter();
const ecs = installMiniplexAdapter(engine, adapter);

ecs.add({ position: { x: 0, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } });

engine.registerSystem(
  ecsSystem({
    name: "ecs.move",
    phase: "fixed",
    run: ({ ecs, dt }) => {
      for (const e of ecs.with("position", "velocity")) {
        e.position.x += e.velocity.x * dt;
        e.position.y += e.velocity.y * dt;
        e.position.z += e.velocity.z * dt;
      }
    }
  })
);
```

## Notes

- The Miniplex world is stored inside the Eris `World` state map under `ecs.miniplex` by default.
- You can change the storage key via `createMiniplexAdapter({ key })` and `ecsSystem({ key })`.

## Typed keys + SystemContext

If you prefer typed access to `World.state`, you can use `DEFAULT_ECS_STATE_KEY` and
pass typed keys into `getEcs`/`ecsSystem`:

- `getEcs(world, DEFAULT_ECS_STATE_KEY)`
- `ecsSystem({ key: DEFAULT_ECS_STATE_KEY, ... })`

`ecsSystem` also forwards an optional Eris `SystemContext` to your callback as `eris`.
This is useful in `renderApply` where `dt` is actually alpha (0..1): prefer `eris.alpha`.

