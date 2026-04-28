# Cerebras - Unlimited Volume-Focused API

**Status:** ✅ Truly Unlimited (RPM + daily tokens, no credits)  
**Best For:** High daily volume, batch processing, agentic workflows  
**Signup:** [cloud.cerebras.ai](https://cloud.cerebras.ai)

---

## Overview

Cerebras offers **unlimited API access** with only RPM and daily token limits. No credit system, no monthly quotas that run out.

**Key Selling Point:** Wafer-scale engine delivering **1 million tokens per day** - the highest daily volume of any free tier.

---

## Rate Limits

| Metric | Limit |
|--------|-------|
| **Requests Per Minute (RPM)** | 30 |
| **Tokens Per Minute (TPM)** | 60,000 |
| **Daily Token Cap** | 1,000,000 tokens |
| **Concurrent Requests** | 200 |

**Important:** Daily token cap resets every 24 hours. No credit system.

---

## Available Models

### Llama Family
- `llama-3.3-70b` - Primary recommendation
- `llama-3.1-70b`
- `llama-3.1-8b`

### Qwen Family
- `qwen-3-32b`
- `qwen-3-235b-a22b`

### Other
- `gpt-oss-120b` - OpenAI's open model
- `gpt-oss-20b`

---

## Code Examples

### Basic Chat
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk_YOUR_API_KEY"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello, world!"}],
    temperature=0.7,
    max_tokens=1024
)

print(response.choices[0].message.content)
```

### Streaming
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk_YOUR_API_KEY"
)

stream = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Async Usage
```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk_YOUR_API_KEY"
)

async def chat():
    response = await client.chat.completions.create(
        model="llama-3.3-70b",
        messages=[{"role": "user", "content": "Hello"}]
    )
    return response.choices[0].message.content

result = asyncio.run(chat())
```

---

## Token Budgeting

With 1M tokens/day, plan your usage:

| Use Case | Avg Tokens/Request | Daily Capacity |
|----------|-------------------|----------------|
| **Short Q&A** | 500 | ~2,000 requests |
| **Medium chats** | 2,000 | ~500 requests |
| **Long documents** | 10,000 | ~100 requests |
| **Code generation** | 5,000 | ~200 requests |

### Token Tracking
```python
class CerebrasTracker:
    def __init__(self, daily_limit=1_000_000):
        self.daily_limit = daily_limit
        self.tokens_today = 0
        self.last_reset = datetime.date.today()
    
    def can_make_request(self, estimated_tokens=2000):
        self.reset_if_needed()
        return (self.tokens_today + estimated_tokens) <= self.daily_limit
    
    def track_usage(self, response):
        if response.usage:
            self.tokens_today += response.usage.total_tokens
```

---

## Rate Limit Handling

Cerebras uses token bucket algorithm. Response headers:

```python
response = client.chat.completions.create(...)

# Headers include:
# x-ratelimit-limit-requests: 30
# x-ratelimit-remaining-requests: 28
# x-ratelimit-limit-tokens: 1000000
# x-ratelimit-remaining-tokens: 985000
```

### Backoff Strategy
```python
import time
from openai import RateLimitError

def cerebras_call_with_retry(client, messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model="llama-3.3-70b",
                messages=messages
            )
        except RateLimitError as e:
            if attempt < max_retries - 1:
                # Cerebras recommends short delay
                time.sleep(2 ** attempt)
            else:
                raise
```

---

## Use Cases

### ✅ Best For
- **Batch processing** - High daily token volume
- **Agentic workflows** - Many sequential calls
- **Content pipelines** - Document generation at scale
- **Background jobs** - 1M tokens/day sustained
- **Multi-step reasoning** - Chain-of-thought workflows

### ❌ Not Ideal For
- **Burst traffic** - 30 RPM max
- **Real-time streaming** - Slower than Groq
- **Latency-critical apps** - Not optimized for speed

---

## Limitations

| Constraint | Value | Workaround |
|------------|-------|------------|
| **RPM** | 30 | Queue requests, use async |
| **Model selection** | Llama family only | Use OpenRouter for variety |
| **No vision** | Text only | Use Google AI Studio |
| **Context** | 128K standard | Sufficient for most use cases |

---

## Comparison: Cerebras vs Others

| Feature | Cerebras | Groq | OpenRouter |
|---------|----------|------|------------|
| **Daily Volume** | 1M tokens | 14,400 req (8B) | 1,000 req |
| **RPM** | 30 | 60 | 20 |
| **Speed** | Moderate | 300+ t/s | Varies |
| **Models** | Llama only | Various | 30+ |
| **Concurrent** | 200 | Lower | Unknown |
| **Best For** | Batch | Real-time | Variety |

---

## Agentic Workflow Example

```python
from openai import OpenAI
import asyncio

client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk_..."
)

async def agent_step(step_name, prompt):
    """One step in agent workflow."""
    response = await client.chat.completions.create(
        model="llama-3.3-70b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000
    )
    return response.choices[0].message.content

async def multi_step_agent(task):
    """Run 10-step agent workflow."""
    steps = [
        f"Step {i}: Analyze this task - {task}"
        for i in range(10)
    ]
    
    # Run sequentially (Cerebras is good at this)
    results = []
    for step in steps:
        result = await agent_step("analysis", step)
        results.append(result)
        await asyncio.sleep(2)  # Respect 30 RPM
    
    return results

# Execute
results = asyncio.run(multi_step_agent("Write a blog post"))
```

---

## Batch Processing Pattern

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk_..."
)

async def process_batch(items):
    """Process items respecting 30 RPM."""
    results = []
    
    for i, item in enumerate(items):
        response = await client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": f"Process: {item}"}],
            max_tokens=500
        )
        results.append(response.choices[0].message.content)
        
        # Rate limiting: 30 RPM = 2 second gap
        if i < len(items) - 1:
            await asyncio.sleep(2)
    
    return results

# Process 500 items over ~17 minutes
items = [f"Item {i}" for i in range(500)]
results = asyncio.run(process_batch(items))
```

---

## Multi-Provider Strategy

Cerebras is ideal as **primary volume handler** with Groq for speed:

```python
class AIProvider:
    def __init__(self):
        self.cerebras = OpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_...")
        self.groq = OpenAI(base_url="https://api.groq.com/openai/v1", api_key="gsk_...")
    
    async def generate(self, prompt, priority="speed"):
        if priority == "speed":
            # Groq: 60 RPM, 300+ t/s
            return await self.groq.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}]
            )
        else:
            # Cerebras: 30 RPM, 1M tokens/day
            return await self.cerebras.chat.completions.create(
                model="llama-3.3-70b",
                messages=[{"role": "user", "content": prompt}]
            )
```

---

## Verdict

**Use Cerebras when:**
- You need high daily token volume (1M/day)
- Running batch jobs or agentic workflows
- 30 RPM is acceptable for your use case
- Llama models are sufficient
- Cost-effective volume is priority

**Skip Cerebras when:**
- You need > 30 RPM burst
- Latency is critical (< 100ms)
- You need model variety beyond Llama
- Real-time streaming UX is required

---

**Status:** ✅ Verified Unlimited (RPM + daily tokens)  
**Last Updated:** April 28, 2026
