import { after } from "next/server";
import { assertRuntimeConfig, config } from "../../../lib/config";
import {
  getConversationDetails,
  postConversationMessage,
  updateConversationCustomAttributes,
  updateConversationStatus,
} from "../../../lib/chatwoot";
import { sendDifyMessage } from "../../../lib/dify";
import { verifyChatwootSignature } from "../../../lib/signature";
import { addTrafficLog } from "../../../lib/traffic";
import type { ChatwootWebhookEnvelope } from "../../../lib/types";

export const runtime = "nodejs";
const HANDOFF_TOKEN = "[HANDOFF]";

type ResolvedWebhook = {
  accountId: number | null;
  conversationId: number | null;
  messageType: string | null;
  content: string | null;
  status: string | null;
  customAttributes: Record<string, unknown>;
};

function readConversationId(payload: ChatwootWebhookEnvelope): number | null {
  if (typeof payload.conversation?.id === "number") {
    return payload.conversation.id;
  }

  const candidate = payload.conversation?.id ?? payload["conversation_id"] ?? payload["conversationId"];
  if (typeof candidate === "number") {
    return candidate;
  }

  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readAccountId(payload: ChatwootWebhookEnvelope): number | null {
  if (typeof payload.conversation?.account_id === "number") {
    return payload.conversation.account_id;
  }

  if (typeof payload.account?.id === "number") {
    return payload.account.id;
  }

  const candidate = payload["account_id"];
  if (typeof candidate === "number") {
    return candidate;
  }

  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readMessageType(payload: ChatwootWebhookEnvelope): string | null {
  const candidate = payload.message_type ?? payload["type"];
  return typeof candidate === "string" ? candidate : null;
}

function readContent(payload: ChatwootWebhookEnvelope): string | null {
  const candidate = payload.content ?? payload["message"] ?? payload["text"];
  return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null;
}

function readStatus(payload: ChatwootWebhookEnvelope): string | null {
  const candidate = payload.conversation?.status ?? payload["status"];
  return typeof candidate === "string" ? candidate : null;
}

function readCustomAttributes(payload: ChatwootWebhookEnvelope): Record<string, unknown> {
  const candidate = payload.conversation?.custom_attributes ?? payload["custom_attributes"];
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>;
  }

  return {};
}

function resolveWebhook(payload: ChatwootWebhookEnvelope): ResolvedWebhook {
  return {
    accountId: readAccountId(payload),
    conversationId: readConversationId(payload),
    messageType: readMessageType(payload),
    content: readContent(payload),
    status: readStatus(payload),
    customAttributes: readCustomAttributes(payload),
  };
}

async function loadConversationContext(args: ResolvedWebhook): Promise<ResolvedWebhook> {
  const accountId = args.accountId ?? config.chatwootAccountId;

  if (!args.conversationId || !accountId) {
    return args;
  }

  if (args.status && Object.keys(args.customAttributes).length > 0) {
    return args;
  }

  const details = await getConversationDetails({
    accountId,
    conversationId: args.conversationId,
  });
  if (!details) {
    return args;
  }

  return {
    ...args,
    accountId,
    status: args.status ?? details.status ?? null,
    customAttributes: Object.keys(args.customAttributes).length > 0 ? args.customAttributes : (details.custom_attributes ?? {}),
  };
}

async function processWebhook(payload: ChatwootWebhookEnvelope): Promise<void> {
  assertRuntimeConfig();

  const resolved = await loadConversationContext(resolveWebhook(payload));
  const accountId = resolved.accountId ?? config.chatwootAccountId;

  if (!accountId || !resolved.conversationId || !resolved.content) {
    console.warn("Skipping webhook: missing account, conversation, or content");
    return;
  }

  const messageType = resolved.messageType?.toLowerCase();
  const status = resolved.status?.toLowerCase();

  if (messageType && messageType !== "incoming") {
    addTrafficLog({
      accountId,
      conversationId: resolved.conversationId,
      direction: "outgoing",
      content: resolved.content,
      action: "sent",
      details: "Outgoing message sent from Chatwoot (ignored by bot)"
    });
    return;
  }

  addTrafficLog({
    accountId,
    conversationId: resolved.conversationId,
    direction: "incoming",
    content: resolved.content,
    action: "received",
    details: `Status: ${resolved.status || "pending"}`
  });

  if (status && status !== "pending") {
    console.info(`Skipping conversation ${resolved.conversationId} because status is ${status}`);
    addTrafficLog({
      accountId,
      conversationId: resolved.conversationId,
      direction: "incoming",
      content: resolved.content,
      action: "ignored",
      details: `Skipped: status is ${status} (expected pending)`
    });
    return;
  }

  const storedDifyConversationId = resolved.customAttributes[config.chatwootConversationStateKey];
  const difyConversationId =
    typeof storedDifyConversationId === "string" && storedDifyConversationId.trim() !== ""
      ? storedDifyConversationId
      : null;

  const startTime = Date.now();
  let difyReply;
  try {
    difyReply = await sendDifyMessage({
      query: resolved.content,
      user: `chatwoot:${accountId}:${resolved.conversationId}`,
      conversationId: difyConversationId,
    });
  } catch (error) {
    console.error(`Dify request failed for conversation ${resolved.conversationId}:`, error);
    addTrafficLog({
      accountId,
      conversationId: resolved.conversationId,
      direction: "system",
      content: resolved.content,
      action: "error",
      details: `Dify error: ${error instanceof Error ? error.message : String(error)}`
    });
    await updateConversationStatus({
      accountId,
      conversationId: resolved.conversationId,
      status: "open",
    });
    return;
  }

  const latencyMs = Date.now() - startTime;

  const answer = difyReply.answer?.trim();
  if (!answer) {
    console.warn(`Dify returned no answer for conversation ${resolved.conversationId}`);
    addTrafficLog({
      accountId,
      conversationId: resolved.conversationId,
      direction: "system",
      content: resolved.content,
      action: "error",
      details: "Dify returned an empty answer. Triggering human takeover."
    });
    await updateConversationStatus({
      accountId,
      conversationId: resolved.conversationId,
      status: "open",
    });
    return;
  }

  if (answer.includes(HANDOFF_TOKEN)) {
    console.info(`Dify requested handoff for conversation ${resolved.conversationId}`);
    addTrafficLog({
      accountId,
      conversationId: resolved.conversationId,
      direction: "system",
      content: answer,
      action: "handoff",
      details: "Handoff keyword matched. Status updated to open.",
      latencyMs,
      tokens: difyReply.metadata?.usage?.total_tokens,
      model: config.difyModel,
      cost: difyReply.metadata?.usage?.total_price ? parseFloat(difyReply.metadata.usage.total_price) : undefined,
    });
    await updateConversationStatus({
      accountId,
      conversationId: resolved.conversationId,
      status: "open",
    });
    return;
  }

  await postConversationMessage({
    accountId,
    conversationId: resolved.conversationId,
    content: answer,
  });

  addTrafficLog({
    accountId,
    conversationId: resolved.conversationId,
    direction: "outgoing",
    content: answer,
    action: "dify_reply",
    details: `Successfully sent AI reply to Chatwoot (dify_id: ${difyReply.conversation_id || "none"})`,
    latencyMs,
    tokens: difyReply.metadata?.usage?.total_tokens,
    model: config.difyModel,
    cost: difyReply.metadata?.usage?.total_price ? parseFloat(difyReply.metadata.usage.total_price) : undefined,
  });

  if (difyReply.conversation_id && difyReply.conversation_id !== difyConversationId) {
    await updateConversationCustomAttributes({
      accountId,
      conversationId: resolved.conversationId,
      customAttributes: {
        [config.chatwootConversationStateKey]: difyReply.conversation_id,
      },
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let payload: ChatwootWebhookEnvelope;

  try {
    payload = JSON.parse(rawBody) as ChatwootWebhookEnvelope;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const signatureOk = verifyChatwootSignature({
    secret: config.chatwootWebhookSecret,
    timestamp: request.headers.get("X-Chatwoot-Timestamp"),
    signature: request.headers.get("X-Chatwoot-Signature"),
    rawBody,
    maxAgeSeconds: config.webhookMaxAgeSeconds,
  });

  if (!signatureOk) {
    addTrafficLog({
      accountId: readAccountId(payload),
      conversationId: readConversationId(payload),
      direction: "incoming",
      content: "Invalid webhook signature",
      action: "error",
      details: "Blocked due to signature mismatch or stale request."
    });
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const event = typeof payload.event === "string" ? payload.event : null;
  const messageType = readMessageType(payload);
  const content = readContent(payload);

  const senderType = payload.sender && typeof payload.sender === "object" && "type" in payload.sender
    ? (payload.sender as { type?: string }).type
    : null;

  const isOutgoingFromHuman =
    event === "message_created" &&
    messageType?.toLowerCase() === "outgoing" &&
    senderType === "user";

  const shouldHandleChatwootWebhook =
    ((event === "message_created" || event === "message_create" || event === null) &&
      content !== null &&
      (messageType === null || messageType.toLowerCase() === "incoming")) ||
    isOutgoingFromHuman;

  if (!shouldHandleChatwootWebhook) {
    return Response.json({ ok: true, ignored: true });
  }

  after(async () => {
    try {
      await processWebhook(payload);
    } catch (error) {
      console.error("Webhook processing failed:", error);
    }
  });

  return Response.json({ ok: true });
}
