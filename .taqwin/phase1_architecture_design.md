# [TAQWIN] PHASE 1 — ARCHITECTURE CORRECTION + STREAM-SAFE DESIGN

**Status:** ANALYSIS COMPLETE  
**Ticket:** T-mcp-e2e-test-004  
**Phase:** p1_architecture_design  

---

## EXECUTIVE SUMMARY

Phase 0 analysis revealed critical architectural gaps that must be corrected BEFORE implementing ModelRouter and WarmupManager. This document defines the corrected backend-first architecture with strict stream-safety guarantees.

### Critical Findings

| Finding | Risk Level | Impact |
|---------|-----------|--------|
| Frontend ModelRouter exists but backend has its own Router | HIGH | Duplicate routing logic, inconsistent decisions |
| No unified model registry | HIGH | Hardcoded model IDs in multiple locations |
| No WarmupManager anywhere | HIGH | Cold-start latency on first request |
| Provider adapters only in frontend | MEDIUM | Backend bypasses adapters, goes direct to Ollama |
| Stream contract exists but not enforced | MEDIUM | Adapters can break streaming format |

---

## 1. STREAM CONTRACT ANALYSIS

### 1.1 Current Stream Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STREAM FLOW (CURRENT)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend:                    Backend:                                 │
│  ┌──────────────────┐          ┌──────────────────┐                    │
│  │ ChatService      │          │ completions.py   │                    │
│  │                  │          │                  │                    │
│  │ ┌──────────────┐ │          │ ┌──────────────┐ │                    │
│  │ │ StreamController│ │         │ │ _sse_stream()  │ │                    │
│  │ └──────────────┘ │          │ └──────────────┘ │                    │
│  │        ▲         │          │        ▲         │                    │
│  │        │ chunks   │          │        │ tokens   │                    │
│  │        │         │          │        │         │                    │
│  │ ┌──────────────┐ │          │ ┌──────────────┐ │                    │
│  │ │ handleStream │ │          │ │ LocalBackend │ │                    │
│  │ │ Chunk()      │ │          │ │ _stream_tokens│ │                    │
│  │ └──────────────┘ │          │ └──────────────┘ │                    │
│  │        ▲         │          │        ▲         │                    │
│  │        │ HTTP    │          │        │ HTTP    │                    │
│  └────────┼─────────┘          └────────┼─────────┘                    │
│           │                             │                              │
│           │    ┌──────────────────┐    │                              │
│           └───►│ Ollama :11434    │◄───┘                              │
│                └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Exact Stream Format Contract

**Location:** `knez-control-app/src/services/streaming/UnifiedEventSchema.ts`

**Base Event Structure (ALL providers MUST emit):**

```typescript
interface SSEEventBase {
  id: string;                    // Unique event ID
  event: SSEEventType;           // Event type discriminator
  timestamp: number;             // Unix timestamp (ms)
  executionId: string;           // Execution context ID
  sessionId: string;             // Session context ID
  provider: string;              // Provider identifier
  model: string;                 // Model identifier
}
```

**Token Delta Event (Core streaming unit):**

```typescript
interface TokenDeltaEvent extends SSEEventBase {
  event: 'token_delta';
  data: {
    content: string;             // Token content (can be partial UTF-8)
    index: number;               // Sequential token index
    finishReason?: string | null; // null during streaming, 'stop' at end
  };
}
```

**Stream Start Event (MUST be first):**

```typescript
interface StreamStartEvent extends SSEEventBase {
  event: 'stream_start';
  metadata: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    estimatedLatency?: number;
  };
}
```

**Stream End Event (MUST be last on success):**

```typescript
interface StreamEndEvent extends SSEEventBase {
  event: 'stream_end';
  data: {
    finishReason: string;        // 'stop', 'length', 'timeout', 'error'
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
    totalExecutionTimeMs: number;
  };
}
```

**Error Event (MUST on failure):**

```typescript
interface ErrorEvent extends SSEEventBase {
  event: 'error';
  data: {
    code: string;                // 'TIMEOUT', 'NETWORK_ERROR', 'PROVIDER_ERROR'
    message: string;
    recoverable: boolean;        // true = can retry, false = fatal
    suggestedAction?: 'retry' | 'restart' | 'fallback';
  };
}
```

### 1.3 Required Normalization Layer

**Current Problem:**
- Frontend: Provider adapters exist (`OllamaAdapter`, abstract `ProviderAdapter`)
- Backend: Direct HTTP calls to Ollama in `LocalBackend._stream_tokens()`
- Result: Backend bypasses normalization, emits different format

**Required Normalization Contract:**

```typescript
// ALL adapters MUST implement this exact interface
abstract class ProviderAdapter {
  // MUST yield SSEEvent in EXACT order:
  // 1. StreamStartEvent
  // 2. TokenDeltaEvent (0...N)
  // 3. StreamEndEvent OR ErrorEvent
  abstract stream(context: StreamContext): AsyncGenerator<SSEEvent, void, void>;
  
  // MUST return normalized health status
  abstract healthCheck(): Promise<boolean>;
  
  // MUST return list of available model IDs
  abstract getAvailableModels(): Promise<string[]>;
}
```

**Critical Stream Safety Rules:**

1. **ONE execution = ONE provider = ONE SSE stream** (no mid-stream switching)
2. **Stream start MUST be first event** (enables FSM transition to 'streaming')
3. **Token delta MUST contain incremental content** (not full message)
4. **Stream end MUST include token counts** (enables metrics)
5. **Error MUST be recoverable/fatal classification** (enables retry logic)

---

## 2. BACKEND-FIRST ARCHITECTURE DESIGN

