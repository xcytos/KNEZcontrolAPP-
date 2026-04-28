# Groq - Unlimited Speed-Focused API

**Status:** ✅ Truly Unlimited (RPM only, no credits)  
**Best For:** Real-time applications, speed-critical workflows  
**Signup:** [console.groq.com](https://console.groq.com)

---

## Overview

Groq offers **unlimited API access** with only RPM limits. No credit system, no daily quotas that run out, just pure speed throttling.

**Key Selling Point:** Custom LPU (Language Processing Unit) hardware delivering **300+ tokens/second** - faster than any GPU-based inference.

---

## Rate Limits

| Model Size | RPM | TPM | Daily Requests |
|------------|-----|-----|----------------|
| **8B models** | 60 | Varies | 14,400 |
| **32B models** | 60 | Varies | 14,400 |
| **70B models** | 30 | 12,000 | 1,000 |
| **Mixtral 8x7B** | 30 | 12,000 | 1,000 |

**Important:** Daily caps reset every 24 hours. No credit system.

---

## Available Models

### Llama Family
- `llama-3.3-70b-versatile` - 30 RPM, 1,000/day
- `llama-3.1-8b-instant` - 60 RPM, 14,400/day ⭐ Best rate
- `llama-4-scout-17b-16e-instruct` - 30 RPM
- `llama-4-maverick-17b-128e-instruct` - 30 RPM

### Qwen Family
- `qwen-3-32b` - 60 RPM, 14,400/day
- `qwen-3-235b-a22b-instruct` - 30 RPM
- `qwen-3-coder-480b-a35b-instruct` - 30 RPM

### Other
- `mixtral-8x7b-32768` - 30 RPM
- `gemma-2-9b-it` - 60 RPM
- `kimi-k2-32b` - 60 RPM

---

## Code Examples

### Basic Chat
```python
from groq import Groq

client = Groq(api_key="gsk_YOUR_API_KEY")

response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[{"role": "user", "content": "Hello, world!"}],
    temperature=0.7,
    max_tokens=512
)

print(response.choices[0].message.content)
```

### Streaming (Recommended for Speed)
```python
from groq import Groq

client = Groq(api_key="gsk_YOUR_API_KEY")

stream = client.chat.completions.create(
    model="llama-3.1-8b-instant",
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
from groq import AsyncGroq

client = AsyncGroq(api_key="gsk_YOUR_API_KEY")

async def chat():
    response = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": "Hello"}]
    )
    return response.choices[0].message.content

result = asyncio.run(chat())
```

---

## Rate Limit Handling

Groq returns standard HTTP 429 when limits exceeded. Headers include:

```python
# Check rate limit status in response headers
response = client.chat.completions.create(...)

# Headers available:
# x-ratelimit-limit-requests: 60
# x-ratelimit-remaining-requests: 45
# x-ratelimit-reset-requests: 2026-04-28T12:34:56Z
```

### Exponential Backoff
```python
import time
from groq import Groq
from groq import RateLimitError

client = Groq(api_key="gsk_YOUR_API_KEY")

def chat_with_retry(message, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": message}]
            )
        except RateLimitError:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1, 2, 4 seconds
                time.sleep(wait)
            else:
                raise
```

---

## Use Cases

### ✅ Best For
- **Voice agents** - Sub-100ms latency
- **Real-time chat** - Instant response feel
- **Interactive demos** - No perceptible delay
- **Streaming UIs** - Tokens flow in real-time
- **High-frequency inference** - 60 RPM sustained

### ❌ Not Ideal For
- **Long document generation** - 12K TPM cap chokes on long outputs
- **Background batch jobs** - Daily caps limit total volume
- **Multi-step agents** - Daily 1,000 limit on 70B models

---

## Limitations

| Constraint | Value | Workaround |
|------------|-------|------------|
| **Max tokens** | 8,192 | Chunk long content |
| **Context window** | 128K | Summarize history |
| **TPM on 70B** | 12,000 | Use 8B models (60 RPM) |
| **Daily 70B cap** | 1,000 | Switch to 8B for volume |

---

## Comparison: Groq vs Others

| Feature | Groq | Cerebras | OpenRouter |
|---------|------|----------|------------|
| **Speed** | 300+ t/s | 100+ t/s | Varies |
| **RPM (8B)** | 60 | 30 | 20 |
| **Daily Cap** | 14,400 | 1M tokens | 1,000 |
| **Free Tier** | Unlimited | Unlimited | Unlimited |
| **Best Model** | Llama 3.1 8B | Llama 3.3 70B | Various |

---

## Multi-Key Strategy

Groq limits are **per organization**, not per key. Multiple keys don't help.

**Better approach:** Combine with other unlimited providers:
```python
providers = {
    "groq": Groq(api_key="gsk_..."),          # 60 RPM
    "cerebras": OpenAI(base_url="..."),     # 30 RPM backup
    "openrouter": OpenAI(base_url="..."),   # 20 RPM tertiary
}
```

---

## Monitoring Usage

```python
# Track daily usage (not enforced by API)
import datetime

class GroqTracker:
    def __init__(self):
        self.requests_today = 0
        self.last_reset = datetime.date.today()
    
    def reset_if_needed(self):
        today = datetime.date.today()
        if today != self.last_reset:
            self.requests_today = 0
            self.last_reset = today
    
    def can_use_70b(self):
        self.reset_if_needed()
        return self.requests_today < 1000  # 70B daily cap
    
    def track_request(self, model):
        self.reset_if_needed()
        self.requests_today += 1
        print(f"Requests today: {self.requests_today}")
```

---

## SDK Installation

```bash
pip install groq
```

---

## API Compatibility

Groq uses **OpenAI-compatible API**:
```python
# Can also use OpenAI SDK with Groq
from openai import OpenAI

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key="gsk_YOUR_KEY"
)
```

---

## Pricing (Paid Tier)

If you need higher limits:

| Tier | RPM | Contact |
|------|-----|---------|
| Free | 30-60 | Automatic |
| Paid | 200+ | sales@groq.com |

---

## Verdict

**Use Groq when:**
- Speed is critical (< 100ms first token)
- You need 60 RPM sustained
- Real-time user experience matters
- 14,400 daily requests (8B) is sufficient

**Skip Groq when:**
- You need > 12K tokens/minute
- You need > 1,000 70B requests/day
- Cost optimization is priority (pay per use elsewhere)

---

**Status:** ✅ Verified Unlimited (RPM only)  
**Last Updated:** April 28, 2026
