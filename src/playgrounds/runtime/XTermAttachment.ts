import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { PTYHandle, PTYEvent, PTYConfig } from './PTYService';

export interface XTermConfig {
  theme?: 'dark' | 'light' | 'auto';
  fontSize?: number;
  fontFamily?: string;
  cursorBlink?: boolean;
  scrollback?: number;
  allowTransparency?: boolean;
}

export interface TerminalAttachment {
  terminal: Terminal;
  ptyHandle?: PTYHandle;
  isAttached: boolean;
  resizeObserver?: ResizeObserver;
  
  // Event handlers
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onExit?: (exitCode: number) => void;
}

export class XTermAttachment {
  private static readonly DEFAULT_CONFIG: XTermConfig = {
    theme: 'auto',
    fontSize: 14,
    fontFamily: 'Cascadia Code, Fira Code, Consolas, monospace',
    cursorBlink: true,
    scrollback: 10000,
    allowTransparency: false
  };

  private attachments: Map<string, TerminalAttachment> = new Map();
  private nextId = 1;

  constructor() {
    this.initializeGlobalStyles();
  }

  // Public API
  createAttachment(container: HTMLElement, config: XTermConfig = {}): TerminalAttachment {
    const attachmentId = `term-${this.nextId++}`;
    const finalConfig = { ...XTermAttachment.DEFAULT_CONFIG, ...config };
    
    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: finalConfig.cursorBlink,
      fontSize: finalConfig.fontSize,
      fontFamily: finalConfig.fontFamily,
      scrollback: finalConfig.scrollback,
      allowTransparency: finalConfig.allowTransparency,
      theme: this.getTheme(finalConfig.theme),
      cols: 80,
      rows: 24
    });

    // Load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    // Create attachment object
    const attachment: TerminalAttachment = {
      terminal,
      isAttached: false,
      
      // Event handlers
      onData: (data: string) => {
        // Forward to PTY if attached
        if (attachment.ptyHandle) {
          attachment.ptyHandle.write(data);
        }
      },
      
      onResize: (cols: number, rows: number) => {
        // Forward resize to PTY if attached
        if (attachment.ptyHandle) {
          attachment.ptyHandle.resize(cols, rows);
        }
      },
      
      onExit: (exitCode: number) => {
        console.log(`Terminal ${attachmentId} exited with code ${exitCode}`);
        this.detachAttachment(attachmentId);
      }
    };

    // Set up terminal event handlers
    this.setupTerminalEvents(attachmentId, terminal, attachment);
    
    // Mount to container
    terminal.open(container);
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      attachment.onResize?.(cols, rows);
    });
    
    resizeObserver.observe(container);
    attachment.resizeObserver = resizeObserver;

    this.attachments.set(attachmentId, attachment);
    
    console.log(`Created terminal attachment ${attachmentId}`);
    return attachment;
  }

  async attachPTY(attachmentId: string, ptyHandle: PTYHandle): Promise<void> {
    const attachment = this.attachments.get(attachmentId);
    if (!attachment) {
      throw new Error(`Terminal attachment ${attachmentId} not found`);
    }

    if (attachment.isAttached) {
      throw new Error(`Terminal attachment ${attachmentId} is already attached`);
    }

    // Set up PTY streams
    this.setupPTYStreams(attachmentId, attachment, ptyHandle);
    
    attachment.ptyHandle = ptyHandle;
    attachment.isAttached = true;

    // Send initial resize
    const { cols, rows } = attachment.terminal;
    await ptyHandle.resize(cols, rows);

    console.log(`Attached PTY ${ptyHandle.id} to terminal ${attachmentId}`);
  }

  detachAttachment(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId);
    if (!attachment) {
      return;
    }

    if (attachment.ptyHandle) {
      // Clean up PTY streams
      this.cleanupPTYStreams(attachmentId, attachment);
      attachment.ptyHandle = undefined;
    }

    attachment.isAttached = false;
    
    // Clear terminal
    attachment.terminal.clear();
    attachment.terminal.writeln('\x1b[31m[PTY Disconnected]\x1b[0m');

    console.log(`Detached PTY from terminal ${attachmentId}`);
  }

  getAttachment(attachmentId: string): TerminalAttachment | undefined {
    return this.attachments.get(attachmentId);
  }

  getActiveAttachments(): TerminalAttachment[] {
    return Array.from(this.attachments.values()).filter(att => att.isAttached);
  }

  getAllAttachments(): TerminalAttachment[] {
    return Array.from(this.attachments.values());
  }

  // Terminal operations
  writeData(attachmentId: string, data: string): void {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) {
      attachment.terminal.write(data);
    }
  }

  resizeTerminal(attachmentId: string, cols: number, rows: number): void {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) {
      // Resize xterm
      const fitAddon = attachment.terminal.loadAddon as any;
      if (fitAddon && typeof fitAddon.fit === 'function') {
        fitAddon.fit();
      }
      
      // Forward to PTY
      attachment.onResize?.(cols, rows);
    }
  }

  focusTerminal(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) {
      attachment.terminal.focus();
    }
  }

  clearTerminal(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId);
    if (attachment) {
      attachment.terminal.clear();
    }
  }

  // Private methods
  private setupTerminalEvents(attachmentId: string, terminal: Terminal, attachment: TerminalAttachment): void {
    // Handle terminal input
    terminal.onData((data: string) => {
      attachment.onData?.(data);
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      attachment.onResize?.(cols, rows);
    });

    // Handle terminal focus/blur
    terminal.onFocus(() => {
      console.log(`Terminal ${attachmentId} focused`);
    });

    terminal.onBlur(() => {
      console.log(`Terminal ${attachmentId} blurred`);
    });

    // Handle selection
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection();
      if (selection) {
        console.log(`Terminal ${attachmentId} selection:`, selection);
      }
    });

    // Handle title change (if supported)
    terminal.onTitleChange((title: string) => {
      console.log(`Terminal ${attachmentId} title:`, title);
    });
  }

  private setupPTYStreams(attachmentId: string, attachment: TerminalAttachment, ptyHandle: PTYHandle): void {
    // Set up stdout stream
    const stdoutReader = ptyHandle.stdout.getReader();
    
    const readStdout = async () => {
      try {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;
          
          if (value) {
            attachment.terminal.write(value);
          }
        }
      } catch (error) {
        console.error(`Error reading PTY stdout for ${attachmentId}:`, error);
      }
    };

    readStdout();

    // Set up stderr stream
    const stderrReader = ptyHandle.stderr.getReader();
    
    const readStderr = async () => {
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          
          if (value) {
            // Write stderr in red
            attachment.terminal.write(`\x1b[31m${value}\x1b[0m`);
          }
        }
      } catch (error) {
        console.error(`Error reading PTY stderr for ${attachmentId}:`, error);
      }
    };

    readStderr();
  }

  private cleanupPTYStreams(attachmentId: string, attachment: TerminalAttachment): void {
    // Clean up stream readers
    // Note: Web Streams API doesn't have explicit close methods for readers
    // The streams will be closed when the PTY is destroyed
    console.log(`Cleaned up PTY streams for ${attachmentId}`);
  }

  private getTheme(theme: 'dark' | 'light' | 'auto'): any {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'auto' ? systemDark : theme === 'dark';

    return {
      background: isDark ? '#1e1e1e' : '#ffffff',
      foreground: isDark ? '#ffffff' : '#000000',
      cursor: isDark ? '#ffffff' : '#000000',
      cursorAccent: isDark ? '#000000' : '#ffffff',
      selection: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
      black: isDark ? '#000000' : '#000000',
      red: isDark ? '#ff5555' : '#cc0000',
      green: isDark ? '#50fa7b' : '#00aa00',
      yellow: isDark ? '#f1fa8c' : '#aa5500',
      blue: isDark ? '#8be9fd' : '#0000aa',
      magenta: isDark ? '#ff79c6' : '#aa00aa',
      cyan: isDark ? '#8be9fd' : '#00aaaa',
      white: isDark ? '#ffffff' : '#ffffff',
      brightBlack: isDark ? '#666666' : '#555555',
      brightRed: isDark ? '#ff6e67' : '#ff5555',
      brightGreen: isDark ? '#5af78e' : '#55ff55',
      brightYellow: isDark ? '#f4f99d' : '#ffff55',
      brightBlue: isDark ? '#6ca8ff' : '#5555ff',
      brightMagenta: isDark ? '#ff92df' : '#ff55ff',
      brightCyan: isDark ? '#a1f7f8' : '#55ffff',
      brightWhite: isDark ? '#ffffff' : '#ffffff'
    };
  }

  private initializeGlobalStyles(): void {
    // Add global styles for xterm
    const style = document.createElement('style');
    style.textContent = `
      .xterm {
        padding: 8px;
        font-feature-settings: "liga" 1;
        position: relative;
      }
      
      .xterm-viewport {
        background-color: transparent;
      }
      
      .xterm-screen {
        background-color: transparent;
      }
      
      .xterm-helper-textarea {
        background-color: transparent;
        color: transparent;
      }
      
      .terminal-container {
        height: 100%;
        width: 100%;
        position: relative;
        overflow: hidden;
      }
      
      .terminal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
      }
      
      .terminal-controls {
        display: flex;
        gap: 4px;
      }
      
      .terminal-control {
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .terminal-control:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    
    document.head.appendChild(style);
  }

  // Cleanup
  destroyAttachment(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId);
    if (!attachment) {
      return;
    }

    // Detach PTY if attached
    if (attachment.isAttached) {
      this.detachAttachment(attachmentId);
    }

    // Clean up resize observer
    if (attachment.resizeObserver) {
      attachment.resizeObserver.disconnect();
    }

    // Dispose terminal
    try {
      attachment.terminal.dispose();
    } catch (error) {
      console.error(`Error disposing terminal ${attachmentId}:`, error);
    }

    // Remove from attachments
    this.attachments.delete(attachmentId);
    
    console.log(`Destroyed terminal attachment ${attachmentId}`);
  }

  async shutdown(): Promise<void> {
    // Destroy all attachments
    const destroyPromises = Array.from(this.attachments.keys()).map(id => 
      this.destroyAttachment(id)
    );

    await Promise.all(destroyPromises);
    this.attachments.clear();
    
    console.log('XTermAttachment service shut down');
  }
}

// Singleton instance
let globalXTermAttachment: XTermAttachment | null = null;

export function getXTermAttachment(): XTermAttachment {
  if (!globalXTermAttachment) {
    globalXTermAttachment = new XTermAttachment();
  }
  return globalXTermAttachment;
}
