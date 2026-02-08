export const features = {
  taqwinTools: String(import.meta.env.VITE_ENABLE_TAQWIN_TOOLS ?? "").toLowerCase() === "true",
  floatingConsole: String(import.meta.env.VITE_ENABLE_FLOATING_CONSOLE ?? "").toLowerCase() === "true",
  mcpViews: String(import.meta.env.VITE_ENABLE_MCP_VIEWS ?? "").toLowerCase() === "true",
  logViews: String(import.meta.env.VITE_ENABLE_LOG_VIEWS ?? "").toLowerCase() === "true",
};
