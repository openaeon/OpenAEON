import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";
import { getVisiblePlanTodos } from "./subagent-view-model.ts";

type PlanTodo = {
  id: string;
  title: string;
  status: string;
  result?: string;
  dependsOn?: string[];
  ownerAgent?: string;
};

export function renderStickyPlanBar(props: ChatLayoutProps) {
  const plan = props?.taskPlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const visibleTodos = getVisiblePlanTodos(plan);
  if (visibleTodos.length === 0) {
    return nothing;
  }
  const done = visibleTodos.filter((t) => t.status === "done").length;
  const total = visibleTodos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;
  const phase = plan.phase || "execution";

  const phaseSteps = [
    { key: "planning", icon: "⚲", label: "PLANNING" },
    { key: "execution", icon: "∿", label: "EXECUTION" },
    { key: "verification", icon: "⊗", label: "VERIFICATION" },
  ];

  return html`
    <div class="chat-plan-sticky fractal-sticky ${allDone ? "chat-plan-sticky--complete" : ""}">
      <span class="chat-plan-sticky__icon neo-icon">${allDone ? "❖" : "⟠"}</span>
      <span class="chat-plan-sticky__desc aeon-text-sm">${plan.description || "System Blueprint"}</span>
      <div class="chat-plan-sticky__phases matrix-phases">
        ${phaseSteps.map(
          (s) => html`
            <span class="chat-plan-phase matrix-phase ${phase === s.key ? "chat-plan-phase--active matrix-phase--active" : ""} ${phase === "complete" && s.key === "verification" ? "chat-plan-phase--active matrix-phase--active" : ""}">
              ${s.icon} ${s.label}
            </span>
          `,
        )}
      </div>
      <span class="chat-plan-sticky__stats data-numbers">${done}/${total} (${pct}%)</span>
      <div class="chat-plan-sticky__bar flux-bar">
        <div
          class="chat-plan-sticky__fill flux-fill ${allDone ? "chat-plan-sticky__fill--done flux-fill--done" : ""}"
          style="width: ${pct}%"
        ></div>
      </div>
      ${
        allDone
          ? html`
            <div class="chat-plan-confetti matrix-particles">
              ${Array.from(
                { length: 12 },
                (_, i) =>
                  html`<span class="chat-confetti-piece matrix-particle" style="--i:${i}; --x:${Math.random() * 100}; --delay:${Math.random() * 2}s; --color:${["#818cf8", "#10b981", "#c084fc", "#3b82f6", "#2dd4bf", "#6366f1"][i % 6]}"></span>`,
              )}
            </div>
          `
          : nothing
      }
    </div>
  `;
}

export function renderPlanSidebar(props: ChatLayoutProps) {
  const plan = props?.taskPlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  return renderPlanExecutionLayer(props, { wrapPanel: true });
}