### 2.1 Current Architecture (Flawed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (FLAWED)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FRONTEND                                    BACKEND                    │
│  ┌────────────────────────┐                 ┌────────────────────────┐ │
│  │ ModelRouter (unused)   │                 │ Router (active)        │ │
│  │ - Has routing logic    │                 │ - Has routing logic    │ │
│  │ - Has provider configs │                 │ - Has backend configs  │ │
│  └──────────┬─────────────┘                 └──────────┬─────────────┘ │
│             │                                           │              │
│  ┌──────────▼─────────────┐                 ┌───────────▼────────────┐  │
│  │ ProviderAdapters       │                 │ LocalBackend           │  │
│  │ (frontend - unused)    │                 │ (backend - active)     │  │
│  │ - OllamaAdapter          │                 │ - Direct HTTP to Ollama│  │
│  └──────────┬─────────────┘                 └───────────┬────────────┘  │
│             │                                           │              │
│             └───────────────────────────────────────────┘              │
│                          ↓                                            │
│                   ┌──────────────┐                                    │
│                   │ Ollama 11434 │                                    │
│                   └──────────────┘                                    │
│                                                                         │
│  PROBLEMS:                                                              │
│  1. Duplicate routing logic (frontend vs backend)                       │
│  2. Frontend adapters not used (ChatService calls backend directly)    │
│  3. Backend has no adapters (goes direct to Ollama)                    │
│  4. No unified model registry                                          │
│  5. No WarmupManager anywhere                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Corrected Backend-First Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CORRECTED ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FRONTEND (Presentation Layer)          BACKEND (Cognitive Layer)       │
│  ┌────────────────────────────┐          ┌────────────────────────────┐ │
│  │ NO ModelRouter             │          │ ModelRouter (AUTHORITATIVE)│ │
│  │ (routing happens in BE)    │          │ - Single source of truth   │ │
│  └────────────────────────────┘          │ - Provider selection       │ │
│                                           │ - Fallback logic           │ │
│  ┌────────────────────────────┐          └──────────┬─────────────────┘ │
│  │ NO ProviderAdapters         │                     │                  │
│  │ (adapters are BE only)      │          ┌──────────▼─────────────────┐ │
│  └────────────────────────────┘          │ ProviderAdapter Interface  │ │
│                                           │ - OllamaAdapter            │ │
│  ┌────────────────────────────┐          │ - NvidiaAdapter (future)   │ │
│  │ ChatService                │          │ - OpenAIAdapter (future)     │ │
│  │ - Calls backend API        │          └──────────┬─────────────────┘ │
│  │ - Receives SSE stream      │                     │                  │
│  │ - Updates UI               │          ┌──────────▼─────────────────┐ │
│  └────────────────────────────┘          │ WarmupManager            │ │
│                                           │ - Load on demand           │ │
│  ┌────────────────────────────┐          │ - Track last_used          │ │
│  │ StreamController           │          │ - Inactivity timeout       │ │
│  │ - Handles SSE events       │          │ - Safe unload              │ │
│  │ - Updates FSM              │          └────────────────────────────┘ │
│  └────────────────────────────┘                                        │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ ModelRegistry (GLOBAL - shared between Router + WarmupManager)      ││
│  │ - model_id, provider, capabilities, status                         ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  COMMUNICATION:                                                         │
│  - Frontend calls backend API (HTTP POST /chat/completions)            │
│  - Backend returns SSE stream (normalized format)                      │
│  - Frontend receives SSE, updates UI                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 ModelRouter Design (BACKEND ONLY)

**Location:** `KNEZ/knez/knez_core/router/ModelRouter.py` (NEW FILE)

**Purpose:** Single authoritative routing decision point

**Design:**

```python
class ModelRouter:
    """
    AUTHORITATIVE routing decision engine.
    ONE execution = ONE provider (locked at start)
    NO mid-stream switching.
    """
    
    def __init__(self, model_registry: ModelRegistry):
        self.registry = model_registry
        self._active_executions: Dict[str, ProviderType] = {}
        
    async def route(self, context: RoutingContext) -> RoutingDecision:
        """
        Make routing decision based on:
        1. User preference (local/cloud/auto)
        2. Task type (coding/reasoning/general)
        3. Model capabilities
        4. Provider health status
        5. Current load
        
        Returns RoutingDecision with execution_id (locks provider for duration)
        """
        
    def release_execution(self, execution_id: str) -> None:
        """Release execution lock (call when stream ends)"""
        
    def update_provider_health(
        self, 
        provider: ProviderType, 
        status: 'healthy' | 'degraded' | 'unhealthy'
    ) -> None:
        """Update health status (called on failure)"""
```

**RoutingDecision Schema:**

```python
@dataclass
class RoutingDecision:
    execution_id: str           # Unique execution identifier
    provider: ProviderType       # Selected provider (locked)
    model: str                  # Selected model ID
    reason: str                 # Human-readable selection reason
    confidence: float           # 0.0-1.0 confidence score
    estimated_latency_ms: int   # Predicted time to first token
    fallback_chain: List[ProviderType]  # Ordered fallback providers
    timestamp: int              # Decision timestamp
```

**RoutingContext Schema:**

```python
@dataclass
class RoutingContext:
    session_id: str
    user_preference: Literal['local', 'cloud', 'auto'] = 'auto'
    task_type: Literal['coding', 'reasoning', 'general', 'creative'] = 'general'
    requires_offline: bool = False      # Force local if True
    requested_model: Optional[str] = None # Specific model request
    message_count: int = 0              # For context length estimation
    estimated_tokens: int = 0           # For latency prediction
```

**Routing Algorithm:**

