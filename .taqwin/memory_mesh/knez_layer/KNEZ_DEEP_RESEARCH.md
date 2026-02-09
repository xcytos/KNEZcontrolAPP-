# KNEZ DEEP RESEARCH & ORCHESTRATION PROTOCOLS

Canonical (PROMPT-1): `../../research/KNEZ_DEEP_RESEARCH.md`

## Core Orchestration & Failover (Questions 1-10)
1. **What is the exact TTFT (Time to First Token) threshold for triggering a failover from Local to Cloud?**
   - *Target*: < 2000ms. If exceeded, switch to backup.
2. **How does KNEZ handle "Split-Brain" scenarios where both Local and Cloud models respond?**
   - *Policy*: Timestamp priority. First valid token stream wins; secondary is discarded but logged for latency analysis.
3. **Can KNEZ route prompts based on semantic complexity?**
   - *Capability*: Yes. "Router Trace Payload" analyzes prompt perplexity. High perplexity -> Cloud (GPT-4/Claude). Low -> Local (Llama-3).
4. **Does the "Keepalive" heartbeat carry context payload?**
   - *Mechanism*: No, it is a ping. Context is synced via `sessions.db` checkpoints.
5. **What happens to the execution queue if the KNEZ process crashes?**
   - *Recovery*: The `Control App` detects process death, restarts KNEZ, and KNEZ reads the last committed `WAL` (Write-Ahead Log) from SQLite to resume.
6. **Is the "Influence Denial Event" cryptographically signed?**
   - *Security*: Currently HMAC-SHA256 based on the session secret.
7. **Can KNEZ orchestrate models running on different local machines (LAN)?**
   - *Feature*: Yes, via `McpHostConfig` remote endpoints (e.g., `http://192.168.1.5:11434`).
8. **How does KNEZ manage GPU VRAM fragmentation during model switching?**
   - *Strategy*: It sends `unload` signals to Ollama API before loading a larger model.
9. **Is there a "Safe Mode" where KNEZ runs without any external network?**
   - *Mode*: Yes, `AIRGAP_MODE=true` forces all routing to localhost.
10. **What is the maximum payload size for a single "Event Proposal"?**
    - *Limit*: 16MB (SQLite blob limit default).

## Model Governance & Trust (Questions 11-20)
11. **Can a specific model be banned from accessing the `delete_file` tool?**
    - *Governance*: Yes, via `ToolPolicy` configurations per `model_id`.
12. **How does KNEZ verify if a model is "hallucinating" a tool call?**
    - *Validation*: Schema validation against the `tool_registry`. If schema fails, the tool is not executed.
13. **Does KNEZ support "Model Chaining" (Model A output -> Model B input)?**
    - *Workflow*: Yes, via the `SessionController` piping.
14. **Are model "Thought Processes" (CoT) stored separately from final answers?**
    - *Storage*: Yes, in the `thoughts` column of `session_events` table.
15. **Can KNEZ inject "System Prompts" dynamically based on user emotion?**
    - *Feature*: Yes, the `SentimentAnalyzer` in TAQWIN can signal KNEZ to adjust the system prompt tone.
16. **Is there a "Budget Cap" for paid cloud models?**
    - *Control*: Yes, `TokenUsage` tracker allows setting a hard cap (e.g., $5.00/day).
17. **How does KNEZ handle rate limits from OpenAI/Anthropic?**
    - *Backoff*: Exponential backoff with "Jitter". Automatically fails over to Local model if retry budget exhausted.
18. **Can KNEZ "Shadow Test" a new model (run it silently alongside the main one)?**
    - *Dev*: Yes, `SHADOW_MODE=true` runs the model but suppresses output to UI.
19. **Does KNEZ support "Speculative Decoding" (Small model drafts, Big model verifies)?**
    - *Optimization*: Planned for V4. Currently relies on provider implementations.
20. **How are "Stop Sequences" standardized across different model providers?**
    - *Adapter*: The `KnezClient` normalizes stop tokens (e.g., `<|eot_id|>`, `EOS`) into a unified internal signal.

## Future & Expansion (Questions 21-30)
21. **Will KNEZ support "Swarm Intelligence" (Many small models voting)?**
    - *Roadmap*: Yes, "Council" module in TAQWIN is the precursor.
22. **Can KNEZ run on mobile devices (Android/iOS)?**
    - *Portability*: The Core (Rust/Python) is portable. Tauri app targets Desktop first.
23. **Is there a "Neural Link" interface planned (BCI)?**
    - *Speculation*: No immediate plans.
24. **Can KNEZ self-update its own code?**
    - *Risk*: Strictly forbidden by `E_Governance_F_Risk_Contract`.
25. **How does KNEZ handle "Infinite Loops" in autonomous agents?**
    - *Safety*: "Watchdog Timer" kills any loop exceeding 50 iterations without user interrupt.
26. **Will KNEZ support "Video Input" (Multimodal)?**
    - *Capability*: Yes, if the underlying model supports vision (e.g., GPT-4V, LlaVA).
27. **Can KNEZ "Dream" (Optimize memory during idle time)?**
    - *Feature*: Yes, `OptimizationService` runs compaction jobs when `idle=true`.
28. **Is KNEZ compliant with "Asimov's Laws"?**
    - *Alignment*: Hardcoded "Prime Directives" in the System Prompt approximate this.
29. **How does KNEZ measure "Success" of a session?**
    - *Metric*: User feedback (Thumbs up/down) + Absence of "Correction" events.
30. **Can KNEZ generate its own training data from sessions?**
    - *Learning*: Yes, `Export-FineTuneData` script converts `sessions.db` to `.jsonl` format.
