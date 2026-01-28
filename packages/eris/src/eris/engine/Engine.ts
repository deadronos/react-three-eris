import { PHASE_ORDER, type Phase } from "./phases";
import type { System, SystemContext } from "./system";
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

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number (got: ${value})`);
  }
}

function assertPositiveNumber(name: string, value: number): void {
  assertFiniteNumber(name, value);
  if (value <= 0) {
    throw new Error(`${name} must be > 0 (got: ${value})`);
  }
}

function assertNonNegativeNumber(name: string, value: number): void {
  assertFiniteNumber(name, value);
  if (value < 0) {
    throw new Error(`${name} must be >= 0 (got: ${value})`);
  }
}

function assertIntegerAtLeast(name: string, value: number, min: number): void {
  assertFiniteNumber(name, value);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer (got: ${value})`);
  }
  if (value < min) {
    throw new Error(`${name} must be >= ${min} (got: ${value})`);
  }
}

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

    // Validate config early so misconfiguration doesn't create pathological stepping.
    assertPositiveNumber("Engine.fixedDt", this.fixedDt);
    assertIntegerAtLeast("Engine.maxSubSteps", this.maxSubSteps, 1);
    assertPositiveNumber("Engine.maxFrameDt", this.maxFrameDt);
    assertNonNegativeNumber("Engine.timeScale", this.timeScale);

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

    assertNonNegativeNumber("Engine.frame(frameDtSeconds)", frameDtSeconds);

    const scaled = frameDtSeconds * this.timeScale;
    const dt = Math.max(0, Math.min(scaled, this.maxFrameDt));

    this.world.now += dt;

    // Networking hooks (default: noop).
    this.world.net.pollIncoming(this.world.now);

    // 1) preFrame once
    this.runPhase("preFrame", dt, {
      phase: "preFrame",
      frameDt: dt,
      fixedDt: this.fixedDt,
      now: this.world.now,
      tick: this.world.tick
    });

    this.world.net.applyIncoming(this.world);

    // 2) fixed ticks with accumulator
    this.accumulator += dt;
    let subSteps = 0;
    while (this.accumulator >= this.fixedDt && subSteps < this.maxSubSteps) {
      this.runPhase("fixed", this.fixedDt, {
        phase: "fixed",
        frameDt: dt,
        fixedDt: this.fixedDt,
        now: this.world.now,
        tick: this.world.tick,
        subStep: subSteps
      });
      this.world.physics.step(this.fixedDt);
      this.runPhase("postPhysicsFixed", this.fixedDt, {
        phase: "postPhysicsFixed",
        frameDt: dt,
        fixedDt: this.fixedDt,
        now: this.world.now,
        tick: this.world.tick,
        subStep: subSteps
      });

      this.world.tick += 1;
      this.accumulator -= this.fixedDt;
      subSteps += 1;
    }

    // Soft-drop policy: if we hit maxSubSteps and still have >= fixedDt of debt,
    // discard the remainder so the accumulator can't grow without bound.
    let droppedTime = 0;
    if (subSteps >= this.maxSubSteps && this.accumulator > this.fixedDt) {
      droppedTime = this.accumulator - this.fixedDt;
      this.accumulator = this.fixedDt;
    }

    // 3) variable phases once
    this.runPhase("update", dt, {
      phase: "update",
      frameDt: dt,
      fixedDt: this.fixedDt,
      now: this.world.now,
      tick: this.world.tick,
      subStepsThisFrame: subSteps,
      droppedTime
    });
    this.runPhase("late", dt, {
      phase: "late",
      frameDt: dt,
      fixedDt: this.fixedDt,
      now: this.world.now,
      tick: this.world.tick,
      subStepsThisFrame: subSteps,
      droppedTime
    });

    // If we hit maxSubSteps, accumulator can still exceed fixedDt. Clamp alpha so
    // render interpolation stays in a stable [0..1] range.
    const alphaRaw = this.accumulator / this.fixedDt;
    const alpha = Math.max(0, Math.min(alphaRaw, 1));
    this.runPhase("renderApply", alpha, {
      phase: "renderApply",
      frameDt: dt,
      fixedDt: this.fixedDt,
      alpha,
      now: this.world.now,
      tick: this.world.tick,
      subStepsThisFrame: subSteps,
      droppedTime
    });

    this.world.net.collectOutgoing(this.world);
    this.world.net.flushOutgoing();
  }

  private runPhase(phase: Phase, dt: number, ctx: SystemContext): void {
    const systems = this.systemsByPhase[phase];
    for (const sys of systems) sys.run(this.world, dt, ctx);
  }
}

export function createEngine(config: EngineConfig = {}): Engine {
  return new Engine(config);
}