```python
def select_provider(self, context: RoutingContext) -> ProviderConfig:
    # 1. Filter by user preference
    if context.user_preference == 'local':
        candidates = self.registry.get_local_providers()
    elif context.user_preference == 'cloud':
        candidates = self.registry.get_cloud_providers()
    else:  # auto
        candidates = self.registry.get_all_healthy()
    
    # 2. Filter by offline requirement
    if context.requires_offline:
        candidates = [c for c in candidates if c.is_local]
    
    # 3. Score by task type match
    scored = []
    for provider in candidates:
        score = self._score_for_task(provider, context.task_type)
        scored.append((score, provider))
    
    # 4. Sort by score (highest first)
    scored.sort(key=lambda x: x[0], reverse=True)
    
    # 5. Return highest scored
    return scored[0][1] if scored else self.registry.get_fallback()
```

### 2.4 ProviderAdapter Interface (STRICT)

**Location:** `KNEZ/knez/knez_core/adapters/base.py` (NEW FILE)

**Design:**

```python
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from ..streaming.schema import SSEEvent, StreamContext

class ProviderAdapter(ABC):
    """
    STRICT adapter interface for ALL model providers.
    
    Guarantees:
    1. All outputs normalized to SSEEvent format
    2. All streams follow contract: start → tokens → end
    3. All errors are recoverable-classified
    """
    
    def __init__(self, provider_id: str, config: AdapterConfig):
        self.provider_id = provider_id
        self.config = config
        
    @abstractmethod
    async def stream(
        self, 
        context: StreamContext
    ) -> AsyncGenerator[SSEEvent, None]:
        """
        REQUIRED event sequence:
        1. SSEEvent(event='stream_start', ...)
        2. SSEEvent(event='token_delta', ...) [0..N]
        3. SSEEvent(event='stream_end', ...) OR SSEEvent(event='error', ...)
        
        MUST yield at least stream_start + (stream_end OR error)
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> HealthStatus:
        """
        Return current health status:
        - healthy: Ready to serve requests
        - degraded: Slow/unreliable but functional
        - unhealthy: Not accepting requests
        """
        pass
    
    @abstractmethod
    async def load_model(self, model_id: str) -> bool:
        """
        Load model into memory (for local providers).
        Called by WarmupManager.
        Returns True if loaded successfully.
        """
        pass
    
    @abstractmethod
    async def unload_model(self, model_id: str) -> bool:
        """
        Unload model from memory (for local providers).
        Called by WarmupManager on timeout.
        Returns True if unloaded successfully.
        """
        pass
    
    @abstractmethod
    async def get_loaded_models(self) -> List[str]:
        """
        Return list of currently loaded model IDs.
        Used by ModelRegistry for status tracking.
        """
        pass
    
    @abstractmethod
    async def get_available_models(self) -> List[ModelInfo]:
        """
        Return list of models available on this provider.
        Used by ModelRegistry for capability discovery.
        """
        pass
```

**OllamaAdapter Implementation:**

```python
class OllamaAdapter(ProviderAdapter):
    """
    Ollama provider adapter.
    
    Normalizes Ollama's streaming format to unified SSEEvent.
    Handles model lifecycle (load/unload) via Ollama API.
    """
    
    def __init__(self, config: AdapterConfig):
        super().__init__('ollama', config)
        self._client: Optional[httpx.AsyncClient] = None
        
    async def stream(self, context: StreamContext) -> AsyncGenerator[SSEEvent, None]:
        # 1. Emit stream_start
        yield self._create_stream_start(context)
        
        try:
            # 2. Connect to Ollama
            response = await self._client.post(
                f"{self.config.endpoint}/api/chat",
                json={
                    "model": context.model,
                    "messages": context.messages,
                    "stream": True
                }
            )
            
            # 3. Stream tokens
            token_index = 0
            async for line in response.aiter_lines():
                chunk = json.loads(line)
                
                if chunk.get('message', {}).get('content'):
                    yield self._create_token_delta(
                        context, 
                        chunk['message']['content'],
                        token_index
                    )
                    token_index += 1
                
                if chunk.get('done'):
                    # 4. Emit stream_end
                    yield self._create_stream_end(
                        context,
                        finish_reason='stop',
                        total_tokens=chunk.get('eval_count', 0)
                    )
                    return
                    
        except Exception as e:
            # 5. Emit error (classified as recoverable or fatal)
            yield self._create_error(context, e)
```

---

## 3. WARMUPMANAGER DESIGN (BACKEND ONLY)

### 3.1 Purpose

- Eliminate cold-start latency for local models
- Keep frequently-used models loaded
- Unload infrequently-used models to free memory
- Coordinate with ModelRegistry for status

### 3.2 Design

**Location:** `KNEZ/knez/knez_core/warmup/manager.py` (NEW FILE)

