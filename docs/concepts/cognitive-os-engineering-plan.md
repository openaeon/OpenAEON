---
title: "Cognitive OS Engineering Plan"
summary: "Execution milestones, data contracts, RPC events, and first test batches for cognitive OS rollout."
read_when:
  - You are implementing cognitive OS capabilities in gateway and agent runtime
  - You need a phased rollout with explicit exit criteria
  - You need concrete schemas and protocol deltas
---

# Cognitive OS engineering plan

Last updated: 2026-04-12

## Scope and guardrails

This plan implements the cognitive OS model in incremental, backward compatible
steps.

Guardrails:

- Keep existing `task_plan.*` methods functional during migration.
- Add fields and events before adding new required behavior.
- Preserve current planner file path compatibility under
  `.openaeon/planner/<session>.json`.
- Never let dream summaries replace raw execution records.

Out of scope in this plan:

- UI redesign visual polish
- Cross host distributed scheduler
- External graph database dependency as a phase 1 requirement

## Current baseline

Current gateway supports:

- `task_plan.read`
- `task_plan.approve`
- `task_plan.autopilot.tick`
- broadcasts: `task_plan.execution.trigger`,
  `task_plan.autopilot.status`, `task_plan.autopilot.spawned`,
  `task_plan.execution.recover`

Current persistence:

- `.openaeon/planner/<sessionKey>.json`

Current gap to close:

- Stage level checkpoint chain with restore
- Branch model and stage history tree
- Dream and episodic separation
- Verifier gate contract per stage
- Cross task graph indexing

## Milestones

### M0 protocol and data scaffolding

Goal:

- Introduce versioned task runtime envelope and new records without changing
  behavior.

Deliverables:

1. `TaskRuntimeV1` schema with `task`, `stages`, `branches`, `checkpoints`,
   `dreams`, `verification`.
2. File layout under `.openaeon/cognitive/` while mirroring key fields back to
   legacy planner payload.
3. Read path adapter that can hydrate from legacy planner format.

Exit criteria:

- Existing clients using `task_plan.read` keep working.
- New fields appear in response payload under optional keys.

### M1 checkpoint and reversible state machine

Goal:

- Enable deterministic rollback, retry, branch, restore.

Deliverables:

1. Checkpoint write on stage boundary.
2. Branch record model and `stage_history` tree.
3. Transition engine with explicit commands:
   `forward|rollback|retry|branch|restore`.

Exit criteria:

- Any completed stage can be restored from disk.
- Retry does not overwrite previous attempt evidence.
- Branch creates a new lineage pointer without mutating source branch.

### M2 verifier and role split

Goal:

- Enforce verification gate and role owned transitions.

Deliverables:

1. Verifier result contract: pass fail blocked plus evidence.
2. Role marker on each stage transition:
   `planner|executor|verifier|reflector|memory_manager|orchestrator`.
3. Reflector output contract for failed stages with recommended action.

Exit criteria:

- Stage completion must include verifier outcome.
- Failed stages emit machine readable remediation advice.

### M3 graph memory and model routing

Goal:

- Add graph edges and routing policy for reusable cognition.

Deliverables:

1. Graph node edge append log.
2. Retrieval API for decision and evidence lookup by anchor.
3. Model profile policy resolved by role, stage type, and risk.

Exit criteria:

- Decision can be traced to evidence and checkpoint chain.
- Routing policy can be inspected for each stage.

## Data contracts

The following interfaces define phase 1 through 3 storage shape.

```ts
type TaskStatus =
  | "queued"
  | "planning"
  | "running"
  | "verifying"
  | "blocked"
  | "failed"
  | "completed"
  | "rolled_back"
  | "branched";

type TransitionAction = "forward" | "rollback" | "retry" | "branch" | "restore";

type VerificationStatus = "pending" | "passed" | "failed" | "blocked";

type AgentRole =
  | "planner"
  | "executor"
  | "verifier"
  | "reflector"
  | "memory_manager"
  | "orchestrator";

type ModelProfile = {
  profileId: string;
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  costTier?: "low" | "medium" | "high";
  riskTier?: "low" | "medium" | "high";
};

type StageRecord = {
  stageId: string;
  taskId: string;
  branchId: string;
  name: string;
  status: TaskStatus;
  ownerRole: AgentRole;
  dependsOnStageIds: string[];
  retryCount: number;
  startedAt?: number;
  completedAt?: number;
  verifierStatus: VerificationStatus;
  verifierEvidenceIds: string[];
};

type CheckpointRecord = {
  checkpointId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  previousCheckpointId?: string;
  stageInput: Record<string, unknown>;
  stageOutput: Record<string, unknown>;
  keyDecisions: string[];
  toolResults: Array<Record<string, unknown>>;
  modelProfile: ModelProfile;
  dreamId?: string;
  recoveryState: Record<string, unknown>;
  createdAt: number;
};

type DreamRecord = {
  dreamId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  summary: string;
  keyDecisions: string[];
  risks: string[];
  nextAction: string;
  anchors: string[];
  sourceCheckpointIds: string[];
  createdAt: number;
};

type BranchRecord = {
  branchId: string;
  taskId: string;
  parentBranchId?: string;
  derivedFromCheckpointId?: string;
  status: "active" | "archived";
  createdAt: number;
};

type TransitionRecord = {
  transitionId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  action: TransitionAction;
  actorRole: AgentRole;
  reason?: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  createdAt: number;
};

type TaskRuntimeV1 = {
  version: "1";
  taskId: string;
  goal: string;
  currentStageId?: string;
  currentCheckpointId?: string;
  currentBranchId: string;
  stageHistoryTree: Record<string, string[]>;
  stages: StageRecord[];
  branches: BranchRecord[];
  checkpoints: CheckpointRecord[];
  dreams: DreamRecord[];
  transitions: TransitionRecord[];
  updatedAt: number;
};
```

