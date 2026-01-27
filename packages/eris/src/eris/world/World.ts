import type { NetDriver } from "../net/NetDriver";
import type { PhysicsModule } from "../physics/PhysicsModule";

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

  set<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  delete(key: string): void {
    this.state.delete(key);
  }
}

