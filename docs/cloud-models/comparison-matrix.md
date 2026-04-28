# Cloud AI Model API Comparison Matrix

**Complete side-by-side comparison of unlimited free AI APIs**

---

## At-a-Glance Matrix

| Provider | RPM | Daily Cap | Unlimited? | Speed | Models | Best Use |
|----------|-----|-----------|------------|-------|--------|----------|
| **Groq** | 30-60 | 1,000-14,400 | ✅ Yes | 300+ t/s | 10+ | Real-time |
| **Cerebras** | 30 | 1M tokens | ✅ Yes | Moderate | 5+ | Batch |
| **Google AI Studio** | 5-15 | 100-1,000 | ✅ Yes | Moderate | 3 | Multimodal |
| **OpenRouter** | 20 | 50-1,000 | ✅ Yes | Varies | 30+ | Variety |
| **Mistral** | 2 | 1B/mo | ✅ Yes | Slow | 5+ | Code |
| **Cloudflare** | 50 | 10K neurons | ✅ Yes | Edge | 10+ | Edge deploy |
| **GitHub Models** | 10-15 | 50-150 | ✅ Yes | Moderate | 15+ | Testing |
| **SambaNova** | 10-30 | N/A | ✅ Yes* | Fast | 10+ | Speed |
| **Hyperbolic** | 60 | N/A | ✅ Yes* | Moderate | 15+ | High RPM |

*After initial minimal credits ($5/$1)

---

## Detailed Comparison

### 1. Rate Limits (RPM)

| Provider | Low RPM | Med RPM | High RPM | Concurrent |
|----------|---------|---------|----------|------------|
| Groq (8B) | - | - | 60 | Low |
| Groq (70B) | 30 | - | - | Low |
| Cerebras | - | 30 | - | 200 |
| Google (Pro) | 5 | - | - | Low |
| Google (Flash) | - | 10 | - | Low |
| Google (Lite) | - | - | 15 | Low |
| OpenRouter | - | 20 | - | Medium |
| Mistral | 2 | - | - | Low |
| Cloudflare | - | - | 50 | High |
| GitHub (High) | 10 | - | - | Low |
| GitHub (Low) | - | 15 | - | Low |
| SambaNova | 10 | 30 | - | Medium |
| Hyperbolic | - | 60 | - | Medium |

**Winner:** Groq (60 RPM on 8B models)

---

### 2. Daily Capacity

| Provider | Measure | Daily Cap | Monthly Estimate |
|----------|---------|-----------|------------------|
| Groq (8B) | Requests | 14,400 | ~432,000 |
| Groq (70B) | Requests | 1,000 | ~30,000 |
| Cerebras | Tokens | 1,000,000 | ~30M |
| Google (Pro) | Requests | 100 | ~3,000 |
| Google (Flash) | Requests | 250 | ~7,500 |
| Google (Lite) | Requests | 1,000 | ~30,000 |
| OpenRouter | Requests | 1,000* | ~30,000 |
| Mistral | Tokens | 1B/mo | 1B |
| Cloudflare | Neurons | 10,000 | ~300K |
| GitHub (High) | Requests | 50 | ~1,500 |
| GitHub (Low) | Requests | 150 | ~4,500 |

*With $10 balance, otherwise 50

**Winner:** Mistral (1B tokens/month) or Cerebras (1M tokens/day)

---

### 3. Speed (Tokens/Second)

| Provider | Speed | Hardware |
|----------|-------|----------|
| Groq | 300+ t/s | LPU (custom) |
| Cerebras | 100+ t/s | Wafer-scale |
| SambaNova | 100+ t/s | RDU (custom) |
| Google | 50-100 t/s | TPU |
| OpenRouter | 20-100 t/s | Varies |
| Mistral | 20-50 t/s | GPU |
| Cloudflare | 50+ t/s | Edge GPU |
| GitHub | 20-50 t/s | Azure |

**Winner:** Groq (300+ tokens/second)

