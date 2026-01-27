# basic-character (packages/basic-character)

Example app that consumes `react-three-eris` in a fully separate Vite + React Three Fiber project.

It demonstrates:
- Registering systems instead of using `useFrame` for simulation
- Fixed-step movement intent (WASD)
- A minimal Rapier setup with manual stepping controlled by the engine

## Run

From repo root:

```sh
pnpm install
pnpm dev
```

## Structure

- `src/App.tsx`: creates the engine, registers systems, mounts `<EngineLoop />` once
- `src/scene/BasicCharacterScene.tsx`: sets up the scene + a kinematic player body

