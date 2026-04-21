# DOC-05: AI Model Processing Pipeline

## Executive Summary

This document describes the complete AI model processing pipeline in the KNEZ system, from user input to model response, including tool execution, streaming, metrics tracking, and error handling. It covers both backend (Python/FastAPI) and frontend (React/TypeScript) processing flows.

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Request Processing Flow](#request-processing-flow)
3. [Backend Selection](#backend-selection)
4. [Model Generation](#model-generation)
5. [Streaming Implementation](#streaming-implementation)
6. [Tool Call Processing](#tool-call-processing)
7. [Tool Execution](#tool-execution)
8. [Response Assembly](#response-assembly)
9. [Metrics Collection](#metrics-collection)
10. [Error Handling](#error-handling)
11. [Frontend Processing](#frontend-processing)
12. [State Management](#state-management)
13. [Phase Transitions](#phase-transitions)
14. [Performance Optimization](#performance-optimization)
15. [Pipeline Diagrams](#pipeline-diagrams)
16. [Bottleneck Analysis](#bottleneck-analysis)
17. [Optimization Opportunities](#optimization-opportunities)

---

## Pipeline Overview

### High-Level Flow

```
User Input (ChatPane)
    ↓
ChatService.sendMessage()
    ↓
KnezClient.chatCompletion() (HTTP POST)
    ↓
Backend: api/completions.py
    ↓
Backend: router.select_backend()
    ↓
Backend: models/local_backend.generate()
    ↓
Backend: SSE Stream (tokens, tool calls)
    ↓
Frontend: KnezClient (SSE parsing)
    ↓
Frontend: ChatService (state updates)
    ↓
Frontend: ChatPane (UI rendering)
```

### Pipeline Stages

1. **Input Stage**: User input capture and validation
2. **Routing Stage**: Backend selection based on health
3. **Generation Stage**: Model token generation
4. **Tool Stage**: Tool call execution (if needed)
5. **Streaming Stage**: Real-time token delivery
6. **Assembly Stage**: Response assembly and formatting
7. **Rendering Stage**: UI display

---

## Request Processing Flow

### Frontend Request Preparation

**ChatService.sendMessage()**:
```typescript
async sendMessage(text: string) {
  // Validate input
  if (!text.trim()) return;
  
  // Create user message
  const userMessage: ChatMessage = {
    id: generateId(),
    sessionId: this.currentSessionId!,
    from: "user",
    text: text,
    createdAt: new Date().toISOString(),
  };
  
  // Persist to database
  await this.sessionDatabase.addMessage(this.currentSessionId!, userMessage);
  
  // Add to state
  this.setState({
    messages: [...this.state.messages, userMessage],
    phase: "sending",
  });
  
  // Build message history
  const history = this.buildMessageHistory();
  
  // Call backend
  await this.runPromptToolLoop(history);
}
```

**Message History Building**:
```typescript
private buildMessageHistory(): ChatMessage[] {
  // Get last N messages (context window limit)
  const maxMessages = 50;
  const messages = this.state.messages.slice(-maxMessages);
  
  // Filter hidden messages
  const visible = messages.filter(m => !m.hiddenLocally);
  
  // Add system prompt if needed
  const systemPrompt = this.getSystemPrompt();
  
  return systemPrompt ? [systemPrompt, ...visible] : visible;
}
```

### Backend Request Processing

**api/completions.py**:
```python
@router.post("/v1/chat/completions")
async def chat_completion(request: GenerationRequest):
    session_id = request.metadata.get("session_id") if request.metadata else None
    
    # Select backend
    backend = await router.select_backend(request, session_id)
    
    # Stream response
    return StreamingResponse(
        _sse_stream(request, session_id, backend),
        media_type="text/event-stream",
    )
```

**GenerationRequest Transformation**:
```python
# Convert API request to internal format
internal_request = GenerationRequest(
    messages=[
        ChatMessage(role=m["role"], content=m["content"])
        for m in request.messages
    ],
    temperature=request.temperature or 0.7,
    max_tokens=request.max_tokens,
    stream=True,
    tools=request.tools,
    tool_choice=request.tool_choice,
    metadata=request.metadata,
)
```

---

## Backend Selection

### Router Selection Algorithm

**router/router.py**:
```python
async def select_backend(
    self,
    request: GenerationRequest,
    session_id: Optional[str] = None
) -> BaseBackend:
    # Filter by capabilities
    capable = [
        b for b in self.backends
        if self._has_capabilities(b, request)
    ]
    
    if not capable:
        raise RouterFailure("No capable backend available")
    
    # Score backends
    scored = []
    for backend in capable:
        score = await self._get_cached_health_score(backend)
        
        # Apply memory hints
        if self._memory_hints:
            hints = await asyncio.wait_for(
                self._memory_hints.generate_hints(
                    session_id=session_id,
                    decision_context={"kind": "routing_select"},
                    max_hints=3,
                ),
                timeout=0.1  # 100ms timeout
            )
            score += self._apply_hints(score, hints)
        
        # Apply influence traces
        if session_id:
            influence = await self._get_influence_trace(session_id)
            score += self._apply_influence(score, influence)
        
        scored.append((backend, score))
    
    # Select highest score
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[0][0]
```

### Health Score Caching

```python
async def _get_cached_health_score(self, backend: BaseBackend) -> float:
    now = time.time()
    async with self._cache_lock:
        cached = self._health_cache.get(backend.model_id)
        if cached and (now - cached[1]) < self._health_cache_ttl:
            return cached[0]
    
    # Cache miss - fetch fresh
    h = await backend.health()
    s = score_health(h).value
    
    async with self._cache_lock:
        self._health_cache[backend.model_id] = (s, now)
    
    return s
```

**Cache Configuration**:
- TTL: 5 seconds
- Lock: asyncio.Lock for thread safety
- Storage: Dict[model_id, (score, timestamp)]

---

## Model Generation

### Local Backend Generation

**models/local_backend.py**:
```python
async def generate(
    self,
    request: GenerationRequest,
    stream_callback: StreamCallback
) -> AsyncGenerator[str, None]:
    url = f"{self.endpoint}/api/chat"
    
    # Build payload
    payload = {
        "model": self.model_id,
        "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        "stream": True,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }
    
    if request.tools:
        payload["tools"] = request.tools
    if request.tool_choice:
        payload["tool_choice"] = request.tool_choice
    
    # Stream tokens
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                data = json.loads(line)
                msg = data.get("message") or {}
                
                # Handle content tokens
                token = msg.get("content", "")
                if token:
                    yield token
                    await stream_callback(token)
                
                # Handle tool calls
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    # Convert to tool_call format
                    tool_call_str = json.dumps({"tool_call": tool_calls[0]})
                    yield tool_call_str
                    await stream_callback(tool_call_str)
```

### Tool Call Format

**Ollama Native Format**:
```json
{
  "role": "assistant",
  "content": "",
  "tool_calls": [
    {
      "function": {
        "name": "puppeteer_navigate",
        "arguments": "{\"url\": \"https://example.com\"}"
      }
    }
  ]
}
```

**Converted Format**:
```json
{
  "tool_call": {
    "tool": "puppeteer_navigate",
    "args": {"url": "https://example.com"}
  }
}
```

---

## Streaming Implementation

### Backend SSE Streaming

**api/completions.py _sse_stream()**:
```python
async def _sse_stream(
    request: GenerationRequest,
    session_id: Optional[str],
    backend: BaseBackend
) -> AsyncGenerator[bytes, None]:
    # Phase 1: Instrument metrics
    t_submit = time.perf_counter()
    t_first_token = None
    token_count = 0
    fallback_triggered = False
    
    # Phase 2: Stream tokens
    try:
        async for token in backend.generate(request, stream_callback):
            if t_first_token is None:
                t_first_token = time.perf_counter()
            
            token_count += 1
            
            # Emit token event
            yield f"data: {json.dumps({\"type\": \"token\", \"content\": token})}\n\n"
    
    except BackendFailure as primary_err:
        # Phase 3: Fallback
        fallback_triggered = True
        fallback_backend = await router.select_fallback(backend, request)
        
        async for token in fallback_backend.generate(request, stream_callback):
            yield f"data: {json.dumps({\"type\": \"token\", \"content\": token})}\n\n"
    
    finally:
        # Phase 4: Metrics
        duration = time.perf_counter() - t_submit
        ttft = (t_first_token - t_submit) if t_first_token else None
        
        # Emit metrics event
        emitter.emit(
            session_id=session_id,
            event_type=EventType.ACTION,
            event_name="stream_complete",
            payload={
                "time_to_first_token_ms": ttft * 1000 if ttft else None,
                "total_tokens": token_count,
                "duration_ms": duration * 1000,
                "tokens_per_sec": token_count / duration if duration > 0 else 0,
                "model_id": backend.model_id,
                "fallback_triggered": fallback_triggered,
            },
            tags=["stream", "metrics"],
        )
        
        # Emit done event
        yield f"data: {json.dumps({\"type\": \"done\", \"finish_reason\": \"stop\", \"total_tokens\": token_count})}\n\n"
```

### SSE Event Format

**Token Event**:
```
data: {"type": "token", "content": "Hello"}
```

**Tool Call Event**:
```
data: {"type": "tool_call", "tool": "puppeteer_navigate", "args": {"url": "https://example.com"}, "call_id": "tc_123"}
```

**Tool Call Completed Event**:
```
data: {"type": "tool_call_completed", "call_id": "tc_123", "ok": true, "result": {...}, "execution_time_ms": 1234}
```

**Done Event**:
```
data: {"type": "done", "finish_reason": "stop", "total_tokens": 100}
```

---

## Tool Call Processing

### Backend Tool Call Detection

**completions.py**:
```python
async def _sse_stream(...):
    async for token in backend.generate(...):
        # Check for tool call format
        if token.strip().startswith('{"tool_call":'):
            tool_call_data = json.loads(token)
            call_id = f"tc_{uuid.uuid4().hex[:8]}"
            
            # Emit tool call event
            yield f"data: {json.dumps({\n                \"type\": \"tool_call\",\n                \"tool\": tool_call_data[\"tool_call\"][\"tool\"],\n                \"args\": tool_call_data[\"tool_call\"][\"args\"],\n                \"call_id\": call_id\n            })}\n\n"
            
            # Track tool call
            pending_tool_calls[call_id] = {
                \"tool\": tool_call_data[\"tool_call\"][\"tool\"],
                \"args\": tool_call_data[\"tool_call\"][\"args\"],
                \"started_at\": time.time()
            }
```

### Frontend Tool Call Handling

**ChatService.runPromptToolLoop()**:
```typescript
async runPromptToolLoop(sessionId: string, messages: ChatMessage[]) {
  this.setPhase("sending");
  
  const stream = knezClient.chatCompletion({
    messages: messages.map(m => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text
    })),
    stream: true,
    metadata: { session_id: sessionId },
  });
  
  let currentMessage: ChatMessage | null = null;
  const pendingToolCalls = new Map<string, ToolCallMessage>();
  
  for await (const event of stream) {
    switch (event.type) {
      case "token":
        this.setPhase("streaming");
        if (!currentMessage) {
          currentMessage = this.createAssistantMessage();
        }
        currentMessage.text += event.content;
        this.appendToMessage(currentMessage);
        break;
        
      case "tool_call":
        this.setPhase("tool_running");
        const toolCall: ToolCallMessage = {
          tool: event.tool,
          args: event.args,
          status: "pending",
          startedAt: new Date().toISOString(),
        };
        
        const toolMessage = await this.persistToolTrace(toolCall);
        pendingToolCalls.set(event.call_id, toolCall);
        break;
        
      case "tool_call_completed":
        const toolCallMsg = pendingToolCalls.get(event.call_id);
        if (toolCallMsg) {
          await this.updateToolTrace(toolCallMsg.id, {
            status: event.ok ? "succeeded" : "failed",
            result: event.result,
            executionTimeMs: event.execution_time_ms,
            finishedAt: new Date().toISOString(),
          });
        }
        break;
        
      case "done":
        this.setPhase("done");
        if (currentMessage) {
          currentMessage.metrics = {
            totalTokens: event.total_tokens,
            finishReason: event.finish_reason,
          };
          await this.finalizeMessage(currentMessage);
        }
        break;
    }
  }
}
```

---

## Tool Execution

### Frontend Tool Execution

**ToolExecutionService.executeNamespacedTool()**:
```typescript
async executeNamespacedTool(
  namespacedName: string,
  args: any,
  opts: ToolExecutionOptions
): Promise<ToolExecutionOutcome> {
  // Parse namespaced name
  const { serverId, originalName } = this.resolveNamespacedName(namespacedName);
  
  // Get tool metadata
  const toolMeta = await toolExposureService.getToolByName(namespacedName);
  if (!toolMeta) {
    return {
      ok: false,
      kind: "failed",
      error: { code: "mcp_tool_not_found", message: "Tool not found" },
      tool: { namespacedName },
    };
  }
  
  // Check server is running
  const server = mcpOrchestrator.getServer(serverId);
  if (!server || !server.running) {
    return {
      ok: false,
      kind: "failed",
      error: { code: "mcp_not_started", message: "MCP server not started" },
      tool: { namespacedName },
    };
  }
  
  // Governance check
  const decision = await governanceService.decideTool(toolMeta, server);
  if (!decision.allowed) {
    return {
      ok: false,
      kind: "denied",
      error: { code: "mcp_permission_denied", message: decision.reason },
      tool: { namespacedName },
    };
  }
  
  // Execute tool
  const startTime = Date.now();
  try {
    const result = await mcpOrchestrator.callTool(
      serverId,
      originalName,
      args,
      { timeoutMs: opts.timeoutMs || 180000 }
    );
    
    const durationMs = Date.now() - startTime;
    
    return {
      ok: true,
      kind: "succeeded",
      tool: { namespacedName, serverId, originalName },
      durationMs,
      result,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const classified = this.classifyError(error);
    
    return {
      ok: false,
      kind: "failed",
      error: classified,
      tool: { namespacedName, serverId, originalName },
      durationMs,
    };
  }
}
```

### MCP Tool Call

**McpOrchestrator.callTool()**:
```typescript
async callTool(
  serverId: string,
  name: string,
  args: any,
  opts: { timeoutMs?: number; toolCallId?: string }
): Promise<any> {
  const server = this.getServer(serverId);
  if (!server || !server.running) {
    throw new Error("Server not running");
  }
  
  const timeout = opts.timeoutMs || 180000;
  
  return await mcpInspectorService.callTool(
    serverId,
    name,
    args,
    { timeoutMs: timeout, toolCallId: opts.toolCallId }
  );
}
```

---

## Response Assembly

### Frontend Message Assembly

**ChatService.createAssistantMessage()**:
```typescript
private createAssistantMessage(): ChatMessage {
  return {
    id: generateId(),
    sessionId: this.currentSessionId!,
    from: "assistant",
    text: "",
    createdAt: new Date().toISOString(),
    isPartial: true,
  };
}
```

**ChatService.appendToMessage()**:
```typescript
private async appendToMessage(message: ChatMessage) {
  message.hasReceivedFirstToken = true;
  
  // Update state
  this.setState({
    messages: this.state.messages.map(m =>
      m.id === message.id ? message : m
    ),
  });
  
  // Notify subscribers (throttled)
  this.notify();
}
```

**ChatService.finalizeMessage()**:
```typescript
private async finalizeMessage(message: ChatMessage) {
  message.isPartial = false;
  message.finalizedAt = new Date().toISOString();
  
  // Persist to database
  await this.sessionDatabase.addMessage(this.currentSessionId!, message);
  
  // Update state
  this.setState({
    messages: this.state.messages.map(m =>
      m.id === message.id ? message : m
    ),
  });
}
```

---

## Metrics Collection

### Backend Metrics

**completions.py**:
```python
# Time to First Token (TTFT)
ttft = (t_first_token - t_submit) * 1000  # milliseconds

# Total Response Time
duration = (time.perf_counter() - t_submit) * 1000  # milliseconds

# Tokens Per Second
tokens_per_sec = token_count / duration if duration > 0 else 0

# Fallback Triggered
fallback_triggered = True if primary_err else False
```

**Event Emission**:
```python
emitter.emit(
    session_id=session_id,
    event_type=EventType.ACTION,
    event_name="stream_complete",
    payload={
        "time_to_first_token_ms": ttft,
        "total_tokens": token_count,
        "duration_ms": duration,
        "tokens_per_sec": tokens_per_sec,
        "model_id": backend.model_id,
        "fallback_triggered": fallback_triggered,
    },
    tags=["stream", "metrics"],
)
```

### Frontend Metrics

**ChatService**:
```typescript
// Tool execution time
const durationMs = Date.now() - startTime;

// MCP latency (future)
const mcpLatencyMs = result.mcpLatency;

// Populate tool call
toolCall.executionTimeMs = durationMs;
toolCall.mcpLatencyMs = mcpLatencyMs;

// Populate message metrics
message.metrics = {
  toolExecutionTime: durationMs,
  fallbackTriggered: event.fallback_triggered,
};
```

---

## Error Handling

### Backend Error Handling

**Router Failover**:
```python
try:
    async for token in backend.generate(request, stream_callback):
        yield token
except BackendFailure as primary_err:
    # Select fallback
    fallback = await router.select_fallback(backend, request)
    
    # Log failover
    emitter.emit(
        event_name="failover_triggered",
        payload={
            "from_backend": backend.model_id,
            "to_backend": fallback.model_id,
            "reason": str(primary_err),
        },
        tags=["failover", "error"],
    )
    
    # Retry with fallback
    async for token in fallback.generate(request, stream_callback):
        yield token
```

**Backend Health Check**:
```python
async def health(self) -> BackendHealth:
    try:
        response = await httpx.get(f"{self.endpoint}/api/tags", timeout=5.0)
        if response.status_code == 200:
            return BackendHealth(
                model_id=self.model_id,
                status="healthy",
                latency_ms=123.45,  # Measured
            )
    except Exception:
        return BackendHealth(
            model_id=self.model_id,
            status="unhealthy",
        )
```

### Frontend Error Handling

**KnezClient Fallback**:
```typescript
async health(): Promise<HealthResponse> {
  try {
    return await this.httpHealth();
  } catch (error) {
    // Fallback to shell command
    return await this.shellHealth();
  }
}
```

**Tool Execution Error Classification**:
```typescript
classifyError(error: unknown): McpErrorClassification {
  if (error instanceof TimeoutError) {
    return { code: "mcp_timeout", message: "Tool execution timeout" };
  }
  if (error instanceof NetworkError) {
    return { code: "mcp_network_error", message: "Network communication error" };
  }
  return { code: "mcp_unknown", message: "Unknown error" };
}
```

---

## Frontend Processing

### SSE Parsing

**KnezClient.chatCompletion()**:
```typescript
async *chatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamEvent, void> {
  const profile = this.getCurrentProfile();
  const url = `${profile.endpoint}/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Split by double newline
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || ""; // Keep partial line
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          return;
        }
        
        try {
          const event = JSON.parse(data);
          yield event;
        } catch (e) {
          console.error("Failed to parse SSE event:", data);
        }
      }
    }
  }
}
```

### UI Update Throttling

**ChatService.notify()**:
```typescript
private notify() {
  const now = Date.now();
  
  // Throttle during streaming
  if (this.phase === "streaming") {
    if (now - this.lastNotifyTime < 33) {  // 33ms throttle
      return;
    }
  }
  
  this.lastNotifyTime = now;
  
  for (const fn of this.subscribers) {
    fn(this.state);
  }
}
```

---

## State Management

### ChatService State

**State Structure**:
```typescript
interface ChatState {
  messages: ChatMessage[];
  assistantMessages: AssistantMessage[];
  phase: ChatPhase;
  activeTools: { search: boolean };
  searchProvider: "off" | "taqwin" | "proxy";
  pendingToolApproval: ToolApprovalRequest | null;
}
```

**State Updates**:
```typescript
setState(updates: Partial<ChatState>) {
  this.state = { ...this.state, ...updates };
  this.notify();
}
```

---

## Phase Transitions

### Phase Machine

```
idle → sending → thinking → tool_running → streaming → finalizing → done
  ↓                                                                                 ↑
  └──────────────────────────────────────────────────────────────────────────────┘
                                        error
```

### Phase Transition Logic

**ChatService**:
```typescript
setPhase(phase: ChatPhase) {
  this.phase = phase;
  
  // Emit phase event
  emitter.emit({
    event_type: "phase_transition",
    event_name: "phase_changed",
    payload: { phase, previousPhase: this.previousPhase },
  });
  
  this.previousPhase = phase;
}
```

---

## Performance Optimization

### Backend Optimizations

1. **Health Score Caching**: 5-second TTL, reduces health check overhead
2. **Memory Hint Timeout**: 100ms timeout, prevents blocking
3. **Connection Pooling**: Reuse HTTP connections
4. **Removed asyncio.sleep(0)**: Eliminated artificial delay in streaming

### Frontend Optimizations

1. **UI Update Throttling**: 33ms during streaming
2. **Message Pagination**: Only render last 50 messages
3. **Event Queue**: Async queue for event writes
4. **Connection Reuse**: Tauri HTTP client pooling

---

## Pipeline Diagrams

### Complete Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User Input (ChatPane)                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  ChatService.sendMessage()                                   │
│  - Create user message                                       │
│  - Persist to SessionDatabase                                │
│  - Build message history                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  KnezClient.chatCompletion()                                 │
│  - HTTP POST /v1/chat/completions                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Backend: api/completions.py                                 │
│  - Transform request                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Backend: router.select_backend()                            │
│  - Filter by capabilities                                    │
│  - Get cached health scores                                  │
│  - Apply memory hints                                        │
│  - Apply influence traces                                    │
│  - Select highest score                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Backend: models/local_backend.generate()                    │
│  - HTTP POST to Ollama /api/chat                            │
│  - Stream tokens                                             │
│  - Detect tool calls                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Backend: SSE Stream                                         │
│  - Emit token events                                         │
│  - Emit tool_call events                                    │
│  - Emit tool_call_completed events                          │
│  - Emit done event                                          │
│  - Track metrics (TTFT, duration, tokens)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Frontend: KnezClient (SSE parsing)                          │
│  - Parse SSE lines                                           │
│  - Extract JSON events                                       │
│  - Yield events to generator                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Frontend: ChatService.runPromptToolLoop()                   │
│  - Handle token events (append to message)                   │
│  - Handle tool_call events (persistToolTrace)               │
│  - Handle tool_call_completed events (updateToolTrace)       │
│  - Handle done events (finalize message)                     │
│  - Update phase                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Frontend: ChatPane (UI rendering)                            │
│  - Render messages via MessageItem                            │
│  - Update phase indicators                                   │
│  - Show tool execution blocks                                │
└─────────────────────────────────────────────────────────────┘
```

### Tool Execution Sub-Pipeline

```
Model outputs tool_call (SSE)
    │
    ▼
ChatService.persistToolTrace()
    │
    ▼
ToolExecutionService.executeNamespacedTool()
    │
    ├─► GovernanceService.decideTool()
    │       │
    │       └─► Allowed?
    │
    ▼
McpOrchestrator.callTool()
    │
    ▼
McpInspectorService.callTool()
    │
    ▼
Tauri Rust Bridge
    │
    ▼
MCP Server (stdio/http)
    │
    ▼
Tool Execution
    │
    ▼
Result returned
    │
    ▼
ChatService.updateToolTrace()
    │
    ▼
Model receives result (SSE)
```

---

## Bottleneck Analysis

### Current Bottlenecks

1. **Backend Health Checks**: Performed on every request (mitigated by caching)
2. **Memory Hint Generation**: Can block indefinitely (mitigated by timeout)
3. **HTTP Connection Overhead**: TCP handshake per request (mitigated by pooling)
4. **UI Update Throttling**: 33ms throttle may cause perceived lag
5. **SSE Parsing**: String concatenation and JSON parsing overhead

### Latency Breakdown

| Stage | Estimated Latency | Notes |
|-------|-------------------|-------|
| User input to HTTP request | 10-50ms | UI overhead |
| HTTP round trip | 20-100ms | Network latency |
| Backend selection | 10-50ms | Cached health scores |
| Model generation (first token) | 500-2000ms | Depends on model |
| Tool execution | 100-5000ms | Depends on tool |
| SSE streaming | 1-10ms per token | Network latency |
| Frontend parsing | 1-5ms per token | JSON parsing |
| UI update | 10-50ms | React rendering |

### Total Latency

- **Simple response (no tools)**: 500-2200ms
- **Response with 1 tool**: 600-7500ms
- **Response with multiple tools**: 1000-15000ms

---

## Optimization Opportunities

### High Impact

1. **SSE Reconnection**: Implement auto-reconnect with exponential backoff
2. **Tool Result Streaming**: Stream large tool results in chunks
3. **Parallel Tool Execution**: Execute independent tools in parallel
4. **Token Prediction**: Predict next token for faster rendering

### Medium Impact

5. **Health Push via SSE**: Eliminate polling for health status
6. **Binary Protocol**: Use binary protocol for faster serialization
7. **Web Workers**: Offload SSE parsing to Web Worker
8. **Virtual Scrolling**: Render only visible messages

### Low Impact

9. **Request Batching**: Batch multiple requests
10. **Compression**: Compress SSE payload

---

## Conclusion

The AI model processing pipeline in KNEZ is well-designed with:

- **Intelligent Routing**: Health-based backend selection with caching
- **Streaming-First**: Real-time token delivery via SSE
- **Tool Execution**: Governed tool execution with MCP integration
- **Metrics Tracking**: Comprehensive metrics for observability
- **Error Handling**: Failover and fallback mechanisms

Key optimization opportunities include:
- SSE reconnection logic
- Tool result streaming
- Parallel tool execution
- Health push via SSE

The pipeline is production-ready with room for performance improvements in edge cases.

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-02 (knez-control-app), DOC-03 (Integration Patterns)
