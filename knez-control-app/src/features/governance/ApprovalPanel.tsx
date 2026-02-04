import React, { useState, useEffect } from "react";
import { ApprovalRequest } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";

export const ApprovalPanel: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000); // Poll for approvals
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const data = await knezClient.getPendingApprovals();
      setApprovals(data);
    } catch (err) {
      console.error("Failed to fetch approvals:", err);
    }
  };

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    // Optimistic update
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: decision } : a))
    );
    
    try {
      await knezClient.submitApprovalDecision(id, decision);
      console.log(`[Approval] ${decision} request ${id}`);
    } catch (err) {
      console.error("Failed to submit decision:", err);
      // Revert on failure (could improve this with robust state management)
      fetchApprovals(); 
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-100">Governance Approvals</h2>
        <span className="text-xs font-mono text-zinc-500 uppercase">
          Checkpoint 2
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {approvals.length === 0 ? (
          <div className="text-center text-zinc-500 py-12">
            No pending approvals.
          </div>
        ) : (
          approvals.map((req) => (
            <div
              key={req.id}
              className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-200">{req.summary}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    ID: {req.id} • {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                  req.status === "pending"
                    ? "bg-yellow-900/20 border-yellow-700 text-yellow-500"
                    : req.status === "approved"
                    ? "bg-green-900/20 border-green-700 text-green-500"
                    : "bg-red-900/20 border-red-700 text-red-500"
                }`}>
                  {req.status}
                </div>
              </div>

              <div className="bg-zinc-900/50 rounded p-3 text-xs font-mono text-zinc-400 overflow-x-auto">
                <pre>{JSON.stringify(req.payload, null, 2)}</pre>
              </div>

              {req.status === "pending" && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleDecision(req.id, "approved")}
                    className="flex-1 bg-green-900/30 hover:bg-green-800/50 text-green-300 border border-green-800 rounded px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision(req.id, "rejected")}
                    className="flex-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 rounded px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
