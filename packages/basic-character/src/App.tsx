import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { createEngine, createKeyboardInput, createRapierPhysics, EngineLoop } from "react-three-eris";
import { BasicCharacterScene, registerBasicCharacterSystems } from "./scene/BasicCharacterScene";

export function App() {
  const engine = useMemo(() => {
    const e = createEngine({
      fixedDt: 1 / 60,
      physics: createRapierPhysics()
    });

    // Input lives in preFrame, but the event listeners are created once.
    e.world.set("input.keyboard", createKeyboardInput());

    registerBasicCharacterSystems(e);
    return e;
  }, []);

  useEffect(() => {
    const kb = engine.world.get<ReturnType<typeof createKeyboardInput>>("input.keyboard");
    return () => kb?.dispose();
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

