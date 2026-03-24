import { diagnosticLogger as diag } from "../../logging/diagnostic.js";
import type { QueueSettings } from "./queue.js";

export type ActiveRunQueueAction = "run-now" | "enqueue-followup" | "drop";

export function resolveActiveRunQueueAction(params: {
  isActive: boolean;
  isHeartbeat: boolean;
  shouldFollowup: boolean;
  queueMode: QueueSettings["mode"];
}): ActiveRunQueueAction {
  let result: ActiveRunQueueAction;
  if (!params.isActive) {
    result = "run-now";
  } else if (params.isHeartbeat) {
    result = "drop";
  } else if (params.shouldFollowup || params.queueMode === "steer") {
    result = "enqueue-followup";
  } else {
    result = "run-now";
  }
  diag.info(
    `[queue-policy] isActive=${params.isActive} isHeartbeat=${params.isHeartbeat} shouldFollowup=${params.shouldFollowup} queueMode=${params.queueMode} → action=${result}`,
  );
  return result;
}