## Storage layout

Proposed path layout under workspace:

- `.openaeon/cognitive/tasks/<taskId>/runtime.json`
- `.openaeon/cognitive/tasks/<taskId>/checkpoints/<checkpointId>.json`
- `.openaeon/cognitive/tasks/<taskId>/dreams/<dreamId>.json`
- `.openaeon/cognitive/tasks/<taskId>/graph/edges.jsonl`
- `.openaeon/planner/<sessionKey>.json` (compat mirror during migration)

Write strategy:

- Runtime file is authoritative index.
- Checkpoint and dream records are append only immutable artifacts.
- Graph edges are append only JSONL for cheap writes and replay.

## RPC and event plan

### Keep existing methods

No breaking changes:

- `task_plan.read`
- `task_plan.approve`
- `task_plan.autopilot.tick`

### Additive method roadmap

Phase 1:

1. `task_plan.transition.apply`
2. `task_plan.checkpoint.restore`
3. `task_plan.branch.create`
4. `task_plan.verifier.report`

Phase 2:

1. `task_plan.dream.distill`
2. `task_plan.graph.query`
3. `task_plan.model.route.resolve`

### Additive event roadmap

1. `task_plan.stage.changed`
2. `task_plan.checkpoint.created`
3. `task_plan.branch.created`
4. `task_plan.verifier.result`
5. `task_plan.dream.created`
6. `task_plan.graph.updated`
7. `task_plan.transition.rejected`

Event payload principles:

- Include `taskId`, `stageId`, `branchId`, `at`.
- Include `correlationId` for request event tracing.
- Include `source` role or component.

## Rollout and migration

### Step 1 dual write

- Continue writing legacy planner file.
- Write new runtime and immutable records in parallel.

### Step 2 shadow read

- Compare hydrated runtime from legacy and new layout.
- Emit warning if mismatch exceeds threshold.

### Step 3 switch primary read

- Read from runtime first.
- Fallback to legacy planner parser.

### Step 4 remove mirror dependency

- Keep legacy file for a deprecation window.
- Remove when all clients consume runtime aware fields.

## First test batch

### Unit tests

1. Transition engine validity
2. Checkpoint serialization and restore determinism
3. Branch derivation lineage
4. Dream generator schema and anchor normalization
5. Model routing policy selection

### Integration tests

1. Full stage flow: planning to execution to verification to checkpoint to dream
2. Failure flow: verifier fail to reflector advice to retry
3. Rollback flow: restore checkpoint and continue on new branch
4. Multi task isolation for memory and checkpoint domains
5. Gateway unknown method guard for non migrated clients

### End to end tests

1. User creates task and approves plan
2. Autopilot progresses ready todos
3. Stage fails and recovery event is emitted
4. Operator triggers rollback and branch
5. Final summary references checkpoint and dream anchors

## Suggested PR slicing

PR 1:

- Add runtime schemas and storage adapters
- Add dual write and `task_plan.read` optional payload fields

PR 2:

- Add transition engine and checkpoint restore path
- Add transition and checkpoint events

PR 3:

- Add verifier report contract and stage gate enforcement
- Add reflector recommendation schema

PR 4:

- Add dream distillation pipeline and graph edge append log
- Add graph query endpoint

PR 5:

- Add model routing policy resolver and observability fields
- Add docs and regression test expansion

## Operational metrics

Track these counters from M1 onward:

- stage transition success rate
- verifier fail rate by stage type
- rollback retry branch frequency
- checkpoint restore success rate
- dream generation latency and token cost
- autopilot dispatch queue depth and stall duration

## Related docs

- [Cognitive OS Architecture](/concepts/cognitive-os)
- [Gateway Architecture](/concepts/architecture)
- [Memory](/concepts/memory)
- [Session Management + Compaction](/reference/session-management-compaction)
