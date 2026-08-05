export const OPEN_WIKI_DIR = process.env.OPENWIKI_OUTPUT_DIR ?? "openwiki";
export const UPDATE_METADATA_PATH = `${OPEN_WIKI_DIR}/.last-update.json`;

/**
 * Comma-separated paths (files or directories, relative to the repo root)
 * the claude-cli write guard must refuse to touch. When set and non-empty,
 * this switches the guard from its default single-allowed-directory mode
 * (writes confined to OPEN_WIKI_DIR) to deny-list mode (writes allowed
 * anywhere except these paths) — see write-guard.ts's deniedRelativePaths.
 * Unset by default: existing per-repo docs-only runs are unaffected.
 */
export const OPEN_WIKI_DENIED_DIRS = process.env.OPENWIKI_DENIED_PATHS
  ? process.env.OPENWIKI_DENIED_PATHS.split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  : [];

export const BASETEN_API_KEY_ENV_KEY = "BASETEN_API_KEY";
export const FIREWORKS_API_KEY_ENV_KEY = "FIREWORKS_API_KEY";
export const NEBIUS_API_KEY_ENV_KEY = "NEBIUS_API_KEY";
export const NVIDIA_API_KEY_ENV_KEY = "NVIDIA_API_KEY";
export const OPENAI_API_KEY_ENV_KEY = "OPENAI_API_KEY";
export const OPENAI_COMPATIBLE_API_KEY_ENV_KEY = "OPENAI_COMPATIBLE_API_KEY";
export const OPENAI_COMPATIBLE_BASE_URL_ENV_KEY = "OPENAI_COMPATIBLE_BASE_URL";
export const OPENAI_CHATGPT_ACCESS_TOKEN_ENV_KEY =
  "OPENAI_CHATGPT_ACCESS_TOKEN";
export const OPENAI_CHATGPT_REFRESH_TOKEN_ENV_KEY =
  "OPENAI_CHATGPT_REFRESH_TOKEN";
export const OPENAI_CHATGPT_EXPIRES_AT_ENV_KEY = "OPENAI_CHATGPT_EXPIRES_AT";
export const OPENAI_CHATGPT_ACCOUNT_ID_ENV_KEY = "OPENAI_CHATGPT_ACCOUNT_ID";
export const OPENAI_CHATGPT_EMAIL_ENV_KEY = "OPENAI_CHATGPT_EMAIL";
export const OPENAI_CHATGPT_PLAN_ENV_KEY = "OPENAI_CHATGPT_PLAN";
export const ANTHROPIC_API_KEY_ENV_KEY = "ANTHROPIC_API_KEY";
export const ANTHROPIC_BASE_URL_ENV_KEY = "ANTHROPIC_BASE_URL";
export const OPENROUTER_API_KEY_ENV_KEY = "OPENROUTER_API_KEY";
export const BEDROCK_AWS_ACCESS_KEY_ID_ENV_KEY = "BEDROCK_AWS_ACCESS_KEY_ID";
export const BEDROCK_AWS_SECRET_ACCESS_KEY_ENV_KEY =
  "BEDROCK_AWS_SECRET_ACCESS_KEY";
export const BEDROCK_AWS_REGION_ENV_KEY = "BEDROCK_AWS_REGION";
export const GEMINI_API_KEY_ENV_KEY = "GEMINI_API_KEY";
export const GOOGLE_CLOUD_PROJECT_ENV_KEY = "GOOGLE_CLOUD_PROJECT";
export const GOOGLE_CLOUD_LOCATION_ENV_KEY = "GOOGLE_CLOUD_LOCATION";
export const GOOGLE_APPLICATION_CREDENTIALS_ENV_KEY =
  "GOOGLE_APPLICATION_CREDENTIALS";
export const DEFAULT_VERTEX_LOCATION = "global";
export const OPENWIKI_PROVIDER_ENV_KEY = "OPENWIKI_PROVIDER";
export const OPENWIKI_MODEL_ID_ENV_KEY = "OPENWIKI_MODEL_ID";
export const OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY =
  "OPENWIKI_PROVIDER_RETRY_ATTEMPTS";
export const DEFAULT_PROVIDER_RETRY_ATTEMPTS = 3;
export const OPENWIKI_GOOGLE_ACCESS_TOKEN_ENV_KEY =
  "OPENWIKI_GOOGLE_ACCESS_TOKEN";
