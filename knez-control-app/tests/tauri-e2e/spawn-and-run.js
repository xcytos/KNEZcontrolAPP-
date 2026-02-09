import net from "node:net";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";

const CDP_HOST = "127.0.0.1";
const KNEZ_HOST = "127.0.0.1";
const KNEZ_PORT = 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, ".tauri-dev-state.json");
const RUN_LOG_FILE = path.join(__dirname, "e2e-run.log");
const runLogStream = fs.createWriteStream(RUN_LOG_FILE, { flags: "w" });

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    runLogStream.write(line);
  } catch {}
  try {
    console.error(msg);
  } catch {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pickFreePort(host) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(null));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : null;
  await new Promise((resolve) => server.close(() => resolve(null)));
  if (!port) throw new Error("Failed to pick free port");
  return port;
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

async function waitForCdpReady(baseUrl, timeoutMs) {
  const start = Date.now();
  let lastNote = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const version = await httpGetJson(`${baseUrl}/json/version`, 1200);
      if (version?.ok) {
        if (version.data?.webSocketDebuggerUrl) return;
        lastNote = `/json/version ok but missing webSocketDebuggerUrl`;
      } else if (version) {
        lastNote = `/json/version status=${version.status}`;
      }
      const list = await httpGetJson(`${baseUrl}/json/list`, 1200);
      if (list?.ok) {
        if (Array.isArray(list.data) && list.data.length > 0) return;
        lastNote = `/json/list ok but empty`;
      } else if (list) {
        lastNote = `/json/list status=${list.status}`;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for CDP JSON at ${baseUrl} (${lastNote})`);
}

async function tryReuseCdpUrl() {
  const envUrl = process.env.TAURI_CDP_URL;
  if (envUrl) return envUrl;

  const envPort = process.env.TAURI_CDP_PORT ? Number(process.env.TAURI_CDP_PORT) : null;
  if (envPort) return `http://${CDP_HOST}:${envPort}`;

  const reuse = String(process.env.TAURI_REUSE ?? "").toLowerCase();
  if (!["1", "true", "yes"].includes(reuse)) return null;

  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = await fs.promises.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const url = typeof parsed?.cdpUrl === "string" ? parsed.cdpUrl : null;
    return url;
  } catch {
    return null;
  }
}

async function validateReusableCdp(cdpUrl) {
  try {
    const u = new URL(cdpUrl);
    const port = Number(u.port);
    if (!port) return false;
    await waitForPort(u.hostname, port, 2500);
    await waitForCdpReady(`${u.origin}`, 2500);
    return true;
  } catch {
    return false;
  }
}

async function spawnTauriDev({ cdpPort }) {
  const isWin = process.platform === "win32";
  const webview2UserData = path.join(os.tmpdir(), `knez-webview2-e2e-${cdpPort}-${process.pid}`);
  fs.mkdirSync(webview2UserData, { recursive: true });
  const env = {
    ...process.env,
    RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? "1",
    WEBVIEW2_USER_DATA_FOLDER: webview2UserData,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort} --remote-debugging-address=127.0.0.1`,
    TAURI_CDP_URL: `http://${CDP_HOST}:${cdpPort}`,
    TAURI_CDP_PORT: String(cdpPort),
    TAURI_E2E: "1",
    VITE_ENABLE_FLOATING_CONSOLE: "true",
    VITE_ENABLE_LOG_VIEWS: "true",
    VITE_ENABLE_TAQWIN_TOOLS: "true"
  };
  const logFile = path.join(__dirname, "tauri-dev.log");
  const logStream = fs.createWriteStream(logFile, { flags: "w" });

  const cmd = isWin ? "cmd.exe" : "npm";
  const args = isWin
    ? ["/d", "/s", "/c", "npm", "run", "tauri", "--", "dev"]
    : ["run", "tauri", "--", "dev"];
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env, shell: false });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  return { child, logFile };
}