```python
class WarmupManager:
    """
    Manages model loading/unloading for local providers.
    
    Rules:
    1. Load on first use (demand-driven)
    2. Keep loaded for INACTIVITY_TIMEOUT after last use
    3. Unload oldest first when memory pressure detected
    4. Never unload model with active execution
    """
    
    INACTIVITY_TIMEOUT_MINUTES = 10
    MAX_CONCURRENT_LOADS = 2
    MEMORY_PRESSURE_THRESHOLD = 0.85  # 85% RAM usage
    
    def __init__(
        self, 
        model_registry: ModelRegistry,
        adapter_factory: AdapterFactory
    ):
        self.registry = model_registry
        self.adapters = adapter_factory
        
        # Track loaded models
        self._loaded_models: Dict[str, ModelLoadState] = {}
        
        # Track last used timestamps
        self._last_used: Dict[str, datetime] = {}
        
        # Active executions per model
        self._active_executions: Dict[str, Set[str]] = {}
        
        # Background cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def start(self) -> None:
        """Start background cleanup task."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
    async def stop(self) -> None:
        """Stop background cleanup, unload all models."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            
        # Unload all models gracefully
        for model_id in list(self._loaded_models.keys()):
            await self.unload_model(model_id)
    
    async def on_execution_start(
        self, 
        model_id: str, 
        execution_id: str
    ) -> bool:
        """
        Called by ModelRouter when execution starts.
        
        1. Ensure model is loaded (load if needed)
        2. Track active execution
        3. Update last_used timestamp
        
        Returns True if model ready for execution.
        """
        # Ensure loaded
        if model_id not in self._loaded_models:
            loaded = await self._load_model(model_id)
            if not loaded:
                return False
        
        # Track execution
        if model_id not in self._active_executions:
            self._active_executions[model_id] = set()
        self._active_executions[model_id].add(execution_id)
        
        # Update last used
        self._last_used[model_id] = datetime.now()
        
        # Update registry status
        self.registry.update_model_status(
            model_id, 
            status='loaded',
            last_used=self._last_used[model_id]
        )
        
        return True
    
    async def on_execution_end(
        self, 
        model_id: str, 
        execution_id: str
    ) -> None:
        """
        Called by ModelRouter when execution ends.
        
        1. Remove from active executions
        2. Update last_used timestamp
        3. Model becomes eligible for cleanup
        """
        if model_id in self._active_executions:
            self._active_executions[model_id].discard(execution_id)
        
        self._last_used[model_id] = datetime.now()
        self.registry.update_model_status(
            model_id,
            status='loaded',
            last_used=self._last_used[model_id]
        )
    
    async def _load_model(self, model_id: str) -> bool:
        """
        Load model via appropriate adapter.
        
        1. Get provider from registry
        2. Get adapter for provider
        3. Call adapter.load_model()
        4. Update registry status
        """
        model = self.registry.get_model(model_id)
        if not model:
            return False
            
        adapter = self.adapters.get_adapter(model.provider)
        
        try:
            success = await adapter.load_model(model_id)
            if success:
                self._loaded_models[model_id] = ModelLoadState(
                    loaded_at=datetime.now(),
                    load_count=1
                )
                self._last_used[model_id] = datetime.now()
                self.registry.update_model_status(model_id, 'loaded')
            return success
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            return False
    
    async def unload_model(self, model_id: str) -> bool:
        """
        Unload model via appropriate adapter.
        
        1. Check no active executions
        2. Call adapter.unload_model()
        3. Update registry status
        4. Cleanup tracking state
        """
        # Check active executions
        active = self._active_executions.get(model_id, set())
        if active:
            logger.warning(f"Cannot unload {model_id}: {len(active)} active executions")
            return False
        
        model = self.registry.get_model(model_id)
        if not model:
            return False
            
        adapter = self.adapters.get_adapter(model.provider)
        
        try:
            success = await adapter.unload_model(model_id)
            if success:
                del self._loaded_models[model_id]
                del self._last_used[model_id]
                if model_id in self._active_executions:
                    del self._active_executions[model_id]
                self.registry.update_model_status(model_id, 'unloaded')
            return success
        except Exception as e:
            logger.error(f"Failed to unload model {model_id}: {e}")
            return False
    
    async def _cleanup_loop(self) -> None:
        """
        Background task that periodically:
        1. Unload models with no recent use
        2. Handle memory pressure by unloading oldest
        3. Run every 60 seconds
        """
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                now = datetime.now()
                
                # Find models to unload (inactive)
                to_unload = []
                for model_id, last_used in self._last_used.items():
                    inactive_time = (now - last_used).total_seconds() / 60
                    
                    # Check if inactive beyond timeout
                    if inactive_time > self.INACTIVITY_TIMEOUT_MINUTES:
                        # Check no active executions
                        active = self._active_executions.get(model_id, set())
                        if not active:
                            to_unload.append((model_id, inactive_time))
                
                # Sort by most inactive first
                to_unload.sort(key=lambda x: x[1], reverse=True)
                
                # Unload models
                for model_id, _ in to_unload:
                    logger.info(f"Unloading inactive model: {model_id}")
                    await self.unload_model(model_id)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
```

### 3.3 Lifecycle States

```
                    ┌─────────────────────┐
                    │     UNLOADED        │
                    │  (not in memory)    │
                    └──────────┬──────────┘
                               │ on_execution_start()
                               │ (demand load)
                    ┌──────────▼──────────┐
                    │      LOADING        │
                    │   (async load)      │
                    └──────────┬──────────┘
                               │ load complete
                    ┌──────────▼──────────┐
         ┌────────►│      LOADED         │◄────────┐
         │         │  (ready for use)    │         │
         │         └──────────┬──────────┘         │
         │                    │                    │
    on_execution_start()  on_execution_end()  inactivity timeout
         │         ┌──────────▼──────────┐         │
         │         │    ACTIVE_USE       │         │
         │         │ (execution running) │         │
         │         └─────────────────────┘         │
         │                                           │
         └──────── on_execution_end() ──────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     UNLOADING       │
                    │   (async unload)    │
                    └──────────┬──────────┘
                               │ unload complete
                               └─────────────────────┐
                                                     │
                    ┌─────────────────────┐◄────────┘
                    │     UNLOADED        │
                    │  (not in memory)    │
                    └─────────────────────┘
```

---

## 4. MODELREGISTRY DESIGN

### 4.1 Purpose

Single source of truth for all model metadata, capabilities, and status.
Used by:
- ModelRouter (for routing decisions)
- WarmupManager (for lifecycle tracking)
- UI (for model selection display)

### 4.2 Schema

**Location:** `KNEZ/knez/knez_core/registry/schema.py` (NEW FILE)

