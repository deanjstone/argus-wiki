import { describe, expect, test } from "vitest";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  DEFAULT_PROVIDER_RETRY_ATTEMPTS,
  getDefaultModelId,
  getMissingProviderEnvKey,
  getProviderApiKeyEnvKey,
  getProviderModelOptions,
  getProviderRegionEnvKey,
  getProviderSecretKeyEnvKey,
  isValidBaseUrl,
  isValidModelId,
  isValidProvider,
  normalizeModelId,
  normalizeProvider,
  providerRequiresApiKey,
  providerRequiresRegion,
  providerRequiresSecretKey,
  resolveConfiguredProvider,
  resolveProviderBaseUrl,
  resolveProviderLocation,
  resolveProviderRegion,
  resolveProviderRetryAttempts,
} from "../src/constants.ts";

describe("isValidModelId", () => {
  test("accepts normal provider/model ids", () => {
    expect(isValidModelId("claude-opus-4-8")).toBe(true);
    expect(isValidModelId("z-ai/glm-5.2")).toBe(true);
    expect(isValidModelId("accounts/fireworks/models/glm-5p2")).toBe(true);
    expect(isValidModelId("gpt-5.4-mini")).toBe(true);
    expect(isValidModelId("nvidia/nemotron-3-super-120b-a12b")).toBe(true);
  });

  test("rejects empty, whitespace-only, and over-long ids", () => {
    expect(isValidModelId("")).toBe(false);
    expect(isValidModelId("   ")).toBe(false);
    expect(isValidModelId("a".repeat(121))).toBe(false);
    expect(isValidModelId("a".repeat(120))).toBe(true);
  });

  test("rejects ids containing a scheme (://)", () => {
    expect(isValidModelId("http://evil.example/model")).toBe(false);
  });

  test("accepts @-versioned model ids", () => {
    expect(isValidModelId("claude-haiku-4-5@20251001")).toBe(true);
  });

  test("rejects ids starting with a non-alphanumeric character", () => {
    expect(isValidModelId("-leading-dash")).toBe(false);
    expect(isValidModelId("/leading-slash")).toBe(false);
    expect(isValidModelId("@leading-at")).toBe(false);
  });

  test("normalizeModelId trims surrounding whitespace", () => {
    expect(normalizeModelId("  claude-opus-4-8  ")).toBe("claude-opus-4-8");
  });
});

describe("normalizeProvider / isValidProvider", () => {
  test("normalizes case and whitespace to the known provider", () => {
    expect(normalizeProvider("  Claude-Cli ")).toBe("claude-cli");
    expect(normalizeProvider("CLAUDE-CLI")).toBe("claude-cli");
  });

  test("returns null for unknown or nullish providers", () => {
    expect(normalizeProvider("bogus")).toBeNull();
    expect(normalizeProvider("anthropic")).toBeNull();
    expect(normalizeProvider(null)).toBeNull();
    expect(normalizeProvider(undefined)).toBeNull();
  });

  test("isValidProvider is a type guard over the known set", () => {
    expect(isValidProvider("claude-cli")).toBe(true);
    expect(isValidProvider("anthropic")).toBe(false);
    expect(isValidProvider("nope")).toBe(false);
  });
});

describe("resolveConfiguredProvider", () => {
  test("honors an explicit OPENWIKI_PROVIDER", () => {
    expect(resolveConfiguredProvider({ OPENWIKI_PROVIDER: "claude-cli" })).toBe(
      "claude-cli",
    );
  });

  test("falls back to the default provider when nothing is configured", () => {
    expect(resolveConfiguredProvider({})).toBe(DEFAULT_PROVIDER);
  });

  test("ignores an invalid OPENWIKI_PROVIDER value", () => {
    expect(resolveConfiguredProvider({ OPENWIKI_PROVIDER: "bogus" })).toBe(
      DEFAULT_PROVIDER,
    );
  });
});

describe("resolveProviderBaseUrl", () => {
  test("returns undefined for claude-cli, which has no base URL concept", () => {
    expect(resolveProviderBaseUrl("claude-cli", {})).toBeUndefined();
  });
});

describe("resolveProviderRetryAttempts", () => {
  test("uses the OpenWiki default when no override is set", () => {
    expect(resolveProviderRetryAttempts({})).toBe(
      DEFAULT_PROVIDER_RETRY_ATTEMPTS,
    );
  });

  test("accepts positive integer retry counts", () => {
    expect(
      resolveProviderRetryAttempts({
        OPENWIKI_PROVIDER_RETRY_ATTEMPTS: "1",
      }),
    ).toBe(1);
    expect(
      resolveProviderRetryAttempts({
        OPENWIKI_PROVIDER_RETRY_ATTEMPTS: " 3 ",
      }),
    ).toBe(3);
  });

  test("rejects invalid retry counts", () => {
    for (const value of ["", "   ", "0", "-1", "1.5", "abc", "1e2"]) {
      expect(() =>
        resolveProviderRetryAttempts({
          OPENWIKI_PROVIDER_RETRY_ATTEMPTS: value,
        }),
      ).toThrow(/OPENWIKI_PROVIDER_RETRY_ATTEMPTS/u);
    }
  });
});

describe("isValidBaseUrl", () => {
  test("accepts http and https URLs", () => {
    expect(isValidBaseUrl("https://api.example.com/v1")).toBe(true);
    expect(isValidBaseUrl("http://localhost:8080")).toBe(true);
  });

  test("rejects blank, non-URL, and non-http(s) schemes", () => {
    expect(isValidBaseUrl("")).toBe(false);
    expect(isValidBaseUrl("   ")).toBe(false);
    expect(isValidBaseUrl("not a url")).toBe(false);
    expect(isValidBaseUrl("ftp://example.com")).toBe(false);
  });
});

describe("claude-cli provider (fully keyless, spawns the operator's authenticated CLI)", () => {
  test("requires no API key, secret key, or region", () => {
    expect(providerRequiresApiKey("claude-cli")).toBe(false);
    expect(providerRequiresSecretKey("claude-cli")).toBe(false);
    expect(providerRequiresRegion("claude-cli")).toBe(false);
    expect(getProviderApiKeyEnvKey("claude-cli")).toBeUndefined();
    expect(getProviderSecretKeyEnvKey("claude-cli")).toBeUndefined();
    expect(getProviderRegionEnvKey("claude-cli")).toBeUndefined();
  });

  test("resolveProviderRegion returns undefined (no region concept)", () => {
    expect(resolveProviderRegion("claude-cli", {})).toBeUndefined();
  });

  test("has no preset model list", () => {
    expect(getProviderModelOptions("claude-cli")).toEqual([]);
  });

  test("getMissingProviderEnvKey is always null (nothing required)", () => {
    expect(getMissingProviderEnvKey("claude-cli", {})).toBeNull();
  });

  test("resolveProviderLocation returns undefined (no location concept)", () => {
    expect(resolveProviderLocation("claude-cli", {})).toBeUndefined();
  });

  test("getDefaultModelId falls back to the global DEFAULT_MODEL_ID", () => {
    expect(getDefaultModelId("claude-cli")).toBe(DEFAULT_MODEL_ID);
  });
});
