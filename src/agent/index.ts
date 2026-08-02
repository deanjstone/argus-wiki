import { createHash } from "node:crypto";
import path from "node:path";
import { DEBUG_ENV_KEYS, loadOpenWikiEnv, openWikiEnvDir } from "../env.js";
import { openWikiLocalWikiDir } from "../openwiki-home.js";
import { runClaudeCliAgent } from "./claude-cli/claude-cli-backend.js";
import { syncBundledSkills } from "./skills.js";
import type {
  OpenWikiCommand,
  OpenWikiRunOptions,
  OpenWikiRunResult,
} from "./types.js";
import {
  ANTHROPIC_BASE_URL_ENV_KEY,
  BEDROCK_AWS_REGION_ENV_KEY,
  OPENAI_COMPATIBLE_BASE_URL_ENV_KEY,
  OPENWIKI_MODEL_ID_ENV_KEY,
  OPENWIKI_PROVIDER_ENV_KEY,
  OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY,
  resolveConfiguredProvider,
} from "../constants.js";
import { getUpdateNoopStatus, shouldCheckUpdateNoop } from "./utils.js";

export async function runOpenWikiAgent(
  command: OpenWikiCommand,
  cwd = openWikiLocalWikiDir,
  options: OpenWikiRunOptions = {},
): Promise<OpenWikiRunResult> {
  const runtimeCwd = options.outputMode ? cwd : openWikiLocalWikiDir;

  emitDebug(options, `command=${command}`);
  emitDebug(options, `cwd=${runtimeCwd}`);
  emitDebug(
    options,
    `userMessage=${options.userMessage ? "provided" : "not-provided"}`,
  );
  emitDebug(options, `userMessage.followup=${options.isFollowup === true}`);
  emitDebug(options, `env.beforeLoad ${formatEnvironmentDebug()}`);

  await loadOpenWikiEnv();
  await syncBundledSkills();
  emitDebug(options, "env=loaded ~/.openwiki/.env");
  emitDebug(options, `env.afterLoad ${formatEnvironmentDebug()}`);

  if (command === "update" && shouldCheckUpdateNoop(options)) {
    const noopStatus = await getUpdateNoopStatus(cwd);

    if (noopStatus.shouldSkip) {
      const message =
        "No repository changes detected since the last OpenWiki update; skipping agent run.";
      emitDebug(options, `update.noop gitHead=${noopStatus.gitHead}`);
      options.onEvent?.({ type: "text", text: message });

      return {
        command,
        model: noopStatus.model,
        skipped: true,
      };
    }

    emitDebug(options, `update.noop=false reason=${noopStatus.reason}`);
  } else if (command === "update") {
    emitDebug(options, "update.noop=false reason=user message provided");
  }

  const provider = resolveConfiguredProvider();
  emitDebug(options, `provider=${provider}`);

  return runClaudeCliAgent(command, runtimeCwd, options);
}

const checkpointPath = path.join(openWikiEnvDir, "openwiki.sqlite");

export type CheckpointTarget = {
  connString: string;
  persistent: boolean;
};

export function resolveCheckpointTarget(
  command: OpenWikiCommand,
): CheckpointTarget {
  if (command === "chat") {
    return {
      connString: checkpointPath,
      persistent: true,
    };
  }

  return {
    connString: ":memory:",
    persistent: false,
  };
}

export function createOpenWikiThreadId(cwd = process.cwd()): string {
  return createThreadId(cwd, createRunThreadId());
}

function createThreadId(cwd: string, runId: string): string {
  const digest = createHash("sha256").update(path.resolve(cwd)).digest("hex");

  return `openwiki-${digest.slice(0, 32)}-${runId}`;
}

function createRunThreadId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function emitDebug(options: OpenWikiRunOptions, message: string): void {
  if (!options.debug) {
    return;
  }

  options.onEvent?.({
    type: "debug",
    message,
  });
}

function formatEnvironmentDebug(): string {
  return DEBUG_ENV_KEYS.map(
    (key) => `${key}:${formatDebugValue(key, process.env[key])}`,
  ).join(" ");
}

function formatDebugValue(key: string, value: string | undefined): string {
  if (value === undefined) {
    return "unset";
  }

  if (
    key === "LANGCHAIN_ENDPOINT" ||
    key === ANTHROPIC_BASE_URL_ENV_KEY ||
    key === OPENAI_COMPATIBLE_BASE_URL_ENV_KEY
  ) {
    return formatUrlDebugValue(value);
  }

  if (key.endsWith("_API_KEY")) {
    return `set(length=${value.length})`;
  }

  if (
    key === OPENWIKI_MODEL_ID_ENV_KEY ||
    key === OPENWIKI_PROVIDER_ENV_KEY ||
    key === OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY ||
    key === BEDROCK_AWS_REGION_ENV_KEY
  ) {
    return `set(value=${JSON.stringify(value)})`;
  }

  if (value.length <= 10) {
    return `set(length=${value.length})`;
  }

  return `set(length=${value.length}, preview=${JSON.stringify(
    `${value.slice(0, 6)}...${value.slice(-4)}`,
  )})`;
}

function formatUrlDebugValue(value: string): string {
  try {
    const url = new URL(value);
    const redacted: string[] = [];

    if (url.username || url.password) {
      redacted.push("auth");
      url.username = "";
      url.password = "";
    }

    if (url.search) {
      redacted.push("query");
      url.search = "";
    }

    if (url.hash) {
      redacted.push("hash");
      url.hash = "";
    }

    const redactionSuffix =
      redacted.length > 0 ? `, redacted=${redacted.join("+")}` : "";

    return `set(url=${JSON.stringify(url.toString())}${redactionSuffix})`;
  } catch {
    return `set(length=${value.length}, preview=${JSON.stringify(
      `${value.slice(0, 6)}...${value.slice(-4)}`,
    )})`;
  }
}
