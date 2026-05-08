import { EventEmitter } from 'events';

export interface PTYHandle {
  pid: number;
  kill: () => void;
  resize: (cols: number, rows: number) => void;
  onData: (handler: (data: string) => void) => void;
  onExit: (handler: (code: number) => void) => void;
}

export interface PTYConfig {
  shell: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class TerminalPTYService extends EventEmitter {
  private processes: Map<number, any> = new Map();

  async spawnPTY(config: PTYConfig): Promise<PTYHandle> {
    return new Promise((resolve) => {
      // For now, return a mock PTY handle until Tauri PTY is properly configured
      const mockPid = Date.now();
      const mockHandle: PTYHandle = {
        pid: mockPid,
        kill: () => {
          this.processes.delete(mockPid);
          this.emit('exit', { pid: mockPid, exitCode: 0 });
        },
        resize: (cols: number, rows: number) => {
          this.emit('resize', { pid: mockPid, cols, rows });
        },
        onData: (handler: (data: string) => void) => {
          this.on('data', ({ pid, data }) => {
            if (pid === mockPid) {
              handler(data);
            }
          });
        },
        onExit: (handler: (code: number) => void) => {
          this.on('exit', ({ pid, exitCode }) => {
            if (pid === mockPid) {
              handler(exitCode);
            }
          });
        }
      };

      this.processes.set(mockPid, mockHandle);
      
      // Simulate successful spawn
      setTimeout(() => {
        this.emit('spawn', { pid: mockPid, config });
        resolve(mockHandle);
      }, 100);
    });
  }

  getProcess(pid: number): any {
    return this.processes.get(pid);
  }

  cleanup(): void {
    this.processes.forEach((process) => {
      process.kill();
    });
    this.processes.clear();
  }
}
