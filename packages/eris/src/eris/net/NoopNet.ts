import type { NetDriver } from "./NetDriver";

export const NoopNet: NetDriver = {
  pollIncoming() {},
  applyIncoming() {},
  collectOutgoing() {},
  flushOutgoing() {}
};
