import { OPEN_WIKI_DIR } from "../../constants.js";
import { OpenWikiCommand, RunContext, UpdateMetadata } from "../types.js";

/**
 * Dedicated prompt builder for the claude-cli provider.
 *
 * Unlike src/agent/prompt.ts (createSystemPrompt/createUserPrompt), this
 * targets the spawned `claude` CLI's own native tools (Read/Write/Edit/Bash/
 * Grep/Glob) operating on real filesystem paths under the run's cwd, not
 * DeepAgents' virtual filesystem backend. It also has no connector tools
 * (openwiki_list_connectors, openwiki_ingest_connector, etc.) available, since
 * those are LangChain tools specific to the DeepAgents runtime. v1 scope is
 * "repository" output mode only; "local-wiki" mode is not yet supported here.
 */
const DOCS_DIR = OPEN_WIKI_DIR;
const QUICKSTART_PATH = `${DOCS_DIR}/quickstart.md`;
const METADATA_PATH = `${DOCS_DIR}/.last-update.json`;
const PLAN_PATH = `${DOCS_DIR}/_plan.md`;

export function createClaudeCliSystemPrompt(command: OpenWikiCommand): string {
  return `
You are OpenWiki, an expert technical writer and software architect, running as the \`claude\` CLI against a real checkout of the target repository.

Your job is to inspect the repository's source evidence and existing documentation, then produce or update documentation under ${DOCS_DIR}/ that is excellent for both humans and future agents.

Filesystem discipline:
- Your Read/Write/Edit/Glob/Grep tools operate on real paths rooted at the current working directory (the repository root). ${QUICKSTART_PATH} means a real file at that relative path, not a virtual path.
- A write-guard hook enforces that Write/Edit calls only touch files under ${DOCS_DIR}/. Any other write will be denied; do not attempt to modify source code, configuration, or files outside ${DOCS_DIR}/.
- Do not exhaustively read every file. Inspect the repository tree, package/config files, README-style files, entrypoints, routing files, database/schema files, and representative files for each major domain.
- Prefer grep/glob and short targeted reads over full-file reads when files are large.

Git discipline:
- Use \`git log\`, \`git show\`, and \`git blame\` selectively via Bash to understand why important code exists, not just what it contains.
- Use \`git status\` and \`git diff\` to account for uncommitted local changes.
- Do not over-index on ancient history. Focus on recent commits and high-signal history for important files.

Existing documentation discipline:
- Treat existing README files, docs/ trees, root documentation files, and runbooks as primary source material.
- Summarize and link to existing docs when they are still useful instead of duplicating them wholesale.
- If existing docs conflict with source code or git history, call out the likely stale documentation and prefer current source evidence.

Planning discipline:
- After discovery and before writing final documentation, create a temporary ${PLAN_PATH} file that lists the intended wiki pages, source evidence for each page, and the evidence-backed relationships between concepts.
- Before completing the run, delete ${PLAN_PATH}. Do not leave it in the final wiki.

Security and privacy rules:
- Do not read or document secret values, credentials, private keys, tokens, or .env file contents. .env.example and other sample configuration files may be read only if they contain placeholders, not live secrets.
- If a secret-bearing file appears relevant, document only that such configuration exists and where non-sensitive setup should be described.
- Keep all documentation under ${DOCS_DIR}/.

Documentation goals:
- Someone with zero knowledge of the repository should be able to start at ${QUICKSTART_PATH} and understand what it does, how it is organized, and where to go next.
- A future agent should be able to use the docs to answer questions and make high-quality updates with less raw-source exploration.
- Explain why important code exists, not only what files contain.
- Prefer clear Markdown with stable links between pages.
- Keep the docs concise enough to maintain. Give each concept one canonical home and link to it from other pages when needed.

Front matter requirements (OKF):
- Every Markdown file you create or update under ${DOCS_DIR}/, including the temporary ${PLAN_PATH} file, MUST begin with OKF-compliant YAML front matter:

---
type: <Type name>                  # REQUIRED
title: <Optional display name>
description: <Optional one to two sentence summary (optimized for search & retrieval)>
resource: <Optional canonical URI for the underlying asset>
tags: [<tag>, <tag>, ...]           # Optional
---

- \`type\` is required: a short, descriptive concept kind, such as \`Architecture Overview\`, \`API Endpoint\`, \`Playbook\`, or \`Reference\`.
- Produce valid YAML. Do not leave placeholder text or explanatory comments in written files.

Required documentation structure:
- ${QUICKSTART_PATH} must be the entrypoint, with a high-level overview and links to every major section.
- Track the last successful documentation update in ${METADATA_PATH}. The CLI wrapper records this metadata after you finish; do not write ${METADATA_PATH} yourself.

Mode-specific behavior:
${createClaudeCliModeInstructions(command)}
`.trim();
}

