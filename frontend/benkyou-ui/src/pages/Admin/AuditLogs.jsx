import { useState } from "react";
import DashboardLayout from "../../components/shared/DashboardLayout";
import { ADMIN_THEME, getNav, ADMIN_STYLES as s } from "./adminConfig";
import { useApiData } from "../../hooks/useApiData";
import { getAuditLogs } from "../../services/auditLogService";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../components/shared/Pagination";

export default function AuditLogs() {
  const { user: authUser } = useAuth();
  const { data: logs, isLoading, error } = useApiData(getAuditLogs);
  const [filter, setFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export PDF");
      return;
    }
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admin Audit Logs Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 24px; color: #1e293b; }
            h2 { font-size: 20px; color: #0f172a; margin-bottom: 4px; }
            p { font-size: 13px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background-color: #f1f5f9; font-weight: 600; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .action { font-weight: 600; }
          </style>
        </head>
        <body>
          <h2>Admin Audit Logs Report</h2>
          <p>Exported on ${new Date().toLocaleString()} · Filter: ${filter} · Total Entries: ${filteredLogs.length}</p>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLogs.map(log => `
                <tr>
                  <td>${new Date(log.createdAt).toLocaleString()}</td>
                  <td>${log.userEmail}</td>
                  <td class="action">${log.action}</td>
                  <td>${log.entityType} ${log.targetName ? `(${log.targetName})` : log.entityID ? `(${log.entityID})` : ""}</td>
                  <td>${log.ipAddress}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (isLoading) return (
    <DashboardLayout theme={ADMIN_THEME} role="Admin" navGroups={getNav("Audit Logs")} headerTitle="Audit Logs" headerSub="Loading...">
      <div style={{ textAlign: "center", padding: 50 }}>Loading logs...</div>
    </DashboardLayout>
  );

  if (error || !logs) return (
    <DashboardLayout theme={ADMIN_THEME} role="Admin" navGroups={getNav("Audit Logs")} headerTitle="Audit Logs" headerSub="Error">
      <div style={{ padding: 24, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, margin: 24 }}>
        Error loading audit logs: {error?.message || "No logs received"}
      </div>
    </DashboardLayout>
  );

  const displayLogs = logs || [];

  const isSecurity = (action) => {
    const lower = action.toLowerCase();
    return lower.includes("suspicious") || lower.includes("locked") || lower.includes("unlock") || lower.includes("failed");
  };

  const filteredLogs = filter === "All"
    ? displayLogs
    : filter === "Security"
    ? displayLogs.filter(log => isSecurity(log.action))
    : displayLogs.filter(log => !isSecurity(log.action));

  const securityCount = displayLogs.filter(log => isSecurity(log.action)).length;

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getActionStyle = (action) => {
    const lower = action.toLowerCase();
    if (lower.includes("suspicious") || lower.includes("locked out")) {
      return { background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 700 };
    }
    if (lower.includes("locked") || lower.includes("unlock")) {
      return { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", fontWeight: 600 };
    }
    if (lower.includes("delete")) {
      return { background: "#fef2f2", color: "#dc2626", border: "none" };
    }
    if (lower.includes("login") || lower.includes("password")) {
      return { background: "#eff6ff", color: "#1d4ed8", border: "none" };
    }
    return { background: "#f3f4f6", color: "#374151", border: "none" };
  };

  return (
    <DashboardLayout 
      theme={ADMIN_THEME} 
      role="Admin" 
      navGroups={getNav("Audit Logs")} 
      userName={authUser?.name} 
      headerTitle="Audit Logs" 
      headerSub="Track all administrative actions"
    >
      {/* Security Alert Banner */}
      {securityCount > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
          border: "1px solid #fca5a5",
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 14,
          color: "#991b1b",
          fontWeight: 500
        }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span><strong>{securityCount}</strong> security {securityCount === 1 ? "event" : "events"} detected — including lockout attempts, suspicious logins, and account unlocks.</span>
          <button
            onClick={() => { setFilter("Security"); setCurrentPage(1); }}
            style={{
              marginLeft: "auto",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12
            }}
          >
            View Security Events
          </button>
        </div>
      )}

      <div style={s.tableCard}>
        <div style={s.cardHeader}>
          <h2 style={s.cardTitle}>Recent Activities</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {["All", "Security", "General"].map((tab) => (
              <button 
                key={tab} 
                onClick={() => { setFilter(tab); setCurrentPage(1); }} 
                style={{ 
                  padding: "6px 14px", 
                  borderRadius: 20, 
                  fontSize: 13, 
                  fontWeight: 500, 
                  cursor: "pointer", 
                  background: filter === tab ? (tab === "Security" ? "#ef4444" : "#185fa5") : "transparent", 
                  color: filter === tab ? "#fff" : "#6b7280", 
                  border: filter === tab ? `1px solid ${tab === "Security" ? "#ef4444" : "#185fa5"}` : "1px solid #e5e7eb" 
                }}
              >
                {tab} {tab === "Security" && securityCount > 0 ? `(${securityCount})` : ""}
              </button>
            ))}
            <button style={{ ...s.outlineBtn, marginLeft: 8 }} onClick={handleExportPdf}>Export Log</button>
          </div>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>TIMESTAMP</th>
              <th style={s.th}>USER</th>
              <th style={s.th}>ACTION</th>
              <th style={s.th}>ENTITY</th>
              <th style={s.th}>IP ADDRESS</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                {filter === "Security" ? "No security events found." : "No activity logs found."}
              </td></tr>
            ) : (
              paginatedLogs.map((log) => {
                const actionStyle = getActionStyle(log.action);
                const isSecurityEvent = isSecurity(log.action);
                return (
                  <tr key={log.auditLogID} style={{ ...s.tr, background: isSecurityEvent ? "#fff5f5" : undefined }}>
                    <td style={s.td}><span style={{ color: "#6b7280", fontSize: 13 }}>{new Date(log.createdAt).toLocaleString()}</span></td>
                    <td style={{ ...s.td, fontWeight: 500, color: "#111827" }}>{log.userEmail}</td>
                    <td style={s.td}>
                      <span style={{ 
                        ...actionStyle,
                        padding: "4px 8px", 
                        borderRadius: 6, 
                        fontSize: 12, 
                        fontWeight: actionStyle.fontWeight || 600,
                        display: "inline-block",
                        maxWidth: 320,
                        wordBreak: "break-word"
                      }}>
                        {isSecurityEvent && "⚠️ "}{log.action}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500 }}>{log.entityType}</span>
                      {log.targetName ? (
                        <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{log.targetName}</div>
                      ) : log.entityID ? (
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", marginTop: 2 }}>{log.entityID}</div>
                      ) : null}
                    </td>
                    <td style={s.td}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{log.ipAddress}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <Pagination
          totalItems={filteredLogs.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onChange={setCurrentPage}
        />
      </div>
    </DashboardLayout>
  );
}

