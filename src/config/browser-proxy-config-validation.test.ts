import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("browser proxy config validation", () => {
  it("accepts gateway.nodes.browser config alongside valid channel streaming enums", () => {
    const res = validateConfigObject({
      gateway: { nodes: { browser: { mode: "auto", node: "node-123" } } },
      channels: {
        slack: { streaming: "progress" },
        telegram: { streaming: "progress" },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects slack account execApprovals because it is not an account-level field", () => {
    const res = validateConfigObject({
      channels: {
        slack: {
          accounts: {
            cto: {
              execApprovals: { enabled: true },
            },
          },
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.some((issue) => issue.path === "channels.slack.accounts.cto")).toBe(true);
    }
  });
});
