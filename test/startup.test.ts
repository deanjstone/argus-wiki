import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { resolveStartupCommand } from "../src/startup.ts";
import type { CliCommand } from "../src/commands.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });

  return stdout.trim();
}

async function createRepoWithOpenWiki(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "openwiki-startup-"));
  await git(repo, ["init"]);
  await git(repo, ["config", "user.email", "test@example.com"]);
  await git(repo, ["config", "user.name", "OpenWiki Test"]);
  await writeFile(path.join(repo, "README.md"), "# Test Repo\n", "utf8");
  await mkdir(path.join(repo, "openwiki"));
  await writeFile(
    path.join(repo, "openwiki", "quickstart.md"),
    "# Quickstart\n",
    "utf8",
  );
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "initial"]);
  return repo;
}

async function writeLastUpdate(repo: string, gitHead: string): Promise<void> {
  await writeFile(
    path.join(repo, "openwiki", ".last-update.json"),
    `${JSON.stringify({
      updatedAt: new Date().toISOString(),
      command: "update",
      gitHead,
      model: "test-model",
    })}\n`,
    "utf8",
  );
}

function updatePrintCommand(
  overrides: Partial<Extract<CliCommand, { kind: "run" }>> = {},
): Extract<CliCommand, { kind: "run" }> {
  return {
    kind: "run",
    exitCode: 0,
    command: "update",
    dryRun: false,
    modelId: null,
    print: true,
    shouldStart: true,
    userMessage: null,
    ...overrides,
  };
}

describe("resolveStartupCommand", () => {
  test("fails fast for non-TTY interactive chat without a message", async () => {
    const result = await resolveStartupCommand(
      {
        kind: "run",
        exitCode: 0,
        command: "chat",
        dryRun: false,
        modelId: null,
        print: false,
        shouldStart: false,
        userMessage: null,
      },
      { isStdinTTY: false },
    );

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("Interactive chat requires a terminal");
    }
  });

  test("allows clean update --print no-ops without provider credentials", async () => {
    const repo = await createRepoWithOpenWiki();
    const head = await git(repo, ["rev-parse", "HEAD"]);
    await writeLastUpdate(repo, head);

    const command = updatePrintCommand();
    const result = await resolveStartupCommand(command, {
      cwd: repo,
      isStdinTTY: false,
    });

    expect(result).toBe(command);
  });

  // Note: claude-cli (the sole remaining provider) is fully keyless — it
  // spawns the operator's already-authenticated `claude` CLI instead of
  // calling a hosted API — so there is no longer a reachable scenario where
  // resolveStartupCommand fails with a missing-credential error. The former
  // "still requires credentials when ..." tests here (pinned to
  // OPENROUTER_API_KEY) were removed as a necessary consequence of narrowing
  // OpenWikiProvider to "claude-cli" only.

  test("runs update --print with source changes (claude-cli needs no credentials)", async () => {
    const repo = await createRepoWithOpenWiki();
    const head = await git(repo, ["rev-parse", "HEAD"]);
    await writeLastUpdate(repo, head);
    await writeFile(
      path.join(repo, "README.md"),
      "# Test Repo\nChanged\n",
      "utf8",
    );

    const command = updatePrintCommand();
    const result = await resolveStartupCommand(command, {
      cwd: repo,
      isStdinTTY: false,
    });

    expect(result).toBe(command);
  });

  test("runs update --print with a user message (claude-cli needs no credentials)", async () => {
    const repo = await createRepoWithOpenWiki();
    const head = await git(repo, ["rev-parse", "HEAD"]);
    await writeLastUpdate(repo, head);

    const command = updatePrintCommand({ userMessage: "refresh API docs" });
    const result = await resolveStartupCommand(command, {
      cwd: repo,
      isStdinTTY: false,
    });

    expect(result).toBe(command);
  });
});
