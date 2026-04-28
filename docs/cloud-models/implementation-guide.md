# Implementation Guide: Unlimited AI APIs

**Practical patterns for building with RPM-only APIs**

---

## Architecture Patterns

### 1. Single Provider (Simple)

Best for: Prototyping, low-traffic apps

```python
from groq import Groq

client = Groq(api_key="gsk_...")

def generate_text(prompt):
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content
```

**Pros:** Simple, fast to implement  
**Cons:** Single point of failure, rate limit bottleneck

---

### 2. Fallback Chain (Recommended)

Best for: Production apps requiring reliability

```python
from openai import OpenAI

class AIFallbackChain:
    def __init__(self):
        self.providers = [
            {"name": "groq", "client": OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_..."), "model": "llama-3.1-8b-instant", "rpm": 60},
            {"name": "cerebras", "client": OpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_..."), "model": "llama-3.3-70b", "rpm": 30},
            {"name": "openrouter", "client": OpenAI(base_url="https://openrouter.ai/api/v1", api_key="sk-or-v1-..."), "model": "meta-llama/llama-3.3-70b-instruct:free", "rpm": 20}
        ]
    
    def generate(self, prompt, max_retries_per_provider=2):
        for provider in self.providers:
            for attempt in range(max_retries_per_provider):
                try:
                    response = provider["client"].chat.completions.create(
                        model=provider["model"],
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1024
                    )
                    return {
                        "content": response.choices[0].message.content,
                        "provider": provider["name"],
                        "success": True
                    }
                except Exception as e:
                    if attempt == max_retries_per_provider - 1:
                        continue
                    import time
                    time.sleep(1)
        
        return {"error": "All providers failed", "success": False}

# Usage
ai = AIFallbackChain()
result = ai.generate("Write a haiku about AI")
print(f"Provider: {result['provider']}")
print(f"Content: {result['content']}")
```

**Pros:** Fault-tolerant, higher effective RPM  
**Cons:** More complex, need to handle different model behaviors

---

### 3. Round-Robin Load Balancing

Best for: High-throughput applications

```python
import itertools
from openai import OpenAI

class RoundRobinAI:
    def __init__(self):
        self.providers = [
            OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_..."),
            OpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_..."),
            OpenAI(base_url="https://openrouter.ai/api/v1", api_key="sk-or-v1-...")
        ]
        self.models = [
            "llama-3.1-8b-instant",
            "llama-3.3-70b",
            "meta-llama/llama-3.3-70b-instruct:free"
        ]
        self.cycle = itertools.cycle(zip(self.providers, self.models))
    
    def generate(self, prompt):
        client, model = next(self.cycle)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
```

**Pros:** Distributes load, simple  
**Cons:** No failure handling, models may behave differently

---

### 4. Priority Queue (Speed + Volume)

Best for: Mixed workloads (real-time + batch)

```python
from openai import OpenAI
import asyncio

class PriorityAI:
    def __init__(self):
        # Fast provider for real-time
        self.fast = OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_...")
        # Volume provider for batch
        self.volume = OpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_...")
    
    async def generate(self, prompt, priority="normal"):
        if priority == "high":
            # Use Groq for speed
            client = self.fast
            model = "llama-3.1-8b-instant"
        else:
            # Use Cerebras for volume
            client = self.volume
            model = "llama-3.3-70b"
        
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content

# Usage
ai = PriorityAI()

# High priority (user-facing)
user_response = await ai.generate("Hello!", priority="high")

# Normal priority (background)
batch_response = await ai.generate("Process this data", priority="normal")
```

**Pros:** Optimized for different use cases  
**Cons:** Need to classify requests

---

## Rate Limit Management

### Token Bucket Implementation

