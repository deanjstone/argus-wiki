import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OPEN_WIKI_DENIED_DIRS, OPEN_WIKI_DIR } from "../../constants.js";
import {
  createOpenWikiContentSnapshot,
  createRunContext,
  persistRunMetadataIfChanged,
} from "../utils.js";
import {
  createClaudeCliSystemPrompt,
  createClaudeCliUserPrompt,
} from "./prompt.js";
import type {
  OpenWikiCommand,
  OpenWikiRunOptions,
  OpenWikiRunResult,
} from "../types.js";

/**
 * claude-cli provider backend.
 *
 * Spawns the operator's already-authenticated `claude` CLI binary as a
 * subprocess instead of calling a hosted API, reusing the same run-context /
 * update-noop / metadata bookkeeping as the DeepAgents-based providers (see
 * ../utils.ts). Docs-only write restriction is re-enforced out of band via a
 * PreToolUse hook (./write-guard-hook.ts) since this path bypasses DeepAgents'
 * LocalShellBackend entirely. v1 scope is "repository" output mode only.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRITE_GUARD_HOOK_PATH = path.join(__dirname, "write-guard-hook.js");
const FALLBACK_MODEL_LABEL = "claude-cli";

export interface ClaudeCliJsonResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  modelUsage?: Record<string, unknown>;
}

export async function runClaudeCliAgent(
  command: OpenWikiCommand,
  cwd: string,
  options: OpenWikiRunOptions,
): Promise<OpenWikiRunResult> {
  const outputMode = options.outputMode ?? "repository";

  if (outputMode !== "repository") {
    throw new Error(
      "The claude-cli provider only supports repository output mode.",
    );
  }

  const context = await createRunContext(command, cwd, outputMode);
  const snapshotBefore =
    command === "chat"
      ? null
      : await createOpenWikiContentSnapshot(cwd, outputMode);

  const systemPrompt = createClaudeCliSystemPrompt(command);
  const userPrompt = createClaudeCliUserPrompt(
    command,
    context,
    options.userMessage ?? null,
  );

  const settingsDir = await mkdtemp(
    path.join(tmpdir(), "openwiki-claude-cli-"),
  );

  try {
    const settingsFilePath = path.join(settingsDir, "settings.json");
    await writeFile(
      settingsFilePath,
      JSON.stringify(buildHookSettings(cwd), null, 2),
      "utf8",
    );

    const result = await spawnClaudeCli({
      cwd,
      modelId: options.modelId ?? undefined,
      settingsFilePath,
      systemPrompt,
      userPrompt,
    });

    if (result.is_error) {
      throw new Error(
        `claude-cli run failed (${result.subtype ?? "unknown_error"}): ${
          result.result ?? "no result text"
        }`,
      );
    }

    const modelId = getEffectiveModelId(result);
    options.onEvent?.({ type: "text", text: result.result ?? "" });

    await persistRunMetadataIfChanged(
      command,
      cwd,
      modelId,
      outputMode,
      snapshotBefore,
    );

    return { command, model: modelId };
  } finally {
    await rm(settingsDir, { force: true, recursive: true });
  }
}

export function buildHookSettings(repoRoot: string): {
  hooks: {
    PreToolUse: Array<{
      matcher: string;
      hooks: Array<{ type: "command"; command: string }>;
    }>;
  };
} {
  const hookCommand = [
    `CLAUDE_CLI_REPO_ROOT=${shellQuote(repoRoot)}`,
    `CLAUDE_CLI_ALLOWED_DIR=${shellQuote(OPEN_WIKI_DIR)}`,
    ...(OPEN_WIKI_DENIED_DIRS.length > 0
      ? [
          `CLAUDE_CLI_DENIED_DIRS=${shellQuote(OPEN_WIKI_DENIED_DIRS.join(","))}`,
        ]
      : []),
    "node",
    shellQuote(WRITE_GUARD_HOOK_PATH),
  ].join(" ");

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [{ type: "command", command: hookCommand }],
        },
      ],
    },
  };
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function getEffectiveModelId(result: ClaudeCliJsonResult): string {
  const modelUsageKeys = result.modelUsage
    ? Object.keys(result.modelUsage)
    : [];
  return modelUsageKeys[0] ?? FALLBACK_MODEL_LABEL;
}

function spawnClaudeCli(args: {
  cwd: string;
  modelId?: string;
  settingsFilePath: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<ClaudeCliJsonResult> {
  return new Promise((resolve, reject) => {
    const cliArgs = [
      "-p",
      args.userPrompt,
      "--output-format",
      "json",
      "--permission-mode",
      "acceptEdits",
      "--settings",
      args.settingsFilePath,
      "--setting-sources",
      "project,local",
      "--system-prompt",
      args.systemPrompt,
    ];

    if (args.modelId) {
      cliArgs.push("--model", args.modelId);
    }

    const child = spawn("claude", cliArgs, { cwd: args.cwd, env: process.env });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: Error) => {
      reject(error);
    });

    child.on("close", (code: number | null) => {
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            `claude CLI exited with code ${code ?? "unknown"}: ${
              stderr.trim() || "no stderr output"
            }`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout) as ClaudeCliJsonResult);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse claude CLI JSON output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  });
}
