import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";
import { getVisibleCognitivePlanTodos } from "./subagent-view-model.ts";

type PlanTodo = {
  id: string;
  title: string;
  status: string;
  result?: string;
  dependsOn?: string[];
  ownerAgent?: string;
};

export function renderStickyPlanBar(props: ChatLayoutProps) {
  const plan = props?.cognitivePlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const visibleTodos = getVisibleCognitivePlanTodos(plan);
  if (visibleTodos.length === 0) {
    return nothing;
  }
  const done = visibleTodos.filter((t) => t.status === "done").length;
  const total = visibleTodos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;
  const phase = plan.phase || "execution";

  const phaseSteps = [
    { key: "planning", icon: "⚲", label: t("sandbox.plan.phasePlanning") },
    { key: "execution", icon: "∿", label: t("sandbox.plan.phaseExecution") },
    { key: "verification", icon: "⊗", label: t("sandbox.plan.phaseVerification") },
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
  const plan = props?.cognitivePlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  return renderPlanExecutionLayer(props, { wrapPanel: true });
}

export function renderPlanExecutionLayer(
  props: ChatLayoutProps,
  options?: { wrapPanel?: boolean },
) {
  const plan = props?.cognitivePlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const visibleTodos = getVisibleCognitivePlanTodos(plan);
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
  const graphEdges = props.cognitivePlanGraphEdges ?? [];
  const graphNodeId = props.cognitivePlanGraphNodeId ?? "";
  const graphRelation = props.cognitivePlanGraphRelation ?? "";
  const graphLoading = Boolean(props.cognitivePlanGraphLoading);
  const graphError = props.cognitivePlanGraphError ?? null;
  const graphAutoTrack = props.cognitivePlanGraphAutoTrack ?? true;
  const graphPageSize = Math.max(1, props.cognitivePlanGraphPageSize ?? 15);
  const graphPage = Math.max(1, props.cognitivePlanGraphPage ?? 1);
  const graphTrail = props.cognitivePlanGraphTrail ?? [];
  const graphExpandedRelation = props.cognitivePlanGraphExpandedRelation ?? "";
  const graphSourceBreadcrumb = props.cognitivePlanGraphSourceBreadcrumb ?? null;
  const graphSourceMemory = props.cognitivePlanGraphSourceMemory ?? null;
  const graphSourceSelectedLine = props.cognitivePlanGraphSourceSelectedLine ?? null;
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
  const focusedTodoId = props.cognitivePlanFocusTodoId ?? null;
  const jumpToGraphNode = (nodeId: string, relation?: string) => {
    const normalizedNodeId = nodeId.trim();
    if (!normalizedNodeId || !props.onQueryCognitivePlanGraph) {
      return;
    }
    const nextRelation = (relation ?? graphRelation).trim();
    props.onCognitivePlanGraphRelationChange?.(nextRelation);
    props.onCognitivePlanGraphExpandedRelationChange?.(nextRelation);
    props.onQueryCognitivePlanGraph({
      nodeId: normalizedNodeId,
      relation: nextRelation,
    });
  };
  const renderChip = (label: string, title?: string, onClick?: () => void) =>
    onClick
      ? html`
          <button
            type="button"
            class="plan-sidebar-approve-btn neon-btn"
            style="display:inline-flex;align-items:center;margin:4px 6px 0 0;padding:2px 8px;"
            title=${title ?? label}
            @click=${onClick}
          >
            ${label}
          </button>
        `
      : html`
          <span
            class="plan-sidebar-approve-btn neon-btn"
            style="display:inline-flex;align-items:center;margin:4px 6px 0 0;padding:2px 8px;cursor:default;"
            title=${title ?? label}
          >
            ${label}
          </span>
        `;

  const content = html`
      <div class="plan-sidebar-header matrix-header">
        <span class="plan-sidebar-title aeon-title">${t("chat.sidebarPlan")}</span>
        <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
      </div>

      ${plan.description ? html`<div class="plan-sidebar-desc data-desc">${plan.description}</div>` : nothing}

      <div class="plan-sidebar-progress matrix-progress">
        <div class="plan-sidebar-progress-row data-row">
          <span>${t("chat.progress").toUpperCase()} / ${t("chat.progress")}</span>
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
                  <span>${t("chat.branch").toUpperCase()} / ${t("chat.branch")}</span>
                  <span class="data-numbers">${runtime.currentBranchId}</span>
                </div>
                <div class="plan-sidebar-progress-row data-row">
                  <span>${t("chat.checkpoints").toUpperCase()} / ${t("chat.checkpoints")}</span>
                  <span class="data-numbers">${runtime.checkpointsCount}</span>
                </div>
                <div class="plan-sidebar-progress-row data-row">
                  <span>${t("chat.latest").toUpperCase()} / ${t("chat.latest")}</span>
                  <span class="data-numbers">${latestCheckpointShort || t("common.none")}</span>
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
                  <span>${t("chat.dream").toUpperCase()} / ${t("chat.dream")}摘要</span>
                  <span class="data-numbers">${latestDream.dreamId.slice(0, 12)}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${latestDream.summary}
                  ${
                    props.onQueryCognitivePlanGraph
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
                              ${t("chat.traceDream")}
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
                  <span>${t("chat.verifier").toUpperCase()} / ${t("chat.verifier")}状态</span>
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
                  <span>${t("chat.branches").toUpperCase()} / ${t("chat.branches")}</span>
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
                        ${readySet.has(todo.id) ? t("chat.readyTask") : t("chat.blockedTask")}
                      </div>
                      <div class="plan-sidebar-todo-result-content data-text">
                        ${
                          readySet.has(todo.id)
                            ? t("chat.readyTaskHint")
                            : t("chat.blockedTaskHint", {
                                deps: (blockedBy[todo.id] ?? []).join(", "),
                              })
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
                  @click=${() => props.onCognitivePlanFocusTodoChange?.(null)}
                >
                  ${t("chat.clear")} Todo Focus (${focusedTodoId})
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
                ${t("chat.approveAndExecute")}
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
                          ${t("chat.retryStage")}
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
                          ${t("chat.branchFromHere")}
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
                          ${t("chat.rollbackLatest")}
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
                          ${t("chat.markVerified")}
                        </button>
                        <button
                          class="plan-sidebar-approve-btn neon-btn"
                          @click=${() => props.onVerifierReport?.("failed")}
                        >
                          ${t("chat.markFailed")}
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
                          ${t("chat.distillDream")}
                        </button>
                      `
                    : nothing
                }
              </div>
            `
          : nothing
      }

      ${
        graphSourceBreadcrumb
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>${t("chat.source").toUpperCase()} / ${t("chat.source")}</span>
                  <span class="data-numbers">breadcrumb</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  ${renderChip(
                    `Memory Match · ${graphSourceBreadcrumb}`,
                    graphSourceBreadcrumb,
                    () =>
                      props.onOpenSidebar?.(
                        `# Graph Source Breadcrumb\n\n- Origin: \`${graphSourceBreadcrumb}\`\n- This trace came from a memory/source selection and is currently reflected in the graph trail.\n`,
                      ),
                  )}
                  <div style="margin-top:6px;" class="data-text">
                    ${graphSourceSelectedLine ? `Focused line: ${graphSourceSelectedLine}` : "Focused line: source start"}
                  </div>
                  <div style="margin-top:8px;">
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!graphSourceMemory || !props.onOpenCognitiveSource}
                      @click=${() => props.onOpenCognitiveSource?.()}
                    >
                      ${t("chat.openSource")}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!graphSourceMemory || !props.onReopenCognitiveMemory}
                      @click=${() => props.onReopenCognitiveMemory?.()}
                    >
                      ${t("chat.reopenMemory")}
                    </button>
                  </div>
                </div>
              </div>
            `
          : nothing
      }

      ${
        props.onQueryCognitivePlanGraph || graphEdges.length > 0
          ? html`
              <div class="plan-sidebar-progress matrix-progress">
                <div class="plan-sidebar-progress-row data-row">
                  <span>${t("chat.graph").toUpperCase()} / ${t("chat.graph")}</span>
                  <span class="data-numbers">${graphLoading ? t("common.loading") : `${graphEdges.length}`}</span>
                </div>
                <div class="plan-sidebar-todo-result-content data-text">
                  <input
                    type="text"
                    placeholder="${t("chat.searchAgentsPlaceholder")}"
                    .value=${graphNodeId}
                    style="width:100%;margin:4px 0 8px 0;padding:6px 8px;border-radius:8px;"
                    @input=${(event: Event) =>
                      props.onCognitivePlanGraphNodeIdChange?.(
                        (event.target as HTMLInputElement).value,
                      )}
                  />
                  <select
                    .value=${graphRelation}
                    style="width:100%;margin:0 0 8px 0;padding:6px 8px;border-radius:8px;"
                    @change=${(event: Event) =>
                      props.onCognitivePlanGraphRelationChange?.(
                        (event.target as HTMLSelectElement).value,
                      )}
                  >
                    <option value="">${t("chat.allRelations")}</option>
                    ${graphRelationOptions.map(
                      (relation) => html`<option value=${relation}>${relation}</option>`,
                    )}
                  </select>
                  <div>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading}
                      @click=${() =>
                        props.onQueryCognitivePlanGraph?.({
                          nodeId: graphNodeId,
                          relation: graphRelation,
                        })}
                    >
                      ${t("chat.queryGraph")}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onCognitivePlanGraphAutoTrackChange}
                      @click=${() => props.onCognitivePlanGraphAutoTrackChange?.(!graphAutoTrack)}
                    >
                      ${t("chat.autoTrack")}: ${graphAutoTrack ? "ON" : "OFF"}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading || !latestCheckpointId}
                      @click=${() =>
                        props.onQueryCognitivePlanGraph?.({
                          nodeId: `checkpoint:${latestCheckpointId}`,
                          relation: graphRelation,
                        })}
                    >
                      ${t("chat.fromCheckpoint")}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading || !latestDream?.dreamId}
                      @click=${() =>
                        props.onQueryCognitivePlanGraph?.({
                          nodeId: latestDream?.dreamId ? `dream:${latestDream.dreamId}` : "",
                          relation: graphRelation,
                        })}
                    >
                      ${t("chat.fromDream")}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading || !latestContextNodeId}
                      @click=${() =>
                        props.onQueryCognitivePlanGraph?.({
                          nodeId: latestContextNodeId,
                          relation: graphRelation,
                        })}
                    >
                      ${t("chat.latestContext")}
                    </button>
                    <button
                      class="plan-sidebar-approve-btn neon-btn"
                      style="margin:4px 6px 0 0;"
                      ?disabled=${!props.onClearCognitivePlanGraph}
                      @click=${() => props.onClearCognitivePlanGraph?.()}
                    >
                      ${t("chat.clear")}
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
                                ?disabled=${!props.onCognitivePlanGraphTrailJump || graphLoading}
                                @click=${() => props.onCognitivePlanGraphTrailJump?.(nodeId, index)}
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
                                  ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading}
                                  @click=${() => {
                                    props.onCognitivePlanGraphRelationChange?.(relation);
                                    props.onCognitivePlanGraphExpandedRelationChange?.(relation);
                                    props.onQueryCognitivePlanGraph?.({
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
                                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading}
                                      @click=${() => {
                                        props.onCognitivePlanGraphRelationChange?.("");
                                        props.onCognitivePlanGraphExpandedRelationChange?.("");
                                        props.onQueryCognitivePlanGraph?.({
                                          nodeId: graphNodeId || latestContextNodeId,
                                          relation: "",
                                        });
                                      }}
                                    >
                                      ${t("chat.clearRelation")}
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
                                  props.onCognitivePlanGraphExpandedRelationChange?.(relation);
                                } else if (graphExpandedRelation === relation) {
                                  props.onCognitivePlanGraphExpandedRelationChange?.("");
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
                                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading}
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
                                      ?disabled=${!props.onQueryCognitivePlanGraph || graphLoading}
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
                              ?disabled=${!props.onCognitivePlanGraphPageChange || filteredSafeGraphPage <= 1 || graphLoading}
                              @click=${() => props.onCognitivePlanGraphPageChange?.(filteredSafeGraphPage - 1)}
                            >
                              ${t("chat.prev")}
                            </button>
                            <span class="data-numbers" style="margin-right:6px;">${filteredSafeGraphPage}/${filteredTotalGraphPages}</span>
                            <button
                              class="plan-sidebar-approve-btn neon-btn"
                              style="margin:4px 6px 0 0;"
                              ?disabled=${!props.onCognitivePlanGraphPageChange || filteredSafeGraphPage >= filteredTotalGraphPages || graphLoading}
                              @click=${() => props.onCognitivePlanGraphPageChange?.(filteredSafeGraphPage + 1)}
                            >
                              ${t("chat.next")}
                            </button>
                          </div>
                        `
                      : html`
                          <div style="margin-top: 8px">${t("chat.noGraphEdges")}</div>
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
                        props.onQueryCognitivePlanGraph
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