---

### 4. Model Variety

| Provider | Model Count | Notable Models |
|----------|-------------|----------------|
| OpenRouter | 30+ | Llama, Gemma, Qwen, Nemotron, GPT-OSS |
| GitHub | 15+ | GPT-4o, o3, Grok-3, DeepSeek-R1 |
| Cloudflare | 10+ | Llama 3.2, Mistral 7B, FLUX.2 |
| Hyperbolic | 15+ | Llama, Qwen, DeepSeek |
| Groq | 10+ | Llama 3.3/4, Qwen 3, Kimi K2 |
| SambaNova | 10+ | Llama 3.1 405B, Qwen 2.5 |
| Cerebras | 5+ | Llama 3.3 70B, Qwen 3, GPT-OSS |
| Google | 3 | Gemini 2.5 Pro/Flash/Lite |
| Mistral | 5+ | Mistral Large, Small, Codestral |

**Winner:** OpenRouter (30+ free models)

---

### 5. Context Window

| Provider | Max Context | Notes |
|----------|-------------|-------|
| Google (Pro) | 1M tokens | Industry leading |
| Groq | 128K | Standard |
| Cerebras | 128K | Standard |
| Mistral | 128K | Standard |
| OpenRouter | Varies | Depends on model |
| Cloudflare | 32K-128K | Model dependent |
| GitHub | 8K input / 4K output | Restrictive |
| SambaNova | 128K | Standard |
| Hyperbolic | 128K-256K | Model dependent |

**Winner:** Google AI Studio (1M tokens)

---

### 6. Special Features

| Provider | Multimodal | Vision | Code | Embeddings | Long Context |
|----------|------------|--------|------|------------|--------------|
| Groq | ❌ | ❌ | ✅ | ❌ | ❌ |
| Cerebras | ❌ | ❌ | ✅ | ❌ | ❌ |
| Google | ✅ | ✅ | ✅ | ❌ | ✅ (1M) |
| OpenRouter | ❌ | ❌ | ✅ | ❌ | Varies |
| Mistral | ❌ | ❌ | ✅ (Codestral) | ✅ | ❌ |
| Cloudflare | ✅ | ✅ | ✅ | ❌ | ❌ |
| GitHub | ❌ | ❌ | ✅ | ❌ | ❌ |
| SambaNova | ❌ | ❌ | ✅ | ❌ | ❌ |
| Hyperbolic | ✅ | ✅ | ✅ | ❌ | ❌ |

**Winner:** Google AI Studio (multimodal + vision + 1M context)

---

## Use Case Matrix

### By Application Type

| Application | Primary | Backup | Tertiary |
|-------------|---------|--------|----------|
| **Real-time chat** | Groq | Cerebras | OpenRouter |
| **Voice agents** | Groq | SambaNova | Hyperbolic |
| **Batch processing** | Cerebras | Mistral | OpenRouter |
| **Content generation** | Cerebras | Google | Groq |
| **Code generation** | Mistral | Groq | GitHub |
| **Image + text** | Google | Cloudflare | OpenRouter |
| **Model testing** | OpenRouter | GitHub | Google |
| **Edge deployment** | Cloudflare | Groq | OpenRouter |
| **Agentic workflows** | Cerebras | Groq | SambaNova |
| **Document Q&A** | Google | Cerebras | Mistral |

---

## Limitations Matrix

| Provider | Main Limit | Secondary Limit | Workaround |
|----------|------------|-----------------|------------|
| Groq | 12K TPM cap | 1,000/day 70B | Use 8B models |
| Cerebras | 30 RPM | Llama only | Queue requests |
| Google | 5-15 RPM | Terms restrict prod | Use for prototyping |
| OpenRouter | 20 RPM | Variable availability | Fallback chain |
| Mistral | 2 RPM | Very slow | Background jobs |
| Cloudflare | 10K neurons | Quantized models | Accept quality tradeoff |
| GitHub | 150/day max | 8K/4K tokens | Use for testing only |
| SambaNova | $5 initial | Then free tier | One-time signup |
| Hyperbolic | $1 initial | Limited features | Verify phone |

