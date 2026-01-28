import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import rapierWasmUrl from "@rapier-wasm-url";
import {
  createEngine,
  createKeyboardInput,
  createRapierPhysics,
  EngineLoop,
  type Engine
} from "react-three-eris";
import { PinballMicroScene, registerPinballMicroSystems, type PinballGameState } from "./scene/PinballMicroScene";

type HudState = {
  mode: PinballGameState["mode"];
  score: number;
  ballsRemaining: number;
  plungerCharge: number;
};

function readHud(engine: Engine): HudState {
  const game = engine.world.get<PinballGameState>("pinball.game");
  return {
    mode: game?.mode ?? "ready",
    score: game?.score ?? 0,
    ballsRemaining: game?.ballsRemaining ?? 3,
    plungerCharge: game?.plungerCharge ?? 0
  };
}

export function App() {
  const engine = useMemo(
    () =>
      createEngine({
        fixedDt: 1 / 60,
        physics: createRapierPhysics({
          // Tilt the world slightly along +Z so the ball naturally drifts toward the drain.
          gravity: { x: 0, y: -9.81, z: 2.5 },
          wasmUrl: rapierWasmUrl
        })
      }),
    []
  );

  const [hud, setHud] = useState<HudState>(() => readHud(engine));
  const prevHud = useRef<string>(JSON.stringify(hud));

  useEffect(() => {
    // Register systems once per engine instance (StrictMode can remount components in dev).
    if (!engine.world.has("pinball.systemsInstalled")) {
      registerPinballMicroSystems(engine);
      engine.world.set("pinball.systemsInstalled", true);
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

    // HUD refresh loop (low frequency; no fancy store subscription needed for this example).
    const id = window.setInterval(() => {
      const next = readHud(engine);
      const json = JSON.stringify(next);
      if (json !== prevHud.current) {
        prevHud.current = json;
        setHud(next);
      }
    }, 100);

    return () => {
      window.clearInterval(id);
      kb.dispose();
      engine.world.delete("input.keyboard");
    };
  }, [engine]);

  return (
    <div className="pinballRoot">
      <Canvas
        shadows
        camera={{ position: [0, 7, 10], fov: 55 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0b0f17");
        }}
        className="pinballCanvas"
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[6, 10, 4]} intensity={1.15} castShadow />

        <EngineLoop engine={engine} />
        <PinballMicroScene engine={engine} />
      </Canvas>

      <div className="pinballHud">
        <div className="pinballHud__row">
          <div>
            <div className="pinballHud__label">Score</div>
            <div className="pinballHud__value">{hud.score}</div>
          </div>
          <div>
            <div className="pinballHud__label">Balls</div>
            <div className="pinballHud__value">{hud.ballsRemaining}</div>
          </div>
        </div>

        <div className="pinballHud__hint">
          {hud.mode === "gameOver" ? (
            <div>
              <div className="pinballHud__strong">Game Over</div>
              <div>Press R to reset</div>
            </div>
          ) : hud.mode === "ready" ? (
            <div>Hold Space to charge, release to launch</div>
          ) : (
            <div>Flippers: Z/← and / /→</div>
          )}
        </div>

        <div className="pinballHud__plunger">
          <div className="pinballHud__plungerTop">
            <span>Plunger</span>
            <span>{Math.round(hud.plungerCharge * 100)}%</span>
          </div>
          <progress className="pinballHud__progress" value={hud.plungerCharge} max={1} />
        </div>
      </div>
    </div>
  );
}
