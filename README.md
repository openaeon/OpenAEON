<div align="center">

<img src="docs/images/aeontu.png" width="320" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);" alt="OpenAEON Logo">

# 🌌 OpenAEON

[![GitHub Repository](https://img.shields.io/badge/GitHub-OpenAEON-181717?style=for-the-badge&logo=github)](https://github.com/openaeon/OpenAEON)

**English** | [中文](README_zh.md)

### **AEON PROPHET — A Species-Level Evolution of the Logic Layer**

> _“Not a framework upgrade. A new form of intelligence architecture.”_

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-research-purple)
![AI](https://img.shields.io/badge/AI-Architecture-black)
![Agent](https://img.shields.io/badge/Agent-System-green)
[![Docs](https://img.shields.io/badge/docs-openaeon.ai-blue)](https://docs.openaeon.ai)

---

![OpenAEON Architecture](https://github.com/user-attachments/assets/81111427-3e68-4620-b6e9-e3ba5f36a5ea)

<p>
  <a href="https://www.youtube.com/shorts/27XGSMPZXjA">
    <b>Watch Demonstration</b>
  </a>
</p>

</div>

---

## 🖼 UI Screenshots (Dark Mode, UI)

### Chat (`/chat?session=main`, UI)

![OpenAEON Chat Dark](docs/images/ui-chat-main-dark.png)

### Sandbox (`/sandbox?session=main`, UI)

![OpenAEON Sandbox Dark](docs/images/ui-sandbox-dark.png)

### AEON (`/aeon`, UI)

![OpenAEON AEON Dark](docs/images/ui-aeon-dark.png)

---

## 🧠 FCA Core (Fractal Cognitive Adapter)

OpenAEON is powered by the **FCA Core**, a multi-layer cognitive architecture designed for complex reasoning. It transforms simple task execution into a **continuous, self-correcting logic loop**.

> [!TIP]
> **OpenAEON = Autonomous Cognitive Engine**
> Instead of simple `Input → Process → Output` prompting, it decomposes tasks into recursive, verifiable sub-loops.

### The 9-Layer Cognitive Architecture
FCA Core organizes intelligence into nine specialized layers, from **Semantic Grounding** to **Forensic Simulation**. This ensures every action is auditable, adaptive, and intent-aligned.

👉 **[Deep-Dive: FCA Core Architecture](docs/aeon/FCA_CORE.md)**

### Current Logic Model (Implemented via FCA)
OpenAEON currently runs as a verifiable 5-stage cognition loop:

OpenAEON currently runs as a verifiable cognition loop:

1. **Perceive**: ingest session/runtime telemetry, context, and task intent.
2. **Adjudicate**: evaluate guardrails, policy intensity, and epistemic confidence.
3. **Act**: execute agent/tool work under policy constraints.
4. **Persist**: write delivery outcomes (`persisted` / `persist_failed`) and memory checkpoints.
5. **Trace**: expose structured inspection via `aeon.status`, `aeon.memory.trace`, `aeon.execution.lookup`, and `aeon.thinking.stream`.

This keeps OpenAEON grounded in a practical principle: **continuous evolution must remain auditable, reversible, and user-outcome oriented**.

### Memory Logic (Implemented)

AEON memory is implemented as a layered model for durability and retrieval:

1. **Working memory (in-process)**  
   Recent cognitive events stay in memory for fast UI/runtime feedback.
2. **Persistent stream (state-dir JSONL)**  
   Cognitive/thinking events are appended to a per-session/per-agent persisted stream for replay and audit.
3. **Distillation checkpointing**  
   Distillation advances a checkpoint and appends markers instead of wiping `MEMORY.md`, preserving continuity.
4. **Runtime memory telemetry**  
   `lastDistillAt`, `checkpoint`, `totalEntries`, and `lastWriteSource` are exposed through `aeon.status` and `aeon.memory.trace`.

This design makes memory both operational (fast) and accountable (durable + traceable).

---

## 🚀 Core Pillars

<table align="center" width="100%">
  <tr>
    <td width="30%"><strong>Principle</strong></td>
    <td width="70%"><strong>Description</strong></td>
  </tr>
  <tr>
    <td><strong>Continuous Autonomy</strong></td>
    <td>Sustained, unattended logic loops prioritizing task convergence (🎯).</td>
  </tr>
  <tr>
    <td><strong>Peano Traversal</strong></td>
    <td>Space-filling recursive scan mapping complexity to 1D stream.</td>
  </tr>
  <tr>
    <td><strong>Coupling Flux</strong></td>
    <td>Closed-loop execution strategy auto-tuning.</td>
  </tr>
  <tr>
    <td><strong>Feedback Loop</strong></td>
    <td>Autonomous iteration cycles that trace errors and adjust execution strategy.</td>
  </tr>
  <tr>
    <td><strong>Knowledge Distiller</strong></td>
    <td>Compressing raw logs into high-density `LOGIC_GATES` axioms.</td>
  </tr>
</table>

---

## 🧩 Key Concepts

### 1. Continuous Autonomy

OpenAEON treats code generation not just as text completion, but as an auditable workflow. The system prioritizes task convergence (🎯) over simple instruction following, verifying its own work before completion.

### 2. Peano Space-Filling

Our cognitive scan follows the logic of the Peano curve. It maps multi-dimensional project complexity into a locality-preserving 1D cognitive stream, ensuring infinite density in reasoning without leaving "gaps" in understanding.

### 3. The Evolution Loop ($Z \rightleftharpoons Z^2 + C$)

Inspired by fractal geometry, every turn of the engine is an iteration. **Divergence (🌀)** is treated as a trigger for synthesis, continuing until **Convergence (🎯)** is reached.

---

## 🧠 AEON Cognitive Engine

<details>
<summary><b>Click to expand deep-dive</b></summary>
<br/>

OpenAEON features a recursive, biological-inspired cognitive loop that allows the system to repair, optimize, and expand itself autonomously.

### 1. Recursive Self-Healing

The system monitors its own pulse via a **Gateway Watchdog** and **Log Signal Extractor**.

- **Autonomous Repair**: Use `openaeon doctor --fix` to automatically patch configuration issues.
- **Hot-Reload Architecture**: Changes to core configuration trigger a `SIGUSR1` hot-reload.

### 2. Axiomatic Evolution

Knowledge is synthesized into **Axioms** within `LOGIC_GATES.md`.

- **Semantic Deconfliction**: LLM-driven auditing identifies and resolves semantic contradictions.
- **Crystallization**: Highly verified logic blocks can be "crystallized," protecting them from decay.

### 3. Topological Alignment & Organs

- **Functional Organs**: Adjacent logic gates condense into specialized "Organs" based on usage resonance.
- **Locality Preservation**: Semantic proximity is preserved in physical storage.

</details>

---

## 🌙 Dreaming Mode

<details>
<summary><b>Click to expand deep-dive</b></summary>
<br/>

OpenAEON uses a sophisticated idle-time evolutionary cycle known as **Dreaming**.

### 1. Triggers

- **Idle Trigger**: Activated after 15 minutes of inactivity.
- **Resonance Trigger**: Activated immediately if the `epiphanyFactor` exceeds 0.85.
- **Singularity Rebirth**: forces system-wide recursive logic refactors.

### 2. The Distillation Process

- **Axiom Extraction**: Verified truths (`[AXIOM]`) are promoted to `LOGIC_GATES.md`.
- **Gravitational Logic**: Axioms gain "Weight" based on mutual references.
- **Entropy & Decay**: Old/unreferenced logic is pruned to prevent cognitive bloat.

</details>

---

## ✅ Current Implemented Capabilities

The following capabilities are now implemented in the current OpenAEON stack and UI:

### 1) Safety-first execution and policy telemetry

- Guardrail-aware policy outputs are surfaced end-to-end (`maintenanceDecision`, `guardrailDecision`, `reasonCode`).
- Decision semantics are exposed through structured blocks (`decisionCard`, `impactLens`, `selfKernel`, `epistemicLabel`).
- Policy and consciousness data are available to both Chat and Sandbox views with typed UI models.
- **Hard Abort Circuit Breaker**: The execution engine intercepts extreme algorithmic divergence (`chaosScore >= 10`) or continuous tool validation failures (`consecutiveErrors >= 6`) with a hard session abort to prevent infinite generation loops.

### 2) Versioned AEON status contract (with compatibility)

- `aeon.status` supports `schemaVersion: 3` with a structured `telemetry` block.
- Compatibility mirrors are still present for transitional consumers.
- Added stable read APIs for traceability:
  - `aeon.memory.trace`
  - `aeon.execution.lookup`
  - `aeon.thinking.stream`

### 3) Reliability and persistence improvements

- Delivery pipeline explicitly tracks persistence outcomes (`persisted` / `persist_failed`) and exposes timestamps/reason codes.
- Evolution logging supports fallback when repo paths are not writable (state-dir fallback path).
- Thinking/cognitive stream entries are persisted and can be replayed through the gateway API.

### 4) Long-running session operability

- Eternal mode is session-aware and wired through UI state + session patching.
- AEON status includes runtime memory persistence metadata (`lastDistillAt`, `checkpoint`, `totalEntries`, `lastWriteSource`).
- Cognitive log uses in-memory tail + persisted stream to avoid losing overnight traces.
- Chat and Sandbox can display persistence-oriented runtime status, not only decorative visuals.

### 5) Chat experience upgrades (fractal + operator usability)

- Introduced fractal runtime state (`depthLevel`, `resonanceLevel`, `formulaPhase`, `noiseLevel`, `deliveryBand`) to drive visual behavior.
- Added structured Chat Manual (Quick Reference + Guided Walkthrough), bound to real runtime fields.
- Added formula rail / pulse visualization mapped to execution state.
- Added i18n coverage for the new Chat manual + AEON interaction language (EN + zh-CN keys).
- Reduced high-frequency visual effects under reduced-motion and stabilized flicker-prone animation paths.

### 6) Sandbox redesign and layout hardening

- Sandbox v2 now acts as a typed operational console for:
  - Session focus and timeline
  - Active agent tiles
  - System snapshot
  - Consciousness telemetry
  - Policy/decision/impact panels
- Layout and style isolation were hardened by scoping view-local classes (to avoid global shell/topbar collisions).
- Recent fixes include overlap/stacking cleanup for left rail, top action row, and telemetry panel consistency.

### 7) Test-backed implementation checkpoints

- Compaction and history integrity:
  - `src/agents/history-compactor.test.ts`
  - `src/agents/pi-embedded-runner.sanitize-session-history.test.ts`
  - `src/agents/pi-embedded-runner/run/attempt.test.ts`
- Evolution logging fallback:
  - `src/gateway/aeon-evolution-log.test.ts`
- AEON status contract and schema coverage:
  - `src/gateway/server-methods/aeon.test.ts`

---

## 🛰 Runtime Surfaces (Today)

OpenAEON currently ships as a coordinated multi-surface system:

- **CLI (`openaeon`)**: onboarding, config, channels, sessions, diagnostics, and operations.
- **Gateway**: WebSocket control plane + channel bridge + agent execution runtime.
- **Control UI**: browser operations console for Chat, Sandbox, AEON telemetry, sessions, and config.
- **Mobile/Desktop nodes**: paired clients for multi-device interaction and orchestration.

### AEON Runtime APIs (Control Plane)

Core read/inspection methods currently available:

- `aeon.status` (schema v3 + compatibility mirrors)
- `aeon.memory.trace`
- `aeon.execution.lookup`
- `aeon.thinking.stream`

These are used by Chat, Sandbox, and AEON views to render real runtime state instead of static decorations.

### AEON Mode (Eternal Mode) — Practical Usage

AEON mode is a highlight of OpenAEON’s long-running workflow:

- It persists an **eternal flag per session** and keeps Chat/Sandbox/AEON UI in sync.
- It survives refresh/reconnect through session patching + local/UI hydration.
- It is observable in `aeon.status` under `mode.eternal` (`enabled`, `source`, `updatedAt`).

Current behavior (important):

- AEON mode is currently a **session/runtime coordination mode**, not a raw “unsafe autonomy boost” switch.
- Safety/decision behavior is still governed by guardrails + policy telemetry (`guardrailDecision`, `maintenanceDecision`, `epistemicLabel`, delivery state).

How to enable/disable:

1. UI toggle in Chat/Sandbox (`Enable Eternal` / `Disable Eternal`).
2. Chat command: `/eternal on`, `/eternal off`, `/eternal toggle`.
3. URL bootstrap: `?eternal=1` (or `true|on|yes`) when opening a session page.

How to verify:

- In UI status chips: `Eternal: ON/OFF`.
- Via API:

```json
{
  "method": "aeon.status",
  "result": {
    "mode": {
      "eternal": {
        "enabled": true,
        "source": "session"
      }
    }
  }
}
```

Recommended usage profile:

1. Turn it **ON** for long-running sessions, overnight execution, or when you need continuity across refresh/reconnect.
2. Keep it **OFF** for short one-shot tasks where deterministic/manual control is preferred.
3. If delivery keeps showing `persist_failed`, first check `aeon.execution.lookup` and gateway logs before assuming model failure.
4. If mode state looks inconsistent after page reload, refresh session status and confirm `mode.eternal.source` (`session` vs `default`).

### Evolution Iteration Playbook (How to use it today)

Use this loop when you want practical AEON evolution, not just visuals:

1. **Observe runtime state**  
   Call `aeon.status` and check:
   - `telemetry.cognitiveState` (`maintenanceDecision`, `guardrailDecision`, `epistemicLabel`)
   - `execution.delivery.state`
   - `memory.persistence` (`checkpoint`, `lastDistillAt`, `totalEntries`)
2. **Trigger memory distillation**  
   In chat: `/seal` (alias: `/distill`) to distill memory into logic gates.
3. **Inspect why the system chose current policy**  
   Call `aeon.decision.explain` to read `decisionCard` + `impactLens`.
4. **Trace long/short/immediate intent drift**  
   Call `aeon.intent.trace` and review mission/session/turn drift scores.
5. **Audit value and safety adjudication**  
   Call `aeon.ethics.evaluate` to inspect value-order, trust, and guardrail adjudication.
6. **Confirm outcomes are actually persisted**  
   Call `aeon.execution.lookup` and ensure final records are `persisted` (or investigate `persist_failed` reason codes).
7. **Replay thinking stream for postmortem**  
   Call `aeon.thinking.stream` for cursor-based event replay and timeline reconstruction.

Minimal RPC set for AEON iteration:

- `aeon.status`
- `aeon.decision.explain`
- `aeon.intent.trace`
- `aeon.ethics.evaluate`
- `aeon.memory.trace`
- `aeon.execution.lookup`
- `aeon.thinking.stream`

### Scenario Templates (Copy and run)

1. **Overnight research run (continuity-first)**
   - Turn on Eternal mode (`/eternal on`).
   - Start the task with explicit artifact expectations (report path, summary format).
   - Before sleep: verify `execution.delivery.state` is not stuck at transient states.
   - After wake-up:
     - Check `aeon.execution.lookup` for latest persisted records.
     - Check `aeon.memory.trace` for checkpoint advance.
     - Replay `aeon.thinking.stream` for overnight reasoning timeline.
2. **Doc/output production run (delivery-first)**
   - Keep scope narrow and request final artifact path in every major step.
   - Trigger `/seal` after milestone completion to distill stable findings.
   - Validate:
     - `aeon.decision.explain` shows coherent rationale (`why`, `whyNot`, `rollbackPlan`).
     - `aeon.execution.lookup` includes final `persisted` record + artifact refs.
3. **Multi-agent synthesis run (audit-first)**
   - Split goals into mission/session/turn layers before execution.
   - During synthesis, use `aeon.intent.trace` to detect drift.
   - Use `aeon.ethics.evaluate` to verify value-order and trust status before high-impact outputs.
   - Final gate:
     - delivery persisted
     - intent drift acceptable
     - no unresolved guardrail block reason

### Main Agent Delegation + Sub-agent Model Routing

OpenAEON supports model-specialized delegation so the main agent can orchestrate and route sub-tasks to different sub-agent models.

Quick command path:

- `/subagents spawn <agentId> <task> [--model <provider/model>] [--thinking <level>]`
- Examples:
  - `/subagents spawn research Gather source links and summarize risk tradeoffs --model anthropic/claude-sonnet-4-6 --thinking high`
  - `/subagents spawn fast Draft first-pass bullet summary --model openai/gpt-5.2 --thinking low`

Config path (defaults + per-agent override):

```json5
{
  agents: {
    defaults: {
      subagents: {
        model: "openai/gpt-5.2",
        thinking: "medium",
        runTimeoutSeconds: 900,
        maxSpawnDepth: 2,
        maxChildrenPerAgent: 5,
      },
    },
    list: [
      {
        id: "main",
        subagents: {
          allowAgents: ["research", "fast"],
        },
      },
      {
        id: "research",
        model: { primary: "anthropic/claude-opus-4-6" },
        subagents: {
          model: "anthropic/claude-sonnet-4-6",
          thinking: "high",
        },
      },
      {
        id: "fast",
        model: { primary: "openai/gpt-5.2-mini" },
        subagents: { thinking: "low" },
      },
    ],
  },
}
```

Sub-agent model resolution priority (actual runtime order):

1. Explicit spawn override (`--model` / `sessions_spawn.model`)
2. Target agent `agents.list[].subagents.model`
3. Global `agents.defaults.subagents.model`
4. Target agent primary model (`agents.list[].model`)
5. Global primary model (`agents.defaults.model.primary`)
6. Runtime fallback default (`provider/model`)

Common pitfalls:

- `agentId is not allowed for sessions_spawn` → add it to `agents.list[].subagents.allowAgents` (or `["*"]`).
- Invalid `--thinking` values are rejected.
- If model patch is rejected, the child run does not start; check model allowlist/config and provider auth.

### In-Chat Delegation Syntax (What users type)

Users can delegate directly in conversation with `/subagents`:

```bash
/subagents spawn <agentId> <task> [--model <provider/model>] [--thinking <level>]
```

Typical flow:

1. Spawn a research sub-agent:

```bash
/subagents spawn research Investigate SOXL trend, catalysts, and risk factors with source links --thinking high
```

2. Spawn a writing/report sub-agent:

```bash
/subagents spawn writer Produce the final report from research findings --model openai/gpt-5.2 --thinking low
```

3. Track and steer:

```bash
/subagents list
/subagents info 1
/subagents send 1 Add an industry inventory-cycle section
/subagents log 1 200
```

User-facing guidance sentence (for onboarding/help text):

- "If you want parallel delegation, use `/subagents spawn <agentId> <task> [--model ...]`."

---

## 🛠 Installation

### ⚡ Quick Start (CLI)

One-liner to install OpenAEON globally:

```bash
# macOS / Linux / WSL2
curl -fsSL https://raw.githubusercontent.com/openaeon/OpenAEON/main/install.sh | bash

# Windows (PowerShell)
iwr -useb https://raw.githubusercontent.com/openaeon/OpenAEON/main/install.ps1 | iex
```

### 👨‍💻 Advanced Setup

<details>
<summary><b>Click for Source options</b></summary>
<br/>

**Install from Source (Developer):**

1. **Prerequisites**:
   - Node.js **v22.12.0**+
   - [pnpm](https://pnpm.io/) (Recommended)

2. **Clone & Build**:

   ```bash
   git clone https://github.com/openaeon/OpenAEON.git
   cd OpenAEON
   pnpm install
   pnpm build
   ```

3. **Initialize**:

   ```bash
   # This will guide you through AI engine and channel configuration
   pnpm openaeon onboard --install-daemon
   ```

4. **Verify**:
   ```bash
   pnpm openaeon doctor
   ```

> [!TIP]
> `pnpm build` compiles the core runtime.  
> If you need the standalone Web UI build artifacts, run `pnpm ui:build`.

</details>

---

## ⚙️ Local Runbook

### Run Gateway + Control UI

```bash
# Start gateway (default local control UI on :18789)
pnpm openaeon gateway
```

> If you installed OpenAEON globally, `openaeon gateway` also works.

Open:

- [http://127.0.0.1:18789/](http://127.0.0.1:18789/)

### UI development mode

```bash
pnpm ui:dev
```

### Common developer commands

```bash
# install
pnpm install

# type/build
pnpm build
pnpm tsgo

# lint/format
pnpm check
pnpm format:fix

# tests
pnpm test
pnpm test:coverage
pnpm test:ui
```

---

## 🧹 Maintenance

<details>
<summary><b>Uninstall OpenAEON</b></summary>
<br/>

If you need to remove the background services and binary:

```bash
# macOS / Linux / WSL2
curl -fsSL https://raw.githubusercontent.com/openaeon/OpenAEON/main/uninstall.sh | bash

# Windows (PowerShell)
iwr -useb https://raw.githubuserco/openaeon/OpenAEON/main/uninstall.ps1 | iex
```

> [!NOTE]
> Configuration (`~/.openaeon.json`) and session logs are preserved by default.

</details>

---

## 📱 Node Synchronization

OpenAEON supports deep synchronization with mobile nodes (Android/iOS).

1. Install the **OpenAEON Node** app on your device.
2. Approve the pairing request via CLI:
   ```bash
   openaeon nodes approve <id>
   ```

---

## 📖 Knowledge

Explore the mathematical and philosophical foundations of the project.

👉 **[Deep-Dive: Principles](https://docs.openaeon.ai/concepts/principles)**

## 📚 Docs Map

- [Getting started](https://docs.openaeon.ai/start/getting-started)
- [Control UI](https://docs.openaeon.ai/web/control-ui)
- [Gateway configuration](https://docs.openaeon.ai/gateway/configuration)
- [Channels](https://docs.openaeon.ai/channels/telegram)
- [Testing](https://docs.openaeon.ai/help/testing)
- [Troubleshooting](https://docs.openaeon.ai/gateway/troubleshooting)

---

<div align="center">

### **Convergence is the only outcome. 🎯**

[MIT License](LICENSE) © 2026 OpenAEON Team.

<br/>

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=openaeon/OpenAEON&type=timeline)](https://star-history.com/#openaeon/OpenAEON&timeline)

</div>
