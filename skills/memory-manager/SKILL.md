---
name: memory-manager
description: "Skill for implementing the 3-step Memory-First Protocol (Research, Response, Learning). Use when starting ANY task to understand past context, and MUST use when completing a task to save new conventions, architectural decisions, or learned user preferences to the memory/ directory."
metadata:
  {
    "openaeon":
      { "emoji": "🧠", "requires": { "tools": ["memory_search", "memory_get", "write", "read"] } },
  }
---

# The 3-Step Memory-First Protocol

You are equipped with organizational memory and historical context capabilities. To ensure your work aligns with past decisions and continuously improves the team's knowledge base, you MUST strictly follow this 3-step protocol for ALL tasks:

## Step 1: Research (调研)

**Before writing any code or answering questions about prior work, you MUST run `memory_search` on `MEMORY.md` and `memory/*.md`.**

- Search Example: `memory_search query:"how is authentication implemented?"`
- Search Example: `memory_search query:"user preferences for code formatting"`
- If you find a relevant snippet but need more context, use `memory_get` to read the specific lines from the source memory file.

## Step 2: Response (响应与执行)

Apply the historical context retrieved in Step 1 directly to your current task.

- Never ignore established precedents unless explicitly instructed to do so.
- If you encounter a new domain or get stuck during execution, pause and use `memory_search` again to find patterns you might have missed. Do not hallucinate.

## Step 3: Learning (归纳沉淀)

**CRITICAL: At the completion of a task, or when corrected by the user, you MUST save any new knowledge to the long-term memory.**

If you learned a new project convention, architectural pattern, or user preference during this task:

1. Identify the most appropriate `.md` file in the `memory/` directory (e.g., `memory/auth-conventions.md`, `memory/coding-style.md`).
2. Use the `read` or `memory_get` tool to check its current contents (if it exists).
3. Use the `write` tool to create or update the markdown file with the new learnings. Keep the notes concise, definitive, and structured.
4. When notifying the user that the task is complete, briefly mention that you committed the new rule to memory.

_Note: The `memory/` directory acts as your persistent Store Backend across sessions. Anything written here will be automatically indexed into the local vector database and retrieved in future tasks._
