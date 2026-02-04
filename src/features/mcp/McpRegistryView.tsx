import React from "react";
import { McpRegistrySnapshot } from "../../domain/DataContracts";

interface McpRegistryViewProps {
  snapshot: McpRegistrySnapshot | null;
  onRefresh: () => void;
}

export const McpRegistryView: React.FC<McpRegistryViewProps> = ({
  snapshot,
  onRefresh,
}) => {
  if (!snapshot) {
    return (
      <div className="pane pane-mcp">
        <h2>MCP Registry</h2>
        <div className="pane-body placeholder">Loading registry...</div>
      </div>
    );
  }

  return (
    <div className="pane pane-mcp">
      <div className="pane-header">
        <h2>MCP Registry (Inspection Only)</h2>
        <button onClick={onRefresh} className="refresh-btn">
          Refresh
        </button>
      </div>
      <div className="pane-body">
        {!snapshot.supported ? (
          <div className="mcp-unsupported">
            <p>MCP Registry not exposed by KNEZ.</p>
            <p className="reason">{snapshot.reason}</p>
          </div>
        ) : snapshot.items.length === 0 ? (
          <div className="empty-state">No MCP tools registered.</div>
        ) : (
          <ul className="mcp-list">
            {snapshot.items.map((item) => (
              <li key={item.id} className="mcp-item">
                <div className="mcp-header">
                  <span className="mcp-id">{item.id}</span>
                  {item.provider && (
                    <span className="mcp-provider">via {item.provider}</span>
                  )}
                  {item.status && (
                    <span className={`mcp-status status-${item.status}`}>
                      {item.status}
                    </span>
                  )}
                </div>
                {item.capabilities && item.capabilities.length > 0 && (
                  <div className="mcp-caps">
                    {item.capabilities.map((cap) => (
                      <span key={cap} className="cap-tag">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
