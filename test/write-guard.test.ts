import { describe, expect, test } from "vitest";
import { evaluateWritePath } from "../src/agent/claude-cli/write-guard.ts";

describe("evaluateWritePath", () => {
  const repoRoot = "/home/deanj/repos/argus-wiki";

  test("allows writes inside the allowed directory", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/home/deanj/repos/argus-wiki/openwiki/architecture.md",
    });
    expect(decision).toEqual({ allowed: true });
  });

  test("allows writes at the allowed directory root itself", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/home/deanj/repos/argus-wiki/openwiki",
    });
    expect(decision.allowed).toBe(true);
  });

  test("refuses writes elsewhere in the repo", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/home/deanj/repos/argus-wiki/AGENTS.md",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Refused path: /home/deanj");
  });

  test("refuses a sibling directory that merely shares a prefix", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/home/deanj/repos/argus-wiki/openwiki-fake/notes.md",
    });
    expect(decision.allowed).toBe(false);
  });

  test("refuses writes outside the repository entirely", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/etc/passwd",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("outside the repository");
  });

  test("refuses path traversal back out of the allowed directory", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "/home/deanj/repos/argus-wiki/openwiki/../../../etc/passwd",
    });
    expect(decision.allowed).toBe(false);
  });

  test("resolves relative file paths against the hook's reported cwd", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "architecture.md",
      cwd: "/home/deanj/repos/argus-wiki/openwiki",
    });
    expect(decision.allowed).toBe(true);
  });

  test("refuses an empty file path", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "openwiki",
      filePath: "",
    });
    expect(decision.allowed).toBe(false);
  });
});

describe("evaluateWritePath (deny-list mode)", () => {
  const repoRoot = "/home/deanj/CONTEXT";
  const deniedRelativePaths = ["02.MEMORY", "MEMORY.md"];

  test("allows a write anywhere in the repo not under a denied path", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/03.SESSIONS/2026-08-05-foo.md",
    });
    expect(decision).toEqual({ allowed: true });
  });

  test("refuses a write inside a denied directory", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/02.MEMORY/feedback_example.md",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("denied path");
  });

  test("refuses a write to a denied directory's root itself", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/02.MEMORY",
    });
    expect(decision.allowed).toBe(false);
  });

  test("refuses a write to an exact denied file", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/MEMORY.md",
    });
    expect(decision.allowed).toBe(false);
  });

  test("allows a file that merely shares a name prefix with a denied entry", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/02.MEMORY-BACKUP/notes.md",
    });
    expect(decision.allowed).toBe(true);
  });

  test("still refuses writes outside the repository entirely in deny-list mode", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/etc/passwd",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("outside the repository");
  });

  test("still refuses path traversal back out of the repository in deny-list mode", () => {
    const decision = evaluateWritePath({
      repoRoot,
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/03.SESSIONS/../../../etc/passwd",
    });
    expect(decision.allowed).toBe(false);
  });

  test("deny-list mode takes precedence when both an allowed dir and denied paths are given", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "01.WIKI",
      deniedRelativePaths,
      filePath: "/home/deanj/CONTEXT/04.REPOS/some-snapshot.md",
    });
    expect(decision.allowed).toBe(true);
  });

  test("an empty deniedRelativePaths array falls back to allow-single-dir mode", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "01.WIKI",
      deniedRelativePaths: [],
      filePath: "/home/deanj/CONTEXT/04.REPOS/some-snapshot.md",
    });
    expect(decision.allowed).toBe(false);
  });
});
