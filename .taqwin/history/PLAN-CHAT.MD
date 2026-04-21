# ChatService System Architecture Fixes

This plan implements systemic architectural fixes to ChatService to establish proper message lifecycle contracts, stream ownership models, agent loop guarantees, tool-model bridges, strict UI state machines, concurrency control, and final response guarantees.

## Root Cause Analysis

The current system has no architectural contracts for:
- Message lifecycle (creation → streaming → finalization)
- Stream ownership and coordination
- Agent loop termination guarantees
- Tool result → model handoff
- UI state machine transitions
- Concurrency control
- Final response guarantees

## Systemic Issues (9 Gaps)

### GAP 1 — NO MESSAGE LIFECYCLE CONTRACT
**Problem:** Messages have no defined lifecycle states
**Impact:** Duplicate creation, orphan streams, partial finalization
**Solution:** Implement MessageState enum with strict transitions

### GAP 2 — NO STREAM OWNERSHIP MODEL
**Problem:** No coordination between streams, overlapping streams corrupt state
**Impact:** "append_message_not_found" spam, stream fallback mode
**Solution:** Implement StreamController with ownership tracking

### GAP 3 — AGENT LOOP NOT AUTHORITATIVE
**Problem:** Loop can exit without final answer or structured failure
**Impact:** maxSteps=5 but no guarantee of final answer
**Solution:** Implement loop termination guarantee with fallback answer

### GAP 4 — TOOL RESULT → MODEL HANDOFF WEAK
**Problem:** Tool results pushed directly to conversation without interpretation
**Impact:** Tool → Model directly, missing interpretation step
**Solution:** Implement strict Tool → Interpreter → Model bridge

### GAP 5 — UI STATE MACHINE TOO SIMPLE
**Problem:** Boolean flags (thinking/streaming) insufficient for complex state
**Impact:** Will break again with edge cases
**Solution:** Implement phase-based state machine with 8 states

### GAP 6 — NO TOOL EXECUTION STATE SYNC WITH UI
**Problem:** UI doesn't drive state from tool lifecycle
**Impact:** No progress updates, bad UX
**Solution:** Sync tool lifecycle events to UI state transitions

### GAP 7 — NO ERROR TERMINATION PATH
**Problem:** No defined path after failure
**Impact:** Unclear what happens after tool failure
**Solution:** Implement FAIL → fallback OR final answer OR user-visible error

### GAP 8 — NO CONCURRENCY CONTROL
**Problem:** Multiple USER_SEND events can overlap
**Impact:** State corruption (USER_SEND triggered twice)
**Solution:** Implement single active request lock

### GAP 9 — MCP SUCCESS ≠ UI SUCCESS
**Problem:** Tool success doesn't guarantee UI success
**Impact:** Tool succeeds but no assistant response
**Solution:** Ensure tool success produces assistant response

## Mandatory Additions (7 System Contracts)

### ADD 1 — MESSAGE STATE CONTRACT

**File:** `src/domain/DataContracts.ts`

**Changes:**
```typescript
export enum MessageState {
  CREATED = "created",
  STREAMING = "streaming",
  TOOL_RUNNING = "tool_running",
  FINAL = "final",
  ERROR = "error",
  LOCKED = "locked"
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  role: "assistant";
  state: MessageState;
  blocks: Block[];
  createdAt: number;
  finalizedAt?: number;
  // ... existing fields
}
```

**Invariant:** Each assistant response MUST progress through: CREATED → (STREAMING | TOOL_RUNNING)* → FINAL → LOCKED

### ADD 2 — STREAM CONTROLLER

**File:** `src/services/StreamController.ts` (NEW FILE)

