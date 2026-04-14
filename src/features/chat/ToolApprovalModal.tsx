import React from "react";

interface Props {
  approvalId: string;
  toolName: string;
  args: Record<string, any>;
  onDecision: (approvalId: string, approved: boolean) => void;
}

export const ToolApprovalModal: React.FC<Props> = ({ approvalId, toolName, args, onDecision }) => {
  const hasArgs = Object.keys(args).length > 0;

  return (
    <div
      data-testid="tool-approval-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400 text-lg">⚡</span>
          <h3 className="text-zinc-100 font-semibold text-base">Execute Tool?</h3>
        </div>

        <p className="text-zinc-400 text-sm mb-4">
          The model requested a tool execution. Review and approve or deny below.
        </p>

        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-5 font-mono text-xs">
          <div className="text-zinc-500 uppercase text-[10px] tracking-wider mb-1">Tool</div>
          <div className="text-blue-300 font-medium">{toolName}</div>

          {hasArgs && (
            <>
              <div className="text-zinc-500 uppercase text-[10px] tracking-wider mt-3 mb-1">Arguments</div>
              <pre className="whitespace-pre-wrap break-all text-zinc-300 leading-relaxed">
                {JSON.stringify(args, null, 2)}
              </pre>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            data-testid="tool-approval-approve"
            onClick={() => onDecision(approvalId, true)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            ✓ Approve
          </button>
          <button
            data-testid="tool-approval-deny"
            onClick={() => onDecision(approvalId, false)}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-zinc-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            ✗ Deny
          </button>
        </div>

        <p className="text-zinc-600 text-[10px] mt-3 text-center">
          Auto-denies after 60 seconds
        </p>
      </div>
    </div>
  );
};
