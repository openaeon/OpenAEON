---
summary: "Aggressive Autopilot runs Cognitive Task OS work from planning through execution, delegation, retry, reflection, and recovery without manual confirmation."
title: "Aggressive Autopilot"
---

# Aggressive Autopilot

Aggressive Autopilot is the zero-confirm execution mode for Cognitive Task OS. It is designed for unattended task convergence: once a task is submitted, OpenAEON can plan, execute, delegate, write back, retry, reflect, and recover without waiting for manual approval at each phase.

## Core Capabilities

### Zero-confirm execution

When autopilot is enabled, tasks move from `PLAN` into `EXECUTE` automatically after planning. The runtime uses legal state-machine transitions instead of skipping directly across lifecycle phases.

### Queue autonomy

The ready queue filters blocked dependencies, releases expired claims, waits for future `nextRetryAt` backoff windows, and can speculatively enqueue nodes whose dependencies are still `in_progress` when speculative dispatch is enabled.

### Delegation recovery

Delegated nodes remain `in_progress` after a subagent accepts work. Runtime summaries expose `delegations.active` and `delegations.overdue`, so the UI or API can distinguish work that is still running from work that needs automatic recovery.

If a delegated lease expires, OpenAEON recovers the node back to `todo` and re-enqueues it. Ordinary dispatcher and subagent failures retry with exponential backoff before escalating to reflection or final failure.

### Closed-loop completion

Once executable nodes are complete, the runtime can advance through `VERIFY`, `REFLECT`, and `DONE`. Root nodes no longer block completion when all executable children have finished; single-node tasks still fall back to the root node.

### Recursive subagent delegation

Cognitive subagents can iterate locally and spawn descendant workers when depth policy allows. Descendants receive `parentCognitiveTask` context rather than the parent writeback link, so only the owning subagent writes final results back to the Cognitive Task OS runtime.

## Manual Force Start

Operators can still force a specific node to start when they intentionally want to bypass dependency or backoff checks. The Gateway exposes this through `cognitive.runtime.force_start`, and the runtime dispatches the requested node rather than falling back to a generic ready-queue scan.

Use force start sparingly. It is intended for operator-directed recovery, not for bypassing security, permission, or invariant checks.

## Runtime Signals

- **Lifecycle**: `INIT` -> `PLAN` -> `EXECUTE` -> `VERIFY` -> `REFLECT` -> `DONE`
- **Queue**: pending and claimed node counts
- **Retries**: total retries, pending backoff, and exhausted retries
- **Delegations**: active and overdue delegated nodes
- **Checkpoint**: last run id and run count
- **Replay**: replay cursor for audit and inspection

## Related APIs

- `cognitive.task.submit`
- `cognitive.runtime.dispatch`
- `cognitive.runtime.force_start`
- `cognitive.runtime.status`
- `cognitive.task.replay`
- `cognitive.task.trajectory`
