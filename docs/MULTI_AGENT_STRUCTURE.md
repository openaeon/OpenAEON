# Multi-Agent Organizational Structure (Qiaobang/Beggars' Gang)

This document describes the hierarchical multi-agent system implemented in OpenAEON, inspired by the "Qiaobang" (Beggars' Gang) structure.

## Structure Overview

The system is organized into five main tiers, ranging from top-level decision-making to entry-level auxiliary tasks.

| Tier                   | Agent Type      | Qiaobang Position               | Core Capabilities / Responsibilities                                               |
| :--------------------- | :-------------- | :------------------------------ | :--------------------------------------------------------------------------------- |
| **Top Decision**       | `LeaderAgent`   | 帮主 (Chief)                    | Global decision-making, command issuance, conflict arbitration, supreme authority. |
| **Core Functional**    | `LawAgent`      | 执法长老 (Law Elder)            | Discipline enforcement, violation judgment, punishment management.                 |
|                        | `SkillAgent`    | 传功长老 (Skill Elder)          | Martial arts teaching, capability assessment, promotion audit.                     |
|                        | `GuardAgent`    | 掌棒龙头 (Stick-holding Leader) | Security defense, combat dispatch, token protection.                               |
|                        | `ResourceAgent` | 掌钵龙头 (Bowl-holding Leader)  | Resource allocation, material management, logistics coordination.                  |
| **Regional Execution** | `AreaAgent`     | 分舵主 (Branch Chief)           | Regional management, intelligence summary, task implementation.                    |
|                        | `EliteAgent`    | 香主 (Fragrance Chief)          | District execution, personnel dispatch, intelligence collection.                   |
| **Basic Member**       | `MemberAgent`   | 弟子 (Disciple)                 | Task execution, intelligence collection, basic assistance.                         |
| **Reserve Member**     | `ReserveAgent`  | 无袋弟子 (Bagless Disciple)     | Auxiliary tasks, entry-level learning, probation process.                          |

## Implementation Details

### Configuration

The agents are defined in `openaeon.json` with specific `id`, `name`, and tool `allowlist` that reflect their roles. For example, the `LeaderAgent` has access to `sessions_spawn` for delegation, while the `ResourceAgent` focuses on `read`, `write`, and `web_search` for material management.

### UI Integration

The Sandbox UI (`ui/src/ui/views/sandbox.ts`) has been enhanced to visually represent this structure:

- **Citadel Zone**: Labeled as "帮主 (Citadel/Admin)".
- **Logistics Zone**: Labeled as "掌钵龙头 (Logistics Hub)".
- **Task Cards**: Include a prominent yellow badge indicating the agent's Qiaobang role (e.g., "执法长老").
