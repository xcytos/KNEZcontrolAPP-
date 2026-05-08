import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * TerminalHost — authoritative xterm + PTY lifecycle owner.
 *
 * Key invariants:
 *  - FitAddon.fit() is NEVER called until xterm has completed its first
 *    internal render cycle AND the container has non-zero layout dimensions.
 *  - ResizeObserver is only attached AFTER isInitialized = true.
 *  - All PTY output is consumed via Tauri's canonical `listen('pty-output')`.
 */
export class TerminalHost {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private ptyId: string | null = null;
  private unlisten: (() => void) | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isInitialized = false;
  private isDisposed = false;

  // Tracks whether at least one successful fit has been completed.
  private hasBeenFit = false;

  constructor() {}

  async initialize(container: HTMLElement): Promise<void> {
    if (this.isInitialized || this.isDisposed) {
      return;
    }

    this.container = container;

    // ── 1. Create xterm instance ──────────────────────────────────────────
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowTransparency: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
    });

    // ── 2. Load FitAddon BEFORE open() ───────────────────────────────────
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // ── 3. Mount xterm into the DOM ──────────────────────────────────────
    this.terminal.open(container);

    // ── 4. Wait for xterm to paint + container to have real dimensions ───
    //    We need TWO animation frames:
    //      • Frame 1: browser layout pass (container gets its CSS dimensions)
    //      • Frame 2: xterm's internal renderer initialises scrollBar metrics
    await this.waitForRendererReady();

    // ── 5. Initial FitAddon call (now safe) ──────────────────────────────
    this.safeFit('init');

    // ── 6. Connect to PTY backend ─────────────────────────────────────────
    await this.createPTY();

    // ── 7. Wire keyboard → PTY ────────────────────────────────────────────
    this.setupInputHandler();

    // ── 8. ResizeObserver — only AFTER terminal is fully ready ───────────
    this.isInitialized = true;
    this.setupResizeObserver();
  }

  // ── DOM readiness helpers ───────────────────────────────────────────────

  /** Wait for two rAF cycles AND verify container has non-zero dimensions. */
  private async waitForRendererReady(): Promise<void> {
    // Two frames to satisfy both the layout pass and xterm's renderer init.
    await this.rAF();
    await this.rAF();

    // If dimensions are still zero, poll up to 2 s (CSS animation / flex-box race).
    const MAX_WAIT_MS = 2000;
    const POLL_MS = 50;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      if (this.containerHasDimensions()) return;
      await this.sleep(POLL_MS);
    }

    // Give up gracefully — fit() will simply skip if dims are still zero.
    console.warn('[TerminalHost] Container did not reach non-zero dimensions within 2 s');
  }

  private containerHasDimensions(): boolean {
    if (!this.container) return false;
    const rect = this.container.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private rAF(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── FitAddon wrapper ────────────────────────────────────────────────────

  /**
   * Safe FitAddon.fit() call.
   * Guards against:
   *  - null container / terminal / fitAddon
   *  - zero-dimension containers (xterm crashes on scrollBarWidth)
   *  - disposed state
   */
  private safeFit(caller: string): void {
    if (!this.terminal || !this.fitAddon || !this.container || this.isDisposed) return;
    if (!this.containerHasDimensions()) return;

    try {
      this.fitAddon.fit();
      this.hasBeenFit = true;
    } catch (err) {
      // xterm internal dimension metrics may not be ready on very first call
      // even after rAF — schedule one more attempt.
      if (!this.hasBeenFit) {
        console.warn(`[TerminalHost] safeFit(${caller}) deferred:`, err);
        this.rAF().then(() => {
          if (!this.terminal || !this.fitAddon || this.isDisposed) return;
          if (!this.containerHasDimensions()) return;
          try {
            this.fitAddon!.fit();
            this.hasBeenFit = true;
          } catch (retryErr) {
            console.error('[TerminalHost] safeFit deferred retry failed:', retryErr);
          }
        });
      } else {
        console.warn(`[TerminalHost] safeFit(${caller}) error:`, err);
      }
    }
  }

  // ── PTY backend ─────────────────────────────────────────────────────────

  private async createPTY(): Promise<void> {
    if (!this.terminal || this.isDisposed) return;

    try {
      const ptyId = await invoke<string>('pty_create', {
        config: {
          cols: this.terminal.cols,
          rows: this.terminal.rows,
          cwd: 'C:\\Users\\',
          env: {},
          shell: 'powershell.exe',
        },
      });

      this.ptyId = ptyId;

      // Subscribe to PTY output using Tauri's canonical event channel.
      this.unlisten = await listen<{ pty_id: string; data: string }>(
        'pty-output',
        (event) => {
          if (this.isDisposed || !this.terminal) return;
          if (event.payload.pty_id === ptyId) {
            this.terminal.write(event.payload.data);
          }
        }
      );
    } catch (error) {
      console.error('[TerminalHost] Failed to create PTY:', error);
      if (this.terminal && !this.isDisposed) {
        this.terminal.writeln('\r\n\x1b[31m[PTY ERROR] Failed to connect to shell backend.\x1b[0m');
        this.terminal.writeln('\x1b[33m[INFO] Ensure the app is running via: npm run tauri dev\x1b[0m');
      }
      // Do not rethrow — let xterm remain visible so the user can see the error.
    }
  }

  private setupInputHandler(): void {
    if (!this.terminal || this.isDisposed) return;

    this.terminal.onData((data) => {
      if (this.ptyId && !this.isDisposed) {
        invoke('pty_write', { ptyId: this.ptyId, data }).catch((err) => {
          console.warn('[TerminalHost] pty_write failed:', err);
        });
      }
    });
  }

  // ── Resize handling ─────────────────────────────────────────────────────

  private setupResizeObserver(): void {
    if (!this.container || this.isDisposed) return;

    this.resizeObserver = new ResizeObserver(() => {
      // Only fire once terminal is fully initialized to avoid the
      // early-observer crash on first render.
      if (!this.isInitialized || this.isDisposed) return;
      this.handleResize();
    });

    this.resizeObserver.observe(this.container);
  }

  private handleResize(): void {
    if (!this.fitAddon || !this.terminal || this.isDisposed) return;
    if (!this.containerHasDimensions()) return;

    try {
      this.fitAddon.fit();
      const { cols, rows } = this.terminal;
      if (this.ptyId) {
        invoke('pty_resize', { ptyId: this.ptyId, cols, rows }).catch((err) => {
          console.warn('[TerminalHost] pty_resize failed:', err);
        });
      }
    } catch (err) {
      console.warn('[TerminalHost] handleResize fit failed:', err);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  getTerminal(): Terminal | null {
    return this.isDisposed ? null : this.terminal;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isDisposed;
  }

  dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.isInitialized = false;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }

    if (this.ptyId) {
      invoke('pty_destroy', { ptyId: this.ptyId }).catch(() => {});
      this.ptyId = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    this.fitAddon = null;
    this.container = null;
  }
}
