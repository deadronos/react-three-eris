import type { World } from "../world/World";

export interface NetDriver {
  init?(): Promise<void>;

  pollIncoming(now: number): void;
  applyIncoming(world: World): void;

  collectOutgoing(world: World): void;
  flushOutgoing(): void;
}
