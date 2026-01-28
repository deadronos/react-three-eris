import { World as MiniWorld } from "miniplex";
import type { Engine, Phase, System, SystemContext, World as ErisWorld, StateKey } from "react-three-eris";

export const DEFAULT_ECS_KEY = "ecs.miniplex" as const;

/**
 * Typed convenience key for `World.state`.
 *
 * This is optional sugar: the runtime storage key is still `DEFAULT_ECS_KEY`.
 */
export const DEFAULT_ECS_STATE_KEY: StateKey<MiniWorld<any>> = { key: DEFAULT_ECS_KEY } as any;

export type MiniplexEntity = Record<string, unknown>;

export interface MiniplexAdapter<E extends MiniplexEntity = MiniplexEntity> {
  key: string;
  ecs: MiniWorld<E>;
}

export function createMiniplexAdapter<E extends MiniplexEntity = MiniplexEntity>(
  opts?: { key?: string; ecs?: MiniWorld<E> }
): MiniplexAdapter<E> {
  return {
    key: opts?.key ?? DEFAULT_ECS_KEY,
    ecs: opts?.ecs ?? new MiniWorld<E>()
  };
}

export function installMiniplexAdapter<E extends MiniplexEntity>(
  engine: Engine,
  adapter: MiniplexAdapter<E>
): MiniWorld<E> {
  engine.world.set(adapter.key, adapter.ecs);
  return adapter.ecs;
}

export function getEcs<E extends MiniplexEntity = MiniplexEntity>(
  world: ErisWorld,
  key: string | StateKey<MiniWorld<E>> = DEFAULT_ECS_KEY
): MiniWorld<E> {
  const keyString = typeof key === "string" ? key : key.key;
  const ecs = world.get<MiniWorld<E>>(keyString);
  if (ecs === undefined) {
    throw new Error(`Miniplex ECS world not installed (missing key: ${keyString})`);
  }
  return ecs;
}

export function ecsSystem<E extends MiniplexEntity>(opts: {
  name: string;
  phase: Phase;
  order?: number;
  key?: string | StateKey<MiniWorld<E>>;
  run(ctx: { world: ErisWorld; ecs: MiniWorld<E>; dt: number; eris?: SystemContext }): void;
}): System {
  const key = opts.key ?? DEFAULT_ECS_KEY;

  return {
    name: opts.name,
    phase: opts.phase,
    order: opts.order,
    run(world, dt, eris) {
      const ecs = getEcs<E>(world, key);
      opts.run({ world, ecs, dt, eris });
    }
  };
}

