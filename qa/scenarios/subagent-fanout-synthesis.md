# Subagent fanout synthesis

```yaml qa-scenario
id: subagent-fanout-synthesis
title: Subagent fanout synthesis
surface: subagents
objective: Verify the agent can delegate multiple bounded subagent tasks and fold both results back into one parent reply.
successCriteria:
  - Parent flow launches at least two bounded subagent tasks.
  - Both delegated results are acknowledged in the main flow.
  - Final answer synthesizes both worker outputs in one reply.
docsRefs:
  - docs/tools/subagents.md
  - docs/help/testing.md
codeRefs:
  - src/agents/subagent-spawn.ts
  - src/agents/system-prompt.ts
execution:
  kind: manual
  summary: Verify two bounded workers run and the parent synthesizes both outputs.
  checklist:
    - Ask the agent to spawn exactly two subagents for two simple file-existence checks.
    - Confirm both runs complete.
    - Confirm parent reply includes both outcomes.
  commands:
    - pnpm test src/agents/subagent-registry.persistence.test.ts
```
