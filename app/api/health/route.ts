import { config } from "../../../lib/config";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    chatwootConfigured: Boolean(config.chatwootApiToken),
    difyConfigured: Boolean(config.difyApiKey),
  });
}
