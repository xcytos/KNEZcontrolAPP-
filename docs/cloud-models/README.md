# Free Cloud AI Model APIs - Complete Guide

**Last Updated:** April 28, 2026  
**Purpose:** Identify AI APIs with rate limits (RPM) but no credit/quota limits for unlimited usage patterns

---

## Executive Summary

Most "free" AI APIs have **dual limit systems**:
1. **Rate Limit (RPM)** - Speed throttle
2. **Credit/Quota Limit** - Lifetime/monthly cap

**This guide focuses on providers with ONLY RPM limits (no credit caps)** - truly unlimited usage within rate constraints.

---

## Tier 1: Truly Unlimited (RPM Only, No Credit Cap)

### 1. **OpenRouter** (Free Models)
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 20 RPM |
| **Daily Cap** | 50 requests/day (without balance) |
| **With $10 Balance** | 1,000 requests/day |
| **Credit System** | No credit system for free models |
| **Models** | 30+ free models (Llama, Gemma, Mistral, Qwen, etc.) |
| **Credit Card** | Optional for free tier |
| **Best For** | Testing multiple models, model-agnostic apps |

**Key Point:** Free models are community-funded. No credits consumed.

```python
# OpenRouter Free Model Example
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-..."
)

# Use :free suffix models
completion = client.chat.completions.create(
    model="meta-llama/llama-3.3-70b-instruct:free",
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

### 2. **Google AI Studio** (Gemini API)
| Attribute | Gemini 2.5 Pro | Gemini 2.5 Flash | Gemini 2.5 Flash-Lite |
|-----------|----------------|------------------|----------------------|
| **Rate Limit** | 5 RPM | 10 RPM | 15 RPM |
| **Daily Cap** | 100 req/day | 250 req/day | 1,000 req/day |
| **Token Cap** | 250K TPM (all models share) |
| **Credit System** | None - request-based only |
| **Context** | 1M tokens |
| **Credit Card** | No |
| **Best For** | Prototyping, multimodal, long context |

**Key Point:** Request-based limits only. No credits to run out.

---

### 3. **Groq**
| Attribute | Llama 3.3 70B | Llama 3.1 8B |
|-----------|---------------|--------------|
| **Rate Limit** | 30 RPM | 60 RPM |
| **Daily Cap** | 1,000 req/day | 14,400 req/day |
| **Token Cap** | 12K TPM | Varies |
| **Credit System** | None |
| **Speed** | 300+ tokens/sec |
| **Credit Card** | No |
| **Best For** | Real-time apps, voice agents, speed-critical |

**Key Point:** Speed-focused. Request limits reset daily. No credits.

---

### 4. **Cerebras**
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 30 RPM |
| **Token Cap** | 1M tokens/day |
| **Concurrent** | 200 concurrent requests |
| **Credit System** | None - pure rate limiting |
| **Models** | Llama 3.3 70B, Qwen3, GPT-OSS 120B |
| **Credit Card** | No |
| **Best For** | High daily volume, batch processing |

**Key Point:** Most generous daily token volume (1M/day). No credits to track.

---

### 5. **Mistral AI (Experiment Tier)**
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 2 RPM |
| **Token Cap** | 500K TPM |
| **Monthly Cap** | 1B tokens/month |
| **Credit System** | Token-based, not credit-based |
| **Models** | All Mistral models + Codestral + Embed |
| **Credit Card** | No |
| **Best For** | Code generation, European data residency |

**Key Point:** High monthly token allowance (1B). No "credits" - just tokens.

---

### 6. **Cloudflare Workers AI**
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 50 req/min (soft) |
| **Daily Cap** | 10,000 neurons/day |
| **Credit System** | Neuron-based, not dollar credits |
| **Models** | Llama 3.2, Mistral 7B, FLUX.2, Whisper |
| **Credit Card** | No |
| **Best For** | Edge deployment, serverless, global latency |

**Key Point:** Neurons are compute units, not dollar credits. Resets daily.

---

### 7. **GitHub Models**
| Attribute | High Tier | Low Tier |
|-----------|-----------|----------|
| **Rate Limit** | 10 RPM | 15 RPM |
| **Daily Cap** | 50 req/day | 150 req/day |
| **Token Cap** | 8K input / 4K output per request |
| **Credit System** | None |
| **Models** | GPT-4o, o3, Grok-3, DeepSeek-R1 |
| **Credit Card** | No |
| **Best For** | Quick testing, GitHub ecosystem |

**Key Point:** Playground-focused. Hard daily caps, no credits.

---

### 8. **SambaNova Cloud**
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 10-30 RPM (model dependent) |
| **Free Credits** | $5 (exp 30 days) |
| **Persistent Free Tier** | Yes, beyond credits |
| **Credit System** | Pay-as-you-go after credits |
| **Models** | Llama 3.1 405B, Llama 3.3 70B, Qwen 2.5 |
| **Credit Card** | No (for free tier) |
| **Best For** | Speed, RDU hardware advantage |

**Key Point:** Has $5 initial credit BUT free tier persists indefinitely after.

---

### 9. **Hyperbolic (Basic Tier)**
| Attribute | Details |
|-----------|---------|
| **Rate Limit** | 60 RPM (Basic), 600 RPM (Pro) |
| **Free Credits** | $1 (phone verification) |
| **Credit System** | Pay-as-you-go, but generous free tier |
| **Models** | Llama, Qwen, DeepSeek, GPT-OSS |
| **Special Limits** | Llama 405B: 5 RPM (Basic), 120 RPM (Pro) |
| **Credit Card** | No (for Basic) |
| **Best For** | High RPM needs, various model sizes |

**Key Point:** $1 credit is minimal; essentially RPM-limited free tier.

---

## Tier 2: Credit-Based (With Generous/Refreshable Credits)

### 10. **DeepInfra**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | $5 on signup (no credit card) |
| **Rate Limit** | 200 concurrent requests |
| **Pricing** | Pay-per-use after credits |
| **Models** | Extensive (Llama 4, Qwen 3, etc.) |
| **Best For** | Long-term testing, production prep |

**Key Point:** $5 is real credit (not unlimited), but no credit card required.

---

### 11. **NVIDIA NIM**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | 1,000 (up to 5,000 requestable) |
| **Rate Limit** | 40 RPM |
| **Credit System** | Credit-based |
| **Models** | Nemotron, Llama, DeepSeek, Kimi |
| **Best For** | Testing frontier models, self-host planning |

**Key Point:** Credits eventually run out (unlike Tier 1).

---

### 12. **DeepSeek**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | 5M tokens (30 days) |
| **Rate Limit** | No hard limit (best effort) |
| **Pricing** | Extremely cheap after free ($0.14/M tokens) |
| **Models** | DeepSeek V3, R1 |
| **Best For** | Cost-effective reasoning, coding |

**Key Point:** 5M tokens expires in 30 days. Not truly unlimited.

---

### 13. **xAI**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | $25 on signup |
| **Rate Limit** | Varies |
| **Models** | Grok 4, Grok 4.1 Fast (2M context) |
| **Best For** | Long context, reasoning |

**Key Point:** $25 one-time credit.

---

### 14. **AI21 Labs**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | $10 (3 months) |
| **Rate Limit** | 200 RPM |
| **Models** | Jamba Large, Jamba Mini |
| **Best For** | Mamba-Transformer hybrid, long context |

**Key Point:** Trial credits expire.

---

### 15. **Anthropic**
| Attribute | Details |
|-----------|---------|
| **Free Credits** | $5 on signup |
| **Rate Limit** | Low (unspecified) |
| **Models** | Claude Sonnet, Opus |
| **Best For** | High-quality reasoning |
| **Credit Card** | Required for continued use |

**Key Point:** $5 runs out quickly. Not a sustainable free tier.

---

## Comparison Matrix

| Provider | RPM | Daily Cap | Credit System | Unlimited? | Credit Card |
|----------|-----|-----------|---------------|------------|-------------|
| **OpenRouter** | 20 | 50-1,000 | None | ✅ Yes | Optional |
| **Google AI Studio** | 5-15 | 100-1,000 | None | ✅ Yes | No |
| **Groq** | 30-60 | 1,000-14,400 | None | ✅ Yes | No |
| **Cerebras** | 30 | 1M tokens | None | ✅ Yes | No |
| **Mistral** | 2 | 1B tokens/mo | Token-based | ✅ Yes | No |
| **Cloudflare** | 50 | 10K neurons | Neuron-based | ✅ Yes | No |
| **GitHub Models** | 10-15 | 50-150 | None | ✅ Yes | No |
| **SambaNova** | 10-30 | N/A | $5 then free tier | ✅ Yes | No |
| **Hyperbolic** | 60 | N/A | $1 minimal | ✅ Yes | No |
| **DeepInfra** | 200 concurrent | N/A | $5 credit | ❌ No | No |
| **NVIDIA NIM** | 40 | N/A | 1,000-5,000 | ❌ No | No |
| **DeepSeek** | No limit | N/A | 5M tokens (30d) | ❌ No | No |
| **xAI** | Varies | N/A | $25 | ❌ No | No |
| **AI21** | 200 | N/A | $10 (3mo) | ❌ No | No |
| **Anthropic** | Low | N/A | $5 | ❌ No | Yes |

---

## Strategy: Maximizing Unlimited Usage

### For High-Frequency, Low-Volume
**Best:** Groq (60 RPM on 8B models), Hyperbolic (60 RPM)

### For High Daily Volume
**Best:** Cerebras (1M tokens/day), Mistral (1B tokens/month)

### For Model Variety
**Best:** OpenRouter (30+ models)

### For Multimodal + Long Context
**Best:** Google AI Studio (1M context, vision support)

### For Production Edge Deployment
**Best:** Cloudflare Workers AI

---

## Tiered Usage Pattern

```
Tier 1 (Truly Unlimited):
├── OpenRouter (20 RPM, 50-1,000/day)
├── Google AI Studio (15 RPM, 1,000/day)
├── Groq (60 RPM, 14,400/day on 8B)
├── Cerebras (30 RPM, 1M tokens/day)
└── Mistral (2 RPM, 1B tokens/month)

