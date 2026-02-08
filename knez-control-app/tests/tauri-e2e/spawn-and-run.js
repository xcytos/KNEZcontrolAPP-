import net from "node:net";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTauriE2E } from "./run.js";

const CDP_HOST = "127.0.0.1";
const CDP_PORT = 9222;
const KNEZ_HOST = "127.0.0.1";
const KNEZ_PORT = 8000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPort(host, port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function spawnTauriDev() {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npm" : "npm";
  const args = ["run", "tauri", "--", "dev"];
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT} --remote-allow-origins=*`,
    TAURI_CDP_URL: `http://${CDP_HOST}:${CDP_PORT}`
  };
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const logFile = path.join(__dirname, "tauri-dev.log");
  const logStream = fs.createWriteStream(logFile, { flags: "w" });

  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env, shell: isWin });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  return { child, logFile };
}

async function printTail(filePath, lineLimit = 80) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const tail = lines.slice(Math.max(0, lines.length - lineLimit)).join("\n");
    console.error(`--- ${path.basename(filePath)} (tail ${lineLimit}) ---\n${tail}\n--- end ---`);
  } catch (e) {
    console.error(`Failed to read ${filePath}`);
  }
}

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function killListeningPort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8" });
    const pids = new Set(
      out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/\s+/).slice(-1)[0])
        .filter(Boolean)
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

function spawnKnezServer() {
  const isWin = process.platform === "win32";
  const pythonCmd = isWin ? "python" : "python3";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const knezRoot = path.join(repoRoot, "KNEZ");
  const logFile = path.join(__dirname, "knez-server.log");
  const logStream = fs.createWriteStream(logFile, { flags: "w" });

  const env = { ...process.env, KNEZ_HOST, KNEZ_PORT: String(KNEZ_PORT) };
  const child = spawn(pythonCmd, ["run.py"], {
    cwd: knezRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin
  });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  return { child, logFile };
}

async function main() {
  let knezProc = null;
  let knezLog = null;
  try {
    await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 2000);
    console.log(`TAURI E2E: using existing KNEZ at http://${KNEZ_HOST}:${KNEZ_PORT}`);
  } catch {
    const started = spawnKnezServer();
    knezProc = started.child;
    knezLog = started.logFile;
    console.log(`TAURI E2E: starting KNEZ server; log=${knezLog}`);
    await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 60000);
  }

  killListeningPort(5173);
  killListeningPort(CDP_PORT);

  const { child: tauriProc, logFile } = spawnTauriDev();
  console.log(`TAURI E2E: starting desktop app; log=${logFile}`);
  try {
    console.log(`TAURI E2E: waiting for CDP ${CDP_HOST}:${CDP_PORT}`);
    await waitForPort(CDP_HOST, CDP_PORT, 120000);
    console.log(`TAURI E2E: CDP ready, attaching Playwright`);
    await runTauriE2E();
    console.log("TAURI E2E: PASS");
    return 0;
  } catch (e) {
    console.error("TAURI E2E: FAIL");
    console.error(e);
    await printTail(logFile);
    if (knezLog) await printTail(knezLog);
    return 1;
  } finally {
    try {
      tauriProc.kill("SIGINT");
    } catch {}
    await sleep(750);
    try {
      tauriProc.kill();
    } catch {}
    if (knezProc) {
      try {
        knezProc.kill("SIGINT");
      } catch {}
      await sleep(500);
      try {
        knezProc.kill();
      } catch {}
    }
  }
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e);
  process.exit(1);
});