```python
@dataclass
class ModelCapabilities:
    """Static capabilities (do not change during runtime)."""
    streaming: bool = True           # Supports streaming responses
    tools: bool = False              # Supports tool calling
    reasoning: bool = False          # Supports reasoning/CoT
    vision: bool = False             # Supports image input
    coding_optimized: bool = False   # Optimized for code generation
    multilingual: bool = False       # Supports multiple languages
    max_context_length: int = 4096   # Maximum token context
    typical_latency_ms: int = 500    # Typical time to first token


@dataclass 
class ModelStatus:
    """Dynamic status (changes during runtime)."""
    loaded: bool = False             # Currently loaded in memory
    last_used: Optional[datetime] = None
    load_count: int = 0              # Total times loaded
    error_count: int = 0           # Consecutive errors
    average_execution_time_ms: Optional[int] = None


@dataclass
class ModelInfo:
    """Complete model registration."""
    # Identity
    model_id: str                  # Unique identifier (e.g., "qwen2.5:7b-instruct-q4_K_M")
    provider: ProviderType         # Provider that serves this model
    display_name: str              # Human-readable name
    
    # Static (set at registration)
    capabilities: ModelCapabilities
    
    # Dynamic (updated during runtime)
    status: ModelStatus
    
    # Provider-specific configuration
    provider_config: Dict[str, Any] = field(default_factory=dict)


class ModelRegistry:
    """
    Global model registry.
    
    - Models registered at startup or discovered dynamically
    - Provides filtered views for routing
    - Tracks status changes (loaded/unloaded)
    """
    
    def __init__(self):
        self._models: Dict[str, ModelInfo] = {}
        self._by_provider: Dict[ProviderType, List[str]] = {}
        self._lock = asyncio.Lock()
        
    async def register(self, model: ModelInfo) -> None:
        """Register a new model."""
        async with self._lock:
            self._models[model.model_id] = model
            if model.provider not in self._by_provider:
                self._by_provider[model.provider] = []
            if model.model_id not in self._by_provider[model.provider]:
                self._by_provider[model.provider].append(model.model_id)
    
    async def unregister(self, model_id: str) -> None:
        """Unregister a model."""
        async with self._lock:
            if model_id in self._models:
                model = self._models[model_id]
                del self._models[model_id]
                if model.provider in self._by_provider:
                    self._by_provider[model.provider].remove(model_id)
    
    def get_model(self, model_id: str) -> Optional[ModelInfo]:
        """Get single model by ID."""
        return self._models.get(model_id)
    
    def get_by_provider(self, provider: ProviderType) -> List[ModelInfo]:
        """Get all models for a provider."""
        model_ids = self._by_provider.get(provider, [])
        return [self._models[mid] for mid in model_ids if mid in self._models]
    
    def get_loaded(self) -> List[ModelInfo]:
        """Get all currently loaded models."""
        return [m for m in self._models.values() if m.status.loaded]
    
    def get_with_capability(self, capability: str) -> List[ModelInfo]:
        """Get all models with specific capability."""
        return [
            m for m in self._models.values()
            if getattr(m.capabilities, capability, False)
        ]
    
    def update_model_status(
        self, 
        model_id: str, 
        status: str,
        **kwargs
    ) -> None:
        """Update dynamic status of a model."""
        if model_id in self._models:
            model = self._models[model_id]
            model.status.loaded = (status == 'loaded')
            for key, value in kwargs.items():
                if hasattr(model.status, key):
                    setattr(model.status, key, value)
```

### 4.3 Registration Example

```python
# At startup, register available models
async def initialize_registry(registry: ModelRegistry):
    # Ollama models (discovered dynamically)
    ollama_adapter = OllamaAdapter(...)
    ollama_models = await ollama_adapter.get_available_models()
    
    for model_id in ollama_models:
        await registry.register(ModelInfo(
            model_id=model_id,
            provider=ProviderType.OLLAMA,
            display_name=model_id.split(':')[0].title(),
            capabilities=ModelCapabilities(
                streaming=True,
                tools=True,
                max_context_length=32768,
                typical_latency_ms=500,
            ),
            status=ModelStatus(loaded=False),
        ))
```

---

## 5. ARCHITECTURAL RISK ELIMINATION

### 5.1 Risk 1: Duplicate Routing (CLIENT vs BACKEND)

**Current State:**
- Frontend has `ModelRouter` in `knez-control-app/src/services/routing/ModelRouter.ts`
- Backend has `Router` in `KNEZ/knez/knez_core/router/router.py`
- Frontend router is NOT used (ChatService calls backend directly)

**Risk:**
- Confusion about which router is authoritative
- Potential for frontend to make routing decisions that backend ignores
- Maintenance burden of duplicate logic

**ELIMINATION PLAN:**

```
ACTION 1: Remove frontend ModelRouter
─────────────────────────────────────
- Delete: knez-control-app/src/services/routing/ModelRouter.ts
- Delete: knez-control-app/src/services/routing/ (entire directory)
- Remove imports from StreamingExecutionEngine.ts
- ChatService calls backend API directly (no routing layer in frontend)

ACTION 2: Keep backend Router (rename to ModelRouter)
────────────────────────────────────────────────────
- Rename: KNEZ/knez/knez_core/router/router.py → model_router.py
- Rename class: Router → ModelRouter
- Update all imports
- This is the SINGLE authoritative routing decision point

RESULT: Frontend has NO routing logic. Backend is SOLE authority.
```

### 5.2 Risk 2: Direct Ollama Dependency

**Current State:**
- Frontend: OllamaAdapter exists but unused
- Backend: LocalBackend makes direct HTTP calls to Ollama
- No abstraction layer in backend

