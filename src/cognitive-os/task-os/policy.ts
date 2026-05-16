/**
 * Cognitive Task OS Policy Constants
 * These define the heuristic boundaries for task orchestration.
 */
export const COGNITIVE_POLICY = {
  /**
   * Probability/Score threshold for a model candidate to win.
   * Based on calibration across GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro.
   */
  MIN_SUCCESS_SCORE: 0.45,

  /**
   * Default timeout for agent dispatch.
   */
  DEFAULT_AGENT_TIMEOUT: 30_000,

  /**
   * Default model providers to use for task execution.
   */
  DEFAULT_PROVIDERS: ["gpt", "claude", "gemini"] as Array<"gpt" | "claude" | "gemini">,

  /**
   * Maximum retry attempts for a failed task node transition.
   */
  MAX_RETRIES: 3,

  /**
   * Maximum depth for fractal decomposition.
   */
  MAX_FRACTAL_DEPTH: 5,

  /**
   * Default file lock options for task-os state persistence.
   */
  LOCK_OPTIONS: {
    retries: {
      retries: 5,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 2000,
      randomize: true,
    },
    stale: 10000, // 10s
  },
  /**
   * Interval for the background task orchestration loop.
   */
  POLLING_INTERVAL_MS: 4_000,

  /**
   * Maximum concurrent node dispatches globally.
   */
  MAX_GLOBAL_CONCURRENT_DISPATCH: 10,

  /**
   * Lease timeout for claimed queue entries.
   */
  DEFAULT_NODE_LEASE_MS: 45_000,

  /**
   * Heartbeat interval while a claimed node is executing.
   */
  NODE_HEARTBEAT_INTERVAL_MS: 10_000,

  /**
   * Threshold after which an in_progress node is considered stale and should be reset.
   */
  STALE_NODE_THRESHOLD_MS: 90_000,

  /**
   * Aggressive Autopilot configurations.
   */
  AGGRESSIVE_AUTOPILOT: {
    ENABLED: true,
    MAX_BLOCK_DURATION_MS: 10000, // 10 seconds of inactivity triggers a breakthrough
    SPECULATIVE_DISPATCH: true, // Allow parallel pre-warming
  },
};
