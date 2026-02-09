import { taqwinMcpService } from "../taqwin/TaqwinMcpService";

export async function runTaqwinMcpSelfTest() {
  return await taqwinMcpService.selfTest();
}
