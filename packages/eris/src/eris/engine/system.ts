import type { Phase } from "./phases";
import type { World } from "../world/World";

export interface System {
  name: string;
  phase: Phase;
  order?: number;
  run(world: World, dt: number): void;
}

