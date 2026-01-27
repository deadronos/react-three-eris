export type Phase =
  | "preFrame"
  | "fixed"
  | "postPhysicsFixed"
  | "update"
  | "late"
  | "renderApply";

export const PHASE_ORDER: readonly Phase[] = [
  "preFrame",
  "fixed",
  "postPhysicsFixed",
  "update",
  "late",
  "renderApply"
] as const;

