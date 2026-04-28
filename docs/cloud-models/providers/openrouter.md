# OpenRouter - Unlimited Variety-Focused API

**Status:** ✅ Truly Unlimited (RPM only, community-funded)  
**Best For:** Testing multiple models, model-agnostic applications, fallback options  
**Signup:** [openrouter.ai](https://openrouter.ai)

---

## Overview

OpenRouter offers **unlimited API access** to 30+ free models with only RPM limits. No credit system for free models - they're community-funded by paid users.

**Key Selling Point:** One API key, access to free variants of Llama, Gemma, Mistral, Qwen, and more.

---

## Rate Limits

| Tier | RPM | Daily Cap | Requirements |
|------|-----|-----------|--------------|
| **Free (no balance)** | 20 | 50 requests | Email only |
| **Free ($10+ balance)** | 20 | 1,000 requests | $10 lifetime |

**Important:** Free models are marked with `:free` suffix. They don't consume credits.

---

## Free Models Available

### Llama Family
- `meta-llama/llama-3.3-70b-instruct:free` ⭐ Popular
- `meta-llama/llama-3.2-3b-instruct:free`
- `meta-llama/llama-3.1-405b-instruct:free` (via Hermes)

### Google Gemma
- `google/gemma-3-12b-it:free`
- `google/gemma-3-27b-it:free`
- `google/gemma-3-4b-it:free`
- `google/gemma-4-26b-a4b-it:free`
- `google/gemma-4-31b-it:free`

### NVIDIA Nemotron
- `nvidia/nemotron-3-super-120b-a12b:free` ⭐ High quality
- `nvidia/nemotron-3-nano-30b-a3b:free`
- `nvidia/nemotron-nano-9b-v2:free`

### OpenAI OSS
- `openai/gpt-oss-120b:free`
- `openai/gpt-oss-20b:free`

### Qwen
- `qwen/qwen3-coder:free`
- `qwen/qwen3-next-80b-a3b-instruct:free`

### Other
- `nousresearch/hermes-3-llama-3.1-405b:free`
- `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`
- `liquid/lfm-2.5-1.2b-instruct:free`
- `minimax/minimax-m2.5:free`
- `z-ai/glm-4.5-air:free`

---

## Code Examples

### Basic Chat
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-YOUR_API_KEY"
)

response = client.chat.completions.create(
    model="meta-llama/llama-3.3-70b-instruct:free",
    messages=[{"role": "user", "content": "Hello, world!"}],
    temperature=0.7,
    max_tokens=1024
)

print(response.choices[0].message.content)
```

### Auto-Select Free Model
```python
# Use openrouter/free to auto-select available free model
response = client.chat.completions.create(
    model="openrouter/free",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Streaming
```python
stream = client.chat.completions.create(
    model="nvidia/nemotron-3-super-120b-a12b:free",
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
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-YOUR_API_KEY"
)

async def chat():
    response = await client.chat.completions.create(
        model="google/gemma-3-27b-it:free",
        messages=[{"role": "user", "content": "Hello"}]
    )
    return response.choices[0].message.content

result = asyncio.run(chat())
```

---

## Model Comparison Testing

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-YOUR_KEY"
)

models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-120b:free"
]

prompt = "Explain quantum computing in simple terms"

for model in models:
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500
        )
        content = response.choices[0].message.content
        print(f"\n{model}:")
        print(content[:200] + "...")
    except Exception as e:
        print(f"\n{model}: Error - {e}")
```

---

## Rate Limit Handling

OpenRouter returns standard HTTP 429. Check limits programmatically:

```python
# Check current rate limit status
import requests

response = requests.get(
    "https://openrouter.ai/api/v1/key",
    headers={"Authorization": "Bearer sk-or-v1-YOUR_KEY"}
)

data = response.json()
print(f"Limit: {data['data']['limit']}")
print(f"Usage: {data['data']['usage']}")
```

### Exponential Backoff
```python
import time
from openai import RateLimitError

def openrouter_call_with_retry(client, model, messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages
            )
        except RateLimitError:
            if attempt < max_retries - 1:
                # 20 RPM = 3 second gap
                time.sleep(3 * (2 ** attempt))
            else:
                raise
