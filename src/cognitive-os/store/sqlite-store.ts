import fs from "node:fs";
import path from "node:path";
import type { AgentDispatchCandidate, AgentRole } from "../contracts/types.js";
import type { CognitiveEvent } from "../observability/event-bus.js";
import type { CognitiveTrajectory } from "../observability/trajectory.js";
import type { CognitiveAgentLoopTurn } from "../runtime/agent-loop.js";
import type { CognitiveTaskRecord } from "../task-os/types.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";

type SqliteDatabase = import("node:sqlite").DatabaseSync;

function storePath(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "index.sqlite");
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function sanitizeFtsQuery(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/["*()[\]{}:^~+-]/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(" ");
}

export type CognitiveAgentLoopRunIndex = {
  taskId: string;
  nodeId: string;
  runId: string;
  source: string;
  role: AgentRole;
  startedAt: number;
  finishedAt: number;
  finishedNaturally: boolean;
  memorySynced: boolean;
  turns: CognitiveAgentLoopTurn[];
  toolErrors: Array<{ turn: number; provider: string; error: string }>;
  winner: AgentDispatchCandidate;
  degraded: boolean;
};

export class CognitiveSqliteStore {
  private db: SqliteDatabase;

  constructor(private readonly workspaceDir: string) {
    fs.mkdirSync(path.dirname(storePath(workspaceDir)), { recursive: true });
    const { DatabaseSync } = requireNodeSqlite();
    this.db = new DatabaseSync(storePath(workspaceDir));
    this.init();
  }

  private init(): void {
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS cognitive_tasks (
        id TEXT PRIMARY KEY,
        session_key TEXT NOT NULL,
        title TEXT NOT NULL,
        input TEXT NOT NULL,
        phase TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL,
        record_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cognitive_nodes (
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        title TEXT NOT NULL,
        owner_role TEXT,
        status TEXT NOT NULL,
        depth INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        artifacts_json TEXT NOT NULL,
        metadata_json TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (task_id, node_id)
      );
      CREATE TABLE IF NOT EXISTS cognitive_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        stream TEXT NOT NULL,
        at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cognitive_artifacts (
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        artifact TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (task_id, node_id, artifact)
      );
      CREATE TABLE IF NOT EXISTS cognitive_trajectories (
        task_id TEXT PRIMARY KEY,
        session_key TEXT NOT NULL,
        phase TEXT NOT NULL,
        completed INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        trajectory_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cognitive_agent_loop_runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        source TEXT NOT NULL,
        role TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        score REAL NOT NULL,
        degraded INTEGER NOT NULL,
        finished_naturally INTEGER NOT NULL,
        memory_synced INTEGER NOT NULL,
        turn_count INTEGER NOT NULL,
        tool_error_count INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        run_json TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS cognitive_fts USING fts5(
        kind,
        ref_id,
        task_id,
        content
      );
      CREATE INDEX IF NOT EXISTS idx_cognitive_tasks_session ON cognitive_tasks(session_key, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cognitive_nodes_status ON cognitive_nodes(task_id, status);
      CREATE INDEX IF NOT EXISTS idx_cognitive_events_task ON cognitive_events(task_id, at);
      CREATE INDEX IF NOT EXISTS idx_cognitive_events_run ON cognitive_events(run_id, at);
      CREATE INDEX IF NOT EXISTS idx_cognitive_agent_loop_task ON cognitive_agent_loop_runs(task_id, started_at DESC);
    `);
  }

  indexTask(record: CognitiveTaskRecord): void {
    const taskStmt = this.db.prepare(`
      INSERT INTO cognitive_tasks
        (id, session_key, title, input, phase, reason, created_at, updated_at, version, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        session_key=excluded.session_key,
        title=excluded.title,
        input=excluded.input,
        phase=excluded.phase,
        reason=excluded.reason,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at,
        version=excluded.version,
        record_json=excluded.record_json
    `);
    const nodeStmt = this.db.prepare(`
      INSERT INTO cognitive_nodes
        (task_id, node_id, title, owner_role, status, depth, priority, artifacts_json, metadata_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, node_id) DO UPDATE SET
        title=excluded.title,
        owner_role=excluded.owner_role,
        status=excluded.status,
        depth=excluded.depth,
        priority=excluded.priority,
        artifacts_json=excluded.artifacts_json,
        metadata_json=excluded.metadata_json,
        updated_at=excluded.updated_at
    `);
    const artifactStmt = this.db.prepare(`
      INSERT OR IGNORE INTO cognitive_artifacts (task_id, node_id, artifact, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const ftsDelete = this.db.prepare(
      "DELETE FROM cognitive_fts WHERE task_id = ? AND kind IN ('task', 'node')",
    );
    const ftsInsert = this.db.prepare(
      "INSERT INTO cognitive_fts (kind, ref_id, task_id, content) VALUES (?, ?, ?, ?)",
    );

    this.db.exec("BEGIN");
    try {
      taskStmt.run(
        record.id,
        record.sessionKey,
        record.title,
        record.input,
        record.status.phase,
        record.status.reason ?? null,
        record.createdAt,
        record.updatedAt,
        record.version,
        json(record),
      );
      ftsDelete.run(record.id);
      ftsInsert.run("task", record.id, record.id, `${record.title}\n${record.input}`);
      for (const node of Object.values(record.tree.nodes)) {
        nodeStmt.run(
          record.id,
          node.id,
          node.title,
          node.ownerRole ?? null,
          node.status,
          node.depth,
          node.priority,
          json(node.artifacts),
          node.metadata ? json(node.metadata) : null,
          record.updatedAt,
        );
        ftsInsert.run(
          "node",
          `${record.id}:${node.id}`,
          record.id,
          `${node.title}\n${node.description ?? ""}\n${node.acceptanceCriteria.join("\n")}`,
        );
        for (const artifact of node.artifacts) {
          artifactStmt.run(record.id, node.id, artifact, record.updatedAt);
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  indexEvent(event: CognitiveEvent): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cognitive_events (id, task_id, run_id, stream, at, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(event.id, event.taskId, event.runId, event.stream, event.at, json(event.payload));
    this.db
      .prepare("INSERT INTO cognitive_fts (kind, ref_id, task_id, content) VALUES (?, ?, ?, ?)")
      .run("event", event.id, event.taskId, `${event.stream}\n${json(event.payload)}`);
  }

  indexTrajectory(trajectory: CognitiveTrajectory): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cognitive_trajectories
          (task_id, session_key, phase, completed, updated_at, trajectory_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trajectory.taskId,
        trajectory.sessionKey,
        trajectory.phase,
        trajectory.completed ? 1 : 0,
        trajectory.updatedAt,
        json(trajectory),
      );
    this.db
      .prepare("INSERT INTO cognitive_fts (kind, ref_id, task_id, content) VALUES (?, ?, ?, ?)")
      .run(
        "trajectory",
        trajectory.taskId,
        trajectory.taskId,
        trajectory.conversations.map((turn) => turn.value).join("\n\n"),
      );
  }

  indexAgentLoopRun(run: CognitiveAgentLoopRunIndex): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cognitive_agent_loop_runs
          (run_id, task_id, node_id, source, role, provider, model, score, degraded,
           finished_naturally, memory_synced, turn_count, tool_error_count, started_at, finished_at, run_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.runId,
        run.taskId,
        run.nodeId,
        run.source,
        run.role,
        run.winner.provider,
        run.winner.model,
        run.winner.score,
        run.degraded ? 1 : 0,
        run.finishedNaturally ? 1 : 0,
        run.memorySynced ? 1 : 0,
        run.turns.length,
        run.toolErrors.length,
        run.startedAt,
        run.finishedAt,
        json(run),
      );
    this.db
      .prepare("INSERT INTO cognitive_fts (kind, ref_id, task_id, content) VALUES (?, ?, ?, ?)")
      .run(
        "agent_loop",
        run.runId,
        run.taskId,
        [
          run.role,
          run.source,
          run.winner.provider,
          run.winner.model,
          run.winner.output,
          ...run.turns.map((turn) => turn.reasoning ?? ""),
          ...run.toolErrors.map((err) => err.error),
        ].join("\n"),
      );
  }

  search(
    query: string,
    limit = 20,
  ): Array<{ kind: string; refId: string; taskId: string; content: string }> {
    const normalized = sanitizeFtsQuery(query);
    if (!normalized) {
      return [];
    }
    return this.db
      .prepare(
        `SELECT kind, ref_id as refId, task_id as taskId, snippet(cognitive_fts, 3, '[', ']', '...', 12) as content
         FROM cognitive_fts
         WHERE cognitive_fts MATCH ?
         LIMIT ?`,
      )
      .all(normalized, Math.max(1, Math.min(100, Math.floor(limit)))) as Array<{
      kind: string;
      refId: string;
      taskId: string;
      content: string;
    }>;
  }

  close(): void {
    this.db.close();
  }
}

const STORE_CACHE = new Map<string, CognitiveSqliteStore | null>();

export function getCognitiveSqliteStore(workspaceDir: string): CognitiveSqliteStore | null {
  if (STORE_CACHE.has(workspaceDir)) {
    return STORE_CACHE.get(workspaceDir) ?? null;
  }
  try {
    const store = new CognitiveSqliteStore(workspaceDir);
    STORE_CACHE.set(workspaceDir, store);
    return store;
  } catch {
    STORE_CACHE.set(workspaceDir, null);
    return null;
  }
}

export function resetCognitiveSqliteStoreForTests(): void {
  for (const store of STORE_CACHE.values()) {
    store?.close();
  }
  STORE_CACHE.clear();
}
