# Aggressive Autopilot (激进自动驾驶)

OpenAEON 的 **Aggressive Autopilot** 是一种全自动的任务编排模式，旨在实现“一次输入，全程无忧”的用户体验。它通过消除任务生命周期中的人工确认环节，实现从规划到交付的闭环自动化。

## 核心特性

### 1. 零确认启动 (Zero-Confirm Execution)

在传统模式下，系统生成规划（PLAN）后需要用户点击“确认”才能开始执行。
在 **Aggressive Autopilot** 开启时，系统会在规划生成的瞬间自动切换到 **EXECUTE** 状态，立即分发任务。

### 2. 队列自治 (Queue Autonomy)

Ready 队列会自动过滤阻塞依赖、释放过期 claim、等待未到期的 retry backoff，并在 speculative dispatch 开启时允许依赖仍在执行中的节点提前入队。

### 3. 委派回收与重试 (Delegation Recovery)

子代理 accepted 后节点保持 `in_progress`，运行摘要会显示 active/overdue delegations。超出 lease 的 delegated node 会自动回收为 `todo` 并重新入队；普通失败先按指数 backoff 重试，耗尽后进入 REFLECT 路径。

### 4. 闭环自动化 (Closed-Loop Completion)

任务跑完后，系统会自动进入 **VERIFY** 和 **REFLECT** 阶段进行质量检查和知识萃取，并最终自动标记为 **DONE**，无需用户手动关闭。

### 5. 递归子代理自治 (Recursive Delegation)

自动模式中的 Cognitive 子代理可以自行迭代，也可以在深度策略允许时继续委派下级 worker。下级 worker 使用 `parentCognitiveTask` 上下文，避免重复写回父任务；父级子代理仍是唯一最终 writeback owner。

## 使用方法

### 开启方式

1. 打开侧边栏的 **Tasks (任务)** 面板。
2. 将顶部的 **Autopilot** 开关切换至 **ON**。
3. (可选) 将 **Parallelism (并行度)** 设置为 `4x` 或更高以获得最佳性能。

### 手动突破 (⚡ Breakthrough)

如果在极其罕见的情况下自动算法没有及时触发，您可以点击任务旁边的 **⚡** 图标。

- **作用**：无视一切前置依赖，强制将该任务推入执行队列。
- **场景**：当您确定某个阻塞是误报，或者急需优先处理某个特定分支时。

---

## 技术实现

- **心跳频率**：4000ms / 周期
- **委派租约**：超时自动回收 delegated node 并重新入队
- **单次最大分发**：10 节点
- **公共摘要**：`delegations.active` / `delegations.overdue`
- **核心逻辑位置**：`src/cognitive-os/task-os/orchestrator.ts`