export const OPENWIKI_GOOGLE_CLIENT_ID_ENV_KEY = "OPENWIKI_GOOGLE_CLIENT_ID";
export const OPENWIKI_GOOGLE_CLIENT_SECRET_ENV_KEY =
  "OPENWIKI_GOOGLE_CLIENT_SECRET";
export const OPENWIKI_GOOGLE_REFRESH_TOKEN_ENV_KEY =
  "OPENWIKI_GOOGLE_REFRESH_TOKEN";
export const OPENWIKI_GMAIL_ACCESS_TOKEN_ENV_KEY =
  "OPENWIKI_GMAIL_ACCESS_TOKEN";
export const OPENWIKI_GMAIL_REFRESH_TOKEN_ENV_KEY =
  "OPENWIKI_GMAIL_REFRESH_TOKEN";
export const OPENWIKI_NOTION_MCP_ACCESS_TOKEN_ENV_KEY =
  "OPENWIKI_NOTION_MCP_ACCESS_TOKEN";
export const OPENWIKI_NOTION_MCP_CLIENT_ID_ENV_KEY =
  "OPENWIKI_NOTION_MCP_CLIENT_ID";
export const OPENWIKI_NOTION_MCP_REFRESH_TOKEN_ENV_KEY =
  "OPENWIKI_NOTION_MCP_REFRESH_TOKEN";
export const OPENWIKI_NOTION_TOKEN_ENV_KEY = "OPENWIKI_NOTION_TOKEN";
export const OPENWIKI_SLACK_BOT_TOKEN_ENV_KEY = "OPENWIKI_SLACK_BOT_TOKEN";
export const OPENWIKI_SLACK_CLIENT_ID_ENV_KEY = "OPENWIKI_SLACK_CLIENT_ID";
export const OPENWIKI_SLACK_CLIENT_SECRET_ENV_KEY =
  "OPENWIKI_SLACK_CLIENT_SECRET";
export const OPENWIKI_SLACK_USER_TOKEN_ENV_KEY = "OPENWIKI_SLACK_USER_TOKEN";
export const OPENWIKI_X_ACCESS_TOKEN_ENV_KEY = "OPENWIKI_X_ACCESS_TOKEN";
export const OPENWIKI_X_CLIENT_ID_ENV_KEY = "OPENWIKI_X_CLIENT_ID";
export const OPENWIKI_X_CLIENT_SECRET_ENV_KEY = "OPENWIKI_X_CLIENT_SECRET";
export const OPENWIKI_X_REFRESH_TOKEN_ENV_KEY = "OPENWIKI_X_REFRESH_TOKEN";
export const OPENWIKI_TAVILY_API_KEY_ENV_KEY = "TAVILY_API_KEY";
export const DEFAULT_PROVIDER = "claude-cli";

export type OpenWikiProvider = "claude-cli";

/**
 * How a provider authenticates. Providers default to `"api-key"` (a pasted
 * secret persisted to a `*_API_KEY` env var); `"oauth"` providers instead run a
 * browser login flow and persist short-lived access/refresh tokens.
 */
export type ProviderAuthMethod = "api-key" | "oauth";

export type SelectableOpenWikiProvider = OpenWikiProvider;

export type ProviderModelOption = {
  id: string;
  label: string;
};

