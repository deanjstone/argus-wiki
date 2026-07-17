import { describe, expect, test } from "vitest";
import {
  buildHookSettings,
  getEffectiveModelId,
  shellQuote,
} from "../src/agent/claude-cli/claude-cli-backend.ts";

describe("buildHookSettings", () => {
  test("wires a PreToolUse hook matching Write and Edit", () => {
    const settings = buildHookSettings("/home/deanj/projects/argus-wiki");
    const [entry] = settings.hooks.PreToolUse;

    expect(entry.matcher).toBe("Write|Edit");
    expect(entry.hooks).toHaveLength(1);
    expect(entry.hooks[0].type).toBe("command");
    expect(entry.hooks[0].command).toContain("CLAUDE_CLI_REPO_ROOT=");
    expect(entry.hooks[0].command).toContain(
      "'/home/deanj/projects/argus-wiki'",
    );
    expect(entry.hooks[0].command).toContain("write-guard-hook.js");
  });

  test("shell-quotes a repo root containing a single quote", () => {
    const settings = buildHookSettings("/tmp/o'brien");
    const command = settings.hooks.PreToolUse[0].hooks[0].command;

    expect(command).toContain("'/tmp/o'\\''brien'");
  });
});

describe("shellQuote", () => {
  test("wraps plain values in single quotes", () => {
    expect(shellQuote("/tmp/foo")).toBe("'/tmp/foo'");
  });

  test("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

describe("getEffectiveModelId", () => {
  test("returns the first modelUsage key when present", () => {
    const modelId = getEffectiveModelId({
      modelUsage: { "claude-sonnet-5": { inputTokens: 10 } },
    });
    expect(modelId).toBe("claude-sonnet-5");
  });

  test("falls back to the claude-cli label when modelUsage is absent", () => {
    expect(getEffectiveModelId({})).toBe("claude-cli");
  });

  test("falls back to the claude-cli label when modelUsage is empty", () => {
    expect(getEffectiveModelId({ modelUsage: {} })).toBe("claude-cli");
  });
});