---

## Cost Efficiency (If You Upgrade)

| Provider | Paid RPM | Min Cost | Best For |
|----------|----------|----------|----------|
| Groq | 200+ | Contact sales | Speed at scale |
| Cerebras | Custom | Enterprise | Volume at scale |
| Google | 150-300 | $1 GCP spend | Production |
| OpenRouter | Unlimited | Any amount | Variety at scale |
| Mistral | Higher | Paid tier | Code + embed |
| Cloudflare | Higher | Workers paid | Edge at scale |
| DeepInfra | 200+ concurrent | Pay per use | Flexible scaling |
| Hyperbolic | 600 | $5 | High RPM needs |

---

## Reliability Matrix

| Provider | Uptime | Latency Consistency | Model Availability |
|----------|--------|---------------------|-------------------|
| Groq | High | High | High |
| Cerebras | High | High | High |
| Google | High | Medium | High |
| OpenRouter | Medium | Low | Variable |
| Mistral | High | High | High |
| Cloudflare | Very High | Very High | High |
| GitHub | High | Medium | High |
| SambaNova | Medium | High | Medium |
| Hyperbolic | Medium | Medium | Medium |

---

## Decision Tree

```
What's your primary need?
├── Speed (< 100ms)
│   └── Groq (60 RPM, 300+ t/s)
├── Volume (1M+ tokens/day)
│   └── Cerebras (1M tokens/day)
├── Variety (30+ models)
│   └── OpenRouter (:free models)
├── Multimodal (image + text)
│   └── Google AI Studio (1M context)
├── Code generation
│   └── Mistral (Codestral)
├── Edge deployment
│   └── Cloudflare Workers AI
├── Testing/Github ecosystem
│   └── GitHub Models
└── High RPM (60+)
    └── Hyperbolic (60 RPM) or Groq
```

---

## Quick Reference Card

### For New Projects
| Priority | Provider | Why |
|----------|----------|-----|
| 1st | Groq | Easiest, fastest, 60 RPM |
| 2nd | Cerebras | High volume, reliable |
| 3rd | OpenRouter | Model variety |

### For Existing Projects
| Migration From | Migrate To | Effort |
|----------------|------------|--------|
| OpenAI | Groq | Drop-in replacement |
| Anthropic | Cerebras | OpenAI-compatible |
| Azure | Cloudflare | Edge advantage |
| AWS Bedrock | OpenRouter | Model variety |

### For Production
| Need | Provider | Plan |
|------|----------|------|
| Speed | Groq | Contact sales |
| Volume | Cerebras | Enterprise |
| Reliability | Cloudflare | Workers paid |
| Variety | OpenRouter | Any balance |

---

## Summary Rankings

### By RPM (Speed of Request)
1. Groq (60) ⭐
2. Hyperbolic (60)
3. Cloudflare (50)
4. GitHub Low Tier (15)
5. Google Flash (10)

### By Daily Volume
1. Cerebras (1M tokens) ⭐
2. Mistral (1B tokens/month)
3. Groq 8B (14,400 requests)
4. Google Lite (1,000 requests)
5. OpenRouter (1,000 requests)

### By Model Variety
1. OpenRouter (30+) ⭐
2. GitHub (15+)
3. Hyperbolic (15+)
4. Cloudflare (10+)
5. Groq (10+)

### By Speed (Tokens/Second)
1. Groq (300+) ⭐
2. SambaNova (100+)
3. Cerebras (100+)
4. Google (50-100)
5. Cloudflare (50+)

### By Special Features
1. Google (multimodal + 1M context) ⭐
2. Cloudflare (edge + vision)
3. Mistral (code + embeddings)
4. Hyperbolic (vision + various)
5. OpenRouter (variety)

---

**Last Updated:** April 28, 2026
