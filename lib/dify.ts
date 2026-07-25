import { config, getDifyInputs } from "./config";
import type { DifyChatMessageResponse } from "./types";

export async function sendDifyMessage(args: {
  query: string;
  user: string;
  conversationId?: string | null;
}): Promise<DifyChatMessageResponse> {
  const response = await fetch(`${config.difyBaseUrl}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.difyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: getDifyInputs(),
      query: args.query,
      response_mode: "blocking",
      conversation_id: args.conversationId ?? "",
      user: args.user,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Dify request failed with ${response.status}: ${detail}`);
  }

  return (await response.json()) as DifyChatMessageResponse;
}
