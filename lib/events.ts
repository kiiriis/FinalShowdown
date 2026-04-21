import { EventEmitter } from "node:events";

export type ChangeEvent = {
  type: "job.created" | "job.updated" | "job.deleted" | "entry.updated";
  actorId?: string;
  ts: number;
};

declare global {
  var __fsEmitter: EventEmitter | undefined;
}

export const emitter =
  globalThis.__fsEmitter ??
  (globalThis.__fsEmitter = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(50);
    return e;
  })());

export function emitChange(
  type: ChangeEvent["type"],
  actorId?: string,
): void {
  const payload: ChangeEvent = { type, actorId, ts: Date.now() };
  emitter.emit("change", payload);
}
