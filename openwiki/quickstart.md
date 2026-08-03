---
type: Quickstart Guide
title: OpenWiki Quickstart
description: Quickstart reference for the OpenWiki TypeScript CLI, including documentation-generation workflows, supported model providers, and the primary source files. Use it to navigate the repository's architecture, commands, agent runtime, operations, and connectors.
tags: [openwiki, quickstart, cli, documentation]
---

# OpenWiki quickstart

OpenWiki is a TypeScript CLI that writes and maintains documentation for a repository using an agent-driven workflow. The package exposes a single `openwiki` binary, stores local credentials in `~/.openwiki/.env`, and records successful update metadata in `openwiki/.last-update.json`.

## What this repository does

- Launches an interactive Ink-based terminal app for chatting with the OpenWiki agent.
- Supports one-shot documentation runs with `--init`, `--update`, and `--print`.
- Runs a single, keyless model provider: `claude-cli`. This fork removed the upstream multi-provider system (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA NIM, Vertex AI, and the DeepAgents/LangChain execution core) — see [Agent workflow](./agent/workflow.md) and [CLI usage](./cli/usage.md). `src/constants.ts`'s provider abstraction (`OpenWikiProvider`, `PROVIDER_CONFIGS`) is still pluggable in shape, just narrowed to one member.
- Spawns the operator's already-authenticated `claude` CLI binary as a subprocess for every run, instead of calling a hosted model API. A `PreToolUse` hook enforces the docs-only write restriction out of band (see [Agent workflow](./agent/workflow.md#claude-code-cli-provider)).
- Creates or refreshes documentation under the target repository's `openwiki/` directory.
- Auto-exits after successful `--init` or `--update` runs in an interactive terminal, so the CLI works as both a one-shot and interactive tool.
- Optionally schedules automated updates through GitHub Actions (the only CI provider this fork ships an example for; see `examples/openwiki-update.yml`).

## Start here

- [Architecture overview](./architecture/overview.md) — runtime structure, major modules, and execution flow.
- [CLI usage](./cli/usage.md) — commands, options, model/provider selection, and credential bootstrap.
- [Agent workflow](./agent/workflow.md) — how documentation runs are assembled and persisted.
- [Credentials and updates](./operations/credentials-and-updates.md) — local env storage, metadata, and scheduled updates.
- [Connectors](./integrations/connectors.md) — built-in connector architecture, the seven connectors, and ingestion orchestration.

## Key source files

- `README.md` — user-facing installation and usage summary.
- `package.json` — bin entrypoint, scripts, and dependencies.
- `src/cli.tsx` — Ink UI, command execution, auto-exit, and run lifecycle.
- `src/commands.ts` — CLI parsing and help content.
- `src/agent/index.ts` — agent runtime entrypoint: loads env/skills, checks the update no-op condition, resolves the (single) provider for logging, and delegates every command unconditionally to `runClaudeCliAgent()`.
- `src/agent/prompt.ts` — prompt assembly, documentation-run instructions, and AGENTS.md/CLAUDE.md insertion rules.
- `src/agent/utils.ts` — git evidence collection, content snapshot, and `.last-update.json` handling.
- `src/agent/types.ts` — shared agent types (`OpenWikiCommand`, `RunContext`, `UpdateMetadata`, run options/events).
- `src/agent/claude-cli/` — the only provider backend: spawns the operator's authenticated `claude` CLI as a subprocess instead of calling a hosted API, with its own prompt builder and an out-of-band `PreToolUse` write guard. See [Agent workflow](./agent/workflow.md#claude-code-cli-provider).
- `src/auth/oauth.ts` — generic OAuth runner for connector providers (Gmail, Notion, Slack, X).
- `src/auth/providers.ts` — connector OAuth provider configs (scopes, token URLs, env-key mappings).
- `src/auth/configure.ts` — `openwiki auth configure <provider>` flow for creating local connector configs.
- `src/auth/ngrok.ts` — Slack HTTPS callback tunnel via ngrok.
- `src/auth/tokens.ts` — token refresh and validation helpers for connector OAuth.
- `src/connectors/` — connector registry, MCP client/runtime, source-specific ingestion (git-repo, gmail, hackernews, slack, web-search, x), and tool definitions.
- `src/ingestion.ts` — orchestrates source ingestion runs across configured connectors.
- `src/code-mode.ts` — `openwiki code` setup: writes GitHub Actions workflow and AGENTS.md/CLAUDE.md snippets.
- `src/env.ts` — `~/.openwiki/.env` persistence and credential diagnostics; base directory is overridable via `OPENWIKI_HOME`.
- `src/credentials.tsx` — interactive onboarding flow; provider/API-key selection UI is largely vestigial now (`claude-cli` is the only, keyless provider), but optional model ID and LangSmith prompts are still active.
- `src/constants.ts` — provider configs, model options, env keys, and validation helpers.
- `examples/openwiki-update.yml` — copyable GitHub Actions scheduled automation example (the only CI example this repo ships).

