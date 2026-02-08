export const features = {
  taqwinTools: String(import.meta.env.VITE_ENABLE_TAQWIN_TOOLS ?? "true").toLowerCase() !== "false",
  floatingConsole: String(import.meta.env.VITE_ENABLE_FLOATING_CONSOLE ?? "true").toLowerCase() !== "false",
  mcpViews: String(import.meta.env.VITE_ENABLE_MCP_VIEWS ?? "true").toLowerCase() !== "false",
  logViews: String(import.meta.env.VITE_ENABLE_LOG_VIEWS ?? "true").toLowerCase() !== "false",
};
