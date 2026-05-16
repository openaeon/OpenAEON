import type {
  CognitiveInvariantReport,
  CognitiveMemoryTrace,
  CognitiveStateProjection,
  CognitiveTaskStatus,
  ReflectionRecord,
  TaskTree,
} from "../contracts/types.js";

export type CognitiveTaskRecord = {
  id: string;
  sessionKey: string;
  title: string;
  input: string;
  status: CognitiveTaskStatus;
  tree: TaskTree;
  reflections: ReflectionRecord[];
  stateProjection?: CognitiveStateProjection;
  invariantReport?: CognitiveInvariantReport;
  memoryTrace?: CognitiveMemoryTrace;
  runIds: string[];
  createdAt: number;
  updatedAt: number;
  version: number;
};