```

---

## Use Cases

### ✅ Best For
- **Model comparison** - Test 30+ models easily
- **A/B testing** - Find best model for your task
- **Fallback chains** - Primary → Backup → Tertiary
- **Model-agnostic apps** - Switch models without code changes
- **Accessing rare models** - Nemotron, Gemma variants

### ❌ Not Ideal For
- **High-frequency** - 20 RPM max
- **Production loads** - Community-funded, availability varies
- **Consistent latency** - Routes to various providers
- **Guaranteed uptime** - Free models may be unavailable

---

## Limitations

| Constraint | Value | Workaround |
|------------|-------|------------|
| **RPM** | 20 | Lower than Groq (60) |
| **Daily cap** | 50-1,000 | Add $10 for 1,000/day |
| **Model availability** | Rotates | Check status page |
| **Latency variance** | High | Use dedicated providers for consistency |
| **No vision** (most) | Text only | Use Google AI Studio |

---

## Comparison: OpenRouter vs Others

| Feature | OpenRouter | Groq | Cerebras |
|---------|------------|------|----------|
| **Model variety** | 30+ | 10+ | 5+ |
| **RPM** | 20 | 60 | 30 |
| **Daily cap** | 1,000* | 14,400 | 1M tokens |
| **Speed** | Varies | 300+ t/s | Moderate |
| **Reliability** | Variable | High | High |
| **Best for** | Variety | Speed | Volume |

*With $10 balance

---

## Fallback Chain Pattern

```python
from openai import OpenAI

class OpenRouterFallback:
    def __init__(self, api_key):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        self.models = [
            "meta-llama/llama-3.3-70b-instruct:free",
            "nvidia/nemotron-3-super-120b-a12b:free",
            "google/gemma-3-27b-it:free",
            "openrouter/free"  # Auto-select
        ]
    
    def generate(self, prompt, max_attempts=3):
        for i, model in enumerate(self.models[:max_attempts]):
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1024
                )
                return {
                    "content": response.choices[0].message.content,
                    "model": model,
                    "success": True
                }
            except Exception as e:
                if i == max_attempts - 1:
                    return {"error": str(e), "success": False}
                continue

# Usage
router = OpenRouterFallback("sk-or-v1-YOUR_KEY")
result = router.generate("Write a haiku")
```

---

## Multi-Provider Redundancy

Combine OpenRouter with dedicated providers:

```python
class MultiProviderAI:
    def __init__(self):
        # Primary: Groq (60 RPM, fast)
        self.groq = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key="gsk_..."
        )
        
        # Backup: OpenRouter (variety)
        self.openrouter = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key="sk-or-v1-..."
        )
        
        # Tertiary: Cerebras (volume)
        self.cerebras = OpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key="csk_..."
        )
    
    def generate(self, prompt):
        providers = [
            (self.groq, "llama-3.1-8b-instant"),
            (self.openrouter, "meta-llama/llama-3.3-70b-instruct:free"),
            (self.cerebras, "llama-3.3-70b")
        ]
        
        for client, model in providers:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.choices[0].message.content
            except Exception:
                continue
        
        raise Exception("All providers failed")
```

---

## Checking Free Model Status

```python
# List available free models
import requests

response = requests.get(
    "https://openrouter.ai/api/v1/models",
    headers={"Authorization": "Bearer sk-or-v1-YOUR_KEY"}
)

models = response.json()["data"]
free_models = [m for m in models if ":free" in m["id"]]

for model in free_models:
    print(f"{model['id']}: {model.get('description', 'No description')[:50]}")
```

---

## Verdict

**Use OpenRouter when:**
- You need to test many models
- Building model-agnostic applications
- Need fallback options
- Want access to rare models (Nemotron, Gemma variants)
- 20 RPM and 1,000/day is sufficient

**Skip OpenRouter when:**
- You need guaranteed availability
- Consistent latency is critical
- High RPM required (> 20)
- Production reliability is priority

---

**Status:** ✅ Verified Unlimited (RPM only, community-funded)  
**Last Updated:** April 28, 2026
