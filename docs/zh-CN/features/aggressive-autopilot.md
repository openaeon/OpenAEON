---
summary: 激进自动驾驶模式让 Cognitive Task OS 从规划、执行、委派、重试、反思到恢复都无需人工确认。
title: 激进自动驾驶
x-i18n:
  generated_at: "2026-05-17T00:00:00Z"
  model: manual-codex-review
  provider: codex
  source_hash: f96a3a06a03de3cd7521b7a50e9641c11d20985f0867f5d625c61af6d33325f3
  source_path: features/aggressive-autopilot.md
  workflow: manual-mintlify-i18n-check
---

激进自动驾驶是 Cognitive Task OS 的零确认执行模式。它面向无人值守的任务收敛：任务提交后，
OpenAEON 可以自动规划、执行、委派、回写、重试、反思和恢复，不需要在每个阶段等待人工批准。

## 核心能力

### 零确认执行

启用 autopilot 后，任务会在规划完成后自动从 `PLAN` 进入 `EXECUTE`。运行时通过合法的
状态机转换推进，而不是跳过生命周期阶段。

### 队列自治

ready 队列会过滤被依赖阻塞的节点、释放过期 claim、等待未来的 `nextRetryAt` backoff
窗口，并且在启用 speculative dispatch 时，可以把依赖仍处于 `in_progress` 的节点提前入队。

### 委派恢复

子代理接受工作后，被委派的节点会保持 `in_progress`。运行时摘要会暴露
`delegations.active` 和 `delegations.overdue`，让 UI 或 API 区分仍在运行的工作和
需要自动恢复的工作。

如果委派 lease 过期，OpenAEON 会把节点恢复为 `todo` 并重新入队。普通 dispatcher 和
subagent 失败会先按指数 backoff 重试，然后才升级到反思或最终失败。

### 闭环完成

可执行节点完成后，运行时可以继续推进到 `VERIFY`、`REFLECT` 和 `DONE`。当所有可执行
子节点都完成时，root 节点不会再阻塞收尾；单节点任务仍会回退到 root 节点判断。

### 递归子代理委派

当深度策略允许时，Cognitive subagent 可以在本地迭代并生成后代 worker。后代会收到
`parentCognitiveTask` 上下文，而不是父级 writeback 链接，因此只有拥有该节点的子代理会把
最终结果写回 Cognitive Task OS 运行时。

## 手动强制启动

操作员仍然可以在确实需要绕过依赖或 backoff 检查时强制启动指定节点。Gateway 通过
`cognitive.runtime.force_start` 暴露该能力，运行时会派发指定节点，而不是退回到普通 ready
队列扫描。

请谨慎使用 force start。它用于操作员主导的恢复，不用于绕过安全、权限或 invariant 检查。

## 运行时信号

- **生命周期**：`INIT` 到 `PLAN` 到 `EXECUTE` 到 `VERIFY` 到 `REFLECT` 到 `DONE`
- **队列**：pending 和 claimed 节点数量
- **重试**：总重试数、等待 backoff 的重试数、已耗尽的重试数
- **委派**：活跃和逾期的委派节点
- **检查点**：最后一次 run id 和 run count
- **Replay**：用于审计和检查的 replay cursor

## 相关 API

- `cognitive.task.submit`
- `cognitive.runtime.dispatch`
- `cognitive.runtime.force_start`
- `cognitive.runtime.status`
- `cognitive.task.replay`
- `cognitive.task.trajectory`
