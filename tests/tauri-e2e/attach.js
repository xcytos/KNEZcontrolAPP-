import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isWin = process.platform === "win32";
const cmd = isWin ? "npx" : "npx";
const args = ["playwright", "test", "-c", "playwright.tauri.config.ts"];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.resolve(__dirname, "..", "..");

const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: isWin, env: process.env });
child.on("close", (code) => process.exit(code ?? 1));
child.on("error", () => process.exit(1));