**Changes:**
```typescript
export class StreamController {
  private activeStreamByMessageId = new Map<string, string>();
  private activeStreamId: string | null = null;

  start(messageId: string, streamId: string): boolean {
    if (this.activeStreamId && this.activeStreamId !== streamId) {
      return false; // Reject overlapping streams
    }
    this.activeStreamByMessageId.set(messageId, streamId);
    this.activeStreamId = streamId;
    return true;
  }

  append(messageId: string, streamId: string): boolean {
    const ownedStream = this.activeStreamByMessageId.get(messageId);
    if (ownedStream !== streamId) {
      return false; // Wrong stream owner
    }
    return true;
  }

  end(messageId: string, streamId: string): void {
    this.activeStreamByMessageId.delete(messageId);
    if (this.activeStreamId === streamId) {
      this.activeStreamId = null;
    }
  }

  cancel(streamId: string): void {
    this.activeStreamByMessageId.forEach((ownedStream, msgId) => {
      if (ownedStream === streamId) {
        this.activeStreamByMessageId.delete(msgId);
      }
    });
    if (this.activeStreamId === streamId) {
      this.activeStreamId = null;
    }
  }

  getActiveStream(): string | null {
    return this.activeStreamId;
  }

  isActive(): boolean {
    return this.activeStreamId !== null;
  }
}
```

**Integration:** Add `streamController` to ChatService, use in all stream operations

### ADD 3 — AGENT LOOP GUARANTEE

**File:** `src/services/agent/AgentOrchestrator.ts`

**Changes:**
```typescript
async runAgent(sessionId: string, userInput: string, callbacks: AgentCallbacks): Promise<void> {
  // ... existing loop logic

  // At end of loop, guarantee final answer
  const finalAnswer = this.getFinalAnswer(sessionId);
  if (!finalAnswer || !finalAnswer.trim()) {
    logger.warn("agent", "no_final_answer_generating_fallback", { sessionId });
    const fallback = await this.generateFallbackAnswer(sessionId, userInput);
    callbacks.onFinal(fallback);
  } else {
    callbacks.onFinal(finalAnswer);
  }
}
```

**Invariant:** Loop MUST exit with either final answer or structured failure

### ADD 4 — TOOL → MODEL BRIDGE

**File:** `src/services/ChatService.ts`

**Changes:**
After tool execution, ALWAYS call model again:
```typescript
async executeToolAndInterpret(toolName: string, args: any, sessionId: string): Promise<string> {
  const result = await toolExecutionService.executeNamespacedTool(toolName, args, { ... });
  
  // ALWAYS call model to interpret result
  const interpretationPrompt = `Tool result: ${JSON.stringify(result)}\n\nInterpret this result and provide a helpful response to the user.`;
  const interpretation = await this.callModelForInterpretation(sessionId, interpretationPrompt);
  
  return interpretation;
}
```

**Invariant:** Tool → Interpreter → Model (NEVER Tool → Model directly)

### ADD 5 — SINGLE ACTIVE REQUEST LOCK

**File:** `src/services/ChatService.ts`

**Changes:**
```typescript
export class ChatService {
  private activeRequestLock: { sessionId: string; requestId: string } | null = null;

  private async acquireRequestLock(sessionId: string, requestId: string): Promise<boolean> {
    if (this.activeRequestLock) {
      logger.warn("chat_service", "request_rejected_active", { 
        activeSession: this.activeRequestLock.sessionId,
        activeRequest: this.activeRequestLock.requestId,
        newSession: sessionId,
        newRequest: requestId
      });
      return false; // Reject overlapping requests
    }
    this.activeRequestLock = { sessionId, requestId };
    return true;
  }

  private releaseRequestLock(sessionId: string, requestId: string): void {
    if (this.activeRequestLock?.sessionId === sessionId && this.activeRequestLock?.requestId === requestId) {
      this.activeRequestLock = null;
    }
  }
}
```

**Integration:** Call `acquireRequestLock` at start of `deliverQueueItem`, call `releaseRequestLock` at end

### ADD 6 — HARD UI STATE MACHINE

**File:** `src/services/ChatService.ts`

