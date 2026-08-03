---
type: CLI reference
title: OpenWiki CLI usage
description: Reference for OpenWiki command-line usage, including interactive and non-interactive runs, initialization and update modes, connector operations, and authentication setup. Covers provider configuration, model selection, validation, and the source files to update when changing CLI behavior.
tags: [openwiki, cli, commands, configuration, authentication]
---

# CLI usage

OpenWiki ships as a single `openwiki` binary and is intended to work both as an interactive terminal app and as a one-shot documentation runner.

## Commands and modes

From `src/commands.ts` and `README.md`, the supported entry patterns are:

- `openwiki` — open the interactive chat UI.
- `openwiki "message"` — send a chat message immediately, then stay open.
- `openwiki personal --init [message]` — generate initial local personal brain wiki documentation.
- `openwiki code --init [message]` — generate initial repository documentation.
- `openwiki --update [message]` — refresh existing OpenWiki documentation.
- `openwiki -p, --print` — run once and print the final assistant output (non-interactive).
- `openwiki --modelId <id>` / `--model-id <id>` — choose a model ID for the run.
- `openwiki --help` / `-h` — print usage, options, and examples.
- `openwiki --dry-run` — development-only option that avoids invoking the agent.

### Connector and operational subcommands

- `openwiki auth <provider>` — run OAuth login for a connector provider (gmail, notion, slack, x).
- `openwiki auth configure <provider> [--force]` — create local connector config that references saved auth env vars.
- `openwiki auth tools <provider>` — list available MCP tools for a connector (e.g. notion).
- `openwiki auth` (no provider) — list supported auth providers and their status.
- `openwiki ngrok start [url] [--port <port>]` — start an ngrok HTTPS tunnel for Slack OAuth callback.
- `openwiki cron list` — show saved connector schedules, launchd state, and the Mac wake window.
- `openwiki cron pause <source|all>` — unload launchd job(s), keep cron metadata, reconcile `pmset` wake window.
- `openwiki cron resume <source|all>` — reinstall paused launchd job(s) and reconcile `pmset` wake window.
- `openwiki cron delete <source|all>` — unload and remove schedule metadata (does not remove auth, config, raw data, or wiki content).
- `openwiki ingest [target]` — run source-specific ingestion for configured connectors.

The parser rejects incompatible combinations such as `--init` and `--update` together, and it requires a message or command when `--print` is used.

### Auto-exit for init/update

When explicit init (`openwiki personal --init` or `openwiki code --init`) or `--update` is run in a TTY (without `--print`), the CLI starts the run, streams agent output, and **exits automatically on success** (`shouldAutoExitStartupRun` in `src/cli.tsx`). Chat runs and `--print` runs are not affected — chat stays open for follow-ups, and `--print` writes to stdout and exits.

### Non-interactive mode

If stdin is not a TTY (e.g. CI), or `--print` is used, the CLI requires the provider's credentials to be already saved in `~/.openwiki/.env` or present in the environment. In practice this is a no-op today: `claude-cli` is the only provider, is keyless, and requires no API key or GCP project — it just needs the `claude` CLI itself installed and authenticated in the run environment. It will error with a clear message if a genuinely required value is missing, rather than prompting interactively.

## Interactive behavior

`src/cli.tsx` is the Ink-based app shell. It handles:

- chat submission and follow-up messages,
- `init` / `update` command launches (including from `/init` and `/update` slash commands),
- provider and model selection during the session (`/provider`, `/model`),
- interactive credential setup when required (including for init/update, not just chat),
- streaming agent text and tool events,
- completed-run history and error display,
- exit handling for help, errors, and explicit `/exit` messages.

The UI persists provider and model selection back to `~/.openwiki/.env` through `saveOpenWikiEnv()`.

## Credentials and onboarding

This fork removed upstream OpenWiki's hosted-model providers (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, Vertex AI, and their ChatGPT-OAuth/API-key setup steps). `claude-cli` — spawning the operator's own already-authenticated `claude` CLI — is the only provider, and it is keyless, so there is no provider or API-key prompt to walk through in onboarding.

