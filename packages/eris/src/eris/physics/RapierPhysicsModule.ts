import type { PhysicsModule } from "./PhysicsModule";

export type Vec3 = { x: number; y: number; z: number };
export type RapierModule = typeof import("@dimforge/rapier3d-compat");

export class RapierPhysicsModule implements PhysicsModule {
  readonly kind = "rapier" as const;

  readonly gravity: Vec3;
  private readonly loader: () => Promise<unknown>;
  rapier: RapierModule | null = null;
  world: unknown = null;

  constructor(opts?: { gravity?: Vec3; loader?: () => Promise<unknown> }) {
    this.gravity = opts?.gravity ?? { x: 0, y: -9.81, z: 0 };
    this.loader =
      opts?.loader ??
      (async () => {
        return import("@dimforge/rapier3d-compat");
      });
  }

  async init(): Promise<void> {
    if (this.rapier) return;

    const ns = (await this.loader()) as unknown as RapierModule;
    const api: any = (ns as any).default ?? ns;

    // rapier3d-compat exposes an async init() in most environments; keep this defensive.
    const initFn = (api as { init?: () => Promise<void> }).init ?? (ns as any).init;
    if (initFn) await initFn();

    this.rapier = api as RapierModule;
    this.world = new (api as any).World(this.gravity);
  }

  step(dt: number): void {
    if (!this.world) return;

    const w: any = this.world;
    if (w.integrationParameters) w.integrationParameters.dt = dt;
    if (typeof w.step === "function") w.step();
  }
}

export function createRapierPhysics(opts?: { gravity?: Vec3 }): RapierPhysicsModule {
  return new RapierPhysicsModule(opts);
}
