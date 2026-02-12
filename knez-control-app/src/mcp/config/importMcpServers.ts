export type ImportedMcpConfig = {
  schema_version: string;
  inputs: any[];
  servers: Record<string, any>;
};

export function extractImportedMcpConfig(parsed: any): ImportedMcpConfig {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("mcp_import_invalid_json");
  const obj: any = parsed;
  const asMap = (v: any) => (typeof v === "object" && v !== null && !Array.isArray(v) ? v : null);

  const fullServers = asMap(obj.servers) ?? asMap(obj.mcpServers);
  if (fullServers) {
    return {
      schema_version: String(obj.schema_version ?? "1"),
      inputs: Array.isArray(obj.inputs) ? obj.inputs : [],
      servers: fullServers
    };
  }

  if (obj.command || obj.url || obj.type) {
    const id = String(obj.id ?? "").trim() || `server_${Date.now()}`;
    return { schema_version: "1", inputs: [], servers: { [id]: obj } };
  }

  return { schema_version: "1", inputs: [], servers: obj };
}

