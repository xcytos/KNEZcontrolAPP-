import { runTauriE2E } from "./run.js";

runTauriE2E().catch((e) => {
  console.error(e);
  process.exit(1);
});
