import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadConfigMock, isNodeCommandAllowedMock, resolveNodeCommandAllowlistMock } = vi.hoisted(
  () => ({
    loadConfigMock: vi.fn(),
    isNodeCommandAllowedMock: vi.fn(),
    resolveNodeCommandAllowlistMock: vi.fn(),
  }),
);

vi.mock("../../config/config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("../node-command-policy.js", () => ({
  isNodeCommandAllowed: isNodeCommandAllowedMock,
  resolveNodeCommandAllowlist: resolveNodeCommandAllowlistMock,
}));

import { browserHandlers } from "./browser.js";

type RespondCall = [boolean, unknown?, { code: number; message: string }?];

function createContext() {
  const invoke = vi.fn(
    async (): Promise<{
      ok: boolean;
      payload?: { result: { ok: boolean } };
      error?: { code?: string; message?: string; details?: unknown };
    }> => ({
      ok: true,
      payload: {
        result: { ok: true },
      },
    }),
  );
  const listConnected = vi.fn(() => [
    {
      nodeId: "node-1",
      caps: ["browser"],
      commands: ["browser.proxy"],
      platform: "linux",
    },
  ]);
  return {
    invoke,
    listConnected,
  };
}

async function runBrowserRequest(params: Record<string, unknown>) {
  const respond = vi.fn();
  const nodeRegistry = createContext();
  await browserHandlers["browser.request"]({
    params,
    respond: respond as never,
    context: { nodeRegistry } as never,
    client: null,
    req: { type: "req", id: "req-1", method: "browser.request" },
    isWebchatConnect: () => false,
  });
  return { respond, nodeRegistry };
}

describe("browser.request profile selection", () => {
  beforeEach(() => {
    loadConfigMock.mockReturnValue({
      gateway: { nodes: { browser: { mode: "auto" } } },
    });
    resolveNodeCommandAllowlistMock.mockReturnValue([]);
    isNodeCommandAllowedMock.mockReturnValue({ ok: true });
  });

  it("uses profile from request body when query profile is missing", async () => {
    const { respond, nodeRegistry } = await runBrowserRequest({
      method: "POST",
      path: "/act",
      body: { profile: "work", request: { action: "click", ref: "btn1" } },
    });

    expect(nodeRegistry.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "browser.proxy",
        params: expect.objectContaining({
          profile: "work",
        }),
      }),
    );
    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(true);
  });

  it("prefers query profile over body profile when both are present", async () => {
    const { nodeRegistry } = await runBrowserRequest({
      method: "POST",
      path: "/act",
      query: { profile: "chrome" },
      body: { profile: "work", request: { action: "click", ref: "btn1" } },
    });

    expect(nodeRegistry.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          profile: "chrome",
        }),
      }),
    );
  });

  it("returns nested node error details when browser proxy invoke fails", async () => {
    const { respond, nodeRegistry } = await runBrowserRequest({
      method: "GET",
      path: "/",
    });
    nodeRegistry.invoke.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "browser proxy timed out",
        details: {
          stage: "transport",
          status: { running: true, cdpReady: false },
        },
      },
    });

    await browserHandlers["browser.request"]({
      params: { method: "GET", path: "/" },
      respond: respond as never,
      context: { nodeRegistry } as never,
      client: null,
      req: { type: "req", id: "req-2", method: "browser.request" },
      isWebchatConnect: () => false,
    });

    expect(respond).toHaveBeenLastCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        message: "UNAVAILABLE: browser proxy timed out",
        details: expect.objectContaining({
          nodeErrorDetails: {
            stage: "transport",
            status: { running: true, cdpReady: false },
          },
        }),
      }),
    );
  });

  it.each([
    {
      method: "POST",
      path: "/profiles/create",
      body: { name: "poc", cdpUrl: "http://10.0.0.42:9222" },
    },
    {
      method: "DELETE",
      path: "/profiles/poc",
      body: undefined,
    },
    {
      method: "POST",
      path: "profiles/create",
      body: { name: "poc", cdpUrl: "http://10.0.0.42:9222" },
    },
    {
      method: "DELETE",
      path: "profiles/poc",
      body: undefined,
    },
  ])("blocks persistent profile mutations for $method $path", async ({ method, path, body }) => {
    const { respond, nodeRegistry } = await runBrowserRequest({
      method,
      path,
      body,
    });

    expect(nodeRegistry.invoke).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: "browser.request cannot create or delete persistent browser profiles",
      }),
    );
  });
});