export function renderPlanExecutionLayer(
  props: ChatLayoutProps,
  options?: { wrapPanel?: boolean },
) {
  const plan = props?.taskPlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const visibleTodos = getVisiblePlanTodos(plan);
  if (visibleTodos.length === 0) {
    return nothing;
  }
  const phase = plan.phase || "execution";
  const graph = plan.executionGraph;
  const blockedBy = graph?.blockedBy ?? {};
  const readySet = new Set(graph?.readyTodoIds ?? []);
  const blockedSet = new Set(graph?.blockedTodoIds ?? []);
  const isPlanning = phase === "planning";
  const done = visibleTodos.filter((t) => t.status === "done").length;
  const total = visibleTodos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const runtime = plan.taskRuntime;
  const latestCheckpointId = runtime?.latestCheckpointId ?? "";
  const latestCheckpointShort = latestCheckpointId ? latestCheckpointId.slice(0, 18) : "";
  const branches = Array.isArray(plan.branches) ? plan.branches : [];
  const checkpoints = Array.isArray(plan.checkpoints) ? plan.checkpoints : [];
  const recentCheckpoints = checkpoints.slice(-5).reverse();
  const dreams = Array.isArray(plan.dreams) ? plan.dreams : [];
  const verifierHistory = Array.isArray(plan.verifierHistory) ? plan.verifierHistory : [];
  const latestDream = dreams.length > 0 ? dreams[dreams.length - 1] : null;
  const latestVerifier =
    verifierHistory.length > 0 ? verifierHistory[verifierHistory.length - 1] : null;
  const graphEdges = props.taskPlanGraphEdges ?? [];
  const graphNodeId = props.taskPlanGraphNodeId ?? "";
  const graphRelation = props.taskPlanGraphRelation ?? "";
  const graphLoading = Boolean(props.taskPlanGraphLoading);
  const graphError = props.taskPlanGraphError ?? null;
  const graphAutoTrack = props.taskPlanGraphAutoTrack ?? true;
  const graphPageSize = Math.max(1, props.taskPlanGraphPageSize ?? 15);
  const graphPage = Math.max(1, props.taskPlanGraphPage ?? 1);
  const graphTrail = props.taskPlanGraphTrail ?? [];
  const graphExpandedRelation = props.taskPlanGraphExpandedRelation ?? "";
  const graphRelationOptions = Array.from(
    new Set((plan.graphEdges ?? []).map((edge) => edge.relation).filter(Boolean)),
  );
  const latestContextNodeId = latestDream?.dreamId
    ? `dream:${latestDream.dreamId}`
    : latestCheckpointId
      ? `checkpoint:${latestCheckpointId}`
      : "";
  const visibleTodoIdSet = new Set(visibleTodos.map((todo) => todo.id));
  const allTodoIds = new Set((Array.isArray(plan.todos) ? plan.todos : []).map((todo) => todo.id));
  const isFilteredTodoNode = (nodeId: string) => {
    const normalized = nodeId.trim();
    if (!normalized.startsWith("todo:")) {
      return false;
    }
    const todoId = normalized.slice("todo:".length).trim();
    if (!todoId) {
      return false;
    }
    if (!allTodoIds.has(todoId)) {
      return false;
    }
    return !visibleTodoIdSet.has(todoId);
  };
  const filteredGraphEdges = graphEdges.filter(
    (edge) => !isFilteredTodoNode(edge.from) && !isFilteredTodoNode(edge.to),
  );
  const graphRelationCounts = new Map<string, number>();
  for (const edge of filteredGraphEdges) {
    if (!edge.relation) {
      continue;
    }
    graphRelationCounts.set(edge.relation, (graphRelationCounts.get(edge.relation) ?? 0) + 1);
  }
  const relationChips =
    graphRelationCounts.size > 0
      ? Array.from(graphRelationCounts.entries())
      : graphRelationOptions.map((relation) => [relation, 0] as const);
  const filteredTotalGraphPages = Math.max(1, Math.ceil(filteredGraphEdges.length / graphPageSize));
  const filteredSafeGraphPage = Math.min(graphPage, filteredTotalGraphPages);
  const graphPageEdges = filteredGraphEdges.slice(
    (filteredSafeGraphPage - 1) * graphPageSize,
    filteredSafeGraphPage * graphPageSize,
  );
  const groupedGraphEdges = new Map<string, typeof graphPageEdges>();
  for (const edge of graphPageEdges) {
    const bucket = groupedGraphEdges.get(edge.relation) ?? [];
    bucket.push(edge);
    groupedGraphEdges.set(edge.relation, bucket);
  }
  const selectedNode = graphNodeId.trim();
  const selectedDreamId = selectedNode.startsWith("dream:")
    ? selectedNode.slice("dream:".length)
    : "";
  const selectedCheckpointId = selectedNode.startsWith("checkpoint:")
    ? selectedNode.slice("checkpoint:".length)
    : "";
  const focusedTodoId = props.taskPlanFocusTodoId ?? null;
  const jumpToGraphNode = (nodeId: string, relation?: string) => {
    const normalizedNodeId = nodeId.trim();
    if (!normalizedNodeId || !props.onQueryTaskGraph) {
      return;
    }
    const nextRelation = (relation ?? graphRelation).trim();
    props.onTaskGraphRelationChange?.(nextRelation);
    props.onTaskGraphExpandedRelationChange?.(nextRelation);
    props.onQueryTaskGraph({
      nodeId: normalizedNodeId,
      relation: nextRelation,
    });
  };

  const content = html`
      <div class="plan-sidebar-header matrix-header">
        <span class="plan-sidebar-title aeon-title">${t("chat.sidebarPlan")}</span>
        <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
      </div>

      ${plan.description ? html`<div class="plan-sidebar-desc data-desc">${plan.description}</div>` : nothing}

      <div class="plan-sidebar-progress matrix-progress">
        <div class="plan-sidebar-progress-row data-row">
          <span>PROGRESS / 进度</span>
          <span class="data-numbers">${done}/${total} (${pct}%)</span>
        </div>
        <div class="plan-sidebar-bar flux-bar flux-bar--large">
          <div class="plan-sidebar-fill flux-fill flux-fill--large" style="width: ${pct}%; background: ${done === total && total > 0 ? "linear-gradient(90deg, #10b981, #2dd4bf)" : "linear-gradient(90deg, #6366f1, #c084fc)"};"></div>
        </div>
      </div>

      ${
        runtime
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>BRANCH / 分支</span>
                  <span class="data-numbers">${runtime.currentBranchId}</span>
                </div>
                <div class="plan-sidebar-progress-row data-row">
                  <span>CHECKPOINTS / 检查点</span>
                  <span class="data-numbers">${runtime.checkpointsCount}</span>
                </div>
                <div class="plan-sidebar-progress-row data-row">
                  <span>LATEST / 最新</span>
                  <span class="data-numbers">${latestCheckpointShort || "none"}</span>
                </div>
              </div>
            `
          : nothing
      }

      ${
        latestDream
          ? html`
              <div
                class="plan-sidebar-progress matrix-progress"
                style=${
                  selectedDreamId && selectedDreamId === latestDream.dreamId
                    ? "outline:1px solid #818cf8;"
                    : ""
                }
              >
                <div class="plan-sidebar-progress-row data-row">
                  <span>DREAM / 梦境摘要</span>
                  <span class="data-numbers">${latestDream.dreamId.slice(0, 12)}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${latestDream.summary}
                  ${
                    props.onQueryTaskGraph
                      ? html`
                          <div style="margin-top:8px;">
                            <button
                              class="plan-sidebar-approve-btn neon-btn"
                              @click=${() =>
                                jumpToGraphNode(
                                  `dream:${latestDream.dreamId}`,
                                  "STAGE_GENERATES_DREAM",
                                )}
                            >
                              Trace Dream
                            </button>
                          </div>
                        `
                      : nothing
                  }
                </div>
              </div>
            `
          : nothing
      }

      ${
        latestVerifier
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>VERIFIER / 验证状态</span>
                  <span class="data-numbers">${latestVerifier.status}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">${latestVerifier.summary}</div>
              </div>
            `
          : nothing
      }

      ${
        branches.length > 0
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>BRANCHES / 分支树</span>
                  <span class="data-numbers">${branches.length}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${branches.map((branch) => {
                    const active = (runtime?.currentBranchId ?? plan.currentBranchId) === branch.id;
                    return html`
                      <button
                        class="plan-sidebar-approve-btn neon-btn"
                        style="margin:4px 6px 0 0;"
                        ?disabled=${active || !props.onSwitchBranch}
                        @click=${() => props.onSwitchBranch?.(branch.id)}
                        title=${active ? "Current branch" : `Switch to ${branch.id}`}
                      >
                        ${active ? "●" : "○"} ${branch.id}
                      </button>
                    `;
                  })}
                </div>
              </div>
            `
          : nothing
      }

      <div class="plan-sidebar-todos matrix-nodelist">
        ${visibleTodos.map(
          (todo) => html`
            <div
              class="plan-sidebar-todo-container matrix-node"
              style=${focusedTodoId && focusedTodoId === todo.id ? "outline:1px solid #818cf8;" : ""}
            >
              <div class="plan-sidebar-todo plan-sidebar-todo--${todo.status} matrix-node-box">
                <span class="plan-sidebar-todo-icon node-status-icon">${todo.status === "done" ? "❖" : todo.status === "in_progress" ? "∿" : "⚬"}</span>
                <span class="plan-sidebar-todo-text node-text">${todo.title}</span>
              </div>
              ${
                todo.status !== "done" && (readySet.has(todo.id) || blockedSet.has(todo.id))
                  ? html`
                    <div class="plan-sidebar-todo-result matrix-node-result">
                      <div class="plan-sidebar-todo-result-title aeon-subtitle">
                        ${readySet.has(todo.id) ? "READY" : "BLOCKED"}
                      </div>
                      <div class="plan-sidebar-todo-result-content data-text">
                        ${
                          readySet.has(todo.id)
                            ? "无依赖阻塞，可立即执行"
                            : `等待依赖: ${(blockedBy[todo.id] ?? []).join(", ")}`
                        }
                      </div>
                    </div>
                  `
                  : nothing
              }
              ${
                todo.status === "done" && todo.result
                  ? html`
                    <div class="plan-sidebar-todo-result matrix-node-result">
                      <div class="plan-sidebar-todo-result-title aeon-subtitle">${t("chat.sidebarResultTitle")}</div>
                      <div class="plan-sidebar-todo-result-content data-text">${todo.result}</div>
                    </div>
                  `
                  : nothing
              }
            </div>
          `,
        )}
      </div>
      ${
        focusedTodoId
          ? html`
              <div class="plan-sidebar-actions matrix-actions">
                <button
                  class="plan-sidebar-approve-btn neon-btn"
                  @click=${() => props.onTaskPlanFocusTodoChange?.(null)}
                >
                  Clear Todo Focus (${focusedTodoId})
                </button>
              </div>
            `
          : nothing
      }

      ${
        isPlanning && props.onApprovePlan
          ? html`
            <div class="plan-sidebar-actions matrix-actions">
              <button
                class="plan-sidebar-approve-btn neon-btn neon-btn--primary"
                @click=${() => props.onApprovePlan?.()}
              >
                Approve and Execute
              </button>
            </div>
          `
          : nothing
      }

      ${
        !isPlanning &&
        (props.onRetryPlanStage || props.onBranchFromCurrent || props.onRollbackToLatestCheckpoint)
          ? html`
              <div class="plan-sidebar-actions matrix-actions">
                ${
                  props.onRetryPlanStage
                    ? html`
                        <button
                          class="plan-sidebar-approve-btn neon-btn neon-btn--primary"
                          @click=${() => props.onRetryPlanStage?.()}
                        >
                          Retry Stage
                        </button>
                      `
                    : nothing
                }
                ${
                  props.onBranchFromCurrent
                    ? html`
                        <button
                          class="plan-sidebar-approve-btn neon-btn"
                          @click=${() => props.onBranchFromCurrent?.()}
                        >
                          Branch From Here
                        </button>
                      `
                    : nothing
                }
                ${
                  props.onRollbackToLatestCheckpoint && latestCheckpointId
                    ? html`
                        <button
                          class="plan-sidebar-approve-btn neon-btn"
                          @click=${() => props.onRollbackToLatestCheckpoint?.()}
                        >
                          Rollback Latest
                        </button>
                      `
                    : nothing
                }
              </div>
            `
          : done === total && total > 0
            ? html`
                <div class="plan-sidebar-actions plan-sidebar-complete matrix-complete">
                  ${t("sandbox.plan.allDone")}
                </div>
              `
            : nothing
      }

      ${
        props.onVerifierReport || props.onDistillDream
          ? html`
              <div class="plan-sidebar-actions matrix-actions">
                ${
                  props.onVerifierReport
                    ? html`
                        <button
                          class="plan-sidebar-approve-btn neon-btn neon-btn--primary"
                          @click=${() => props.onVerifierReport?.("passed")}
                        >
                          Mark Verified
                        </button>
                        <button
                          class="plan-sidebar-approve-btn neon-btn"
                          @click=${() => props.onVerifierReport?.("failed")}
                        >
                          Mark Failed
                        </button>
                      `
                    : nothing
                }
                ${
                  props.onDistillDream
                    ? html`
                        <button
                          class="plan-sidebar-approve-btn neon-btn"
                          @click=${() => props.onDistillDream?.()}
                        >
                          Distill Dream
                        </button>
                      `
                    : nothing
                }
              </div>
            `
          : nothing
      }

      ${
        props.onQueryTaskGraph || graphEdges.length > 0
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>GRAPH / 关系追踪</span>
                  <span class="data-numbers">${graphLoading ? "loading" : `${graphEdges.length}`}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  <input
                    type="text"
                    placeholder="node id (task/stage/checkpoint/dream)"
                    .value=${graphNodeId}
                    style="width:100%;margin:4px 0 8px 0;padding:6px 8px;border-radius:8px;"
                    @input=${(event: Event) =>
                      props.onTaskGraphNodeIdChange?.((event.target as HTMLInputElement).value)}
                  />
                  <select
                    .value=${graphRelation}
                    style="width:100%;margin:0 0 8px 0;padding:6px 8px;border-radius:8px;"
                    @change=${(event: Event) =>
                      props.onTaskGraphRelationChange?.((event.target as HTMLSelectElement).value)}
                  >
                    <option value="">All relations</option>
                    ${graphRelationOptions.map(
                      (relation) => html`<option value=${relation}>${relation}</option>`,
                    )}
                  </select>
                  <div>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryTaskGraph || graphLoading}
                      @click=${() =>
                        props.onQueryTaskGraph?.({
                          nodeId: graphNodeId,
                          relation: graphRelation,
                        })}
                    >
                      Query Graph
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onTaskGraphAutoTrackChange}
                      @click=${() => props.onTaskGraphAutoTrackChange?.(!graphAutoTrack)}
                    >
                      Auto Track: ${graphAutoTrack ? "ON" : "OFF"}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryTaskGraph || graphLoading || !latestCheckpointId}
                      @click=${() =>
                        props.onQueryTaskGraph?.({
                          nodeId: `checkpoint:${latestCheckpointId}`,
                          relation: graphRelation,
                        })}
                    >
                      From Checkpoint
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryTaskGraph || graphLoading || !latestDream?.dreamId}
                      @click=${() =>
                        props.onQueryTaskGraph?.({
                          nodeId: latestDream?.dreamId ? `dream:${latestDream.dreamId}` : "",
                          relation: graphRelation,
                        })}
                    >
                      From Dream
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryTaskGraph || graphLoading || !latestContextNodeId}
                      @click=${() =>
                        props.onQueryTaskGraph?.({
                          nodeId: latestContextNodeId,
                          relation: graphRelation,
                        })}
                    >
                      Latest Context
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onClearTaskGraph}
                      @click=${() => props.onClearTaskGraph?.()}
                    >
                      Clear
                    </button>
                  </div>
                  ${
                    graphTrail.length > 0
                      ? html`
                          <div style="margin-top:8px;">
                            ${graphTrail.map(
                              (nodeId, index) => html`
                              <button
                                class="plan-sidebar-approve-btn neon-btn"
                                style=${`margin:4px 6px 0 0;padding:2px 6px;${index === graphTrail.length - 1 ? "outline:1px solid #818cf8;" : ""}`}
                                ?disabled=${!props.onTaskGraphTrailJump || graphLoading}
                                @click=${() => props.onTaskGraphTrailJump?.(nodeId, index)}
                              >
                                ${nodeId}
                              </button>
                            `,
                            )}
                          </div>
                        `
                      : nothing
                  }
                  ${
                    graphError
                      ? html`<div style="margin-top:8px;color:#f87171;">${graphError}</div>`
                      : nothing
                  }
                  ${
                    relationChips.length > 0
                      ? html`
                          <div style="margin-top:8px;">
                            ${relationChips.slice(0, 10).map(([relation, count]) => {
                              const active = graphRelation === relation;
                              return html`
                                <button
                                  class="plan-sidebar-approve-btn neon-btn"
                                  style="margin:4px 6px 0 0;${active ? "outline:1px solid #818cf8;" : ""}"
                                  ?disabled=${!props.onQueryTaskGraph || graphLoading}
                                  @click=${() => {
                                    props.onTaskGraphRelationChange?.(relation);
                                    props.onTaskGraphExpandedRelationChange?.(relation);
                                    props.onQueryTaskGraph?.({
                                      nodeId: graphNodeId || latestContextNodeId,
                                      relation,
                                    });
                                  }}
                                >
                                  ${relation}${count > 0 ? ` (${count})` : ""}
                                </button>
                              `;
                            })}
                            ${
                              graphRelation
                                ? html`
                                    <button
                                      class="plan-sidebar-approve-btn neon-btn"
                                      style="margin:4px 6px 0 0;"
                                      ?disabled=${!props.onQueryTaskGraph || graphLoading}
                                      @click=${() => {
                                        props.onTaskGraphRelationChange?.("");
                                        props.onTaskGraphExpandedRelationChange?.("");
                                        props.onQueryTaskGraph?.({
                                          nodeId: graphNodeId || latestContextNodeId,
                                          relation: "",
                                        });
                                      }}
                                    >
                                      Clear Relation
                                    </button>
                                  `
                                : nothing
                            }
                          </div>
                        `
                      : nothing
                  }
                  ${
                    graphEdges.length > 0
                      ? html`
                          ${Array.from(groupedGraphEdges.entries()).map(
                            ([relation, edges]) => html`
                            <details
                              ?open=${!graphExpandedRelation || graphExpandedRelation === relation}
                              @toggle=${(event: Event) => {
                                const target = event.target as HTMLDetailsElement;
                                if (target.open) {
                                  props.onTaskGraphExpandedRelationChange?.(relation);
                                } else if (graphExpandedRelation === relation) {
                                  props.onTaskGraphExpandedRelationChange?.("");
                                }
                              }}
                              style="margin-top:6px;"
                            >
                              <summary style="cursor:pointer;">${relation} (${edges.length})</summary>
                              ${edges.map((edge) => {
                                const stamp = new Date(edge.at).toLocaleTimeString([], {
                                  hour12: false,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                });
                                return html`
                                  <div style="margin-top:6px;">
                                    [${stamp}]
                                    <button
                                      class="plan-sidebar-approve-btn neon-btn"
                                      style="margin:0 6px 0 0;padding:2px 6px;"
                                      ?disabled=${!props.onQueryTaskGraph || graphLoading}
                                      @click=${() => jumpToGraphNode(edge.from, relation)}
                                    >
                                      ${edge.from}
                                    </button>
                                    →
                                    <span style="margin:0 6px;">${edge.relation}</span>
                                    →
                                    <button
                                      class="plan-sidebar-approve-btn neon-btn"
                                      style="margin:0 0 0 6px;padding:2px 6px;"
                                      ?disabled=${!props.onQueryTaskGraph || graphLoading}
                                      @click=${() => jumpToGraphNode(edge.to, relation)}
                                    >
                                      ${edge.to}
                                    </button>
                                  </div>
                                `;
                              })}
                            </details>
                          `,
                          )}
                          <div style="margin-top:8px;">
                            <button
                              class="plan-sidebar-approve-btn neon-btn"
                              style="margin:4px 6px 0 0;"
                              ?disabled=${!props.onTaskGraphPageChange || filteredSafeGraphPage <= 1 || graphLoading}
                              @click=${() => props.onTaskGraphPageChange?.(filteredSafeGraphPage - 1)}
                            >
                              Prev
                            </button>
                            <span class="data-numbers" style="margin-right:6px;">${filteredSafeGraphPage}/${filteredTotalGraphPages}</span>
                            <button
                              class="plan-sidebar-approve-btn neon-btn"
                              style="margin:4px 6px 0 0;"
                              ?disabled=${!props.onTaskGraphPageChange || filteredSafeGraphPage >= filteredTotalGraphPages || graphLoading}
                              @click=${() => props.onTaskGraphPageChange?.(filteredSafeGraphPage + 1)}
                            >
                              Next
                            </button>
                          </div>
                        `
                      : html`
                          <div style="margin-top: 8px">No graph edges queried.</div>
                        `
                  }
                </div>
              </div>
            `
          : nothing
      }

      ${
        recentCheckpoints.length > 0 && props.onRestoreCheckpoint
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>RESTORE / 历史恢复</span>
                  <span class="data-numbers">${recentCheckpoints.length} recent</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${recentCheckpoints.map((checkpoint) => {
                    const shortId = checkpoint.checkpointId.slice(0, 18);
                    return html`
                      ${
                        props.onQueryTaskGraph
                          ? html`
                              <button
                                class="plan-sidebar-approve-btn neon-btn"
                                style=${`margin:4px 6px 0 0;${selectedCheckpointId && selectedCheckpointId === checkpoint.checkpointId ? "outline:1px solid #818cf8;" : ""}`}
                                @click=${() =>
                                  jumpToGraphNode(
                                    `checkpoint:${checkpoint.checkpointId}`,
                                    "STAGE_HAS_CHECKPOINT",
                                  )}
                                title=${`trace checkpoint=${checkpoint.checkpointId}`}
                              >
                                Trace ${shortId}
                              </button>
                            `
                          : nothing
                      }
                      <button
                        class="plan-sidebar-approve-btn neon-btn"
                        style=${`margin:4px 6px 0 0;${selectedCheckpointId && selectedCheckpointId === checkpoint.checkpointId ? "outline:1px solid #818cf8;" : ""}`}
                        @click=${() => props.onRestoreCheckpoint?.(checkpoint.checkpointId)}
                        title=${`stage=${checkpoint.stageId} branch=${checkpoint.branchId} reason=${checkpoint.reason}`}
                      >
                        Restore ${shortId}
                      </button>
                    `;
                  })}
                </div>
              </div>
            `
          : nothing
      }

      ${
        recentCheckpoints.length > 0
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>OPERATIONS / 操作日志</span>
                  <span class="data-numbers">${recentCheckpoints.length}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${recentCheckpoints.map((checkpoint) => {
                    const stamp = new Date(checkpoint.createdAt).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    return html`
                      <div style="margin-top:4px;">
                        [${stamp}] ${checkpoint.reason} · ${checkpoint.stageId} · ${checkpoint.branchId}
                      </div>
                    `;
                  })}
                </div>
              </div>
            `
          : nothing
      }
  `;
  if (options?.wrapPanel === false) {
    return content;
  }
  return html`<div class="plan-sidebar-panel fractal-panel">${content}</div>`;
}