**Risk:**
- Cannot add other local providers (Nvidia, vLLM, etc.)
- Backend bypasses normalization, emits inconsistent format
- Cannot implement unified warmup/load management

**ELIMINATION PLAN:**

```
ACTION 1: Create backend ProviderAdapter base class
───────────────────────────────────────────────────
NEW: KNEZ/knez/knez_core/adapters/base.py
- Define abstract ProviderAdapter interface
- Require stream() → AsyncGenerator[SSEEvent]
- Require load_model(), unload_model(), health_check()

ACTION 2: Create OllamaAdapter in backend
────────────────────────────────────────
NEW: KNEZ/knez/knez_core/adapters/ollama.py
- Implements ProviderAdapter
- Normalizes Ollama format to SSEEvent
- Handles Ollama-specific lifecycle

ACTION 3: Refactor LocalBackend to use adapter
──────────────────────────────────────────────
MODIFY: KNEZ/knez/knez_core/models/local_backend.py
- Remove direct HTTP calls
- Use OllamaAdapter for all Ollama communication
- LocalBackend becomes thin wrapper around adapter

ACTION 4: Remove frontend adapters (optional)
────────────────────────────────────────────
- Frontend no longer needs adapters (backend handles all)
- Keep only if direct Ollama calls needed for health checks
```

### 5.3 Risk 3: Inconsistent Provider Outputs

**Current State:**
- Backend LocalBackend: Direct Ollama HTTP → raw Ollama format
- Frontend (if adapters used): Normalized SSEEvent format
- Format mismatch between backend and frontend expectations

**Risk:**
- ChatService expects SSEEvent format, backend emits raw Ollama
- FSM transitions break on unexpected format
- Tool execution breaks on format mismatch

**ELIMINATION PLAN:**

```
SINGLE NORMALIZATION POINT: BACKEND ONLY
──────────────────────────────────────────

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Ollama API     │────►│ OllamaAdapter   │────►│  SSEEvent       │
│  (raw format)   │     │ (normalizes)    │     │  (unified)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Frontend (any)   │
                    │  Receives unified   │
                    │  SSEEvent format    │
                    └───────────────────┘

ENFORCEMENT:
1. Backend OllamaAdapter is SOLE normalization point
2. All providers MUST use adapter interface
3. All adapter outputs are validated against SSEEvent schema
4. Frontend receives ONLY normalized SSEEvent
```

### 5.4 Risk 4: No WarmupManager Anywhere

**Current State:**
- No WarmupManager exists in codebase
- First request incurs cold-start latency
- Models stay loaded indefinitely

**Risk:**
- Poor UX on first request (long wait for model load)
- Memory pressure from unused loaded models
- No coordinated model lifecycle

**ELIMINATION PLAN:**

```
CREATE: KNEZ/knez/knez_core/warmup/manager.py
─────────────────────────────────────────────
- Implements demand-driven loading
- Tracks last_used timestamps
- Unloads after INACTIVITY_TIMEOUT
- Coordinates with ModelRegistry

INTEGRATION POINTS:
- ModelRouter.on_execution_start() → WarmupManager.on_execution_start()
- ModelRouter.on_execution_end() → WarmupManager.on_execution_end()
- Startup: WarmupManager.start()
- Shutdown: WarmupManager.stop()
```

---

## 6. SAFE INTEGRATION PLAN

### 6.1 Phase 1: Foundation (No Stream Changes)

**Goal:** Establish backend architecture WITHOUT modifying streaming pipeline

```
STEP 1: Create ModelRegistry
────────────────────────────
Files: NEW KNEZ/knez/knez_core/registry/schema.py
       NEW KNEZ/knez/knez_core/registry/manager.py

Actions:
- Define ModelInfo, ModelCapabilities, ModelStatus
- Implement ModelRegistry with CRUD operations
- Add provider filtering, capability filtering

Safety:
- NO changes to streaming code
- NO changes to ChatService
- Registry is standalone, can be tested in isolation

STEP 2: Create ProviderAdapter Base Class
────────────────────────────────────────
Files: NEW KNEZ/knez/knez_core/adapters/base.py

Actions:
- Define abstract ProviderAdapter
- Define SSEEvent schema (copy from frontend)
- Define StreamContext, AdapterConfig

Safety:
- NO changes to existing code
- Pure interface definition

STEP 3: Create Backend OllamaAdapter
───────────────────────────────────
Files: NEW KNEZ/knez/knez_core/adapters/ollama.py

Actions:
- Copy normalization logic from frontend adapter
- Adapt to backend Python/httpx
- Implement all abstract methods

Safety:
- NO integration yet (standalone file)
- Can be tested independently

STEP 4: Create ModelRouter (Backend)
───────────────────────────────────
Files: NEW KNEZ/knez/knez_core/router/model_router.py
       DELETE KNEZ/knez/knez_core/router/router.py (after migration)

Actions:
- Implement ModelRouter with routing algorithm
- Integrate with ModelRegistry
- Implement execution locking

Safety:
- NOT connected to completions.py yet
- Can be tested with unit tests

STEP 5: Create WarmupManager
───────────────────────────
Files: NEW KNEZ/knez/knez_core/warmup/manager.py

Actions:
- Implement lifecycle management
- Integrate with ModelRegistry
- Add background cleanup task

Safety:
- NOT connected to execution flow yet
- Can be tested in isolation
```

### 6.2 Phase 2: Adapter Integration (Stream-Safe)

**Goal:** Replace LocalBackend direct Ollama calls with adapter

