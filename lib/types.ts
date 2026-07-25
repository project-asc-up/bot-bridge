export type ChatwootWebhookEnvelope = {
  event?: string;
  message_type?: string;
  content?: string;
  conversation?: {
    id?: number;
    status?: string;
    account_id?: number;
    custom_attributes?: Record<string, unknown>;
  };
  account?: {
    id?: number;
  };
  data?: unknown;
  [key: string]: unknown;
};

export type DifyChatMessageResponse = {
  answer?: string;
  conversation_id?: string;
  message_id?: string;
  task_id?: string;
  event?: string;
  mode?: string;
};