function runPlaywrightTauri({ cdpUrl }) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin
    ? ["/d", "/s", "/c", "npx", "playwright", "test", "-c", "playwright.tauri.config.ts"]
    : ["playwright", "test", "-c", "playwright.tauri.config.ts"];
  const env = {
    ...process.env,
    TAURI_CDP_URL: cdpUrl,
    KNEZ_ENDPOINT: process.env.KNEZ_ENDPOINT ?? `http://${KNEZ_HOST}:${KNEZ_PORT}`
  };
  const child = spawn(cmd, args, {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  const keepAliveId = setInterval(() => {
    void httpGetJson(`${cdpUrl}/json/version`, 1500);
  }, 500);
  child.stdout?.pipe(runLogStream, { end: false });
  child.stderr?.pipe(runLogStream, { end: false });
  return new Promise((resolve) => {
    child.on("close", (code) => {
      clearInterval(keepAliveId);
      resolve(code ?? 1);
    });
    child.on("error", () => {
      clearInterval(keepAliveId);
      resolve(1);
    });
  });
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

function httpGet(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === "https:" ? https : http;
      const req = mod.request(
        {
          method: "GET",
          hostname: u.hostname,
          port: u.port || (u.protocol === "https:" ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          headers: { "Cache-Control": "no-store" },
        },
        (res) => {
          const chunks = [];
          res.on("data", (d) => chunks.push(d));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, body });
          });
        }
      );
      req.on("error", () => resolve(null));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

async function httpGetJson(url, timeoutMs) {
  const res = await httpGet(url, timeoutMs);
  if (!res) return null;
  try {
    return { ...res, data: JSON.parse(res.body) };
  } catch {
    return { ...res, data: null };
  }
}

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await httpGet(url, 1500);
    if (res?.ok) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function killListeningPort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: "utf8",
      timeout: 2000,
      maxBuffer: 5 * 1024 * 1024
    });
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
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore", timeout: 2000 });
      } catch {}
    }
  } catch {}
}

function killProcessTree(proc) {
  if (!proc?.pid) return;
  if (process.platform !== "win32") return;
  try {
    execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore", timeout: 5000 });
  } catch {}
}

function killImage(imageName) {
  if (process.platform !== "win32") return;
  if (!imageName) return;
  try {
    execSync(`taskkill /IM ${imageName} /T /F`, { stdio: "ignore", timeout: 5000 });
  } catch {}
}

function spawnKnezServer() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const knezRoot = path.join(repoRoot, "KNEZ");
  const logFile = path.join(__dirname, "knez-server.log");
  const logStream = fs.createWriteStream(logFile, { flags: "w" });

  if (process.platform === "win32") {
    const startScript = path.resolve(__dirname, "..", "..", "src-tauri", "scripts", "start_knez.ps1");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", startScript, "-KnezRoot", knezRoot],
      { cwd: knezRoot, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"], shell: false }
    );
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);
    return { child: null, logFile, startedDetached: true, tempLog: path.join(process.env.TEMP ?? process.env.TMP ?? "", "knez-startup.log") };
  }

  const venvUvicorn = path.join(knezRoot, ".venv", "bin", "uvicorn");
  const uvicornCmd = fs.existsSync(venvUvicorn) ? venvUvicorn : "uvicorn";
  const existingPythonPath = typeof process.env.PYTHONPATH === "string" ? process.env.PYTHONPATH : "";
  const env = {
    ...process.env,
    KNEZ_HOST,
    KNEZ_PORT: String(KNEZ_PORT),
    PYTHONPATH: existingPythonPath ? `${knezRoot}:${existingPythonPath}` : knezRoot,
  };
  const child = spawn(
    uvicornCmd,
    ["knez.knez_core.app:app", "--app-dir", ".", "--host", KNEZ_HOST, "--port", String(KNEZ_PORT)],
    { cwd: knezRoot, env, stdio: ["ignore", "pipe", "pipe"], shell: false }
  );
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  return { child, logFile, startedDetached: false, tempLog: null };
}

