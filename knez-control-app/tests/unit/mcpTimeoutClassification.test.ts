import { describe, expect, it } from "vitest";
import { classifyMcpTimeout } from "../../src/mcp/client/classifyTimeout";

describe("classifyMcpTimeout", () => {
  it("classifies protocol phases", () => {
    expect(classifyMcpTimeout("initialize")).toBe("mcp_timeout_initialize");
    expect(classifyMcpTimeout("tools/list")).toBe("mcp_timeout_tools_list");
    expect(classifyMcpTimeout("tools/call")).toBe("mcp_timeout_tools_call");
    expect(classifyMcpTimeout("shutdown")).toBe("mcp_timeout_shutdown");
    expect(classifyMcpTimeout("ping")).toBe("mcp_timeout_request");
  });
});

