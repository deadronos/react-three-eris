import { describe, expect, it } from "vitest";
import { createEngine } from "../../../packages/eris/src/eris/engine/Engine";
import {
  DEFAULT_ECS_KEY,
  createMiniplexAdapter,
  ecsSystem,
  getEcs,
  installMiniplexAdapter
} from "../../../packages/eris-ecs-miniplex-adapter/src";

describe("eris-ecs-miniplex-adapter", () => {
  it("createMiniplexAdapter uses default key and creates an ECS world", () => {
    const adapter = createMiniplexAdapter();
    expect(adapter.key).toBe(DEFAULT_ECS_KEY);
    expect(typeof (adapter.ecs as any).add).toBe("function");
    expect(typeof (adapter.ecs as any).with).toBe("function");
  });

  it("installMiniplexAdapter stores ECS world in engine.world state and returns it", () => {
    const engine = createEngine();
    const adapter = createMiniplexAdapter();

    const ecs = installMiniplexAdapter(engine, adapter);
    expect(ecs).toBe(adapter.ecs);
    expect(engine.world.get(DEFAULT_ECS_KEY)).toBe(adapter.ecs);
  });

  it("getEcs returns the installed ECS world and throws if missing", () => {
    const engine = createEngine();

    expect(() => getEcs(engine.world)).toThrow(/not installed/i);

    const adapter = createMiniplexAdapter();
    installMiniplexAdapter(engine, adapter);
    expect(getEcs(engine.world)).toBe(adapter.ecs);
  });

  it("ecsSystem runs with { world, ecs, dt } and supports custom keys", () => {
    type E = { value: number };

    const engine = createEngine();
    const adapter = createMiniplexAdapter<E>({ key: "ecs.custom" });
    installMiniplexAdapter(engine, adapter);

    adapter.ecs.add({ value: 1 });

    const sys = ecsSystem<E>({
      name: "ecs.test",
      phase: "update",
      key: "ecs.custom",
      run: ({ world, ecs, dt }) => {
        expect(world).toBe(engine.world);
        expect(ecs).toBe(adapter.ecs);
        expect(dt).toBe(0.5);

        for (const e of ecs.with("value")) e.value += 1;
      }
    });

    sys.run(engine.world, 0.5);

    const entities = [...adapter.ecs.with("value")];
    expect(entities[0]?.value).toBe(2);
  });
});