async function main() {
  let knezProc = null;
  let knezLog = null;
  let knezTempLog = null;
  let knezDetached = false;

  try {
    logLine(`TAURI E2E: checking KNEZ at http://${KNEZ_HOST}:${KNEZ_PORT}/health`);
    await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 2000);
    logLine(`TAURI E2E: using existing KNEZ at http://${KNEZ_HOST}:${KNEZ_PORT}`);
  } catch {
    logLine(`TAURI E2E: KNEZ not reachable, starting...`);
    logLine(`TAURI E2E: killListeningPort(${KNEZ_PORT})`);
    killListeningPort(KNEZ_PORT);
    logLine(`TAURI E2E: spawnKnezServer()`);
    const started = spawnKnezServer();
    logLine(`TAURI E2E: spawnKnezServer() returned`);
    knezProc = started.child;
    knezLog = started.logFile;
    knezTempLog = started.tempLog;
    knezDetached = started.startedDetached === true;
    logLine(`TAURI E2E: starting KNEZ server; log=${knezLog}`);
    try {
      await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 60000);
    } catch (e) {
      logLine("TAURI E2E: KNEZ failed to become healthy");
      if (knezLog) await printTail(knezLog);
      if (knezTempLog && fs.existsSync(knezTempLog)) await printTail(knezTempLog);
      throw e;
    }
  }

  const reusable = await tryReuseCdpUrl();
  if (reusable && (await validateReusableCdp(reusable))) {
    logLine(`TAURI E2E: reusing existing desktop app at ${reusable}`);
    const exitCode = await runPlaywrightTauri({ cdpUrl: reusable });
    if (exitCode !== 0) throw new Error(`playwright_failed_${exitCode}`);
    logLine("TAURI E2E: PASS");
    return 0;
  }

  killImage("knez-control-app.exe");
  killListeningPort(5173);
  let tauriProc = null;
  let logFile = null;
  let cdpPort = null;
  const maxStarts = 3;
  for (let attempt = 1; attempt <= maxStarts; attempt++) {
    cdpPort = process.env.TAURI_CDP_PORT ? Number(process.env.TAURI_CDP_PORT) : await pickFreePort(CDP_HOST);
    killListeningPort(cdpPort);
    const started = await spawnTauriDev({ cdpPort });
    tauriProc = started.child;
    logFile = started.logFile;
    logLine(`TAURI E2E: starting desktop app; log=${logFile}`);
    try {
      logLine(`TAURI E2E: waiting for Vite http://127.0.0.1:5173/`);
      await waitForHttpOk("http://127.0.0.1:5173/", 90000);
      logLine(`TAURI E2E: waiting for CDP ${CDP_HOST}:${cdpPort}`);
      await waitForPort(CDP_HOST, cdpPort, 180000);

      try {
        await fs.promises.writeFile(
          STATE_FILE,
          JSON.stringify({ cdpUrl: `http://${CDP_HOST}:${cdpPort}`, cdpPort, startedAt: new Date().toISOString() }, null, 2),
          "utf8"
        );
      } catch {}
      break;
    } catch (e) {
      logLine(`TAURI E2E: start attempt ${attempt} failed (${String(e?.message ?? e)})`);
      if (logFile) await printTail(logFile);
      try { tauriProc.kill("SIGINT"); } catch {}
      await sleep(750);
      try { tauriProc.kill(); } catch {}
      killProcessTree(tauriProc);
      tauriProc = null;
      logFile = null;
      if (attempt === maxStarts) throw e;
      await sleep(500);
    }
  }
  try {
    logLine(`TAURI E2E: CDP ready, running Playwright`);
    const exitCode = await runPlaywrightTauri({ cdpUrl: `http://${CDP_HOST}:${cdpPort}` });
    if (exitCode !== 0) throw new Error(`playwright_failed_${exitCode}`);
    logLine("TAURI E2E: PASS");
    return 0;
  } catch (e) {
    logLine(`TAURI E2E: FAIL (${String(e?.message ?? e)})`);
    if (logFile) await printTail(logFile);
    if (knezLog) await printTail(knezLog);
    return 1;
  } finally {
    try {
      tauriProc?.kill("SIGINT");
    } catch {}
    await sleep(750);
    try {
      tauriProc?.kill();
    } catch {}
    killProcessTree(tauriProc);
    killListeningPort(5173);
    if (cdpPort) killListeningPort(cdpPort);
    if (knezDetached) {
      killListeningPort(KNEZ_PORT);
    } else if (knezProc) {
      try { knezProc.kill("SIGINT"); } catch {}
      await sleep(500);
      try { knezProc.kill(); } catch {}
      killProcessTree(knezProc);
    }
    try { runLogStream.end(); } catch {}
  }
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e);
  process.exit(1);
});
