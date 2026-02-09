import { useMemo, useState } from "react";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

async function invokeTauri(command: string, args?: any): Promise<any> {
  const w = window as any;
  const invokeFn = w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke;
  if (!invokeFn) throw new Error("tauri_invoke_unavailable");
  return await invokeFn(command, args ?? {});
}

export function E2EBanner() {
  const [closing, setClosing] = useState(false);

  const params = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);
  const enabled = params.get("e2e") === "1";
  const label = params.get("label") ?? "";

  if (!enabled) return null;

  return (
    <div className="fixed top-2 right-2 z-[9999] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 shadow-lg">
        <div className="font-mono text-zinc-400">E2E</div>
        <div className="font-mono">{label || "window"}</div>
        {isTauriRuntime() && label && (
          <button
            disabled={closing}
            onClick={() => {
              void (async () => {
                setClosing(true);
                try {
                  await invokeTauri("close_window", { label });
                } finally {
                  setClosing(false);
                }
              })();
            }}
            className="ml-2 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
