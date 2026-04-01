import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("sessions/lifecycle");

export type SessionLifecycleEvent = {
  sessionKey: string;
  reason: string;
  parentSessionKey?: string;
  label?: string;
  displayName?: string;
};

type SessionLifecycleListener = (event: SessionLifecycleEvent) => void;

const SESSION_LIFECYCLE_LISTENERS = new Set<SessionLifecycleListener>();

export function onSessionLifecycleEvent(listener: SessionLifecycleListener): () => void {
  SESSION_LIFECYCLE_LISTENERS.add(listener);
  return () => {
    SESSION_LIFECYCLE_LISTENERS.delete(listener);
  };
}

export function emitSessionLifecycleEvent(event: SessionLifecycleEvent): void {
  log.info(
    `session: ${event.reason} sessionKey=${event.sessionKey}${event.parentSessionKey ? ` parent=${event.parentSessionKey}` : ""}${event.label ? ` label=${event.label}` : ""}`,
  );
  log.debug(
    `session lifecycle: reason=${event.reason} sessionKey=${event.sessionKey} displayName=${event.displayName ?? "(none)"} listeners=${SESSION_LIFECYCLE_LISTENERS.size}`,
  );
  for (const listener of SESSION_LIFECYCLE_LISTENERS) {
    try {
      listener(event);
    } catch {
      // Best-effort, do not propagate listener errors.
    }
  }
}
