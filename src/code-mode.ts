import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isFileNotFoundError } from "./fs-errors.js";

const OPENWIKI_AGENTS_SNIPPET_START = "<!-- OPENWIKI:START -->";
const OPENWIKI_AGENTS_SNIPPET_END = "<!-- OPENWIKI:END -->";
const DEFAULT_CODE_MODE_CRON = "0 8 * * *";

// Root agent-instruction files OpenWiki keeps pointed at the generated wiki.
// Each is created when missing and refreshed in place when already present.
const CODE_MODE_AGENT_FILES = ["AGENTS.md", "CLAUDE.md"];

export async function ensureCodeModeRepoSetup(
  cwd: string,
  cronExpression = DEFAULT_CODE_MODE_CRON,
): Promise<void> {
  await writeCodeModeWorkflow(cwd, cronExpression);
  await writeCodeModeAgentSnippets(cwd);
}

// Created once, then left alone: once a repo has its own
// .github/workflows/openwiki-update.yml, it's operator-owned config (runner,
// provider, build steps), not a tool-managed output the generator should
// keep overwriting on every run.
async function writeCodeModeWorkflow(
  cwd: string,
  cronExpression: string,
): Promise<void> {
  const workflowPath = path.join(
    cwd,
    ".github",
    "workflows",
    "openwiki-update.yml",
  );

  if (await fileExists(workflowPath)) {
    return;
  }

  await mkdir(path.dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, createCodeModeWorkflow(cronExpression), "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

async function writeCodeModeAgentSnippets(cwd: string): Promise<void> {
  const snippet = createCodeModeAgentsSnippet();

  await Promise.all(
    CODE_MODE_AGENT_FILES.map((fileName) =>
      writeCodeModeAgentSnippet(path.join(cwd, fileName), snippet),
    ),
  );
}

async function writeCodeModeAgentSnippet(
  agentsPath: string,
  snippet: string,
): Promise<void> {
  let currentContent = "";

  try {
    currentContent = await readFile(agentsPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }

  const startIndex = currentContent.indexOf(OPENWIKI_AGENTS_SNIPPET_START);
  const endIndex = currentContent.indexOf(OPENWIKI_AGENTS_SNIPPET_END);
  const nextContent =
    startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
      ? `${currentContent.slice(0, startIndex)}${snippet}${currentContent.slice(endIndex + OPENWIKI_AGENTS_SNIPPET_END.length)}`
      : `${currentContent.trimEnd()}${currentContent.trim().length > 0 ? "\n\n" : ""}${snippet}\n`;

  await writeFile(agentsPath, nextContent, "utf8");
}

function createCodeModeWorkflow(cronExpression: string): string {
  return `name: OpenWiki Update

on:
  workflow_dispatch:
  schedule:
    - cron: "${cronExpression}"

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install OpenWiki
        run: npm install --global openwiki

      - name: Run OpenWiki
        run: openwiki code --update --print
        env:
          OPENWIKI_PROVIDER: openrouter
          OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
          OPENWIKI_MODEL_ID: z-ai/glm-5.2
          LANGSMITH_API_KEY: \${{ secrets.LANGSMITH_API_KEY }}
          LANGCHAIN_PROJECT: openwiki
          LANGCHAIN_TRACING_V2: "true"

      - name: Classify update as structural or routine
        id: classify
        run: |
          set -euo pipefail
          # The workflow file itself must never be silently auto-merged.
          if ! git diff --quiet -- .github/workflows/openwiki-update.yml; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=workflow file changed" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if git status --porcelain -- openwiki | grep -qE '^(\\?\\?|A)'; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=new file(s) under openwiki/" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          diff_output="$(git diff -- openwiki)"
          if echo "$diff_output" | grep -qE '^\\+#{2,3} '; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=new heading added" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if echo "$diff_output" | grep -qE '^\\+.*\\[.+\\]\\(.+\\)'; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=markdown link changed" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          echo "classification=routine" >> "$GITHUB_OUTPUT"
          echo "reason=prose-only content update" >> "$GITHUB_OUTPUT"

      - name: Create OpenWiki update pull request
        id: pr
        uses: peter-evans/create-pull-request@22a9089034f40e5a961c8808d113e2c98fb63676 # v7
        with:
          add-paths: |
            openwiki
            AGENTS.md
            CLAUDE.md
            .github/workflows/openwiki-update.yml
          branch: openwiki/update
          commit-message: "docs: update OpenWiki"
          title: "docs: update OpenWiki"
          body: |
            Automated OpenWiki documentation update.

            This PR was generated by the scheduled OpenWiki workflow.

            Classification: \${{ steps.classify.outputs.classification }} (\${{ steps.classify.outputs.reason }})

      - name: Auto-merge routine updates
        if: steps.classify.outputs.classification == 'routine' && steps.pr.outputs.pull-request-number
        run: gh pr merge --auto --squash "\${{ steps.pr.outputs.pull-request-number }}"
        env:
          GH_TOKEN: \${{ github.token }}
`;
}

function createCodeModeAgentsSnippet(): string {
  return `${OPENWIKI_AGENTS_SNIPPET_START}

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with \`openwiki/quickstart.md\`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

${OPENWIKI_AGENTS_SNIPPET_END}`;
}
