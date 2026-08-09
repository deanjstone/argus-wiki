# argus-wiki

## Status

**ARCHIVED 2026-08-09.** This codebase was subtree-merged in full (with git history) into `deanjstone/argus-context` as `packages/wiki` on 2026-08-03, making this standalone repo redundant — it had been running a duplicate daily scheduled workflow alongside `argus-context`'s own on the same self-hosted runner. Superseded by `deanjstone/argus-context` (`packages/wiki`). See [deanjstone/argus-wiki#43](https://github.com/deanjstone/argus-wiki/issues/43) for the full decommission record.

Light-touch fork of [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki), retargeted at the CONTEXT/CORTEX Obsidian vaults instead of a fresh `~/.openwiki` tree.

## Remotes

- `origin` → `deanjstone/argus-wiki` (this fork)
- `upstream` → `langchain-ai/openwiki` — **hard fork**: `upstream` is kept but pulled only **on-demand** (e.g. a specific security fix worth cherry-picking), never routinely, and never `git merge upstream/main` as a matter of course. This fork has no obligation to track upstream releases and never contributes fixes back to `langchain-ai/openwiki`, even when generic. Full rationale locked in [wayfinder map #15](https://github.com/deanjstone/argus-wiki/issues/15).

## Local divergence from upstream

- `src/constants.ts` / `src/openwiki-home.ts` — `OPEN_WIKI_DIR` and `openWikiHomeDir` are env-overridable (`OPENWIKI_OUTPUT_DIR`, `OPENWIKI_HOME`), defaulting to upstream's original paths when unset. No longer deliberately kept small — hard-fork status ([wayfinder map #15](https://github.com/deanjstone/argus-wiki/issues/15)) means upstream merges are on-demand/cherry-pick-only, not routine, so minimizing diff surface here is no longer a design constraint; these files can be refactored or expanded freely.
- `src/constants.ts` — `OpenWikiProvider` is narrowed to `"claude-cli"` only. This fork only ever runs headless via `OPENWIKI_PROVIDER=claude-cli`, so all other agent backends, the LangChain/LangGraph execution core, and PostHog telemetry were removed ([#35](https://github.com/deanjstone/argus-wiki/issues/35)). The provider abstraction itself (`OpenWikiProvider` union, `PROVIDER_CONFIGS` keyed lookup) remains pluggable, just narrowed to one member.

## Not yet done

All forkpoint items tracked by [wayfinder map #15](https://github.com/deanjstone/argus-wiki/issues/15) are resolved — structural/routine auto-merge is implemented and validated end-to-end (`deanjstone/argus-wiki#17`), and `OPENWIKI_HOME`/`OPENWIKI_OUTPUT_DIR` plumbing is validated (`deanjstone/argus-wiki#8`; an end-to-end run against the real vaults remains governed by `deanjstone/context#3`, not this repo).

---

## OpenWiki (upstream, self-generated)

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
