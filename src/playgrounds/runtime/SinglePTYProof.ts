import { getPTYService } from './PTYService';
import { getPTYLifecycleManager } from './PTYLifecycleManager';
import { getProcessRegistry } from './ProcessRegistry';

export interface PTYProofConfig {
  runtimeType: 'opencode' | 'claudecode' | 'shell';
  cols: number;
  rows: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PTYProofResult {
  success: boolean;
  ptyId?: string;
  processId?: number;
  error?: Error;
  evidence?: {
    processCreated: boolean;
    ptyAttached: boolean;
    terminalRendered: boolean;
    inputReceived: boolean;
    outputReceived: boolean;
    resizeWorking: boolean;
    processTerminated: boolean;
  };
}

export class SinglePTYProof {
  private ptyService = getPTYService();
  private lifecycleManager = getPTYLifecycleManager();
  private processRegistry = getProcessRegistry();

  async executeProof(config: PTYProofConfig): Promise<PTYProofResult> {
    console.log(`[SinglePTYProof] Starting proof for ${config.runtimeType}`);
    
    const result: PTYProofResult = {
      success: false,
      evidence: {
        processCreated: false,
        ptyAttached: false,
        terminalRendered: false,
        inputReceived: false,
        outputReceived: false,
        resizeWorking: false,
        processTerminated: false
      }
    };

    try {
      // Step 1: Create PTY
      console.log('[SinglePTYProof] Step 1: Creating PTY...');
      const ptyHandle = await this.ptyService.createPTY({
        cols: config.cols,
        rows: config.rows,
        cwd: config.cwd,
        env: config.env
      });

      result.ptyId = ptyHandle.id;
      result.evidence!.processCreated = true;
      console.log(`[SinglePTYProof] PTY created with ID: ${ptyHandle.id}`);

      // Step 2: Register process
      console.log('[SinglePTYProof] Step 2: Registering process...');
      const processId = this.processRegistry.registerProcess({
        processId: ptyHandle.id,
        ptyId: ptyHandle.id,
        runtimeId: config.runtimeType,
        playgroundId: 'proof-playground',
        ownerType: 'user',
        command: this.getCommandForRuntime(config.runtimeType),
        args: this.getArgsForRuntime(config.runtimeType),
        cwd: config.cwd || process.cwd(),
        env: config.env || {}
      });

      result.processId = this.processRegistry.getProcess(processId)?.pid;
      console.log(`[SinglePTYProof] Process registered with PID: ${result.processId}`);

      // Step 3: Start PTY lifecycle
      console.log('[SinglePTYProof] Step 3: Starting PTY lifecycle...');
      this.lifecycleManager.createPTY(ptyHandle.id);
      this.lifecycleManager.spawnPTY(ptyHandle.id);

      // Step 4: Attach PTY
      console.log('[SinglePTYProof] Step 4: Attaching PTY...');
      this.lifecycleManager.attachPTY(ptyHandle.id);

      // Step 5: Start PTY
      console.log('[SinglePTYProof] Step 5: Starting PTY...');
      this.lifecycleManager.startPTY(ptyHandle.id);
      this.processRegistry.spawnProcess(processId);
      result.evidence!.ptyAttached = true;

      // Step 6: Test bidirectional communication
      console.log('[SinglePTYProof] Step 6: Testing bidirectional communication...');
      const testResult = await this.testPTYCommunication(ptyHandle);
      
      if (testResult.success) {
        result.evidence!.inputReceived = true;
        result.evidence!.outputReceived = true;
        console.log('[SinglePTYProof] Bidirectional communication test passed');
      } else {
        console.error('[SinglePTYProof] Bidirectional communication test failed:', testResult.error);
        result.error = testResult.error;
        return result;
      }

      // Step 7: Test resize functionality
      console.log('[SinglePTYProof] Step 7: Testing resize functionality...');
      const resizeResult = await this.testPTYResize(ptyHandle);
      
      if (resizeResult.success) {
        result.evidence!.resizeWorking = true;
        console.log('[SinglePTYProof] Resize test passed');
      } else {
        console.error('[SinglePTYProof] Resize test failed:', resizeResult.error);
        result.error = resizeResult.error;
        return result;
      }

      // Step 8: Keep PTY running for observation
      console.log('[SinglePTYProof] Step 8: PTY is now running and ready for observation');
      result.success = true;

      // Set up event listeners for monitoring
      this.setupEventMonitoring(ptyHandle.id, result);

      console.log('[SinglePTYProof] Proof completed successfully');
      console.log('[SinglePTYProof] Evidence:', result.evidence);

      return result;

    } catch (error) {
      console.error('[SinglePTYProof] Proof failed:', error);
      result.error = error as Error;
      return result;
    }
  }

