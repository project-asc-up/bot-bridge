"use client";

import { useEffect, useState } from "react";

type TrafficLog = {
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

type HealthStatus = {
  connected: boolean;
  baseUrl: string;
  accountId?: number | null;
  error?: string | null;
};

type SystemHealth = {
  ok: boolean;
  dify: HealthStatus;
  chatwoot: HealthStatus;
};

export default function HomePage() {
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterConvoId, setFilterConvoId] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterChatsOnly, setFilterChatsOnly] = useState<boolean>(false);
  const [filterLatencyOnly, setFilterLatencyOnly] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchTraffic() {
      try {
        const response = await fetch("/api/traffic");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = (await response.json()) as TrafficLog[];
        if (active) {
          setLogs(data);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch traffic logs:", err);
        if (active) {
          setError("Failed to connect to API server");
        }
      }
    }

    async function fetchHealth() {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = (await response.json()) as SystemHealth;
        if (active) {
          setHealth(data);
        }
      } catch (err) {
        console.error("Failed to fetch health status:", err);
      }
    }

    // Initial fetch
    void fetchTraffic();
    void fetchHealth();

    // Set up webhook traffic polling
    const trafficInterval = setInterval(() => {
      if (isPolling) {
        void fetchTraffic();
      }
    }, 2000);

    // Set up health probe checking (longer interval to prevent overloading)
    const healthInterval = setInterval(() => {
      void fetchHealth();
    }, 10000);

    return () => {
      active = false;
      clearInterval(trafficInterval);
      clearInterval(healthInterval);
    };
  }, [isPolling]);

  // Compute Stats
  const stats = logs.reduce(
    (acc, log) => {
      acc.total++;
      if (log.action === "dify_reply") acc.replies++;
      if (log.action === "handoff") acc.handoffs++;
      if (log.action === "ignored") acc.ignored++;
      if (log.action === "error") acc.errors++;
      return acc;
    },
    { total: 0, replies: 0, handoffs: 0, ignored: 0, errors: 0 }
  );

  // Compute Latency
  const latencyLogs = logs.filter((log) => typeof log.latencyMs === "number");
  const avgLatency =
    latencyLogs.length > 0
      ? (
          latencyLogs.reduce((sum, log) => sum + (log.latencyMs ?? 0), 0) /
          latencyLogs.length /
          1000
        ).toFixed(2)
      : "0.00";

  // Compute Unique Chats count (from original logs)
  const activeChats = Array.from(
    new Set(
      logs
        .map((log) => log.conversationId)
        .filter((id): id is number => typeof id === "number")
    )
  ).length;

  // Compute unique conversation IDs from logs
  const uniqueConvoIds = Array.from(
    new Set(
      logs
        .map((log) => log.conversationId)
        .filter((id): id is number => typeof id === "number")
    )
  ).sort((a, b) => a - b);

  // Compute Copy Action Handler
  const handleCopyError = (log: TrafficLog) => {
    const errorText = `Error Event at ${formatTime(log.timestamp)}
Direction: ${log.direction}
Source: ${getSource(log)}
Content: ${log.content}
Details: ${log.details || "None"}`;
    void navigator.clipboard.writeText(errorText).then(() => {
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    // Search query matches content, details, action, direction, source, convo ID
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const contentMatch = log.content?.toLowerCase().includes(query);
      const detailsMatch = log.details?.toLowerCase().includes(query);
      const actionMatch = log.action?.toLowerCase().includes(query);
      const directionMatch = log.direction?.toLowerCase().includes(query);
      const sourceMatch = getSource(log).toLowerCase().includes(query);
      const convoMatch = log.conversationId?.toString().includes(query);
      if (!contentMatch && !detailsMatch && !actionMatch && !directionMatch && !sourceMatch && !convoMatch) {
        return false;
      }
    }

    // Action filter
    if (filterAction !== "all" && log.action !== filterAction) {
      return false;
    }

    // Source filter
    if (filterSource !== "all" && getSource(log) !== filterSource) {
      return false;
    }

    // Conversation ID filter
    if (filterConvoId !== "all") {
      if (filterConvoId === "system") {
        if (log.conversationId !== null) return false;
      } else {
        if (log.conversationId?.toString() !== filterConvoId) return false;
      }
    }

    // Direction filter
    if (filterDirection !== "all" && log.direction !== filterDirection) {
      return false;
    }

    // Chats only filter
    if (filterChatsOnly && log.conversationId === null) {
      return false;
    }

    // Latency only filter
    if (filterLatencyOnly && typeof log.latencyMs !== "number") {
      return false;
    }

    return true;
  });

  function formatTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toTimeString().split(" ")[0];
    } catch {
      return "00:00:00";
    }
  }

  function getBadgeClass(action: TrafficLog["action"]): string {
    switch (action) {
      case "received":
        return "badge badge-received";
      case "ignored":
        return "badge badge-ignored";
      case "dify_reply":
        return "badge badge-dify_reply";
      case "handoff":
        return "badge badge-handoff";
      case "error":
        return "badge badge-error";
      default:
        return "badge";
    }
  }

  function getSource(log: TrafficLog): string {
    if (log.direction === "incoming") {
      return "Evolution (Whatsapp)";
    }
    if (log.direction === "outgoing") {
      if (log.action === "dify_reply") {
        return "Dify";
      }
      return "Chatwoot";
    }
    if (log.direction === "system") {
      if (log.action === "handoff") {
        return "Dify";
      }
      return "Bridge";
    }
    return "System";
  }

  function getSourceBadgeClass(source: string): string {
    switch (source) {
      case "Evolution (Whatsapp)":
        return "badge badge-source-whatsapp";
      case "Dify":
        return "badge badge-source-dify";
      case "Chatwoot":
        return "badge badge-source-chatwoot";
      default:
        return "badge badge-source-bridge";
    }
  }
  return (
    <main className="shell">
      <style dangerouslySetInnerHTML={{ __html: `
        .status-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        .status-card-info {
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(11, 24, 39, 0.4);
          border: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: transform 0.2s ease;
        }
        .status-card-info:hover {
          transform: translateY(-1px);
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .status-online {
          border-color: rgba(94, 234, 212, 0.2);
        }
        .status-online .status-indicator-badge {
          background: rgba(94, 234, 212, 0.1);
          color: var(--accent);
          border: 1px solid rgba(94, 234, 212, 0.3);
        }
        .status-online .status-dot {
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
        }
        .status-offline {
          border-color: rgba(239, 68, 68, 0.2);
          background: rgba(239, 68, 68, 0.02);
        }
        .status-offline .status-indicator-badge {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .status-offline .status-dot {
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
        }
        .status-detail {
          font-size: 0.78rem;
          color: var(--muted);
          font-family: monospace;
          word-break: break-all;
        }
        .status-error-msg {
          font-size: 0.75rem;
          color: #f87171;
          background: rgba(239, 68, 68, 0.05);
          padding: 6px 10px;
          border-radius: 8px;
          margin-top: 4px;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        .stat-card {
          padding: 20px;
          border-radius: 20px;
          background: var(--bg-soft);
          border: 1px solid var(--card-border);
          text-align: center;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(94, 234, 212, 0.3);
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text);
          margin-top: 6px;
          line-height: 1;
        }
        .stat-label {
          font-size: 0.72rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 600;
        }
        .dashboard-layout {
          display: flex;
          gap: 24px;
          margin-top: 24px;
          align-items: flex-start;
          width: 100%;
        }
        .panel {
          flex: 1;
          transition: all 0.3s ease;
        }
        .panel-split {
          flex: 1.25;
          max-width: 65%;
        }
        .chat-viewer-panel {
          flex: 0.75;
          max-width: 35%;
          position: sticky;
          top: 24px;
          display: flex;
          flex-direction: column;
          background: rgba(11, 24, 39, 0.6);
          border: 1px solid var(--card-border);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--card-border);
          background: rgba(15, 32, 53, 0.4);
        }
        .chat-header-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chat-body-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 520px;
          min-height: 350px;
          scrollbar-width: thin;
        }
        .chat-bubble-row {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .chat-bubble-incoming {
          align-items: flex-start;
        }
        .chat-bubble-outgoing {
          align-items: flex-end;
        }
        .chat-bubble-system {
          align-items: center;
        }
        .bubble {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 0.85rem;
          line-height: 1.4;
          word-break: break-word;
        }
        .bubble-incoming {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text);
          border-bottom-left-radius: 4px;
          border: 1px solid rgba(148, 163, 184, 0.15);
        }
        .bubble-outgoing {
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(94, 234, 212, 0.05));
          color: var(--accent);
          border-bottom-right-radius: 4px;
          border: 1px solid rgba(94, 234, 212, 0.25);
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.05);
        }
        .bubble-system {
          background: rgba(192, 132, 252, 0.08);
          color: #c084fc;
          border: 1px solid rgba(192, 132, 252, 0.2);
          font-size: 0.78rem;
          padding: 6px 12px;
          border-radius: 10px;
          text-align: center;
        }
        .bubble-meta {
          font-size: 0.68rem;
          color: var(--muted);
          margin-top: 4px;
          display: flex;
          gap: 6px;
        }
        .chat-bubble-outgoing .bubble-meta {
          justify-content: flex-end;
        }
        .btn-chat-link {
          background: rgba(94, 234, 212, 0.05);
          border: 1px solid rgba(94, 234, 212, 0.15);
          color: var(--accent);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-family: monospace;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .btn-chat-link:hover {
          background: rgba(94, 234, 212, 0.12);
          border-color: var(--accent);
          color: var(--text);
        }
        .btn-chat-link-active {
          background: var(--accent);
          border-color: var(--accent);
          color: #0b1827;
        }
        .badge-source-whatsapp {
          background: rgba(37, 211, 102, 0.1) !important;
          color: #25d366 !important;
          border: 1px solid rgba(37, 211, 102, 0.2) !important;
        }
        .badge-source-dify {
          background: rgba(99, 102, 241, 0.1) !important;
          color: #818cf8 !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
        }
        .badge-source-chatwoot {
          background: rgba(59, 130, 246, 0.15) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
        }
        .badge-source-bridge {
          background: rgba(148, 163, 184, 0.1) !important;
          color: var(--muted) !important;
          border: 1px solid rgba(148, 163, 184, 0.15) !important;
        }
        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 32px;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 12px;
        }
        .monitor-title {
          font-size: 1.25rem;
          margin: 0;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .pulse-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(94, 234, 212, 0.7);
          animation: pulse 1.6s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(94, 234, 212, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(94, 234, 212, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(94, 234, 212, 0);
          }
        }
        .traffic-table-container {
          overflow-x: auto;
          margin-top: 16px;
        }
        .traffic-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .traffic-table th {
          padding: 12px 16px;
          font-size: 0.75rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid var(--card-border);
          font-weight: 700;
        }
        .traffic-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--card-border);
          font-size: 0.9rem;
          vertical-align: middle;
        }
        .traffic-table tr:hover td {
          background: rgba(148, 163, 184, 0.03);
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .badge-received {
          background: rgba(56, 189, 248, 0.1);
          color: var(--accent-2);
          border: 1px solid rgba(56, 189, 248, 0.2);
        }
        .badge-ignored {
          background: rgba(148, 163, 184, 0.08);
          color: var(--muted);
          border: 1px solid rgba(148, 163, 184, 0.15);
        }
        .badge-dify_reply {
          background: rgba(94, 234, 212, 0.1);
          color: var(--accent);
          border: 1px solid rgba(94, 234, 212, 0.2);
        }
        .badge-handoff {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .badge-error {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .direction-tag {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .direction-incoming {
          color: var(--accent-2);
        }
        .direction-outgoing {
          color: var(--accent);
        }
        .direction-system {
          color: #c084fc;
        }
        .msg-cell {
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .details-cell {
          color: var(--muted);
          font-size: 0.85rem;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .empty-state {
          text-align: center;
          padding: 48px 0;
          color: var(--muted);
        }
        .error-banner {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          padding: 12px 16px;
          border-radius: 12px;
          margin-top: 16px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .actions-bar {
          display: flex;
          gap: 8px;
        }
        .btn {
          background: var(--bg-soft);
          border: 1px solid var(--card-border);
          color: var(--text);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .btn-active {
          background: rgba(94, 234, 212, 0.1);
          border-color: var(--accent);
          color: var(--accent);
        }
        .stat-card-clickable {
          cursor: pointer;
          user-select: none;
          position: relative;
        }
        .stat-card-active-all {
          border-color: var(--text) !important;
          box-shadow: 0 0 12px rgba(250, 250, 250, 0.1);
          background: rgba(250, 250, 250, 0.02) !important;
        }
        .stat-card-active-replies {
          border-color: var(--accent) !important;
          box-shadow: 0 0 12px rgba(20, 184, 166, 0.15);
          background: rgba(20, 184, 166, 0.02) !important;
        }
        .stat-card-active-latency {
          border-color: var(--accent-2) !important;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
          background: rgba(59, 130, 246, 0.02) !important;
        }
        .stat-card-active-chats {
          border-color: #c084fc !important;
          box-shadow: 0 0 12px rgba(192, 132, 252, 0.15);
          background: rgba(192, 132, 252, 0.02) !important;
        }
        .stat-card-active-handoff {
          border-color: #f59e0b !important;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);
          background: rgba(245, 158, 11, 0.02) !important;
        }
        .stat-card-active-errors {
          border-color: #f87171 !important;
          box-shadow: 0 0 12px rgba(248, 113, 113, 0.15);
          background: rgba(248, 113, 113, 0.02) !important;
        }
        .filter-bar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 16px;
          margin-bottom: 8px;
          padding: 16px;
          background: rgba(11, 24, 39, 0.25);
          border: 1px solid var(--card-border);
          border-radius: 12px;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .filter-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .filter-input, .filter-select {
          background: #09090b;
          border: 1px solid var(--card-border);
          color: var(--text);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s ease;
          width: 100%;
        }
        .filter-input::placeholder {
          color: #71717a;
        }
        .filter-input:focus, .filter-select:focus {
          border-color: var(--accent);
        }
        .btn-clear-filters {
          align-self: flex-end;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-copy-error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
          margin-left: 8px;
          white-space: nowrap;
        }
        .btn-copy-error:hover {
          background: rgba(239, 68, 68, 0.25);
          border-color: #f87171;
          color: #ffffff;
        }
      ` }} />

      <section className="hero">
        <p className="eyebrow">Project Kganya Stack</p>
        <h1>Bot Bridge Live Monitor</h1>
        <p className="lede">
          Real-time activity log between WhatsApp (via Evolution Go), Chatwoot, and the Dify AI agent. 
          Use this panel to monitor active conversations, AI routing, automated replies, and agent handoffs.
        </p>
      </section>

      {/* System Status Indicators */}
      {health && (
        <div className="status-container">
          <div className={`status-card-info ${health.dify.connected ? "status-online" : "status-offline"}`}>
            <div className="status-row">
              <span className="status-label-text">Dify Engine</span>
              <span className="status-indicator-badge">
                <span className="status-dot" />
                {health.dify.connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="status-detail">{health.dify.baseUrl}</div>
            {health.dify.error && <div className="status-error-msg">{health.dify.error}</div>}
          </div>

          <div className={`status-card-info ${health.chatwoot.connected ? "status-online" : "status-offline"}`}>
            <div className="status-row">
              <span className="status-label-text">Chatwoot API</span>
              <span className="status-indicator-badge">
                <span className="status-dot" />
                {health.chatwoot.connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="status-detail">
              {health.chatwoot.baseUrl} (Acc: #{health.chatwoot.accountId})
            </div>
            {health.chatwoot.error && <div className="status-error-msg">{health.chatwoot.error}</div>}
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <span>{error} (reconnecting...)</span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div
          className={`stat-card stat-card-clickable ${
            filterAction === "all" && !filterChatsOnly && !filterLatencyOnly ? "stat-card-active-all" : ""
          }`}
          onClick={() => {
            setFilterAction("all");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterChatsOnly(false);
            setFilterLatencyOnly(false);
          }}
        >
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${
            filterAction === "dify_reply" ? "stat-card-active-replies" : ""
          }`}
          onClick={() => {
            setFilterAction("dify_reply");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterChatsOnly(false);
            setFilterLatencyOnly(false);
          }}
        >
          <div className="stat-label">AI Replies</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {stats.replies}
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${
            filterLatencyOnly ? "stat-card-active-latency" : ""
          }`}
          onClick={() => {
            setFilterLatencyOnly(true);
            setFilterAction("all");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterChatsOnly(false);
          }}
        >
          <div className="stat-label">Avg Latency</div>
          <div className="stat-value" style={{ color: "var(--accent-2)" }}>
            {avgLatency}s
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${
            filterChatsOnly ? "stat-card-active-chats" : ""
          }`}
          onClick={() => {
            setFilterChatsOnly(true);
            setFilterAction("all");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterLatencyOnly(false);
          }}
        >
          <div className="stat-label">Active Chats</div>
          <div className="stat-value" style={{ color: "#c084fc" }}>
            {activeChats}
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${
            filterAction === "handoff" ? "stat-card-active-handoff" : ""
          }`}
          onClick={() => {
            setFilterAction("handoff");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterChatsOnly(false);
            setFilterLatencyOnly(false);
          }}
        >
          <div className="stat-label">Handoffs</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>
            {stats.handoffs}
          </div>
        </div>
        <div
          className={`stat-card stat-card-clickable ${
            filterAction === "error" ? "stat-card-active-errors" : ""
          }`}
          onClick={() => {
            setFilterAction("error");
            setFilterSource("all");
            setFilterConvoId("all");
            setFilterDirection("all");
            setSearchQuery("");
            setFilterChatsOnly(false);
            setFilterLatencyOnly(false);
          }}
        >
          <div className="stat-label">Errors</div>
          <div className="stat-value" style={{ color: "#f87171" }}>
            {stats.errors}
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Layout */}
      <div className="dashboard-layout">
        {/* Live Monitor Panel (Left side, maps to split panel if active chat is viewed) */}
        <section className={`panel ${selectedConversationId ? "panel-split" : ""}`}>
          <div className="monitor-header">
            <div className="pulse-indicator">
              <div className={isPolling ? "pulse-dot" : ""} style={{ backgroundColor: isPolling ? "var(--accent)" : "var(--muted)" }} />
              <span>{isPolling ? "LIVE TRAFFIC MONITOR" : "TRAFFIC MONITOR PAUSED"}</span>
            </div>
            <div className="actions-bar">
              <button
                className={`btn ${isPolling ? "btn-active" : ""}`}
                onClick={() => setIsPolling(true)}
              >
                Stream
              </button>
              <button
                className={`btn ${!isPolling ? "btn-active" : ""}`}
                onClick={() => setIsPolling(false)}
              >
                Pause
              </button>
              <button className="btn" onClick={() => { setLogs([]); setSelectedConversationId(null); }}>
                Clear View
              </button>
            </div>
          </div>

          {/* Dynamic Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <span className="filter-label">Search Text</span>
              <input
                type="text"
                className="filter-input"
                placeholder="Search msg/details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filter-group">
              <span className="filter-label">Conv ID</span>
              <select
                className="filter-select"
                value={filterConvoId}
                onChange={(e) => {
                  setFilterConvoId(e.target.value);
                  setFilterChatsOnly(false);
                }}
              >
                <option value="all">All Conversations</option>
                <option value="system">System (No ID)</option>
                {uniqueConvoIds.map((id) => (
                  <option key={id} value={id.toString()}>
                    Convo #{id}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Action</span>
              <select
                className="filter-select"
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setFilterChatsOnly(false);
                  setFilterLatencyOnly(false);
                }}
              >
                <option value="all">All Actions</option>
                <option value="received">received</option>
                <option value="ignored">ignored</option>
                <option value="dify_reply">dify_reply</option>
                <option value="handoff">handoff</option>
                <option value="error">error</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Source</span>
              <select
                className="filter-select"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
              >
                <option value="all">All Sources</option>
                <option value="Evolution (Whatsapp)">Evolution (Whatsapp)</option>
                <option value="Dify">Dify</option>
                <option value="Chatwoot">Chatwoot</option>
                <option value="Bridge">Bridge</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Direction</span>
              <select
                className="filter-select"
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
              >
                <option value="all">All Directions</option>
                <option value="incoming">incoming</option>
                <option value="outgoing">outgoing</option>
                <option value="system">system</option>
              </select>
            </div>

            {(searchQuery || filterAction !== "all" || filterSource !== "all" || filterConvoId !== "all" || filterDirection !== "all" || filterChatsOnly || filterLatencyOnly) && (
              <button
                className="btn btn-clear-filters"
                onClick={() => {
                  setSearchQuery("");
                  setFilterAction("all");
                  setFilterSource("all");
                  setFilterConvoId("all");
                  setFilterDirection("all");
                  setFilterChatsOnly(false);
                  setFilterLatencyOnly(false);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="traffic-table-container">
            {logs.length === 0 ? (
              <div className="empty-state">
                <p>No traffic events logged yet.</p>
                <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                  Send a message to your WhatsApp number to trigger events.
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="empty-state">
                <p>No traffic events match your active filters.</p>
                <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                  Try resetting the filters or typing a different search query.
                </p>
                <button
                  className="btn"
                  style={{ marginTop: "12px" }}
                  onClick={() => {
                    setSearchQuery("");
                    setFilterAction("all");
                    setFilterSource("all");
                    setFilterConvoId("all");
                    setFilterDirection("all");
                    setFilterChatsOnly(false);
                    setFilterLatencyOnly(false);
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <table className="traffic-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Conv ID</th>
                    <th>Source</th>
                    <th>Dir</th>
                    <th>Message</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{formatTime(log.timestamp)}</td>
                      <td>
                        {log.conversationId ? (
                          <button
                            className={`btn-chat-link ${
                              selectedConversationId === log.conversationId ? "btn-chat-link-active" : ""
                            }`}
                            onClick={() => setSelectedConversationId(log.conversationId)}
                          >
                            #{log.conversationId}
                          </button>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>System</span>
                        )}
                      </td>
                      <td>
                        <span className={getSourceBadgeClass(getSource(log))}>
                          {getSource(log)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`direction-tag ${
                            log.direction === "incoming"
                              ? "direction-incoming"
                              : log.direction === "outgoing"
                              ? "direction-outgoing"
                              : "direction-system"
                          }`}
                        >
                          {log.direction}
                        </span>
                      </td>
                      <td>
                        <div className="msg-cell" title={log.content}>
                          {log.content}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span className={getBadgeClass(log.action)}>{log.action}</span>
                          {log.action === "error" && (
                            <button
                              className="btn-copy-error"
                              onClick={() => handleCopyError(log)}
                              title="Copy error details to clipboard"
                            >
                              {copiedId === log.id ? "✓ Copied!" : "📋 Copy"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="details-cell" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Chat Thread Viewer Panel (Right side, appears when a chat ID is clicked) */}
        {selectedConversationId && (
          <section className="panel chat-viewer-panel">
            <div className="chat-header">
              <div className="chat-header-title">
                <span style={{ fontSize: "1.1rem" }}>💬</span>
                <span>Conversation #{selectedConversationId}</span>
              </div>
              <button className="btn" onClick={() => setSelectedConversationId(null)}>
                Close
              </button>
            </div>
            <div className="chat-body-scroll">
              {logs.filter((log) => log.conversationId === selectedConversationId).length === 0 ? (
                <div className="chat-empty">
                  <p>No messages found in history for this chat.</p>
                </div>
              ) : (
                logs
                  .filter((log) => log.conversationId === selectedConversationId)
                  .slice()
                  .reverse() // Sort chronologically (oldest message first)
                  .map((log) => {
                    const isIncoming = log.direction === "incoming";
                    const isSystem = log.direction === "system";
                    return (
                      <div
                        key={log.id}
                        className={`chat-bubble-row ${
                          isSystem
                            ? "chat-bubble-system"
                            : isIncoming
                            ? "chat-bubble-incoming"
                            : "chat-bubble-outgoing"
                        }`}
                      >
                        <div
                          className={`bubble ${
                            isSystem
                              ? "bubble-system"
                              : isIncoming
                              ? "bubble-incoming"
                              : "bubble-outgoing"
                          }`}
                        >
                          {log.content}
                        </div>
                        {!isSystem && (
                          <div className="bubble-meta">
                            <span>{formatTime(log.timestamp)}</span>
                            {log.latencyMs && <span>({(log.latencyMs / 1000).toFixed(2)}s)</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