```
STEP 6: Refactor LocalBackend
────────────────────────────
Files: MODIFY KNEZ/knez/knez_core/models/local_backend.py

Current Behavior:
- _stream_tokens() calls Ollama directly
- Returns raw Ollama chunks

New Behavior:
- _stream_tokens() uses OllamaAdapter
- Receives normalized SSEEvent from adapter
- Yields tokens from SSEEvent.data.content

Integration Point:
Line ~124 in local_backend.py:

OLD:
    async def _stream_tokens(self, messages, tools=None, tool_choice=None):
        await self._ensure_model_id()
        url = f"{self.endpoint}/api/chat"
        payload = {...}
        client = await self._get_client()
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                data = json.loads(line)
                if data.get('message', {}).get('content'):
                    yield data['message']['content']  # Raw Ollama format

NEW:
    async def _stream_tokens(self, messages, tools=None, tool_choice=None):
        await self._ensure_model_id()
        
        # Use adapter for normalized streaming
        context = StreamContext(
            execution_id=str(uuid.uuid4()),
            session_id=self.session_id,
            model=self.model_id,
            messages=messages,
            tools=tools,
            tool_choice=tool_choice
        )
        
        adapter = await self._get_adapter()  # Returns OllamaAdapter
        
        async for event in adapter.stream(context):
            if event.event == 'token_delta':
                yield event.data.content  # Normalized SSE format
            elif event.event == 'stream_end':
                break
            elif event.event == 'error':
                raise BackendFailure(event.data.message)

Safety:
- Output format to completions.py UNCHANGED (string tokens)
- Normalization happens inside adapter
- If adapter fails, fallback to old behavior (feature flag)

STEP 7: Register Models at Startup
──────────────────────────────────
Files: MODIFY KNEZ/knez/knez_core/app.py (or startup location)

Actions:
- Initialize ModelRegistry
- Discover Ollama models via adapter
- Register each model in registry

Integration Point:
- Called during FastAPI startup event
```

### 6.3 Phase 3: Router Integration (Stream-Safe)

**Goal:** Replace Router with ModelRouter in execution flow

```
STEP 8: Integrate ModelRouter with completions.py
───────────────────────────────────────────────
Files: MODIFY KNEZ/knez/knez_core/api/completions.py

Current Behavior:
    router: Router = request.app.state.router
    local = next((b for b in router.backends if isinstance(b, LocalBackend)), None)
    primary = local or await router.select(gen_request)

New Behavior:
    model_router: ModelRouter = request.app.state.model_router
    warmup_manager: WarmupManager = request.app.state.warmup_manager
    
    # Route to provider
    routing_context = RoutingContext(
        session_id=session_id,
        user_preference='local',  # From request/config
        task_type='general',
        requested_model=gen_request.model,
        message_count=len(gen_request.messages),
        estimated_tokens=estimate_tokens(gen_request.messages)
    )
    
    decision = await model_router.route(routing_context)
    
    # Ensure model is loaded (warmup)
    loaded = await warmup_manager.on_execution_start(
        decision.model, 
        decision.execution_id
    )
    if not loaded:
        # Handle load failure (return error or fallback)
        ...
    
    # Get backend via adapter
    adapter = adapter_factory.get_adapter(decision.provider)
    
    # Stream via adapter (normalized)
    try:
        async for event in adapter.stream(stream_context):
            if event.event == 'token_delta':
                yield format_sse(event.data.content)
            elif event.event == 'stream_end':
                # Update metrics
                break
    finally:
        # Release execution lock and update warmup state
        model_router.release_execution(decision.execution_id)
        await warmup_manager.on_execution_end(decision.model, decision.execution_id)

Safety:
- SSE output format UNCHANGED
- FSM transitions UNCHANGED (same events emitted)
- Error handling UNCHANGED
- Can rollback to old router if issues (feature flag)

STEP 9: Integrate WarmupManager with Lifecycle
────────────────────────────────────────────
Files: MODIFY KNEZ/knez/knez_core/app.py

Actions:
- Start WarmupManager on startup
- Stop WarmupManager on shutdown
- Integrate with ModelRouter callbacks

Integration Point:
- app.add_event_handler("startup", warmup_manager.start)
- app.add_event_handler("shutdown", warmup_manager.stop)
```

### 6.4 Phase 4: Frontend Cleanup (Optional)

**Goal:** Remove unused frontend routing code

```
STEP 10: Remove Frontend ModelRouter (AFTER backend stable)
───────────────────────────────────────────────────────────
Files: DELETE knez-control-app/src/services/routing/

Actions:
- Remove ModelRouter.ts
- Remove all routing imports
- Update StreamingExecutionEngine (remove routing calls)

Safety:
- ONLY after backend integration is stable
- ONLY after e2e tests pass
- Can be done in separate release

STEP 11: Remove Frontend ProviderAdapters (Optional)
──────────────────────────────────────────────────
Files: DELETE knez-control-app/src/services/providers/

Note:
- Keep if direct Ollama health checks needed
- Keep if offline mode needs direct provider calls
- Otherwise, all provider interaction goes through backend
```

---