type ProviderConfig = {
  /**
   * Environment variable holding the provider's API key. Absent when the
   * provider authenticates without an API key (e.g. Google Application
   * Default Credentials for Vertex AI).
   */
  apiKeyEnvKey?: string;
  /**
   * Authentication method for the provider. Omitted entries are implicitly
   * {@link ProviderAuthMethod} `"api-key"`. `"oauth"` providers replace the
   * pasted-key setup step with a browser login and store tokens instead.
   */
  authMethod?: ProviderAuthMethod;
  baseURL?: string;
  /**
   * Environment variable that, when set, overrides {@link ProviderConfig.baseURL}
   * with an alternative base URL (e.g. a self-hosted or proxied endpoint).
   */
  baseUrlEnvKey?: string;
  /**
   * When true, the provider has no default endpoint and requires a base URL to
   * be supplied via {@link ProviderConfig.baseUrlEnvKey}.
   */
  requiresBaseUrl?: boolean;
  /**
   * Environment variable holding the cloud project identifier required to
   * run the provider (e.g. a Google Cloud project ID).
   */
  projectEnvKey?: string;
  /**
   * Environment variable that overrides {@link ProviderConfig.defaultLocation}
   * with an alternative cloud location/region.
   */
  locationEnvKey?: string;
  defaultLocation?: string;
  label: string;
  modelOptions: ProviderModelOption[];
  /**
   * Environment variable holding a second required secret (e.g. an AWS secret
   * access key paired with {@link ProviderConfig.apiKeyEnvKey} as an access key
   * ID). Omitted for providers authenticated by a single API key.
   */
  secretKeyEnvKey?: string;
  /**
   * Environment variable holding the provider's region (e.g. an AWS region).
   * Only relevant when {@link ProviderConfig.requiresRegion} is true.
   */
  regionEnvKey?: string;
  /**
   * When true, the provider has no default region and requires one to be
   * supplied via {@link ProviderConfig.regionEnvKey}.
   */
  requiresRegion?: boolean;
};

export const SELECTABLE_OPENWIKI_PROVIDERS =
  [] as const satisfies readonly SelectableOpenWikiProvider[];

export const PROVIDER_CONFIGS: Record<OpenWikiProvider, ProviderConfig> = {
  "claude-cli": {
    // Fully keyless: spawns the operator's already-authenticated `claude` CLI
    // binary as a subprocess instead of calling a hosted API. Opt-in only via
    // OPENWIKI_PROVIDER=claude-cli — deliberately excluded from
    // SELECTABLE_OPENWIKI_PROVIDERS since there is no key/OAuth setup step to
    // walk a user through in interactive onboarding.
    label: "Claude Code CLI",
    modelOptions: [],
  },
};

export const DEFAULT_MODEL_ID =
  PROVIDER_CONFIGS[DEFAULT_PROVIDER].modelOptions[0]?.id ?? "gpt-5.6-terra";

export const SUGGESTED_MODEL_IDS = PROVIDER_CONFIGS[
  DEFAULT_PROVIDER
].modelOptions.map((model) => model.id);

export function getProviderConfig(provider: OpenWikiProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function getProviderLabel(provider: OpenWikiProvider): string {
  return getProviderConfig(provider).label;
}

export function getProviderApiKeyEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).apiKeyEnvKey;
}

export function getProviderAuthMethod(
  provider: OpenWikiProvider,
): ProviderAuthMethod {
  return getProviderConfig(provider).authMethod ?? "api-key";
}

export function providerUsesOAuth(provider: OpenWikiProvider): boolean {
  return getProviderAuthMethod(provider) === "oauth";
}

export function providerRequiresApiKey(provider: OpenWikiProvider): boolean {
  return getProviderConfig(provider).apiKeyEnvKey !== undefined;
}

export function getProviderProjectEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).projectEnvKey;
}

export function getProviderLocationEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).locationEnvKey;
}

/**
 * Returns the first required-but-unset environment variable for a provider
 * (its API key, or its cloud project for providers that authenticate without
 * one), or `null` when the provider has everything it needs to run. Base URL
 * requirements are checked separately via {@link providerRequiresBaseUrl}.
 */
export function getMissingProviderEnvKey(
  provider: OpenWikiProvider,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const config = getProviderConfig(provider);

  if (config.apiKeyEnvKey && !env[config.apiKeyEnvKey]) {
    return config.apiKeyEnvKey;
  }

  if (config.projectEnvKey && !env[config.projectEnvKey]) {
    return config.projectEnvKey;
  }

  return null;
}

/**
 * Resolves the cloud location for a provider, preferring the provider's
 * configured environment variable over its built-in default. Returns
 * `undefined` for providers without a location concept.
 */
export function resolveProviderLocation(
  provider: OpenWikiProvider,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const config = getProviderConfig(provider);
  const override = config.locationEnvKey
    ? env[config.locationEnvKey]
    : undefined;
  const trimmedOverride = override?.trim();

  if (trimmedOverride) {
    return trimmedOverride;
  }

  return config.defaultLocation;
}

