import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Engine } from "../engine/Engine";

export type EngineContainerStatus = "idle" | "initializing" | "ready" | "error";

export interface EngineContainerProps {
  /** Factory used for first init and for retries (creates a fresh Engine). */
  createEngine: () => Engine;

  /** Render children only once the engine is ready. */
  children: (engine: Engine) => ReactNode;

  /** Optional loading UI (rendered while initializing). Defaults to null. */
  loading?: ReactNode;

  /**
   * Optional error UI.
   * If omitted, the component will throw the init error during render.
   */
  error?: (opts: { error: unknown; retry: () => void; engine: Engine }) => ReactNode;

  /** If false, the container will not call engine.init(). Defaults to true. */
  autoInit?: boolean;

  /** Called after a successful init. */
  onReady?: (engine: Engine) => void;
}

/**
 * React helper that owns Engine initialization and supports retry-by-recreation.
 *
 * Typical usage:
 *
 * - Create the engine via `createEngine`.
 * - Once ready, render `EngineLoop` and your scene systems.
 * - If init fails, show an error UI that can call `retry()`.
 */
export function EngineContainer(props: EngineContainerProps) {
  const { createEngine, children, loading = null, error, autoInit = true, onReady } = props;

  const [engine, setEngine] = useState<Engine>(() => createEngine());
  const [status, setStatus] = useState<EngineContainerStatus>(autoInit ? "initializing" : "idle");
  const [initError, setInitError] = useState<unknown>(null);

  const retry = useCallback(() => {
    setEngine(createEngine());
  }, [createEngine]);

  useEffect(() => {
    if (!autoInit) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("initializing");
    setInitError(null);

    void engine
      .init()
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
        onReady?.(engine);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setInitError(e);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [engine, autoInit, onReady]);

  if (status === "ready") return <>{children(engine)}</>;

  if (status === "error") {
    if (error) return <>{error({ error: initError, retry, engine })}</>;
    // Let the nearest error boundary handle it.
    throw initError;
  }

  return <>{loading}</>;
}