```python
import time
import threading

class TokenBucket:
    def __init__(self, rate, capacity):
        """
        rate: tokens per second
        capacity: maximum bucket size
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self.lock = threading.Lock()
    
    def consume(self, tokens=1):
        with self.lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    def wait_time(self, tokens=1):
        with self.lock:
            if self.tokens >= tokens:
                return 0
            needed = tokens - self.tokens
            return needed / self.rate

# Usage: 30 RPM = 0.5 tokens/second
groq_70b_bucket = TokenBucket(rate=0.5, capacity=30)

# Before each request
if groq_70b_bucket.consume():
    make_request()
else:
    wait = groq_70b_bucket.wait_time()
    time.sleep(wait)
    make_request()
```

---

### Async Rate Limiter

```python
import asyncio
import time

class AsyncRateLimiter:
    def __init__(self, rpm):
        self.delay = 60.0 / rpm
        self.last_request = 0
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_request
            if elapsed < self.delay:
                await asyncio.sleep(self.delay - elapsed)
            self.last_request = time.time()

# Usage
groq_limiter = AsyncRateLimiter(rpm=60)
cerebras_limiter = AsyncRateLimiter(rpm=30)

async def make_groq_request(prompt):
    await groq_limiter.acquire()
    # ... make request

async def make_cerebras_request(prompt):
    await cerebras_limiter.acquire()
    # ... make request
```

---

## Error Handling Patterns

### Exponential Backoff

```python
import time
import random

def exponential_backoff(attempt, base_delay=1, max_delay=60):
    """Calculate delay with jitter."""
    delay = min(base_delay * (2 ** attempt), max_delay)
    jitter = random.uniform(0, delay * 0.1)  # 10% jitter
    return delay + jitter

def call_with_backoff(client, model, messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages
            )
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            
            delay = exponential_backoff(attempt)
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
            time.sleep(delay)
```

---

### Circuit Breaker Pattern

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

# Usage
from openai import OpenAI

groq_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_...")

def make_groq_request(prompt):
    return groq_breaker.call(
        groq_client.chat.completions.create,
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
```

---

## Request Batching

### Simple Batcher

```python
import asyncio
from collections import deque

class RequestBatcher:
    def __init__(self, client, model, max_batch_size=10, max_wait_time=1.0):
        self.client = client
        self.model = model
        self.max_batch_size = max_batch_size
        self.max_wait_time = max_wait_time
        self.queue = deque()
        self.processing = False
    
    async def add_request(self, prompt):
        future = asyncio.Future()
        self.queue.append({"prompt": prompt, "future": future})
        
        if not self.processing:
            asyncio.create_task(self._process_batch())
        
        return await future
    
    async def _process_batch(self):
        self.processing = True
        await asyncio.sleep(self.max_wait_time)
        
        batch = []
        while len(batch) < self.max_batch_size and self.queue:
            batch.append(self.queue.popleft())
        
        if batch:
            await self._execute_batch(batch)
        
        if self.queue:
            asyncio.create_task(self._process_batch())
        else:
            self.processing = False
    
    async def _execute_batch(self, batch):
        # Process batch (provider-specific)
        for item in batch:
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": item["prompt"]}]
                )
                item["future"].set_result(response.choices[0].message.content)
            except Exception as e:
                item["future"].set_exception(e)

# Usage
from openai import AsyncOpenAI

client = AsyncOpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_...")
batcher = RequestBatcher(client, "llama-3.3-70b")

# Add requests
result1 = await batcher.add_request("Prompt 1")
result2 = await batcher.add_request("Prompt 2")
```

---

## Testing Your Implementation

### Load Test Script

```python
import asyncio
import time
from openai import AsyncOpenAI

