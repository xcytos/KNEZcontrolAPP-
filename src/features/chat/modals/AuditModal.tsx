import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/core/Modal';
import { ChatMessage } from '../../../domain/DataContracts';
import { sessionDatabase } from '../../../services/session/SessionDatabase';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  messages: ChatMessage[];
}

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  messages,
}) => {
  const [queueCount, setQueueCount] = useState(0);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [failedQueueCount, setFailedQueueCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const tick = async () => {
      if (!sessionId) return;
      const all = await sessionDatabase.listOutgoing();
      const scoped = all.filter((x) => x.sessionId === sessionId);
      if (cancelled) return;
      setQueueCount(scoped.length);
      setInFlightCount(scoped.filter((x) => x.status === "in_flight").length);
      setFailedQueueCount(scoped.filter((x) => x.status === "failed").length);
    };
    void tick();
    const t = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOpen, sessionId]);

  const queuedMessages = messages.filter((m) => m.deliveryStatus === "queued").length;
  const pendingMessages = messages.filter((m) => m.deliveryStatus === "pending").length;
  const failedMessages = messages.filter((m) => m.deliveryStatus === "failed").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Chat State Audit">
      <div className="p-4 space-y-4">
        <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
          <div className="font-mono text-zinc-500 mb-2">Active Session</div>
          <div className="font-mono text-zinc-200">{sessionId ?? "none"}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">Messages</div>
            <div className="flex justify-between"><span className="text-zinc-500">queued</span><span className="font-mono text-zinc-200">{queuedMessages}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">pending</span><span className="font-mono text-zinc-200">{pendingMessages}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">failed</span><span className="font-mono text-zinc-200">{failedMessages}</span></div>
          </div>
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">Outgoing Queue</div>
            <div className="flex justify-between"><span className="text-zinc-500">total</span><span className="font-mono text-zinc-200">{queueCount}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">in_flight</span><span className="font-mono text-zinc-200">{inFlightCount}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">failed</span><span className="font-mono text-zinc-200">{failedQueueCount}</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