**Changes:**
```typescript
export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "tool_running"
  | "streaming"
  | "finalizing"
  | "done"
  | "error";

const PHASE_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking", "error"],
  thinking: ["tool_running", "streaming", "error"],
  tool_running: ["thinking", "streaming", "error"],
  streaming: ["finalizing", "error"],
  finalizing: ["done", "error"],
  done: ["idle"],
  error: ["idle"]
};

private setPhase(newPhase: ChatPhase): void {
  const currentPhase = this.state.phase;
  const allowed = PHASE_TRANSITIONS[currentPhase];
  if (!allowed.includes(newPhase)) {
    logger.error("chat_service", "invalid_phase_transition", { 
      from: currentPhase, 
      to: newPhase,
      allowed 
    });
    throw new Error(`Invalid phase transition: ${currentPhase} → ${newPhase}`);
  }
  this.state.phase = newPhase;
  this.notify();
}
```

**Invariant:** Strict phase transitions only, no boolean flags

### ADD 7 — FINAL RESPONSE GUARANTEE

**File:** `src/services/ChatService.ts`

**Changes:**
```typescript
private async ensureFinalResponse(sessionId: string, assistantId: string): Promise<void> {
  const msg = this.state.assistantMessages.find(m => m.id === assistantId);
  if (!msg) {
    logger.error("chat_service", "final_response_no_message", { sessionId, assistantId });
    throw new Error("No assistant message exists");
  }

  if (msg.state === MessageState.FINAL || msg.state === MessageState.LOCKED) {
    return; // Already finalized
  }

  // If no final block exists, generate fallback
  const hasFinalBlock = msg.blocks.some(b => b.type === "final");
  if (!hasFinalBlock) {
    logger.warn("chat_service", "final_response_missing_generating_fallback", { sessionId, assistantId });
    const fallback = "I apologize, but I was unable to generate a complete response. Please try again.";
    this.appendBlockToAssistantMessage(assistantId, { type: "final", content: fallback });
  }

  // Finalize message
  msg.state = MessageState.FINAL;
  msg.finalizedAt = Date.now();
  await sessionDatabase.updateAssistantMessage(assistantId, { 
    state: msg.state, 
    finalizedAt: msg.finalizedAt 
  });
  this.notify();
}
```

**Invariant:** Every request MUST end with assistant message in FINAL state

## Implementation Order

1. **ADD 5 — Single Active Request Lock** (Foundation for all other fixes)
2. **ADD 1 — Message State Contract** (Data structure foundation)
3. **ADD 6 — Hard UI State Machine** (Phase-based transitions)
4. **ADD 2 — Stream Controller** (Stream ownership)
5. **ADD 4 — Tool → Model Bridge** (Tool interpretation)
6. **ADD 3 — Agent Loop Guarantee** (Loop finalization)
7. **ADD 7 — Final Response Guarantee** (Response completion)

## Cleanup Tasks (Remove Symptom Fixes)

1. Remove `tryDirectToolExecution` method (FIX 2 from original plan)
2. Remove `isPermissionSeekingResponse` method (FIX 3 from original plan)
3. Remove `isSimulationResponse` method (FIX 3 from original plan)
4. Remove `shouldForceToolLoop` check (FIX 7 from original plan)
5. Fix `appendToMessage` to use StreamController (FIX 4 from original plan)

## Risk Assessment

- **Critical Risk:** ADD 5 (Request Lock) - Changes concurrency model
- **High Risk:** ADD 1, ADD 6 (State contracts) - Changes data structures
- **Medium Risk:** ADD 2, ADD 4 (Stream/Tool bridges) - Changes execution flow
- **Low Risk:** ADD 3, ADD 7 (Loop/Final guarantees) - Defensive improvements

## Testing Strategy

1. **Concurrency Test:** Send multiple requests simultaneously, verify only one processed
2. **State Transition Test:** Verify all phase transitions are valid
3. **Stream Ownership Test:** Verify overlapping streams are rejected
4. **Tool Bridge Test:** Verify tool results always go through model interpretation
5. **Loop Guarantee Test:** Verify loop always exits with final answer or error
6. **Final Response Test:** Verify every request ends with FINAL state message
7. **Message Lifecycle Test:** Verify messages progress through all states correctly