async def load_test(provider_name, base_url, api_key, model, rpm, duration_seconds=60):
    """Test provider under load."""
    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    
    delay = 60.0 / rpm
    start_time = time.time()
    results = {"success": 0, "failure": 0, "rate_limited": 0}
    
    async def single_request(i):
        try:
            await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": f"Test {i}"}],
                max_tokens=50
            )
            results["success"] += 1
        except Exception as e:
            if "429" in str(e):
                results["rate_limited"] += 1
            else:
                results["failure"] += 1
    
    tasks = []
    i = 0
    while time.time() - start_time < duration_seconds:
        tasks.append(single_request(i))
        i += 1
        await asyncio.sleep(delay)
    
    await asyncio.gather(*tasks, return_exceptions=True)
    
    print(f"\n{provider_name} Results:")
    print(f"  Duration: {duration_seconds}s")
    print(f"  Requests: {i}")
    print(f"  Success: {results['success']}")
    print(f"  Rate Limited: {results['rate_limited']}")
    print(f"  Failed: {results['failure']}")
    print(f"  Success Rate: {results['success']/i*100:.1f}%")

# Run tests
async def main():
    await load_test(
        "Groq",
        "https://api.groq.com/openai/v1",
        "gsk_...",
        "llama-3.1-8b-instant",
        rpm=60
    )

asyncio.run(main())
```

---

## Monitoring & Observability

### Simple Metrics

```python
import time
from collections import defaultdict

class MetricsCollector:
    def __init__(self):
        self.requests = defaultdict(int)
        self.errors = defaultdict(int)
        self.latency = defaultdict(list)
    
    def record_request(self, provider, latency_ms, success=True):
        self.requests[provider] += 1
        self.latency[provider].append(latency_ms)
        if not success:
            self.errors[provider] += 1
    
    def get_report(self):
        report = {}
        for provider in self.requests:
            total = self.requests[provider]
            errors = self.errors[provider]
            latencies = self.latency[provider]
            
            report[provider] = {
                "total_requests": total,
                "error_count": errors,
                "error_rate": errors / total if total > 0 else 0,
                "avg_latency": sum(latencies) / len(latencies) if latencies else 0,
                "max_latency": max(latencies) if latencies else 0
            }
        return report

# Usage
metrics = MetricsCollector()

# Wrap your calls
start = time.time()
try:
    response = client.chat.completions.create(...)
    metrics.record_request("groq", (time.time() - start) * 1000, success=True)
except Exception:
    metrics.record_request("groq", (time.time() - start) * 1000, success=False)

# Print report
print(metrics.get_report())
```

---

## Deployment Checklist

### Before Production

- [ ] Test each provider independently
- [ ] Implement fallback chain (minimum 2 providers)
- [ ] Add rate limiting client-side
- [ ] Implement exponential backoff
- [ ] Add circuit breaker for each provider
- [ ] Set up monitoring/metrics
- [ ] Test failure scenarios
- [ ] Document rate limits for ops team
- [ ] Configure alerts for high error rates
- [ ] Test with realistic load patterns

### Configuration

```yaml
# config.yaml
ai_providers:
  primary:
    name: groq
    base_url: https://api.groq.com/openai/v1
    model: llama-3.1-8b-instant
    rpm: 60
    daily_cap: 14400
  fallback:
    name: cerebras
    base_url: https://api.cerebras.ai/v1
    model: llama-3.3-70b
    rpm: 30
    daily_cap: 1000000  # tokens
  tertiary:
    name: openrouter
    base_url: https://openrouter.ai/api/v1
    model: meta-llama/llama-3.3-70b-instruct:free
    rpm: 20
    daily_cap: 1000

rate_limiting:
  strategy: token_bucket
  safety_margin: 0.9  # Use 90% of limit

retry:
  max_attempts: 3
  backoff_base: 1.0
  backoff_max: 60.0
```

---

## Common Pitfalls

### ❌ Don't
- Rely on single provider for production
- Ignore rate limits until you hit them
- Assume all models behave the same
- Forget to handle 429 errors
- Hard-code provider credentials

### ✅ Do
- Implement provider fallback chains
- Add client-side rate limiting
- Test with burst traffic patterns
- Monitor error rates continuously
- Use environment variables for keys

---

**Last Updated:** April 28, 2026
