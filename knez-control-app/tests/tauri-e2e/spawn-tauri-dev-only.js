import net from "node:net";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";

const CDP_HOST = "localhost";
const KNEZ_HOST = "127.0.0.1";
const KNEZ_PORT = 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, ".tauri-dev-state.json");

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

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await httpGet(url, 1500);
    if (res?.ok) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
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

async function waitForCdpReady(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const version = await httpGetJson(`${baseUrl}/json/version`, 1200);
      if (version?.ok && version.data?.webSocketDebuggerUrl) return;
      const list = await httpGetJson(`${baseUrl}/json/list`, 1200);
      if (list?.ok && Array.isArray(list.data) && list.data.length > 0) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for CDP JSON at ${baseUrl}`);
}

function startKnezIfNeeded() {
  return new Promise(async (resolve) => {
    try {
      await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 1500);
      console.log(`KNEZ: already up at http://${KNEZ_HOST}:${KNEZ_PORT}`);
      resolve({ started: false });
      return;
    } catch {}
    if (process.platform !== "win32") {
      console.log("KNEZ: please start manually (non-win dev-only runner).");
      resolve({ started: false });
      return;
    }
    killListeningPort(KNEZ_PORT);
    const script = path.resolve(__dirname, "..", "..", "src-tauri", "scripts", "start_knez.ps1");
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const knezRoot = path.join(repoRoot, "KNEZ");
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-KnezRoot", knezRoot], {
      cwd: knezRoot,
      stdio: "ignore",
      shell: false,
    });
    child.unref();
    console.log(`KNEZ: starting via script (${script})`);
    await waitForHttpOk(`http://${KNEZ_HOST}:${KNEZ_PORT}/health`, 60000);
    console.log(`KNEZ: healthy at http://${KNEZ_HOST}:${KNEZ_PORT}`);
    resolve({ started: true });
  });
}

function spawnTauriDev({ cdpPort }) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const args = isWin ? ["/d", "/s", "/c", "npm", "run", "tauri", "--", "dev"] : ["run", "tauri", "--", "dev"];
  const webview2UserData = path.join(__dirname, `.webview2-user-data-${cdpPort}`);
  fs.mkdirSync(webview2UserData, { recursive: true });
  const env = {
    ...process.env,
    WEBVIEW2_USER_DATA_FOLDER: webview2UserData,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort} --remote-allow-origins=*`,
    TAURI_CDP_URL: `http://${CDP_HOST}:${cdpPort}`,
    TAURI_CDP_PORT: String(cdpPort),
  };
  const logFile = path.join(__dirname, "tauri-dev.log");
  const logStream = fs.createWriteStream(logFile, { flags: "w" });
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env, shell: false });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  return { child, logFile, cdpUrl: `http://${CDP_HOST}:${cdpPort}` };
}

async function main() {
  await startKnezIfNeeded();

  const cdpPort = process.env.TAURI_CDP_PORT ? Number(process.env.TAURI_CDP_PORT) : await pickFreePort(CDP_HOST);
  killListeningPort(cdpPort);

  const started = spawnTauriDev({ cdpPort });
  console.log(`TAURI: starting dev app, log=${started.logFile}`);

  await waitForHttpOk("http://127.0.0.1:5173/", 90000);
  await waitForPort(CDP_HOST, cdpPort, 180000);
  await waitForCdpReady(`http://${CDP_HOST}:${cdpPort}`, 90000);

  try {
    await fs.promises.writeFile(
      STATE_FILE,
      JSON.stringify({ cdpUrl: started.cdpUrl, cdpPort, startedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  } catch {}

  console.log(`TAURI_CDP_URL=${started.cdpUrl}`);
  console.log("Tauri dev is running. Keep this process open while you run Playwright.");

  const shutdown = () => {
    try {
      started.child.kill("SIGINT");
    } catch {}
    setTimeout(() => {
      try {
        started.child.kill();
      } catch {}
      process.exit(0);
    }, 750);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
