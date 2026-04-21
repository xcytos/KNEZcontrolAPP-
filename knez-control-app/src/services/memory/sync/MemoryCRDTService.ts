/**
 * Memory CRDT-Based Synchronization Service
 * 
 * Implements CRDT-based memory synchronization
 * 
 * Applied Learnings:
 * - Learning 36-39: Event Sourcing Fundamentals for CRDT integration
 * - Learning 73-74: Data Deduplication for conflict resolution
 * - Learning 31-33: SQLite WAL for consistent synchronization
 */

import { v4 as uuidv4 } from 'uuid';

export interface CRDTOperation {
  id: string;
  type: 'add' | 'remove' | 'update';
  nodeId: string;
  timestamp: number;
  data: any;
}

export interface CRDTState {
  operations: CRDTOperation[];
  version: number;
  nodeId: string;
}

export class MemoryCRDTService {
  private state: CRDTState;
  private pendingOperations: CRDTOperation[] = [];

  constructor(nodeId: string) {
    this.state = {
      operations: [],
      version: 0,
      nodeId
    };
  }

  /**
   * Add operation to CRDT
   */
  addOperation(type: CRDTOperation['type'], data: any): CRDTOperation {
    const operation: CRDTOperation = {
      id: uuidv4(),
      type,
      nodeId: this.state.nodeId,
      timestamp: Date.now(),
      data
    };

    this.state.operations.push(operation);
    this.state.version++;
    this.pendingOperations.push(operation);

    return operation;
  }

  /**
   * Merge CRDT state from another node
   */
  mergeState(remoteState: CRDTState): void {
    // Merge operations using last-write-wins based on timestamp
    const mergedOps = new Map<string, CRDTOperation>();

    // Add local operations
    for (const op of this.state.operations) {
      mergedOps.set(op.id, op);
    }

    // Add remote operations, keeping the one with higher timestamp
    for (const op of remoteState.operations) {
      const existing = mergedOps.get(op.id);
      if (!existing || op.timestamp > existing.timestamp) {
        mergedOps.set(op.id, op);
      }
    }

    // Convert back to array and sort by timestamp
    this.state.operations = Array.from(mergedOps.values()).sort((a, b) => a.timestamp - b.timestamp);
    this.state.version = Math.max(this.state.version, remoteState.version);
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): CRDTOperation[] {
    return [...this.pendingOperations];
  }

  /**
   * Clear pending operations
   */
  clearPendingOperations(): void {
    this.pendingOperations = [];
  }

  /**
   * Apply operation to memory state
   */
  applyOperation(operation: CRDTOperation, currentState: any): any {
    const newState = { ...currentState };

    switch (operation.type) {
      case 'add':
        if (!newState[operation.data.id]) {
          newState[operation.data.id] = operation.data;
        }
        break;
      case 'remove':
        delete newState[operation.data.id];
        break;
      case 'update':
        if (newState[operation.data.id]) {
          newState[operation.data.id] = { ...newState[operation.data.id], ...operation.data.updates };
        }
        break;
    }

    return newState;
  }

  /**
   * Apply all operations to initial state
   */
  applyAllOperations(initialState: any): any {
    let state = initialState;

    for (const operation of this.state.operations) {
      state = this.applyOperation(operation, state);
    }

    return state;
  }

  /**
   * Get CRDT state
   */
  getState(): CRDTState {
    return {
      ...this.state,
      operations: [...this.state.operations]
    };
  }

  /**
   * Reset CRDT state
   */
  reset(): void {
    this.state = {
      operations: [],
      version: 0,
      nodeId: this.state.nodeId
    };
    this.pendingOperations = [];
  }

  /**
   * Get conflict count (operations with same ID but different timestamps)
   */
  getConflictCount(): number {
    const opMap = new Map<string, CRDTOperation[]>();
    
    for (const op of this.state.operations) {
      if (!opMap.has(op.id)) {
        opMap.set(op.id, []);
      }
      opMap.get(op.id)!.push(op);
    }

    let conflicts = 0;
    for (const [, ops] of opMap) {
      if (ops.length > 1) {
        conflicts++;
      }
    }

    return conflicts;
  }

  /**
   * Get synchronization statistics
   */
  getStats(): {
    totalOperations: number;
    pendingOperations: number;
    version: number;
    conflicts: number;
  } {
    return {
      totalOperations: this.state.operations.length,
      pendingOperations: this.pendingOperations.length,
      version: this.state.version,
      conflicts: this.getConflictCount()
    };
  }
}

// Singleton instance
let memoryCRDTService: MemoryCRDTService | null = null;

export function getMemoryCRDTService(nodeId?: string): MemoryCRDTService {
  if (!memoryCRDTService) {
    memoryCRDTService = new MemoryCRDTService(nodeId || uuidv4());
  }
  return memoryCRDTService;
}

export function resetMemoryCRDTService(): void {
  memoryCRDTService = null;
}