/**
 * A human-readable hint for providers whose credentials live outside the
 * OpenWiki env file, appended to missing-credential error messages. Keeps a
 * `provider` parameter for API-shape consistency with the rest of the
 * pluggable provider abstraction, even though the sole remaining provider
 * (claude-cli) never needs a hint.
 */
export function getProviderCredentialHint(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provider: OpenWikiProvider,
): string | null {
  return null;
}

/**
 * Resolves the base URL for a provider, preferring an alternative base URL from
 * the provider's configured environment variable over the built-in default.
 * Returns `undefined` when neither is set, so callers fall back to the SDK's
 * own default endpoint.
 */
export function resolveProviderBaseUrl(
  provider: OpenWikiProvider,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const config = getProviderConfig(provider);
  const override = config.baseUrlEnvKey ? env[config.baseUrlEnvKey] : undefined;
  const trimmedOverride = override?.trim();

  if (trimmedOverride) {
    return trimmedOverride;
  }

  return config.baseURL;
}

export function getProviderBaseUrlEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).baseUrlEnvKey;
}

export function providerRequiresBaseUrl(provider: OpenWikiProvider): boolean {
  return getProviderConfig(provider).requiresBaseUrl === true;
}

export function getProviderSecretKeyEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).secretKeyEnvKey;
}

export function providerRequiresSecretKey(provider: OpenWikiProvider): boolean {
  return getProviderConfig(provider).secretKeyEnvKey !== undefined;
}

export function getProviderRegionEnvKey(
  provider: OpenWikiProvider,
): string | undefined {
  return getProviderConfig(provider).regionEnvKey;
}

export function providerRequiresRegion(provider: OpenWikiProvider): boolean {
  return getProviderConfig(provider).requiresRegion === true;
}

/**
 * Resolves the configured region for a provider from its region environment
 * variable. Returns `undefined` when unset, so callers fall back to the SDK's
 * own region resolution (e.g. `~/.aws/config`).
 */
export function resolveProviderRegion(
  provider: OpenWikiProvider,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const regionEnvKey = getProviderRegionEnvKey(provider);
  const region = regionEnvKey ? env[regionEnvKey]?.trim() : undefined;

  return region ? region : undefined;
}

export function isValidBaseUrl(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return false;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getProviderModelOptions(
  provider: OpenWikiProvider,
): ProviderModelOption[] {
  return getProviderConfig(provider).modelOptions;
}

export function getDefaultModelId(provider: OpenWikiProvider): string {
  return getProviderModelOptions(provider)[0]?.id ?? DEFAULT_MODEL_ID;
}

export function normalizeProvider(
  value: string | null | undefined,
): OpenWikiProvider | null {
  if (value === undefined || value === null) {
    return null;
  }

  const provider = value.trim().toLowerCase();

  return isValidProvider(provider) ? provider : null;
}

export function isValidProvider(value: string): value is OpenWikiProvider {
  return value in PROVIDER_CONFIGS;
}

export function resolveConfiguredProvider(
  env: NodeJS.ProcessEnv = process.env,
): OpenWikiProvider {
  return normalizeProvider(env[OPENWIKI_PROVIDER_ENV_KEY]) ?? DEFAULT_PROVIDER;
}

export function resolveProviderRetryAttempts(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const rawRetryAttempts = env[OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY];

  if (rawRetryAttempts === undefined) {
    return DEFAULT_PROVIDER_RETRY_ATTEMPTS;
  }

  const retryAttempts = rawRetryAttempts.trim();

  if (!/^[1-9]\d*$/u.test(retryAttempts)) {
    throw new Error(
      `Invalid ${OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY}. Expected a positive integer.`,
    );
  }

  const parsedRetryAttempts = Number(retryAttempts);

  if (!Number.isSafeInteger(parsedRetryAttempts)) {
    throw new Error(
      `Invalid ${OPENWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY}. Expected a positive integer.`,
    );
  }

  return parsedRetryAttempts;
}

export function normalizeModelId(value: string): string {
  return value.trim();
}

export function isValidModelId(value: string): boolean {
  const modelId = normalizeModelId(value);

  return (
    modelId.length > 0 &&
    modelId.length <= 120 &&
    /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/u.test(modelId) &&
    !modelId.includes("://")
  );
}

export const OPENWIKI_VERSION = "0.2.0";