Tier 2 (Generous Credits):
├── DeepInfra ($5, no CC required)
├── SambaNova ($5, then persistent free)
└── Hyperbolic ($1, essentially free)

Tier 3 (Trial Only):
├── NVIDIA NIM (1,000-5,000 credits)
├── DeepSeek (5M tokens, 30 days)
└── xAI ($25 one-time)
```

---

## Code Examples

### OpenRouter - Free Models
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-YOUR-KEY"
)

response = client.chat.completions.create(
    model="meta-llama/llama-3.3-70b-instruct:free",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Google AI Studio
```python
from google import genai

client = genai.Client(api_key="YOUR_API_KEY")

response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="Hello"
)
```

### Groq
```python
from groq import Groq

client = Groq(api_key="gsk_YOUR_KEY")

response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Cerebras
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk-YOUR_KEY"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

## Warnings & Caveats

### OpenRouter
- Free models marked with `:free` suffix
- Free tier subsidized by paid users
- Models may rotate/disappear

### Google AI Studio
- Terms prohibit high-volume production use
- Data may be used for training (opt-out available)
- Limits reduced Dec 2025

### Groq
- 6K TPM cap can choke long content generation
- Best for short interactive responses

### Cerebras
- Model selection limited (Llama family only)
- 1M tokens/day is total (not per model)