The first interactive run can still prompt for:

- a **model ID** stored as `OPENWIKI_MODEL_ID` — optional; if set, it's passed through to `claude --model`,
- optional `LANGSMITH_API_KEY` for tracing.

`src/credentials.tsx` determines whether setup is needed (`needsCredentialSetup()`) and walks the user through any missing values. See [Credentials and updates](../operations/credentials-and-updates.md) for details.

## Provider and model selection

`PROVIDER_CONFIGS` in `src/constants.ts` has a single entry:

| Provider   | Env key        | Base URL                    | Models                                                               |
| ---------- | -------------- | ---------------------------- | --------------------------------------------------------------------- |
| claude-cli | none (keyless) | none (subprocess, not HTTP) | none preset — `OPENWIKI_MODEL_ID` passes through to `claude --model` |

`claude-cli` is both `DEFAULT_PROVIDER` and the only value `isValidProvider()` accepts, so `resolveConfiguredProvider()` resolves to it whether or not `OPENWIKI_PROVIDER` is set. The upstream fallback-through-API-keys logic (try OpenAI, then OpenRouter, then Anthropic, etc.) no longer exists — `resolveConfiguredProvider()` is now a one-line env-var-or-default lookup.

### Claude Code CLI provider

OpenWiki runs against the operator's own already-authenticated `claude` CLI binary as a subprocess instead of calling a hosted API. There is no API key, base URL, or model list to configure — `OPENWIKI_MODEL_ID`, if set, is passed through to `claude --model`. It requires the `claude` CLI to be installed and signed in on the machine running OpenWiki, which makes it a good fit for a self-hosted CI runner under an operator's account. It only supports `repository` output mode. `SELECTABLE_OPENWIKI_PROVIDERS` is empty (`claude-cli` is deliberately excluded since there's no setup step to select), so the interactive provider-picker menu currently has nothing to show. See [Agent workflow: Claude Code CLI provider](../agent/workflow.md#claude-code-cli-provider) for the execution details, including how the docs-only write restriction is enforced for this path.

### Provider retry attempts

`OPENWIKI_PROVIDER_RETRY_ATTEMPTS` is still validated (`resolveProviderRetryAttempts()` in `src/constants.ts` requires a positive integer, defaulting to 3), but nothing in the current runtime consumes it — the `claude-cli` backend spawns the CLI once per run with no retry loop. Setting it has no observable effect today; it's a leftover from the removed LangChain-backed providers.

## Help text and validation

The help content is centralized in `src/commands.ts` and is used by the CLI UI. Model validation is intentionally strict:

- model IDs are trimmed,
- they must match the allowed character pattern (`/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/u`),
- URLs are rejected.

## What to change when editing the CLI

- Update parser behavior in `src/commands.ts` first.
- Then update any user-visible text in `src/cli.tsx` and `README.md`.
- If new options affect run behavior, make sure `src/agent/index.ts` and `src/credentials.tsx` still receive the right inputs.
- If adding a provider, add a `PROVIDER_CONFIGS` entry and `MANAGED_ENV_KEYS` entries in `src/env.ts` for any new env keys — but also plan a new execution path analogous to `src/agent/claude-cli/`, since there is no `createModel` branch point to hook a hosted-model client into anymore.
- Re-check the `package.json` bin entry and scripts if the entrypoint changes.

## Source map

- `src/cli.tsx`
- `src/commands.ts`
- `src/credentials.tsx`
- `src/constants.ts`
- `src/env.ts`
- `src/agent/index.ts`
- `src/auth/oauth.ts`
- `src/auth/providers.ts`
- `src/auth/configure.ts`
- `src/auth/ngrok.ts`
- `README.md`
- `package.json`
- Git evidence: commits `ceded10`, `f89b05d`, `fd3a702`, `8278c36`, `0fa1430`
