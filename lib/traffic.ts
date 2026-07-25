export type TrafficLog = {
  id: string;
  timestamp: string;
  accountId: number | null;
  conversationId: number | null;
  direction: "incoming" | "outgoing" | "system";
  content: string;
  action: "received" | "ignored" | "dify_reply" | "handoff" | "error";
  details?: string;
  latencyMs?: number;
};

const MAX_LOGS = 100;

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

  if (trafficLogs.length > MAX_LOGS) {
    trafficLogs.pop();
  }
}
