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
};

export default function HomePage() {
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    void fetchTraffic();

    const interval = setInterval(() => {
      if (isPolling) {
        void fetchTraffic();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
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

  return (
    <main className="shell">
      <style jsx global>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
          font-size: 2.2rem;
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
          max-width: 250px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .details-cell {
          color: var(--muted);
          font-size: 0.85rem;
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
      `}</style>

      <section className="hero">
        <p className="eyebrow">Project Kganya Stack</p>
        <h1>Bot Bridge Live Monitor</h1>
        <p className="lede">
          Real-time activity log between WhatsApp (via Evolution Go), Chatwoot, and the Dify AI agent. 
          Use this panel to monitor active conversations, AI routing, automated replies, and agent handoffs.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <span>{error} (reconnecting...)</span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AI Replies</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {stats.replies}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Handoffs</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>
            {stats.handoffs}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Errors</div>
          <div className="stat-value" style={{ color: "#f87171" }}>
            {stats.errors}
          </div>
        </div>
      </div>

      {/* Live Monitor Panel */}
      <section className="panel">
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
            <button className="btn" onClick={() => setLogs([])}>
              Clear View
            </button>
          </div>
        </div>

        <div className="traffic-table-container">
          {logs.length === 0 ? (
            <div className="empty-state">
              <p>No traffic events logged yet.</p>
              <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                Send a message to your WhatsApp number to trigger events.
              </p>
            </div>
          ) : (
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Conv ID</th>
                  <th>Dir</th>
                  <th>Message</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{formatTime(log.timestamp)}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                      {log.conversationId ? `#${log.conversationId}` : "System"}
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
                      <span className={getBadgeClass(log.action)}>{log.action}</span>
                    </td>
                    <td className="details-cell">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
