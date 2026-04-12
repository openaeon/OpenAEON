import type { DreamRecord, ReflectionRecord } from "../contracts/types.js";
import { distillDreamRecord } from "./dream-loop.js";
import { buildReflectionRecord } from "./reflection-loop.js";
import { optimizeStrategy } from "./strategy-optimizer.js";

export class CognitionService {
  reflect(params: {
    taskId: string;
    nodeId?: string;
    output: string;
    success: boolean;
  }): ReflectionRecord {
    return buildReflectionRecord(params);
  }

  dream(params: { taskId: string; reflections: ReflectionRecord[]; sourceRunIds: string[] }): {
    dream: DreamRecord;
    strategy: ReturnType<typeof optimizeStrategy>;
  } {
    const dream = distillDreamRecord(params);
    const strategy = optimizeStrategy({ reflections: params.reflections, dream });
    return { dream, strategy };
  }
}
