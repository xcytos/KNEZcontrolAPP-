import { useEffect, useState } from "react";
import { taqwinMcpService } from "../mcp/taqwin/TaqwinMcpService";

export function useTaqwinMcpStatus() {
  const [status, setStatus] = useState(() => taqwinMcpService.getStatus());

  useEffect(() => {
    return taqwinMcpService.subscribe(setStatus);
  }, []);

  return status;
}