## Documentation map

- [Architecture](./architecture/overview.md)
- [CLI](./cli/usage.md)
- [Agent](./agent/workflow.md)
- [Operations](./operations/credentials-and-updates.md)
- [Connectors](./integrations/connectors.md)

## Notes for future agents

- The repository is intentionally focused: the main product surface is the CLI plus the documentation-generation agent.
- Treat `openwiki/` in this repo as generated documentation output from a future OpenWiki run, not as application source.
- When changing behavior, verify both the CLI parser and the agent prompt/runtime, because user-visible semantics are split across `src/commands.ts`, `src/cli.tsx`, and `src/agent/*`.
- Provider metadata still lives in `src/constants.ts` (`PROVIDER_CONFIGS`, `OpenWikiProvider`, `SELECTABLE_OPENWIKI_PROVIDERS`), but `claude-cli` is the only implemented provider — `runOpenWikiAgent()` in `src/agent/index.ts` unconditionally delegates to `runClaudeCliAgent()`, and there is no `createModel`/hosted-model code path to branch on anymore. Reintroducing a hosted-model provider would mean adding both the config entry and a new execution path, not just a config change.

## Source map

- `README.md`
- `package.json`
- `src/cli.tsx`
- `src/commands.ts`
- `src/agent/index.ts`
- `src/agent/prompt.ts`
- `src/agent/utils.ts`
- `src/agent/types.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/agent/claude-cli/prompt.ts`
- `src/agent/claude-cli/write-guard.ts`
- `src/agent/claude-cli/write-guard-hook.ts`
- `src/auth/oauth.ts`
- `src/auth/providers.ts`
- `src/auth/configure.ts`
- `src/auth/ngrok.ts`
- `src/auth/tokens.ts`
- `src/auth/types.ts`
- `src/connectors/registry.ts`
- `src/connectors/tools.ts`
- `src/connectors/types.ts`
- `src/connectors/mcp-client.ts`
- `src/connectors/mcp-runtime.ts`
- `src/connectors/io.ts`
- `src/connectors/sources/git-repo.ts`
- `src/connectors/sources/gmail.ts`
- `src/connectors/sources/hackernews.ts`
- `src/connectors/sources/mcp.ts`
- `src/connectors/sources/slack.ts`
- `src/connectors/sources/web-search.ts`
- `src/connectors/sources/x.ts`
- `src/ingestion.ts`
- `src/code-mode.ts`
- `src/env.ts`
- `src/openwiki-home.ts`
- `src/credentials.tsx`
- `src/constants.ts`
- `examples/openwiki-update.yml`
- Git evidence: commits `ceded10`, `f89b05d`, `a82759f`, `dfa73cc`, `fd3a702`, `8278c36`, `0fa1430`, `070a382`, `5210cc4`, `9f2c252`, `7c3d1df`