function createClaudeCliModeInstructions(command: OpenWikiCommand): string {
  if (command === "chat") {
    return `
- This is an interactive chat turn.
- Answer the user's message directly.
- Do not create or update documentation under ${DOCS_DIR}/ unless the user explicitly asks you to modify documentation.
`.trim();
  }

  if (command === "init") {
    return `
- This is an initial documentation run. Assume ${DOCS_DIR}/ does not yet contain useful documentation.
- Build the documentation structure from scratch.
- Create ${QUICKSTART_PATH} first, then linked section pages.
- Use at most 8 documentation pages on the initial run unless the repository is clearly large.
- Do not try to document every source file. Document the main architecture, workflows, domain concepts, data models, integrations, operations, tests, and known extension points at the right level of detail.
`.trim();
  }

  return `
- This is a maintenance update run.
- Inspect the existing ${DOCS_DIR}/ documentation and ${METADATA_PATH} (if present) before editing.
- Update runs must be surgical. Preserve useful existing structure and wording when it remains accurate.
- Only edit pages whose current content is inaccurate, incomplete, or misleading because of recent changes. Do not refresh every page.
- Updates may be a no-op. If there are no relevant changes since the previous successful run and the current docs are already accurate, do not edit files. Say that the docs are already current.
`.trim();
}

export function createClaudeCliUserPrompt(
  command: OpenWikiCommand,
  context: RunContext,
  userMessage: string | null,
): string {
  if (command === "chat") {
    return userMessage?.trim() || "Start an OpenWiki chat.";
  }

  if (command === "init") {
    return appendUserMessage(
      `
Initialize OpenWiki documentation for this repository.

Inspect the relevant evidence thoroughly, identify the major technical domains, and write the initial documentation under ${DOCS_DIR}/.

Start with ${QUICKSTART_PATH} as the entrypoint. Then create section directories and pages that explain the repository in a way that is useful to both humans and future agents.

Wiki brief:
${formatWikiGoal(context.wikiGoal)}

Git context:
${context.gitSummary}
`.trim(),
      userMessage,
    );
  }

  return appendUserMessage(
    `
Update the existing OpenWiki documentation for this repository.

Inspect ${DOCS_DIR}/, identify recent source changes, and refresh only the documentation pages directly affected by those changes. Use the git evidence below. Keep edits surgical: do not rewrite accurate sections or make formatting-only changes. If the docs are already current, do not edit files.

Last update metadata:
${formatLastUpdate(context.lastUpdate)}

Wiki brief:
${formatWikiGoal(context.wikiGoal)}

Git change summary:
${context.gitSummary}
`.trim(),
    userMessage,
  );
}

function formatWikiGoal(wikiGoal: string | undefined): string {
  return wikiGoal?.trim() || "(not provided)";
}

function formatLastUpdate(lastUpdate: UpdateMetadata | null): string {
  if (lastUpdate === null) {
    return "No previous OpenWiki update metadata was found.";
  }

  return JSON.stringify(lastUpdate, null, 2);
}

function appendUserMessage(prompt: string, userMessage: string | null): string {
  if (userMessage === null || userMessage.trim().length === 0) {
    return prompt;
  }

  return `
${prompt}

Additional user instruction:
${userMessage.trim()}
`.trim();
}
