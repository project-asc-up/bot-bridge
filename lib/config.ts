const defaultDifyBaseUrl = "https://api.dify.ai/v1";
const defaultChatwootBaseUrl = "https://app.chatwoot.com";

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/\/+$/, "");
}

export const config = {
  difyApiKey: process.env.DIFY_API_KEY ?? "",
  difyBaseUrl: normalizeBaseUrl(process.env.DIFY_API_BASE_URL, defaultDifyBaseUrl),
  chatwootApiToken: process.env.CHATWOOT_API_TOKEN ?? "",
  chatwootBaseUrl: normalizeBaseUrl(process.env.CHATWOOT_API_BASE_URL, defaultChatwootBaseUrl),
  chatwootWebhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET ?? "",
  chatwootAccountId: process.env.CHATWOOT_ACCOUNT_ID ? Number(process.env.CHATWOOT_ACCOUNT_ID) : null,
  chatwootConversationStateKey: process.env.CHATWOOT_CONVERSATION_STATE_KEY ?? "dify_conversation_id",
  difyInputsJson: process.env.DIFY_INPUTS_JSON ?? "",
  webhookMaxAgeSeconds: Number(process.env.CHATWOOT_WEBHOOK_MAX_AGE_SECONDS ?? "300"),
} as const;

export function assertRuntimeConfig(): void {
  const missing: string[] = [];

  if (!config.difyApiKey) {
    missing.push("DIFY_API_KEY");
  }

  if (!config.chatwootApiToken) {
    missing.push("CHATWOOT_API_TOKEN");
  }

  if (!config.chatwootAccountId) {
    missing.push("CHATWOOT_ACCOUNT_ID");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function getDifyInputs(): Record<string, unknown> {
  if (!config.difyInputsJson) {
    return {};
  }

  const parsed = JSON.parse(config.difyInputsJson) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("DIFY_INPUTS_JSON must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}
