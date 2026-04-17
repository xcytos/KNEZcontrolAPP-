export const features = {
  taqwinTools: String(import.meta.env.VITE_ENABLE_TAQWIN_TOOLS ?? "true").toLowerCase() !== "false",
  floatingConsole: String(import.meta.env.VITE_ENABLE_FLOATING_CONSOLE ?? "true").toLowerCase() !== "false",
  mcpViews: String(import.meta.env.VITE_ENABLE_MCP_VIEWS ?? "true").toLowerCase() !== "false",
  logViews: String(import.meta.env.VITE_ENABLE_LOG_VIEWS ?? "true").toLowerCase() !== "false",
};

// Configuration constants for timeout values
export const TIMEOUT_CONFIG = {
  DEFAULT_UI_TIMEOUT_MS: 5000,
  DEFAULT_UI_INTERVAL_MS: 100,
  TOOL_CACHE_DEFAULT_TTL_MS: 300000, // 5 minutes
  TOOL_CACHE_MAX_ENTRIES: 1000,
  PROGRESSIVE_LOAD_DELAY_MS: 1000,
  CONTENT_LENGTH_THRESHOLD: 100,
  HEALTH_BACKEND_STALE_MS: 60000, // 1 minute
  TEST_RUNNER_TIMEOUT_MS: 8000,
  TEST_RUNNER_INTERVAL_MS: 250,
  CACHE_CLEANUP_INTERVAL_MS: 300000, // 5 minutes
};

// Configuration constants for slice limits
export const SLICE_LIMITS = {
  LOG_LINES: 150,
  URL_ALTERNATIVES: 4,
  MEMORY_RETRIEVAL: 2,
  HEADINGS: 6,
  LINKS: 8,
  CONSOLE_ERRORS: 5,
};
