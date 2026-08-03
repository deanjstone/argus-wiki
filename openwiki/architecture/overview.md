---
type: Architecture overview
title: OpenWiki Architecture Overview
description: Explains OpenWiki's layered CLI, agent, provider, connector, authentication, and ingestion architecture, including runtime execution and persistence. Identifies core source modules, extension points, and operational considerations for maintaining OpenWiki.
tags: [architecture, cli, agent, providers, connectors, ingestion]
---

# Architecture overview

OpenWiki has a small but layered architecture:

1. `src/cli.tsx` provides the interactive terminal application and orchestrates runs, including auto-exit for init/update.
2. `src/commands.ts` parses argv and defines help text and supported options, including `auth`, `ngrok`, `cron`, and `ingest` subcommands.
3. `src/credentials.tsx` manages interactive onboarding — largely vestigial provider/API-key selection UI (there's nothing to pick since `claude-cli` is the only, keyless provider), plus a still-active optional model ID and LangSmith tracing prompt.
4. `src/env.ts` reads and writes `~/.openwiki/.env` and surfaces credential diagnostics, including for provider env keys that no longer have an implemented provider behind them (see below).
5. `src/agent/index.ts` runs the documentation agent: loads env/skills, resolves the (single) provider for logging, collects Git context, and unconditionally delegates to the `claude-cli` backend.
6. `src/agent/prompt.ts` builds the system and user prompts that tell the model how to behave.
7. `src/agent/utils.ts` gathers Git evidence, computes an OpenWiki content snapshot, and records `.last-update.json` after successful init/update runs.
8. `src/auth/` contains the connector OAuth system: `oauth.ts` (generic runner), `providers.ts` (provider configs), `configure.ts` (`openwiki auth configure`), `ngrok.ts` (Slack HTTPS tunnel), `tokens.ts` (refresh/validation), and `types.ts`.
9. `src/connectors/` contains the connector registry, MCP client/runtime, source-specific ingestion modules (git-repo, gmail, hackernews, slack, web-search, x), and tool definitions exposed to the agent.
10. `src/ingestion.ts` orchestrates source ingestion runs across configured connectors.
11. `src/code-mode.ts` handles `openwiki code` setup: writes a GitHub Actions workflow and AGENTS.md/CLAUDE.md snippets.
12. `src/constants.ts` centralizes provider configs, model options, environment keys, validation helpers, and the wiki directory names — narrowed to a single `claude-cli` provider (see below).
13. `src/agent/types.ts` defines shared types: `OpenWikiCommand`, `RunContext`, `UpdateMetadata`, and run option/event interfaces.

## Runtime shape

The CLI starts in `src/cli.tsx`, parses the command, and then either:

- prints help and exits,
- opens the interactive chat UI,
- runs an init/update command against the current repository, or
- performs a dry-run in development mode.

For non-chat runs, the agent receives a `RunContext` that includes last-update metadata and a Git summary generated from:

- `git status --short`
- `git rev-parse HEAD`
- `git log --max-count=20 --name-status --oneline` (init, or update without prior metadata)
- `git log <lastHead>..HEAD --name-status --oneline` (update with a recorded `gitHead`)
- `git log --since <updatedAt> --name-status --oneline` (update with only a timestamp)
- `git diff --name-status HEAD`

### Provider and model resolution

This is a hard fork of upstream OpenWiki with the multi-provider/DeepAgents system removed (see this repo's own `CLAUDE.md`). `src/constants.ts` still exposes a pluggable-shaped provider abstraction (`OpenWikiProvider`, `PROVIDER_CONFIGS`, `getProviderConfig()`, etc.), but it now has exactly one member:

- `OpenWikiProvider = "claude-cli"` — the only key in `PROVIDER_CONFIGS`.
- `SELECTABLE_OPENWIKI_PROVIDERS = []` — `claude-cli` is deliberately excluded because it's keyless (no API key/OAuth step to walk a user through in interactive onboarding).
- `resolveConfiguredProvider()` is now a one-line resolver: `normalizeProvider(env.OPENWIKI_PROVIDER) ?? DEFAULT_PROVIDER`. Since `normalizeProvider()` rejects any value not in `PROVIDER_CONFIGS`, this always resolves to `claude-cli` regardless of what `OPENWIKI_PROVIDER` is set to — there is no API-key-based fallback chain anymore.

There is no `createModel()` function, no DeepAgents, and no LangChain hosted-model client in `src/agent/index.ts`. `runOpenWikiAgent()` unconditionally calls `runClaudeCliAgent()` (`src/agent/claude-cli/claude-cli-backend.ts`) for every command, which spawns the operator's already-authenticated `claude` CLI binary as a subprocess. It has its own prompt builder (`src/agent/claude-cli/prompt.ts`) and enforces the docs-only write restriction via a `PreToolUse` hook (`write-guard-hook.ts` / `write-guard.ts`) instead of a virtual-filesystem backend. It requires the `claude` CLI to be installed and authenticated in the run environment, and v1 scope supports only `repository` output mode. See [Agent workflow](../agent/workflow.md) for the full flow.

`getMissingProviderEnvKey()` in `src/constants.ts` still exists for credential gating, but for `claude-cli` it always returns `null` (no `apiKeyEnvKey`, no `projectEnvKey` configured) — there is nothing to gate.

`src/env.ts` and the credential diagnostics panel still track env keys for the removed providers (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, Bedrock/Gemini/ChatGPT-OAuth keys, etc. — see [Credentials and updates](../operations/credentials-and-updates.md)); these are vestigial (no provider config reads them) but not removed, so setting them has no effect on which provider runs.

### Content snapshot and metadata writes

After a non-chat run completes, `src/agent/utils.ts` computes a SHA-256 snapshot of the `openwiki/` directory (excluding `.last-update.json`). Metadata is written **only if the snapshot changed** — a no-op update that leaves docs untouched will not update `.last-update.json`. This prevents endless update loops in scheduled workflows.

### Auto-exit behavior

`shouldAutoExitStartupRun()` in `src/cli.tsx` determines whether a startup run should exit automatically on success. This applies to `--init` and `--update` commands (without `--print`) when run in a TTY: the CLI launches the run, renders streaming output, and exits with code 0 on success. Chat runs and `--print` runs are unaffected.

## Why the architecture is shaped this way

The current design reflects a documentation product rather than a general-purpose agent framework:

- The CLI owns user experience and credential bootstrap so the tool is install-and-run friendly.
- Git evidence is collected in the host process before the agent starts so the model sees stable repository context.
- Provider support is centralized in `src/constants.ts`, though currently narrowed to a single `claude-cli` provider — reintroducing a hosted-model provider means adding both a config entry and a new execution path (no `createModel` branch point exists to hook into anymore).
- Model execution has no automatic retry path: the `claude-cli` backend spawns the CLI once per run and surfaces a failure immediately. `OPENWIKI_PROVIDER_RETRY_ATTEMPTS` is still validated in `src/env.ts` but is not consumed by any retry logic.
- The content-snapshot check prevents metadata churn when an update run produces no documentation changes, which is important for scheduled CI workflows.
- Auto-exit for init/update makes the CLI usable in both interactive and one-shot contexts without requiring `--print`.

## Major extension points

- Add or refine CLI commands in `src/commands.ts` and the corresponding UI behavior in `src/cli.tsx`.
- Change onboarding or local credential storage in `src/credentials.tsx` and `src/env.ts`.
- Add a new model provider by extending `PROVIDER_CONFIGS` and `OpenWikiProvider` in `src/constants.ts`, then implementing a new execution path analogous to `src/agent/claude-cli/` (there is no `createModel` branch to extend anymore).
- Adjust model defaults or validation in `src/constants.ts`.
- Extend the documentation prompt or Git evidence in `src/agent/prompt.ts` and `src/agent/utils.ts`.
- Modify run persistence or snapshot behavior in `src/agent/utils.ts`.

## Things to watch when editing

- `src/cli.tsx` and `src/commands.ts` must stay aligned; help text and parser behavior are intentionally coupled.
- Credential setup writes to a real home-directory file, so permission handling matters.
- The `claude-cli` backend operates on real repository-relative filesystem paths (not a virtual filesystem) via the spawned CLI's own native Read/Write/Edit/Bash/Grep/Glob tools.
- `openwiki/` in the target repository is both the docs output location and the metadata location for `.last-update.json`.
- When adding a provider, update `MANAGED_ENV_KEYS` in `src/env.ts` so diagnostics and env formatting cover the new key.
- The content-snapshot logic excludes `.last-update.json`; if new metadata files are added under `openwiki/`, decide whether they should be excluded too.

## Source map

- `src/cli.tsx`
- `src/commands.ts`
- `src/credentials.tsx`
- `src/env.ts`
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
- `src/ingestion.ts`
- `src/code-mode.ts`
- `src/constants.ts`
- `package.json`
- Git evidence: commits `ceded10`, `f89b05d`, `fd3a702`, `8278c36`, `0fa1430`
