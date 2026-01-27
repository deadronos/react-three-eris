import type { PhysicsModule } from "./PhysicsModule";

export const NoopPhysics: PhysicsModule = {
  step() {}
};

