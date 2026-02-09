import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "dist",
  "playwright-report",
  "test-results",
  path.join("tests", "tauri-e2e", ".tauri-dev-state.json"),
  path.join("tests", "tauri-e2e", "e2e-run.log"),
  path.join("tests", "tauri-e2e", "tauri-dev.log"),
  path.join("tests", "tauri-e2e", "knez-server.log"),
  path.join("tests", "tauri-e2e", "knez-startup.log"),
];

let removed = 0;
for (const rel of targets) {
  const p = path.resolve(root, rel);
  try {
    if (!fs.existsSync(p)) continue;
    fs.rmSync(p, { recursive: true, force: true });
    removed++;
  } catch {}
}

process.stdout.write(`clean: removed ${removed}/${targets.length}\\n`);
