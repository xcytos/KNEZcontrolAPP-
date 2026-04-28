# Quick Reference: Unlimited AI APIs (RPM Only)

**One-page cheat sheet for APIs with no credit limits**

---

## Top 5 Unlimited APIs (RPM Only)

| Provider | RPM | Daily Cap | Best For | Signup |
|----------|-----|-----------|----------|--------|
| **Groq** | 30-60 | 1,000-14,400 | Speed | [console.groq.com](https://console.groq.com) |
| **Cerebras** | 30 | 1M tokens | Volume | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Google AI Studio** | 5-15 | 100-1,000 | Multimodal | [ai.google.dev](https://ai.google.dev) |
| **OpenRouter** | 20 | 50-1,000 | Variety | [openrouter.ai](https://openrouter.ai) |
| **Mistral** | 2 | 1B/mo tokens | Code | [console.mistral.ai](https://console.mistral.ai) |

---

## Quick Code Snippets

### Groq (Fastest)
```python
from groq import Groq
client = Groq(api_key="gsk_...")
response = client.chat.completions.create(
    model="llama-3.1-8b-instant",  # 60 RPM
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Cerebras (Highest Daily Volume)
```python
from openai import OpenAI
client = OpenAI(base_url="https://api.cerebras.ai/v1", api_key="csk_...")
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Google AI Studio (Multimodal)
```python
from google import genai
client = genai.Client(api_key="...")
response = client.models.generate_content(
    model="gemini-2.5-flash-lite",  # 15 RPM, 1,000/day
    contents="Hello"
)
```

### OpenRouter (30+ Models)
```python
from openai import OpenAI
client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key="sk-or-v1-...")
response = client.chat.completions.create(
    model="meta-llama/llama-3.3-70b-instruct:free",
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

## When to Use What

| Use Case | Best Provider | Why |
|----------|---------------|-----|
| **Real-time chat** | Groq | 300+ tokens/sec |
| **Batch processing** | Cerebras | 1M tokens/day |
| **Image + text** | Google AI Studio | Native multimodal |
| **Testing models** | OpenRouter | 30+ free models |
| **Code generation** | Mistral | Codestral |
| **Edge deployment** | Cloudflare | Global CDN |

---

## Rate Limit Math

| Provider | RPM | Per Hour | Per Day | Per Month |
|----------|-----|----------|---------|-----------|
| Groq (8B) | 60 | 3,600 | 14,400 | ~432,000 |
| Groq (70B) | 30 | 1,800 | 1,000 | ~30,000 |
| Cerebras | 30 | 1,800 | 1M tokens | ~30M tokens |
| Google Flash-Lite | 15 | 900 | 1,000 | ~30,000 |
| OpenRouter | 20 | 1,200 | 1,000* | ~30,000 |
| Mistral | 2 | 120 | 1B tokens | 1B tokens |

*With $10 balance: 1,000/day

---

## Tier System Summary

### Tier 1: Truly Unlimited ✅
- No credit system
- Only RPM/daily caps
- Resets automatically

**Providers:** OpenRouter, Google AI Studio, Groq, Cerebras, Mistral, Cloudflare, GitHub Models, SambaNova (after $5), Hyperbolic (after $1)

### Tier 2: Generous Credits ⚠️
- Has credits but no CC required
- Credits refresh or persist

**Providers:** DeepInfra ($5), Fireworks (10 RPM no CC)

### Tier 3: Trial Only ❌
- Credits run out
- Not sustainable

**Providers:** NVIDIA NIM, DeepSeek, xAI, AI21, Anthropic

---

## Red Flags (Not Truly Unlimited)

❌ **Credit-based:** "$5 free credit" → Will run out  
❌ **Trial:** "30-day trial" → Expires  
❌ **Requires CC:** Usually auto-charges  
❌ **"Free tier" with conditions:** Read fine print  

✅ **True Unlimited Indicators:**
- "X RPM limit" without mentioning credits
- "X requests per day" hard cap
- "Neurons/tokens per day" not dollars
- "No credit card required"

---

## Multi-Provider Setup (For Redundancy)

```python
from openai import OpenAI
import random

# Multiple unlimited providers
clients = {
    "groq": Client(base_url="https://api.groq.com/openai/v1", api_key="gsk_..."),
    "cerebras": Client(base_url="https://api.cerebras.ai/v1", api_key="csk_..."),
    "openrouter": Client(base_url="https://openrouter.ai/api/v1", api_key="sk-or-v1-..."),
}

# Round-robin or fallback
provider = random.choice(["groq", "cerebras", "openrouter"])
```

---

## Need More RPM?

| Provider | Paid RPM | Min Deposit |
|----------|----------|-------------|
| Groq | Higher limits | Contact sales |
| Cerebras | Custom | Enterprise |
| Hyperbolic | 600 RPM | $5 |
| OpenRouter | Unlimited | Any amount |
| DeepInfra | 200+ concurrent | Pay per use |

---

**Last Updated:** April 28, 2026
