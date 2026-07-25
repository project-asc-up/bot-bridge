import { config } from "./config";

type ConversationDetails = {
  id?: number;
  status?: string;
  custom_attributes?: Record<string, unknown>;
};

export async function getConversationDetails(args: {
  accountId: number;
  conversationId: number;
}): Promise<ConversationDetails | null> {
  const { accountId, conversationId } = args;
  const response = await fetch(
    `${config.chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`,
    {
      headers: {
        api_access_token: config.chatwootApiToken,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ConversationDetails;
}

export async function postConversationMessage(args: {
  accountId: number;
  conversationId: number;
  content: string;
}): Promise<Response> {
  const { accountId, conversationId, content } = args;

  return fetch(
    `${config.chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        api_access_token: config.chatwootApiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        message_type: "outgoing",
        private: false,
        content_type: "text",
        content_attributes: {},
      }),
    },
  );
}

export async function updateConversationCustomAttributes(args: {
  accountId: number;
  conversationId: number;
  customAttributes: Record<string, unknown>;
}): Promise<Response> {
  const { accountId, conversationId, customAttributes } = args;

  return fetch(
    `${config.chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/custom_attributes`,
    {
      method: "POST",
      headers: {
        api_access_token: config.chatwootApiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        custom_attributes: customAttributes,
      }),
    },
  );
}

export async function updateConversationStatus(args: {
  accountId: number;
  conversationId: number;
  status: "open" | "pending" | "resolved" | "snoozed";
}): Promise<Response> {
  const { accountId, conversationId, status } = args;

  return fetch(`${config.chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`, {
    method: "PATCH",
    headers: {
      api_access_token: config.chatwootApiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}