### Mistral
- 2 RPM is extremely slow
- Best for background batch jobs

### Cloudflare
- Models are quantized for edge
- Quality may differ from full-precision

---

## Conclusion

**For truly unlimited usage (RPM only, no credits):**

1. **OpenRouter** - Best model variety
2. **Google AI Studio** - Best multimodal + long context
3. **Groq** - Best speed
4. **Cerebras** - Best daily volume
5. **Mistral** - Best monthly token allowance

**Combine multiple for redundancy:**
```
Primary: Groq (60 RPM)  
Backup: OpenRouter (20 RPM)  
Tertiary: Cerebras (30 RPM)
```

---

## References

- [TokenMix Free LLM APIs 2026](https://tokenmix.ai/blog/free-llm-apis-2026-every-provider-free-tier-tested)
- [Awesome Agents Free AI APIs](https://awesomeagents.ai/tools/free-ai-inference-providers-2026/)
- [GitHub Free LLM API Resources](https://github.com/cheahjs/free-llm-api-resources)
- [OpenRouter Limits](https://openrouter.ai/docs/api/reference/limits)
- [Hyperbolic Pricing](https://docs.hyperbolic.xyz/docs/hyperbolic-pricing)
- [SambaNova Plans](https://cloud.sambanova.ai/plans)

---

*Document created: April 28, 2026*  
*Verified limits are current as of research date*
