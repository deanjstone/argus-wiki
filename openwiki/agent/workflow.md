---
type: Technical documentation
title: Agent workflow
description: Explains the OpenWiki documentation agent's command flow, provider and model setup, prompting rules, and update metadata behavior. Documents the agent's Git-grounded workflow, content snapshot safeguards, and source implementation map for maintaining agent behavior.
tags: [agent, workflow, documentation, providers, update-metadata]
---

# Agent workflow

The documentation agent is implemented in `src/agent/`. It takes a command (`chat`, `init`, or `update`), gathers repository context, builds prompts, spawns the `claude` CLI as the execution backend, and records successful update metadata — but only if the documentation content actually changed.

This is a hard fork of upstream OpenWiki: the original multi-provider system (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, Vertex AI) and its DeepAgents/LangChain execution core were removed (see this repo's own `CLAUDE.md`). `claude-cli` is now the only provider, and there is no `createModel()` or hosted-model client anywhere in `src/agent/index.ts`.

## Main flow

`runOpenWikiAgent()` in `src/agent/index.ts` follows this sequence:

1. Load `~/.openwiki/.env` into `process.env` and sync bundled skills (`syncBundledSkills()`).
2. For `update` runs, check the update no-op condition (`getUpdateNoopStatus()`) and return early — skipping the CLI spawn entirely — if nothing has changed since the last recorded `.last-update.json`.
3. Resolve the provider via `resolveConfiguredProvider()` (always `claude-cli` — logged for debugging, not branched on).
4. Delegate unconditionally to `runClaudeCliAgent()` (`src/agent/claude-cli/claude-cli-backend.ts`) for every command (`chat`, `init`, `update`), which builds the run context, prompts, spawns the CLI, and persists update metadata. See [Claude Code CLI provider](#claude-code-cli-provider) below for that backend's own steps.

Chat runs skip the content-snapshot metadata write (handled inside `runClaudeCliAgent()`, not `runOpenWikiAgent()`).

## Claude Code CLI provider

`src/agent/claude-cli/` implements the sole execution path — there is no `createModel()` branch to contrast it with anymore:

- `claude-cli-backend.ts` (`runClaudeCliAgent()`) spawns the operator's already-authenticated `claude` CLI binary as a subprocess (`spawn("claude", [...])`) with `--output-format json`, `--permission-mode acceptEdits`, and a `--system-prompt`/user prompt built by the dedicated prompt module, reusing the same run-context, content-snapshot, and metadata bookkeeping (`persistRunMetadataIfChanged`) defined in `src/agent/utils.ts`.
- `prompt.ts` (`createClaudeCliSystemPrompt`/`createClaudeCliUserPrompt`) mirrors the product rules in `src/agent/prompt.ts` but targets the spawned CLI's own native tools (Read/Write/Edit/Bash/Grep/Glob) operating on real filesystem paths. It has no connector tools available.
- The docs-only write restriction is enforced out of band since there is no virtual-filesystem backend to enforce it in-process: a temporary `--settings` file registers a `PreToolUse` hook (`write-guard-hook.ts`) matching `Write|Edit` calls, backed by pure path-decision logic in `write-guard.ts` (`evaluateWritePath()`). By default it runs in allow-list mode, refusing writes outside the repository root or outside the configured `openwiki/`-relative directory (`CLAUDE_CLI_ALLOWED_DIR`, sourced from `OPEN_WIKI_DIR`). Setting `OPENWIKI_DENIED_PATHS` (comma-separated repo-relative files/directories; exposed to the hook as `OPEN_WIKI_DENIED_DIRS`/`CLAUDE_CLI_DENIED_DIRS` in `src/constants.ts`/`claude-cli-backend.ts`) switches `evaluateWritePath()` to deny-list mode instead — writes are allowed anywhere in the repo except the listed paths, which takes precedence over the allowed-dir check. This is unset by default, so ordinary per-repo `openwiki/`-only doc runs are unaffected; it exists for run configurations (e.g. a vault repo) where the agent needs broad write access minus a small set of paths owned by another writer.
- It is keyless — there is no API key or OAuth step, so it is deliberately excluded from `SELECTABLE_OPENWIKI_PROVIDERS` (there's no setup step for onboarding to walk a user through). It is both the `DEFAULT_PROVIDER` and the only valid value for `OPENWIKI_PROVIDER`, so it runs whether or not `OPENWIKI_PROVIDER` is set. It requires the `claude` CLI to be installed and already authenticated in the run environment (for example a self-hosted CI runner under an operator's account).
- v1 scope only supports `repository` output mode; passing `local-wiki` output mode throws.

## Prompting strategy

`src/agent/prompt.ts` encodes the product rules directly into the system prompt. The agent is instructed to:

- inspect the current codebase and write documentation under `openwiki/`,
- use filesystem discovery tools and git history rather than inventing facts,
- keep the initial wiki focused and navigable,
- avoid thin/slim pages — merge stubs into broader pages rather than creating many small directories,
- document the repository for both humans and future agents,
- respect the repository root as the only project in scope,
- avoid reading secrets or `.env` files,
- use git history for init and update runs,
- respect the temporary plan file and update metadata requirements,
- ensure top-level `/AGENTS.md` and/or `/CLAUDE.md` reference the OpenWiki quickstart (inserting or refreshing a standardized section).

The user prompt changes with the command:

- `init` includes the current Git summary and asks for fresh documentation.
- `update` includes last update metadata and a Git change summary.
- `chat` just forwards the user message.

### Local brain open questions

Local brain runs use `~/.openwiki/wiki/open-questions.md` as a compact queue for uncertainty about the user's wiki or core memory model, not as a place to copy unresolved questions from every source document. Good open questions are things that would impair future assistance, such as unclear recurring routines, missing locations, uncertain preferences, ambiguous people/org relationships, or contradictions between sources.

Do not add an open question merely because a Notion spec, meeting note, email thread, or source page contains open product/design questions. Keep those on source pages, `themes.md`, or `commitments.md` unless they are explicitly owned by the user or reveal a gap in the user's memory graph. Group similar questions under one topic key instead of creating many same-project entries.

The file should use three sections:

- `Active`: unresolved questions with `Owner`, `Seen`, `Evidence`, and optional `Notes`.
- `Answered`: previously open questions with `Evidence` linking to the canonical answer or source evidence, plus `Answered`.
- `Stale`: dropped questions with `Why` and `Last seen`.

The agent should read `open-questions.md` at the start of each local-wiki run when it exists, use the run's evidence to answer known questions, and return to the file at the end to add new unresolved questions or move answered ones out of `Active`. Answered entries should link to the answer evidence rather than duplicating an answer summary that can drift.

### Local brain themes

Local brain runs use `themes.md` as a compact trend index, not as a narrative page. Prefer a Markdown table with `Topic key`, `Theme/Signal`, `First seen`, `Last seen`, `Confidence`, `Sources`, `Evidence count`, `Status`, and `Evidence`. If a table is too cramped, use one short fielded entry per theme.

Each theme should have at most 1-2 short sentences of prose. Keep detailed examples, long context, source-specific item lists, and tweet/feed clusters in `sources/<connector>.md`, then link to that evidence from the theme row. Watchlist entries should be especially terse.

### Local brain commitments and logistics

Local brain runs use `commitments.md` for work commitments, follow-ups, approvals, deadlines, and scheduled work items. Entries should include `Owner` when inferable from evidence: `me`, `team`, `other:<name>`, or `unknown`.

Use `personal-logistics.md` for non-work personal items such as appointments, pickups, travel, household tasks, and life-admin deadlines. Personal logistics should not be mixed into `commitments.md` unless they are also work commitments.

## Git evidence and update metadata

`src/agent/utils.ts` is responsible for the repository evidence that the prompt sees:

- current working tree status,
- current HEAD,
- a change window since the last successful update when `.last-update.json` includes a `gitHead` or `updatedAt`,
- the most recent 20 commits with changed files for init runs (or updates without prior metadata),
- a diff summary against HEAD.

On successful init/update runs where content changed, the agent writes JSON metadata with:

- `updatedAt`
- `command`
- `gitHead`
- `model`

That metadata is later used to scope update runs.

### Content snapshot

`createOpenWikiContentSnapshot()` computes a SHA-256 hash of the entire `openwiki/` directory tree (excluding `.last-update.json`). The agent runtime takes a snapshot before and after the run. If they match — meaning the model made no documentation changes — the metadata file is not updated. This prevents scheduled update loops from churning the metadata when the wiki is already current.

## Model errors

The agent runtime uses only `claude-cli` for a run, and the backend spawns the CLI exactly once — there is no retry loop. `resolveProviderRetryAttempts()`/`OPENWIKI_PROVIDER_RETRY_ATTEMPTS` are still validated in `src/env.ts`, but nothing in the current runtime consumes them to actually retry a failed run; a spawn failure or non-zero exit surfaces immediately as an error (see `runClaudeCliAgent()` in `src/agent/claude-cli/claude-cli-backend.ts`).

## Why this matters

The agent is not just a generic chat wrapper. It is intentionally constrained so it can:

- write repository-local docs without wandering outside the repo,
- keep updates grounded in Git evidence and prior run metadata,
- avoid metadata churn via the content-snapshot check,
- support both interactive and scheduled maintenance use cases.

`resolveCheckpointTarget()`/`createOpenWikiThreadId()` in `src/agent/index.ts` still exist (a thread-ID/checkpoint-path helper pair, exercised by `test/checkpoint-policy.test.ts` and used for thread-ID generation in `src/cli.tsx`/`src/ingestion.ts`), but the `claude-cli` backend does not use a checkpointer — each run is a single stateless CLI spawn.

## Things to watch when changing agent behavior

- Keep the prompt in sync with the actual filesystem tools and path conventions used by the CLI.
- Be careful with `.last-update.json` semantics, because update runs use it to decide what changed since the previous successful run.
- The content-snapshot check means a no-op update will not update metadata. If you change the snapshot logic, ensure `.last-update.json` is still excluded.
- Env loading happens before the update no-op check and before delegating to the backend; changes there affect both onboarding and agent startup.
- Adding a provider now means adding both a `PROVIDER_CONFIGS` entry in `src/constants.ts` and a new execution path (there is no `createModel()` branch point to extend).

## Source map

- `src/agent/index.ts`
- `src/agent/prompt.ts`
- `src/agent/utils.ts`
- `src/agent/types.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/agent/claude-cli/prompt.ts`
- `src/agent/claude-cli/write-guard.ts`
- `src/agent/claude-cli/write-guard-hook.ts`
- `src/constants.ts`
- `src/env.ts`
- Git evidence: commits `ceded10`, `f89b05d`, `dfa73cc`, `a82759f`, `0fa1430`, `070a382`, `5210cc4`
