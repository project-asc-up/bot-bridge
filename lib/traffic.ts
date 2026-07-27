import { prisma } from "./db";

export type TrafficLog = {
  id: string;
  timestamp: string;
  accountId: number | null;
  conversationId: number | null;
  direction: "incoming" | "outgoing" | "system";
  action: "received" | "ignored" | "sent" | "dify_reply" | "handoff" | "error";
  content: string;
  details?: string;
  latencyMs?: number;
  tokens?: number;
  model?: string;
  cost?: number;
};

const MAX_FALLBACK_LOGS = 100;

// Use globalRef to prevent memory resets during Next.js Hot Module Replacement (HMR) in dev mode
const globalRef = globalThis as unknown as { trafficLogs?: TrafficLog[] };
if (!globalRef.trafficLogs) {
  globalRef.trafficLogs = [];
}

export const trafficLogs = globalRef.trafficLogs;

export function addTrafficLog(log: Omit<TrafficLog, "id" | "timestamp">): void {
  const newLog: TrafficLog = {
    ...log,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
  };

  trafficLogs.unshift(newLog);

  if (trafficLogs.length > MAX_FALLBACK_LOGS) {
    trafficLogs.pop();
  }

  if (prisma) {
    prisma.trafficLog
      .create({
        data: {
          accountId: log.accountId,
          conversationId: log.conversationId,
          direction: log.direction,
          action: log.action,
          content: log.content,
          details: log.details,
          latencyMs: log.latencyMs,
          tokens: log.tokens,
          model: log.model,
          cost: log.cost,
        },
      })
      .catch((err) => {
        console.error("Failed to persist traffic log to DB:", err);
      });
  }
}
