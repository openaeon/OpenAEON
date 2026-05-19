# Cognitive OS Contract

OpenAEON Cognitive OS treats tasks, agent execution, memory, replay, and governance as one runtime contract.

## Core Loop

```text
input -> task decomposition -> dispatch -> verification -> reflection -> memory -> replay
```

The authoritative task phase sequence is:

```text
INIT -> PLAN -> EXECUTE -> VERIFY -> REFLECT -> DONE
```

Failed invariant checks may route a task to `REFLECT` or `FAILED` instead of `DONE`.

## Runtime Contracts

### Task OS

- Source of truth: `CognitiveTaskRecord`
- Durable record: `.openaeon/cognitive/tasks/*.json`
- Query index: `.openaeon/cognitive/index.sqlite`
- Queue contract: claim, heartbeat, lease, complete

### Memory Provider

All Cognitive memory backends implement `CognitiveMemoryProvider`:

- `initialize`
- `prefetch`
- `writeEvolution`
- `queryEvolution`
- `syncTurn`
- `onDelegation`
- `shutdown`

The default provider maps short/long/evolution memory into this lifecycle. Honcho, Mem0, OpenViking, and similar backends should plug in at this boundary.

### SQLite Cognitive Store

JSON and JSONL remain authoritative. SQLite is a secondary index for:

- tasks
- nodes
- events
- artifacts
- trajectories
- full-text search via FTS5

If SQLite is unavailable, Cognitive OS continues to run with file-backed records and JSONL replay.

### Delegation Policy

Subagent delegation is governed by `CognitiveDelegationPolicy`:

- max concurrent children
- max delegation depth
- blocked descendant tools
- default/inherited toolsets
- workspace mode

The policy is injected into delegated subagent prompts and shared context.

### Provider Runtime Resolver

`resolveCognitiveProviderRuntime` maps a provider to:

- model
- API mode
- credential source
- auxiliary flag
- fallback provider list

Cognitive runtime should depend on this resolver instead of hardcoding model names.

### Agent Loop

`CognitiveAgentLoop` is the common execution seam for:

- gateway chat
- subagent execution
- cron jobs
- Cognitive dispatch

Current dispatch still uses existing gateway and subagent primitives, but new execution paths should target this loop contract.

### Trajectory Export

`cognitive.task.trajectory` converts task records and replay events into `openaeon-cognitive-trajectory` format for:

- regression tests
- benchmark datasets
- RL and self-improvement
- replay-driven debugging

### Progressive Context Discovery

Context hints are discovered from:

- `AGENTS.md`
- `CLAUDE.md`
- `.hermes.md`
- `HERMES.md`

Hints are loaded from referenced directories and ancestors, capped and injected as contextual snippets instead of bloating the base prompt.
