import { MAX_BUFFERED_BYTES } from "./server-constants.js";
import type { GatewayWsClient } from "./server/ws-types.js";
import { logWs, shouldLogWs, summarizeAgentEventForWsLog } from "./ws-log.js";

const ADMIN_SCOPE = "operator.admin";
const APPROVALS_SCOPE = "operator.approvals";
const PAIRING_SCOPE = "operator.pairing";

const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "exec.approval.resolved": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
  "device.pair.resolved": [PAIRING_SCOPE],
  "node.pair.requested": [PAIRING_SCOPE],
  "node.pair.resolved": [PAIRING_SCOPE],
};

export type GatewayLaneType = "chat_lane" | "agent_lane" | "tool_lane";

export type GatewayLanePolicy = {
  maxInFlight?: number;
  queueLimit?: number;
  timeoutMs?: number;
  retryBudget?: number;
  dropIfSlow?: boolean;
};

export type GatewayLaneConfig = Partial<Record<GatewayLaneType, GatewayLanePolicy>>;

export type GatewayLaneSnapshot = {
  laneType: GatewayLaneType;
  queueLength: number;
  inFlight: number;
  avgDispatchMs: number;
  dropped: number;
  retries: number;
  degraded: boolean;
  degradedReason: string | null;
  updatedAt: number;
};

export type GatewayBroadcastStateVersion = {
  presence?: number;
  health?: number;
};

export type GatewayBroadcastOpts = {
  dropIfSlow?: boolean;
  stateVersion?: GatewayBroadcastStateVersion;
};

export type GatewayBroadcastFn = (
  event: string,
  payload: unknown,
  opts?: GatewayBroadcastOpts,
) => void;

export type GatewayBroadcastToConnIdsFn = (
  event: string,
  payload: unknown,
  connIds: ReadonlySet<string>,
  opts?: GatewayBroadcastOpts,
) => void;

function hasEventScope(client: GatewayWsClient, event: string): boolean {
  const required = EVENT_SCOPE_GUARDS[event];
  if (!required) {
    return true;
  }
  const role = client.connect.role ?? "operator";
  if (role !== "operator") {
    return false;
  }
  const scopes = Array.isArray(client.connect.scopes) ? client.connect.scopes : [];
  if (scopes.includes(ADMIN_SCOPE)) {
    return true;
  }
  return required.some((scope) => scopes.includes(scope));
}

