import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { Engine } from "../engine/Engine";

export function EngineLoop(props: { engine: Engine; priority?: number }) {
  const { engine, priority = 0 } = props;

  useEffect(() => {
    void engine.init();
  }, [engine]);

  useFrame((_state, delta) => {
    engine.frame(delta);
  }, priority);

  return null;
}

