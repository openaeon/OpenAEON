import type { AnyAgentTool } from "../common.js";
import { createEntropyCalculatorTool } from "./entropycalculator-tool.js";

export const EVOLVED_TOOLS: AnyAgentTool[] = [createEntropyCalculatorTool()];
