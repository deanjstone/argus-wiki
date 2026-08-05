import path from "node:path";

/**
 * Path-based write guard for the claude-cli provider.
 *
 * The `claude` CLI backend bypasses DeepAgents entirely (see docs-only-backend.ts),
 * so the docs-only restriction has to be re-enforced out of band via a PreToolUse
 * hook instead of a LocalShellBackend subclass. This module holds the pure
 * decision logic so it can be unit tested without spawning a real hook process.
 */
export interface WriteGuardDecision {
  allowed: boolean;
  reason?: string;
}

export interface EvaluateWritePathOptions {
  /** Absolute path to the repository root the claude-cli agent was launched against. */
  repoRoot: string;
  /**
   * Path, relative to repoRoot, that writes/edits must stay within (e.g. "openwiki").
   * Ignored when deniedRelativePaths is given and non-empty.
   */
  allowedRelativeDir?: string;
  /**
   * Paths (files or directories), relative to repoRoot, that writes/edits must stay
   * OUT of — every other path in the repo is allowed. When given and non-empty, this
   * takes precedence over allowedRelativeDir. Used by run configurations (e.g. a vault
   * repo's whole-tree INBOX-filing) where the agent needs broad write access minus a
   * small set of paths owned by another writer, rather than a single allowed subtree.
   */
  deniedRelativePaths?: string[];
  /** The file_path the tool call wants to write/edit, as reported by Claude Code. */
  filePath: string;
  /** cwd reported by the hook payload, used to resolve relative filePath values. */
  cwd?: string;
}

export function evaluateWritePath(
  options: EvaluateWritePathOptions,
): WriteGuardDecision {
  const { repoRoot, allowedRelativeDir, deniedRelativePaths, filePath, cwd } =
    options;

  if (!filePath || filePath.trim() === "") {
    return { allowed: false, reason: "Refused: empty file path." };
  }

  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedFilePath = path.resolve(cwd ?? resolvedRepoRoot, filePath);

  if (!isWithinDir(resolvedRepoRoot, resolvedFilePath)) {
    return {
      allowed: false,
      reason: `Refused path: ${filePath} is outside the repository (${resolvedRepoRoot}).`,
    };
  }

  if (deniedRelativePaths && deniedRelativePaths.length > 0) {
    const deniedDirs = deniedRelativePaths.map((relativePath) =>
      path.resolve(resolvedRepoRoot, relativePath),
    );
    const hit = deniedDirs.find((deniedDir) =>
      isWithinDir(deniedDir, resolvedFilePath),
    );
    if (hit) {
      return {
        allowed: false,
        reason: `claude-cli init/update runs may not write under denied path ${path.relative(resolvedRepoRoot, hit)}/. Refused path: ${filePath}`,
      };
    }
    return { allowed: true };
  }

  const allowedDir = path.resolve(
    resolvedRepoRoot,
    allowedRelativeDir ?? "openwiki",
  );
  if (!isWithinDir(allowedDir, resolvedFilePath)) {
    return {
      allowed: false,
      reason: `claude-cli init/update runs may only write under ${allowedRelativeDir ?? "openwiki"}/. Refused path: ${filePath}`,
    };
  }

  return { allowed: true };
}

function isWithinDir(dir: string, target: string): boolean {
  return target === dir || target.startsWith(`${dir}${path.sep}`);
}
