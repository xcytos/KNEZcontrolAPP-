import { useState, useCallback } from 'react';
import { ChatMessage } from '../../../domain/DataContracts';

type ChatPhase = "idle" | "request_sent" | "model_thinking" | "tool_execution" | "streaming" | "completed" | "error";

export const useChatState = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [forkingMsgId, setForkingMsgId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>("");
  
  // Modal states
  const [modals, setModals] = useState({
    history: false,
    fork: false,
    rename: false,
    audit: false,
    tools: false,
  });

  const openModal = useCallback((name: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [name]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      history: false,
      fork: false,
      rename: false,
      audit: false,
      tools: false,
    });
  }, []);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    phase,
    setPhase,
    editingMessageId,
    setEditingMessageId,
    isAtBottom,
    setIsAtBottom,
    forkingMsgId,
    setForkingMsgId,
    sessionName,
    setSessionName,
    modals,
    openModal,
    closeModal,
    closeAllModals,
  };
};
