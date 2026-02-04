import React, { useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";

type Props = {
  sessionId: string | null;
  readOnly: boolean;
};

export const ChatPane: React.FC<Props> = ({ sessionId, readOnly }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "seed",
      sessionId: sessionId ?? "unknown",
      from: "knez",
      text: "KNEZ client ready.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === "seed" ? { ...m, sessionId } : m))
    );
  }, [sessionId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (readOnly) return;
    if (!sessionId) return;
    if (!inputValue.trim() || sending) return;

    const now = new Date().toISOString();
    const startTime = Date.now();
    
    const userMsg: ChatMessage = {
      id: `${startTime}`,
      sessionId,
      from: "user",
      text: inputValue,
      createdAt: now,
    };

    const assistantId = `${startTime}-assistant`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: true,
      metrics: {
        totalTokens: 0,
      }
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue("");
    setSending(true);

    const completionMessages = [...messages, userMsg]
      .filter((m) => m.id !== "seed")
      .map((m) => {
        const role = m.from === "user" ? "user" : "assistant";
        return { role, content: m.text } as const;
      });

    try {
      let collected = "";
      let firstTokenTime: number | undefined;
      let tokenCount = 0;

      for await (const token of knezClient.chatCompletionsStream(
        completionMessages,
        sessionId
      )) {
        if (!firstTokenTime) firstTokenTime = Date.now();
        collected += token;
        tokenCount++;
        
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { 
            ...m, 
            text: collected,
            metrics: {
              timeToFirstTokenMs: firstTokenTime! - startTime,
              totalTokens: tokenCount
            }
          } : m))
        );
      }

      if (!collected) {
        const text = await knezClient.chatCompletionsNonStream(
          completionMessages,
          sessionId
        );
        collected = text;
        // Estimate token count for non-stream fallback (rough approx)
        tokenCount = text.split(/\s+/).length; 
        
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { 
            ...m, 
            text,
            metrics: {
              timeToFirstTokenMs: Date.now() - startTime,
              totalTokens: tokenCount
            }
          } : m))
        );
      }

      // Mark as complete
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { 
          ...m, 
          isPartial: false,
          metrics: {
            ...m.metrics,
            finishReason: "stop"
          }
        } : m))
      );

    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: m.text ? m.text : `Delivery Failure: ${errorMsg}`, // Keep partial text if any
                refusal: true,
                isPartial: false,
                metrics: {
                  ...m.metrics,
                  finishReason: "error"
                }
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleVote = (messageId: string, vote: "upvote" | "downvote") => {
    if (readOnly) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, influence: { ...m.influence, vote } }
          : m
      )
    );
    
    if (sessionId) {
      knezClient.submitVote(sessionId, messageId, vote);
    }
    console.log(`[Influence] Voted ${vote} on message ${messageId}`);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto relative">
      <div className="absolute top-0 left-0 right-0 bg-orange-900/20 border-b border-orange-900/50 p-2 text-center">
        <span className="text-xs font-mono text-orange-200 uppercase tracking-widest">
          ⚠️ Delivery Validation Mode: Responses Untrusted
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 mt-8">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.from === "user"
                  ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
                  : msg.refusal
                    ? "bg-red-900/20 border border-red-800 text-red-200"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-300"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.text}
                {msg.isPartial && <span className="inline-block w-2 h-4 ml-1 bg-zinc-500 animate-pulse align-middle" />}
              </p>
              
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/5 pt-2">
                <span className="text-xs text-zinc-500 opacity-70">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                
                {msg.from === "knez" && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                    {msg.isPartial ? (
                      <span className="text-blue-400">STREAMING...</span>
                    ) : (
                      <span className="text-zinc-500">COMPLETE</span>
                    )}
                    {msg.metrics?.timeToFirstTokenMs && (
                      <span title="Time to First Token">
                        TTFT: {msg.metrics.timeToFirstTokenMs}ms
                      </span>
                    )}
                    {msg.metrics?.totalTokens !== undefined && (
                      <span title="Total Tokens">
                        TOK: {msg.metrics.totalTokens}
                      </span>
                    )}
                  </div>
                )}

                {msg.from === "knez" && !msg.isPartial && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVote(msg.id, "upvote")}
                      disabled={readOnly}
                      className={`p-1 rounded hover:bg-zinc-700 transition-colors ${
                        msg.influence?.vote === "upvote" ? "text-green-400" : "text-zinc-600"
                      }`}
                      title="Positive Influence"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleVote(msg.id, "downvote")}
                      disabled={readOnly}
                      className={`p-1 rounded hover:bg-zinc-700 transition-colors ${
                        msg.influence?.vote === "downvote" ? "text-red-400" : "text-zinc-600"
                      }`}
                      title="Negative Influence"
                    >
                      👎
                    </button>
                  </div>
                )}
                
                {msg.refusal && (
                  <span className="font-bold text-red-500 uppercase tracking-wider text-[10px]">
                    DELIVERY FAILURE
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={readOnly ? "Read-only mode" : "Type a message..."}
            disabled={readOnly || !sessionId || sending}
            className="w-full bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={readOnly || !sessionId || sending || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            ⏎
          </button>
        </form>
      </div>
    </div>
  );
};
