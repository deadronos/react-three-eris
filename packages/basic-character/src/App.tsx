import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import rapierWasmUrl from "@rapier-wasm-url";
import { createEngine, createKeyboardInput, createRapierPhysics, EngineLoop } from "react-three-eris";
import { BasicCharacterScene, registerBasicCharacterSystems } from "./scene/BasicCharacterScene";

export function App() {
  const engine = useMemo(
    () =>
      createEngine({
        fixedDt: 1 / 60,
        physics: createRapierPhysics({ wasmUrl: rapierWasmUrl })
      }),
    []
  );

  useEffect(() => {
    // Register systems once per engine instance (StrictMode can remount components in dev).
    if (!engine.world.has("basicCharacter.systemsInstalled")) {
      registerBasicCharacterSystems(engine);
      engine.world.set("basicCharacter.systemsInstalled", true);
    }

    // Input is mounted/unmounted with the React tree.
    const kb = createKeyboardInput();
    engine.world.set("input.keyboard", kb);

    // Ensure physics/net init happens even if an app forgets to mount <EngineLoop />.
    void engine.init();

    // Dev helper: inspect runtime state from the browser console.
    if (import.meta.env.DEV) {
      (window as any).__erisEngine = engine;
      (window as any).__rapierWasmUrl = rapierWasmUrl;
    }

    return () => {
      kb.dispose();
      engine.world.delete("input.keyboard");
    };
  }, [engine]);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 4, 8], fov: 50 }}
      onCreated={({ gl }) => {
        gl.setClearColor("#10131a");
      }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 8, 3]} intensity={1.1} castShadow />

      <EngineLoop engine={engine} />
      <BasicCharacterScene engine={engine} />
    </Canvas>
  );
}