## 7. FINAL ARCHITECTURE DIAGRAM (CORRECTED)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      CORRECTED KNEZ ARCHITECTURE                                │
│                     Backend-First, Stream-Safe Design                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                         FRONTEND (Presentation)                            ││
│  │                                                                            ││
│  │  ┌─────────────────────┐    ┌─────────────────────┐    ┌───────────────┐ ││
│  │  │   ChatService       │───►│  StreamController   │───►│   FSM / UI    │ ││
│  │  │   - Calls backend   │    │  - Handles SSE      │    │               │ ││
│  │  │   - No routing      │    │  - Updates state    │    │               │ ││
│  │  └──────────┬──────────┘    └─────────────────────┘    └───────────────┘ ││
│  │             │                                                              ││
│  │             │ HTTP POST /chat/completions                                  ││
│  │             │ Accept: text/event-stream                                   ││
│  └─────────────┼──────────────────────────────────────────────────────────────┘│
│                │                                                                │
│                ▼                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                          BACKEND (Cognitive)                                 ││
│  │                                                                            ││
│  │  ┌──────────────────────────────────────────────────────────────────────┐  ││
│  │  │  completions.py (API Layer)                                          │  ││
│  │  │  - Receives request                                                  │  ││
│  │  │  - Calls ModelRouter.route()                                         │  ││
│  │  │  - Calls WarmupManager.on_execution_start()                          │  ││
│  │  │  - Streams via ProviderAdapter                                     │  ││
│  │  │  - Returns SSE stream (normalized)                                   │  ││
│  │  └────────────────────────────────┬───────────────────────────────────────┘  ││
│  │                                   │                                          ││
│  │         ┌─────────────────────────┼─────────────────────────┐                ││
│  │         │                         │                         │                ││
│  │  ┌──────▼──────┐         ┌────────▼────────┐      ┌────────▼───────┐       ││
│  │  │ ModelRouter │         │ WarmupManager    │      │ ModelRegistry  │       ││
│  │  │             │         │                  │      │                │       ││
│  │  │ Authoritative│◄────────┤ on_exec_start   │◄─────┤ get_model()    │       ││
│  │  │ routing      │         │ on_exec_end     │      │ update_status()│       ││
│  │  │ decision     │         │ load_model      │      │ register()     │       ││
│  │  └──────┬──────┘         │ unload_model    │      └────────────────┘       ││
│  │         │                └────────┬────────┘                               ││
│  │         │                         │                                        ││
│  │  ┌──────▼─────────────────────────▼──────────────────────────────────┐    ││
│  │  │                    ProviderAdapter Interface                         │    ││
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    ││
│  │  │  │ OllamaAdapter│  │NvidiaAdapter │  │OpenAIAdapter │   (future)   │    ││
│  │  │  │              │  │              │  │              │              │    ││
│  │  │  │ - stream()   │  │ - stream()   │  │ - stream()   │              │    ││
│  │  │  │ - load()     │  │ - load()     │  │ - load()     │              │    ││
│  │  │  │ - unload()   │  │ - unload()   │  │ - unload()   │              │    ││
│  │  │  └──────┬───────┘  └──────────────┘  └──────────────┘              │    ││
│  │  │         │  Normalizes to SSEEvent                                 │    ││
│  │  └─────────┼─────────────────────────────────────────────────────────┘    ││
│  │            │                                                               ││
│  └────────────┼───────────────────────────────────────────────────────────────┘│
│               │                                                                 │
│               ▼                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                           OLLAMA  :11434                                   ││
│  │                         (Local Model Server)                               ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  KEY PRINCIPLES:                                                                │
│  1. Backend is SOLE authority for routing                                      │
│  2. ALL providers normalized via Adapter interface                               │
│  3. WarmupManager handles model lifecycle (backend only)                         │
│  4. ModelRegistry is single source of truth                                      │
│  5. Streaming format is UNIFIED (SSEEvent) across all providers                │
│  6. Frontend has NO routing logic, NO adapters (presentation only)              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. SUMMARY OF DELIVERABLES

### 8.1 Files to Create

| File | Purpose |
|------|---------|
| `KNEZ/knez/knez_core/registry/schema.py` | ModelRegistry schema definitions |
| `KNEZ/knez/knez_core/registry/manager.py` | ModelRegistry implementation |
| `KNEZ/knez/knez_core/adapters/base.py` | ProviderAdapter abstract base |
| `KNEZ/knez/knez_core/adapters/ollama.py` | OllamaAdapter implementation |
| `KNEZ/knez/knez_core/adapters/factory.py` | AdapterFactory for provider lookup |
| `KNEZ/knez/knez_core/router/model_router.py` | New ModelRouter (authoritative) |
| `KNEZ/knez/knez_core/warmup/manager.py` | WarmupManager implementation |
| `KNEZ/knez/knez_core/streaming/schema.py` | SSEEvent schema (backend copy) |

### 8.2 Files to Modify

| File | Change |
|------|--------|
| `KNEZ/knez/knez_core/models/local_backend.py` | Use OllamaAdapter instead of direct HTTP |
| `KNEZ/knez/knez_core/api/completions.py` | Integrate ModelRouter and WarmupManager |
| `KNEZ/knez/knez_core/app.py` | Initialize registry, router, warmup manager |

### 8.3 Files to Delete (After Stabilization)

| File | Reason |
|------|--------|
| `KNEZ/knez/knez_core/router/router.py` | Replaced by model_router.py |
| `knez-control-app/src/services/routing/ModelRouter.ts` | Routing moved to backend |
| `knez-control-app/src/services/routing/` | Entire directory removed |

---

## 9. VERIFICATION CHECKLIST

### Pre-Implementation Safety

- [ ] All new files can be created WITHOUT modifying existing code
- [ ] All modifications have feature flags for rollback
- [ ] Streaming pipeline changes are NONE in Phase 1
- [ ] ChatService requires NO changes
- [ ] FSM transitions remain unchanged
- [ ] Backend API contract remains unchanged

### Implementation Order

- [ ] Phase 1: Foundation (all new files, no integration)
- [ ] Unit tests for all new components
- [ ] Phase 2: Adapter integration (LocalBackend refactor)
- [ ] Integration tests with backend only
- [ ] Phase 3: Router integration (completions.py)
- [ ] End-to-end tests with frontend
- [ ] Phase 4: Frontend cleanup (optional, post-stabilization)

---

**END OF PHASE 1 ARCHITECTURE DESIGN**

**Next Action:** Review and approve architecture design, then proceed with Phase 1 implementation (foundation files only).
