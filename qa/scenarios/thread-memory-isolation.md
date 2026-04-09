# Thread memory isolation

```yaml qa-scenario
id: thread-memory-isolation
title: Thread memory isolation
surface: memory
objective: Verify a memory-backed answer requested inside a thread stays in-thread and does not leak into the root channel.
successCriteria:
  - Agent uses memory tools inside the thread.
  - The hidden fact is answered correctly in the thread.
  - No root-channel outbound message leaks during the threaded memory reply.
docsRefs:
  - docs/concepts/memory-search.md
  - docs/channels/group-messages.md
codeRefs:
  - extensions/memory-core/index.ts
  - src/routing/session-key.ts
execution:
  kind: manual
  summary: Verify thread-local memory recall does not leak to the parent channel timeline.
  checklist:
    - Seed a memory-only fact not present in transcript.
    - Ask inside a thread and require memory tools first.
    - Confirm reply is in-thread and contains expected fact.
    - Confirm root channel gets no leaked outbound message.
  commands:
    - pnpm test src/auto-reply/reply/reply-state.test.ts
```
