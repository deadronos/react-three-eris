import { PHASE_ORDER, type Phase } from "./phases";
import type { System } from "./system";
import { World } from "../world/World";
import { NoopNet } from "../net/NoopNet";
import type { NetDriver } from "../net/NetDriver";
import { NoopPhysics } from "../physics/NoopPhysics";
import type { PhysicsModule } from "../physics/PhysicsModule";

export interface EngineConfig {
  fixedDt?: number;
  maxSubSteps?: number;
  maxFrameDt?: number;
  timeScale?: number;
  net?: NetDriver;
  physics?: PhysicsModule;
}

type PhaseSystems = Record<Phase, System[]>;

function makePhaseMap(): PhaseSystems {
  return {
    preFrame: [],
    fixed: [],
    postPhysicsFixed: [],
    update: [],
    late: [],
    renderApply: []
  };
}

function sortSystems(systems: System[]): void {
  systems.sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

export class Engine {
  readonly fixedDt: number;
  readonly maxSubSteps: number;
  readonly maxFrameDt: number;
  timeScale: number;

  readonly world: World;

  private accumulator = 0;
  private systemsByPhase: PhaseSystems = makePhaseMap();

  private _ready = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: EngineConfig = {}) {
    this.fixedDt = config.fixedDt ?? 1 / 60;
    this.maxSubSteps = config.maxSubSteps ?? 5;
    this.maxFrameDt = config.maxFrameDt ?? 0.25;
    this.timeScale = config.timeScale ?? 1;

    const physics = config.physics ?? NoopPhysics;
    const net = config.net ?? NoopNet;

    this.world = new World({ fixedDt: this.fixedDt, physics, net });
  }

  get ready(): boolean {
    return this._ready;
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.world.physics.init) await this.world.physics.init();
      if (this.world.net.init) await this.world.net.init();
      this._ready = true;
    })();

    return this.initPromise;
  }

  registerSystem(system: System): void {
    const list = this.systemsByPhase[system.phase];
    if (list.some((s) => s.name === system.name)) {
      throw new Error(`System name already registered: ${system.name}`);
    }
    list.push(system);
    sortSystems(list);
  }

  registerSystems(systems: readonly System[]): void {
    for (const s of systems) this.registerSystem(s);
  }

  /**
   * Drive one render-frame worth of work.
   *
   * - Runs `preFrame` once
   * - Runs 0..N fixed ticks (fixed -> physics.step -> postPhysicsFixed)
   * - Runs `update`, `late`, `renderApply` once
   *
   * Note: `renderApply` receives `alpha` (0..1) in the `dt` parameter.
   */
  frame(frameDtSeconds: number): void {
    if (!this._ready) return;

    const scaled = frameDtSeconds * this.timeScale;
    const dt = Math.max(0, Math.min(scaled, this.maxFrameDt));

    this.world.now += dt;

    // Networking hooks (default: noop).
    this.world.net.pollIncoming(this.world.now);

    // 1) preFrame once
    this.runPhase("preFrame", dt);

    this.world.net.applyIncoming(this.world);

    // 2) fixed ticks with accumulator
    this.accumulator += dt;
    let subSteps = 0;
    while (this.accumulator >= this.fixedDt && subSteps < this.maxSubSteps) {
      this.runPhase("fixed", this.fixedDt);
      this.world.physics.step(this.fixedDt);
      this.runPhase("postPhysicsFixed", this.fixedDt);

      this.world.tick += 1;
      this.accumulator -= this.fixedDt;
      subSteps += 1;
    }

    // 3) variable phases once
    this.runPhase("update", dt);
    this.runPhase("late", dt);

    // If we hit maxSubSteps, accumulator can still exceed fixedDt. Clamp alpha so
    // render interpolation stays in a stable [0..1] range.
    const alphaRaw = this.fixedDt > 0 ? this.accumulator / this.fixedDt : 0;
    const alpha = Math.max(0, Math.min(alphaRaw, 1));
    this.runPhase("renderApply", alpha);

    this.world.net.collectOutgoing(this.world);
    this.world.net.flushOutgoing();
  }

  private runPhase(phase: Phase, dt: number): void {
    const systems = this.systemsByPhase[phase];
    for (const sys of systems) sys.run(this.world, dt);
  }
}

export function createEngine(config: EngineConfig = {}): Engine {
  return new Engine(config);
}
