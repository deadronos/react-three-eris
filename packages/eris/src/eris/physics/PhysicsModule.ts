export interface PhysicsModule {
  init?(): Promise<void>;
  step(dt: number): void;
}

