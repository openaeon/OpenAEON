import crypto from "node:crypto";
import type { AgentRole, TaskNode, TaskTree } from "../contracts/types.js";

const DEFAULT_OWNER_ROTATION: AgentRole[] = ["DevAgent", "QAAgent", "OpsAgent"];

function priorityForTitle(title: string): number {
  const lower = title.toLowerCase();
  if (lower.includes("security") || lower.includes("risk")) {
    return 100;
  }
  if (lower.includes("test") || lower.includes("verify")) {
    return 85;
  }
  return 60;
}

function buildNode(params: {
  title: string;
  depth: number;
  parentId?: string;
  ownerRole?: AgentRole;
  dependsOn?: string[];
  acceptance?: string[];
}): TaskNode {
  return {
    id: crypto.randomUUID().slice(0, 12),
    title: params.title,
    status: "todo",
    ownerRole: params.ownerRole,
    parentId: params.parentId,
    dependsOn: params.dependsOn ?? [],
    children: [],
    depth: params.depth,
    priority: priorityForTitle(params.title),
    acceptanceCriteria: params.acceptance ?? ["Deliver verifiable outcome"],
    artifacts: [],
  };
}

export function expandNodeFractally(node: TaskNode, instruction: string): TaskNode[] {
  const sentences = instruction
    .split(/[\n.。;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  const tasks = sentences.length > 0 ? sentences : [instruction.trim() || "Refine implementation"];
  const children: TaskNode[] = [];

  for (let index = 0; index < tasks.length; index += 1) {
    const taskText = tasks[index];
    const ownerRole = DEFAULT_OWNER_ROTATION[index % DEFAULT_OWNER_ROTATION.length];
    const child = buildNode({
      title: taskText,
      depth: node.depth + 1,
      parentId: node.id,
      ownerRole,
      dependsOn: index === 0 ? [] : [children[index - 1].id],
      acceptance: ["Sub-task completed", "Result added to artifacts"],
    });
    children.push(child);
  }

  return children;
}

export function decomposeTaskFractally(input: string): TaskTree {
  const root = buildNode({
    title: "Top-Level Objective",
    depth: 0,
    ownerRole: "DevAgent",
    acceptance: ["Objective decomposed and executable"],
  });

  const nodes: Record<string, TaskNode> = {
    [root.id]: root,
  };

  const initialChildren = expandNodeFractally(root, input);
  const childIds: string[] = [];

  for (const child of initialChildren) {
    nodes[child.id] = child;
    childIds.push(child.id);
  }

  nodes[root.id] = {
    ...nodes[root.id],
    children: childIds,
  };

  return {
    rootId: root.id,
    nodes,
  };
}