export function createGatewayBroadcaster(params: {
  clients: Set<GatewayWsClient>;
  lanes?: GatewayLaneConfig;
}) {
  let seq = 0;
  const lanePriority: GatewayLaneType[] = ["tool_lane", "agent_lane", "chat_lane"];
  const laneDefaults: Record<GatewayLaneType, Required<GatewayLanePolicy>> = {
    tool_lane: {
      maxInFlight: 2,
      queueLimit: 256,
      timeoutMs: 20_000,
      retryBudget: 1,
      dropIfSlow: false,
    },
    agent_lane: {
      maxInFlight: 1,
      queueLimit: 256,
      timeoutMs: 20_000,
      retryBudget: 1,
      dropIfSlow: false,
    },
    chat_lane: {
      maxInFlight: 1,
      queueLimit: 512,
      timeoutMs: 20_000,
      retryBudget: 0,
      dropIfSlow: true,
    },
  };
  const configuredLanes = normalizeLaneConfig(params.lanes);
  const laneState = new Map<GatewayLaneType, GatewayLaneSnapshot>(
    lanePriority.map((laneType) => [
      laneType,
      {
        laneType,
        queueLength: 0,
        inFlight: 0,
        avgDispatchMs: 0,
        dropped: 0,
        retries: 0,
        degraded: false,
        degradedReason: null,
        updatedAt: Date.now(),
      },
    ]),
  );
  const laneQueued = new Map<GatewayLaneType, number>(lanePriority.map((laneType) => [laneType, 0]));

  function normalizeLaneConfig(config?: GatewayLaneConfig): Record<GatewayLaneType, Required<GatewayLanePolicy>> {
    return {
      tool_lane: {
        ...laneDefaults.tool_lane,
        ...(config?.tool_lane ?? {}),
      },
      agent_lane: {
        ...laneDefaults.agent_lane,
        ...(config?.agent_lane ?? {}),
      },
      chat_lane: {
        ...laneDefaults.chat_lane,
        ...(config?.chat_lane ?? {}),
      },
    };
  }

  function classifyLane(event: string): GatewayLaneType {
    if (event === "agent" || event.startsWith("tool.")) {
      return "tool_lane";
    }
    if (
      event.startsWith("task_plan.") ||
      event.startsWith("exec.approval.") ||
      event.startsWith("node.") ||
      event === "device.pair.requested" ||
      event === "device.pair.resolved"
    ) {
      return "agent_lane";
    }
    return "chat_lane";
  }

  function updateLaneSnapshot(
    laneType: GatewayLaneType,
    patch: Partial<Omit<GatewayLaneSnapshot, "laneType">>,
  ): void {
    const current = laneState.get(laneType);
    if (!current) {
      return;
    }
    laneState.set(laneType, {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    });
  }

  const broadcastInternal = (
    event: string,
    payload: unknown,
    opts?: GatewayBroadcastOpts,
    targetConnIds?: ReadonlySet<string>,
  ) => {
    if (params.clients.size === 0) {
      return;
    }
    const laneType = classifyLane(event);
    const lanePolicy = configuredLanes[laneType];
    const isTargeted = Boolean(targetConnIds);
    const queuedNow = (laneQueued.get(laneType) ?? 0) + 1;
    laneQueued.set(laneType, queuedNow);
    updateLaneSnapshot(laneType, { queueLength: queuedNow });
    if (queuedNow > lanePolicy.queueLimit) {
      updateLaneSnapshot(laneType, {
        dropped: (laneState.get(laneType)?.dropped ?? 0) + 1,
        degraded: true,
        degradedReason: "queue_limit_exceeded",
      });
      laneQueued.set(laneType, Math.max(0, queuedNow - 1));
      updateLaneSnapshot(laneType, {
        queueLength: laneQueued.get(laneType) ?? 0,
      });
      return;
    }
    const currentInFlight = laneState.get(laneType)?.inFlight ?? 0;
    if (currentInFlight >= lanePolicy.maxInFlight) {
      const shouldDrop = opts?.dropIfSlow ?? lanePolicy.dropIfSlow;
      if (shouldDrop) {
        updateLaneSnapshot(laneType, {
          dropped: (laneState.get(laneType)?.dropped ?? 0) + 1,
          degraded: true,
          degradedReason: "max_inflight_exceeded",
        });
        laneQueued.set(laneType, Math.max(0, queuedNow - 1));
        updateLaneSnapshot(laneType, {
          queueLength: laneQueued.get(laneType) ?? 0,
        });
        return;
      }
      updateLaneSnapshot(laneType, {
        degraded: true,
        degradedReason: "max_inflight_exceeded_no_drop",
      });
    }
    updateLaneSnapshot(laneType, {
      inFlight: currentInFlight + 1,
    });
    const dispatchStartedAt = Date.now();
    const eventSeq = isTargeted ? undefined : ++seq;
    const frame = JSON.stringify({
      type: "event",
      event,
      payload,
      seq: eventSeq,
      stateVersion: opts?.stateVersion,
    });
    if (shouldLogWs()) {
      const logMeta: Record<string, unknown> = {
        event,
        seq: eventSeq ?? "targeted",
        clients: params.clients.size,
        targets: targetConnIds ? targetConnIds.size : undefined,
        dropIfSlow: opts?.dropIfSlow,
        laneType,
        presenceVersion: opts?.stateVersion?.presence,
        healthVersion: opts?.stateVersion?.health,
      };
      if (event === "agent") {
        Object.assign(logMeta, summarizeAgentEventForWsLog(payload));
      }
      logWs("out", "event", logMeta);
    }
    for (const c of params.clients) {
      if (targetConnIds && !targetConnIds.has(c.connId)) {
        continue;
      }
      if (!hasEventScope(c, event)) {
        continue;
      }
      const slow = c.socket.bufferedAmount > MAX_BUFFERED_BYTES;
      const dropIfSlow = opts?.dropIfSlow ?? lanePolicy.dropIfSlow;
      if (slow && dropIfSlow) {
        updateLaneSnapshot(laneType, {
          dropped: (laneState.get(laneType)?.dropped ?? 0) + 1,
        });
        continue;
      }
      if (slow) {
        try {
          c.socket.close(1008, "slow consumer");
        } catch {
          /* ignore */
        }
        continue;
      }
      try {
        c.socket.send(frame);
      } catch {
        const retries = laneState.get(laneType)?.retries ?? 0;
        if (lanePolicy.retryBudget > 0 && retries < lanePolicy.retryBudget) {
          updateLaneSnapshot(laneType, { retries: retries + 1 });
          try {
            c.socket.send(frame);
          } catch {
            updateLaneSnapshot(laneType, {
              degraded: true,
              degradedReason: "send_failed_after_retry",
            });
          }
        } else {
          updateLaneSnapshot(laneType, {
            degraded: true,
            degradedReason: "send_failed_no_retry_budget",
          });
        }
      }
    }
    const dispatchMs = Date.now() - dispatchStartedAt;
    const currentAvg = laneState.get(laneType)?.avgDispatchMs ?? 0;
    const nextAvg = currentAvg <= 0 ? dispatchMs : currentAvg * 0.8 + dispatchMs * 0.2;
    const inflightNow = laneState.get(laneType)?.inFlight ?? 0;
    const queuedAfter = Math.max(0, (laneQueued.get(laneType) ?? 1) - 1);
    laneQueued.set(laneType, queuedAfter);
    updateLaneSnapshot(laneType, {
      inFlight: Math.max(0, inflightNow - 1),
      avgDispatchMs: nextAvg,
      queueLength: queuedAfter,
    });
  };

  const broadcast: GatewayBroadcastFn = (event, payload, opts) =>
    broadcastInternal(event, payload, opts);

  const broadcastToConnIds: GatewayBroadcastToConnIdsFn = (event, payload, connIds, opts) => {
    if (connIds.size === 0) {
      return;
    }
    broadcastInternal(event, payload, opts, connIds);
  };
  const getLaneSnapshots = (): GatewayLaneSnapshot[] =>
    lanePriority
      .map((laneType) => laneState.get(laneType))
      .filter((entry): entry is GatewayLaneSnapshot => entry != null)
      .map((entry) => ({ ...entry }));

  return { broadcast, broadcastToConnIds, getLaneSnapshots };
}
