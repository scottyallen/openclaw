import type { Command } from "commander";
import { callGateway } from "../gateway/call.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../utils/message-channel.js";
import { withProgress } from "./progress.js";

export type GatewayRpcOpts = {
  url?: string;
  token?: string;
  timeout?: string;
  expectFinal?: boolean;
  json?: boolean;
};

export function addGatewayClientOptions(cmd: Command) {
  return cmd
    .option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)")
    .option("--token <token>", "Gateway token (if required)")
    .option("--timeout <ms>", "Timeout in ms", "30000")
    .option("--expect-final", "Wait for final response (agent)", false);
}

export async function callGatewayFromCli(
  method: string,
  opts: GatewayRpcOpts,
  params?: unknown,
  extra?: { expectFinal?: boolean; progress?: boolean },
) {
  const showProgress = extra?.progress ?? opts.json !== true;
  const debugCliGateway = process.env.OPENCLAW_DEBUG_CLI_GATEWAY === "1";
  if (debugCliGateway) {
    const tokenPreview =
      typeof opts.token === "string" && opts.token.trim().length > 0
        ? `${opts.token.trim().slice(0, 6)}…${opts.token.trim().slice(-4)}`
        : undefined;
    // eslint-disable-next-line no-console
    console.error(
      `[cli-gateway] call method=${method} url=${opts.url ?? "<default>"} timeout=${opts.timeout ?? "<default>"} expectFinal=${String(extra?.expectFinal ?? Boolean(opts.expectFinal))}${tokenPreview ? ` token=${tokenPreview}` : ""}`,
    );
  }
  return await withProgress(
    {
      label: `Gateway ${method}`,
      indeterminate: true,
      enabled: showProgress,
    },
    async () => {
      try {
        return await callGateway({
          url: opts.url,
          token: opts.token,
          method,
          params,
          expectFinal: extra?.expectFinal ?? Boolean(opts.expectFinal),
          timeoutMs: Number(opts.timeout ?? 10_000),
          clientName: GATEWAY_CLIENT_NAMES.CLI,
          mode: GATEWAY_CLIENT_MODES.CLI,
        });
      } catch (error) {
        if (debugCliGateway) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          const details =
            error && typeof error === "object" && "details" in error
              ? (error as { details?: unknown }).details
              : undefined;
          // eslint-disable-next-line no-console
          console.error(`[cli-gateway] failure method=${method} message=${message}`);
          if (details !== undefined) {
            // eslint-disable-next-line no-console
            console.error(`[cli-gateway] details=${JSON.stringify(details)}`);
          }
          if (stack) {
            // eslint-disable-next-line no-console
            console.error(stack);
          }
        }
        throw error;
      }
    },
  );
}