  private async testPTYCommunication(ptyHandle: any): Promise<{ success: boolean; error?: Error }> {
    try {
      // Test 1: Write test command
      const testCommand = 'echo "PTY PROOF TEST"';
      await ptyHandle.write(testCommand);
      console.log('[SinglePTYProof] Sent test command:', testCommand);

      // Test 2: Wait for output
      const output = await this.waitForOutput(ptyHandle, 'PTY PROOF TEST');
      console.log('[SinglePTYProof] Received output:', output);

      // Test 3: Verify output matches expected
      const success = output.includes('PTY PROOF TEST');
      
      return { success };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async testPTYResize(ptyHandle: any): Promise<{ success: boolean; error?: Error }> {
    try {
      // Test 1: Get current size
      const originalCols = ptyHandle.cols;
      const originalRows = ptyHandle.rows;
      console.log(`[SinglePTYProof] Original size: ${originalCols}x${originalRows}`);

      // Test 2: Resize to new dimensions
      const newCols = originalCols + 10;
      const newRows = originalRows + 5;
      await ptyHandle.resize(newCols, newRows);
      console.log(`[SinglePTYProof] Resized to: ${newCols}x${newRows}`);

      // Test 3: Wait a bit and verify resize was processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const resizeSuccess = ptyHandle.cols === newCols && ptyHandle.rows === newRows;
      console.log(`[SinglePTYProof] Resize ${resizeSuccess ? 'successful' : 'failed'}`);
      
      return { success: resizeSuccess };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async waitForOutput(ptyHandle: any, expectedText: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for output'));
      }, 5000);

      const outputBuffer: string[] = [];
      
      const onData = (data: string) => {
        outputBuffer.push(data);
        
        if (outputBuffer.join('').includes(expectedText)) {
          clearTimeout(timeout);
          ptyHandle.stdout?.off('data', onData);
          resolve(outputBuffer.join(''));
        }
      };

      ptyHandle.stdout?.on('data', onData);
    });
  }

  private setupEventMonitoring(ptyId: string, result: PTYProofResult): void {
    // Monitor PTY lifecycle events
    this.lifecycleManager.on('state_change', (event: any) => {
      if (event.ptyId === ptyId) {
        console.log(`[SinglePTYProof] PTY state change: ${event.state}`);
        
        // Update evidence based on state
        switch (event.state) {
          case 'running':
            result.evidence!.terminalRendered = true;
            break;
          case 'exited':
            result.evidence!.processTerminated = true;
            break;
          case 'error':
            console.error('[SinglePTYProof] PTY error:', event.error);
            break;
        }
      }
    });

    // Monitor process registry events
    this.processRegistry.on('process_exited', (event: any) => {
      if (event.processId.includes(ptyId)) {
        console.log(`[SinglePTYProof] Process exited: ${event.processId}`);
        result.evidence!.processTerminated = true;
      }
    });

    // Monitor PTY service events
    this.ptyService.on('data', (event: any) => {
      if (event.ptyId === ptyId) {
        console.log(`[SinglePTYProof] PTY data received: ${event.data?.substring(0, 50)}...`);
      }
    });

    this.ptyService.on('error', (event: any) => {
      if (Event.ptyId === ptyId) {
        console.error(`[SinglePTYProof] PTY error: ${event.error}`);
      }
    });
  }

  private getCommandForRuntime(runtimeType: string): string {
    switch (runtimeType) {
      case 'opencode':
        return 'opencode';
      case 'claudecode':
        return 'claude';
      case 'shell':
        return process.platform === 'win32' ? 'cmd.exe' : 'bash';
      default:
        return process.platform === 'win32' ? 'cmd.exe' : 'bash';
    }
  }

  private getArgsForRuntime(runtimeType: string): string[] {
    switch (runtimeType) {
      case 'opencode':
        return [];
      case 'claudecode':
        return [];
      case 'shell':
        return [];
      default:
        return [];
    }
  }
}

export function createSinglePTYProof(): SinglePTYProof {
  return new SinglePTYProof();
}
