import { config } from "../../../lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = {
  connected: boolean;
  baseUrl: string;
  accountId?: number | null;
  error?: string | null;
};

async function checkDifyHealth(): Promise<HealthStatus> {
  if (!config.difyApiKey) {
    return { connected: false, baseUrl: config.difyBaseUrl, error: "API key is missing" };
  }

  try {
    const res = await fetch(`${config.difyBaseUrl}/parameters`, {
      headers: {
        Authorization: `Bearer ${config.difyApiKey}`,
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      return { connected: true, baseUrl: config.difyBaseUrl, error: null };
    }

    const detail = await res.text();
    return {
      connected: false,
      baseUrl: config.difyBaseUrl,
      error: `Auth error (Status ${res.status}): ${detail.substring(0, 100)}`,
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl: config.difyBaseUrl,
      error: err instanceof Error ? err.message : "Connection timed out",
    };
  }
}

async function checkChatwootHealth(): Promise<HealthStatus> {
  if (!config.chatwootApiToken || !config.chatwootAccountId) {
    return {
      connected: false,
      baseUrl: config.chatwootBaseUrl,
      accountId: config.chatwootAccountId,
      error: "API token or Account ID is missing",
    };
  }

  try {
    const res = await fetch(
      `${config.chatwootBaseUrl}/api/v1/accounts/${config.chatwootAccountId}/conversations?page=1`,
      {
        headers: {
          api_access_token: config.chatwootApiToken,
        },
        next: { revalidate: 0 },
      }
    );

    if (res.ok) {
      return {
        connected: true,
        baseUrl: config.chatwootBaseUrl,
        accountId: config.chatwootAccountId,
        error: null,
      };
    }

    const detail = await res.text();
    return {
      connected: false,
      baseUrl: config.chatwootBaseUrl,
      accountId: config.chatwootAccountId,
      error: `Auth error (Status ${res.status}): ${detail.substring(0, 100)}`,
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl: config.chatwootBaseUrl,
      accountId: config.chatwootAccountId,
      error: err instanceof Error ? err.message : "Connection timed out",
    };
  }
}

export async function GET() {
  const [difyHealth, chatwootHealth] = await Promise.all([
    checkDifyHealth(),
    checkChatwootHealth(),
  ]);

  return Response.json({
    ok: difyHealth.connected && chatwootHealth.connected,
    dify: difyHealth,
    chatwoot: chatwootHealth,
  });
}
