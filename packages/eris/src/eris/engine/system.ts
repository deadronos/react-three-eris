import type { Phase } from "./phases";
import type { World } from "../world/World";

export interface SystemContext {
  /** The phase currently being executed. */
  phase: Phase;

  /** Variable frame dt (seconds), after timeScale + maxFrameDt clamping. */
  frameDt: number;

  /** Engine fixed timestep (seconds). */
  fixedDt: number;

  /** Interpolation alpha in [0..1]. Only meaningful during `renderApply`. */
  alpha?: number;

  /** World clock time (seconds). */
  now: number;

  /** Current fixed tick index. */
  tick: number;

  /** Which fixed sub-step we are on (0..N-1). Only set in fixed-step phases. */
  subStep?: number;

  /** Number of fixed sub-steps executed this render frame (set after fixed stepping). */
  subStepsThisFrame?: number;

  /** Amount of accumulated time discarded due to maxSubSteps (seconds). */
  droppedTime?: number;
}

export interface System {
  name: string;
  phase: Phase;
  order?: number;
  /**
   * Execute the system.
   *
   * Note: for historical reasons, `dt` means **alpha** during `renderApply`.
   * Prefer reading `ctx.alpha` when available.
   */
  run(world: World, dt: number, ctx?: SystemContext): void;
}

