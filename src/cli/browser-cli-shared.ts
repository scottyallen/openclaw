import type { GatewayRpcOpts } from "./gateway-rpc.js";
import { callGatewayFromCli } from "./gateway-rpc.js";

export type BrowserParentOpts = GatewayRpcOpts & {
  json?: boolean;
  browserProfile?: string;
};

type BrowserRequestParams = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

function normalizeQuery(query: BrowserRequestParams["query"]): Record<string, string> | undefined {
  if (!query) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

export async function callBrowserRequest<T>(
  opts: BrowserParentOpts,
  params: BrowserRequestParams,
  extra?: { timeoutMs?: number; progress?: boolean },
): Promise<T> {
  const debugBrowserCli = process.env.OPENCLAW_DEBUG_BROWSER_CLI === "1";
  const resolvedTimeoutMs =
    typeof extra?.timeoutMs === "number" && Number.isFinite(extra.timeoutMs)
      ? Math.max(1, Math.floor(extra.timeoutMs))
      : typeof opts.timeout === "string"
        ? Number.parseInt(opts.timeout, 10)
        : undefined;
  const resolvedTimeout =
    typeof resolvedTimeoutMs === "number" && Number.isFinite(resolvedTimeoutMs)
      ? resolvedTimeoutMs
      : undefined;
  const timeout = typeof resolvedTimeout === "number" ? String(resolvedTimeout) : opts.timeout;
  const requestPayload = {
    method: params.method,
    path: params.path,
    query: normalizeQuery(params.query),
    body: params.body,
    timeoutMs: resolvedTimeout,
  };
  if (debugBrowserCli) {
    // eslint-disable-next-line no-console
    console.error(
      `[browser-cli] request method=${params.method} path=${params.path} timeout=${resolvedTimeout ?? "<default>"}`,
    );
  }
  const payload = await callGatewayFromCli(
    "browser.request",
    { ...opts, timeout },
    requestPayload,
    { progress: extra?.progress },
  ).catch((error) => {
    if (debugBrowserCli) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const details =
        error && typeof error === "object" && "details" in error
          ? (error as { details?: unknown }).details
          : undefined;
      // eslint-disable-next-line no-console
      console.error(`[browser-cli] failure path=${params.path} message=${message}`);
      if (details !== undefined) {
        // eslint-disable-next-line no-console
        console.error(`[browser-cli] details=${JSON.stringify(details)}`);
      }
      if (stack) {
        // eslint-disable-next-line no-console
        console.error(stack);
      }
    }
    throw error;
  });
  if (payload === undefined) {
    throw new Error("Unexpected browser.request response");
  }
  return payload as T;
}

export async function callBrowserResize(
  opts: BrowserParentOpts,
  params: { profile?: string; width: number; height: number; targetId?: string },
  extra?: { timeoutMs?: number },
): Promise<unknown> {
  return callBrowserRequest(
    opts,
    {
      method: "POST",
      path: "/act",
      query: params.profile ? { profile: params.profile } : undefined,
      body: {
        kind: "resize",
        width: params.width,
        height: params.height,
        targetId: params.targetId?.trim() || undefined,
      },
    },
    extra,
  );
}
