import type { NetDriver } from "../net/NetDriver";
import type { PhysicsModule } from "../physics/PhysicsModule";

/**
 * A typed key for `World.state`.
 *
 * This keeps runtime storage debuggable (string keys) while giving TypeScript
 * a way to associate a value type with a particular key.
 */
export type StateKey<T> = { readonly key: string } & { readonly __stateKeyBrand?: T };

export function createStateKey<T>(key: string): StateKey<T> {
  return { key } as StateKey<T>;
}

export class World {
  tick = 0;
  now = 0;
  readonly fixedDt: number;

  readonly physics: PhysicsModule;
  readonly net: NetDriver;

  readonly state = new Map<string, unknown>();

  constructor(opts: { fixedDt: number; physics: PhysicsModule; net: NetDriver }) {
    this.fixedDt = opts.fixedDt;
    this.physics = opts.physics;
    this.net = opts.net;
  }

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  getKey<T>(key: StateKey<T>): T | undefined {
    return this.get<T>(key.key);
  }

  set<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  setKey<T>(key: StateKey<T>, value: T): void {
    this.set(key.key, value);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  hasKey(key: StateKey<unknown>): boolean {
    return this.has(key.key);
  }

  delete(key: string): void {
    this.state.delete(key);
  }

  deleteKey(key: StateKey<unknown>): void {
    this.delete(key.key);
  }
}

