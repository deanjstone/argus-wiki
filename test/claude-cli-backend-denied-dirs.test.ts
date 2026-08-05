import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// OPEN_WIKI_DENIED_DIRS (src/constants.ts) is a module-level const computed
// from process.env.OPENWIKI_DENIED_PATHS at import time, same constraint as
// test/env-behavior.test.ts documents for openWikiEnvPath: the env var must
// be set before the module graph loads, so this needs vi.resetModules() +
// a dynamic import rather than the static import the rest of
// claude-cli-backend.test.ts uses.

type BackendModule = typeof import("../src/agent/claude-cli/claude-cli-backend.ts");

const ENV_KEY = "OPENWIKI_DENIED_PATHS";
let original: string | undefined;

beforeEach(() => {
  original = process.env[ENV_KEY];
});

afterEach(() => {
  vi.resetModules();
  if (original === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = original;
  }
});

describe("buildHookSettings with OPENWIKI_DENIED_PATHS set", () => {
  test("includes a joined CLAUDE_CLI_DENIED_DIRS env assignment in the hook command", async () => {
    vi.resetModules();
    process.env[ENV_KEY] = "02.MEMORY, MEMORY.md";
    const { buildHookSettings }: BackendModule = await import(
      "../src/agent/claude-cli/claude-cli-backend.ts"
    );

    const command = buildHookSettings("/home/deanj/CONTEXT").hooks
      .PreToolUse[0].hooks[0].command;

    expect(command).toContain("CLAUDE_CLI_DENIED_DIRS=");
    expect(command).toContain("02.MEMORY,MEMORY.md");
  });
});
