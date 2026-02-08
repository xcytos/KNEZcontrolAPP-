import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const knezRoot = path.join(repoRoot, "KNEZ");
const logFile = path.join(__dirname, "knez-server.debug.log");
const logStream = fs.createWriteStream(logFile, { flags: "w" });
const startScript = path.resolve(__dirname, "..", "..", "src-tauri", "scripts", "start_knez.ps1");

console.log("knezRoot", knezRoot);
console.log("startScript", startScript, fs.existsSync(startScript));

const child = spawn(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", startScript, "-KnezRoot", knezRoot],
  { cwd: knezRoot, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"], shell: false }
);
child.stdout?.pipe(logStream);
child.stderr?.pipe(logStream);

child.on("error", (e) => {
  console.error("spawn error", e);
});
child.on("close", (code) => {
  console.log("close code", code);
});

setTimeout(() => {
  console.log("done");
  process.exit(0);
}, 1500);

