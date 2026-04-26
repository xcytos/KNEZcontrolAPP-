/**
 * Packet Simulation Engine
 * 
 * Each event = PACKET
 * Algorithm:
 * FOR each event:
 *   create packet
 *   assign path (edge)
 *   animate movement (time-based)
 *   update node state
 * 
 * CRITICAL: This is REAL simulation, not mock
 * Packets represent actual data flow in the system
 */

import { Packet, SystemEvent } from '../eventBus/EventSchema';
import { getEventBus } from '../eventBus/EventBus';
import { getGraphStateEngine } from '../graphState/GraphStateEngine';

// PHASE 3: Packet types
export type PacketType = 'request_packet' | 'token_packet' | 'tool_packet' | 'memory_packet' | 'response_packet';

export class PacketSimulationEngine {
  private packets: Map<string, Packet> = new Map();
  private activePackets: Map<string, Packet> = new Map();
  private eventBus = getEventBus();
  private graphState = getGraphStateEngine();
  private animationFrameId: number | null = null;
  private isRunning = false;
  
  // PHASE 3: Cap on active packets
  private readonly MAX_ACTIVE_PACKETS = 100;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Create packet from event
   */
  createPacket(event: SystemEvent): Packet {
    // PHASE 3: Check packet cap
    if (this.activePackets.size >= this.MAX_ACTIVE_PACKETS) {
      // Drop or batch overflow - for now, drop oldest
      const oldestPacketId = this.activePackets.keys().next().value;
      if (oldestPacketId) {
        this.activePackets.delete(oldestPacketId);
      }
    }

    // PHASE 3: Determine packet type from event
    const packetType = this.determinePacketType(event);

    // PHASE 3: Normalize latency for animation
    const normalizedDuration = this.normalizeLatency(event.latency_ms || 100);

    const packet: Packet = {
      packet_id: this.generateUUID(),
      event_id: event.event_id,
      trace_id: event.trace_id,
      from_node: event.source_node,
      to_node: event.target_node,
      path: this.calculatePath(event.source_node, event.target_node),
      progress: 0,
      status: 'traveling',
      start_time: Date.now(),
      estimated_arrival: Date.now() + normalizedDuration
    };

    this.packets.set(packet.packet_id, packet);
    this.activePackets.set(packet.packet_id, packet);

    // Emit packet creation event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: event.trace_id,
      timestamp: Date.now(),
      source_node: 'packet_engine',
      target_node: 'system',
      event_type: 'packet_created',
      payload: {
        packet_id: packet.packet_id,
        from_node: packet.from_node,
        to_node: packet.to_node,
        path: packet.path,
        packet_type: packetType
      },
      latency_ms: 0,
      status: 'success'
    });

    return packet;
  }

  /**
   * PHASE 3: Determine packet type from event
   */
  private determinePacketType(event: SystemEvent): PacketType {
    const { event_type, source_node, target_node } = event;

    // Determine packet type based on event and nodes
    if (target_node.includes('tool') || event_type.includes('tool')) {
      return 'tool_packet';
    }
    if (target_node.includes('memory') || event_type.includes('memory')) {
      return 'memory_packet';
    }
    if (event_type.includes('token') || source_node.includes('model')) {
      return 'token_packet';
    }
    if (source_node.includes('model') || event_type.includes('response')) {
      return 'response_packet';
    }
    return 'request_packet';
  }

  /**
   * PHASE 3: Normalize latency for animation
   * Scale: 10ms → 300ms, 200ms → 700ms, 1s → 1200ms
   * This keeps realism while avoiding jitter and maintaining readability
   */
  private normalizeLatency(latencyMs: number): number {
    // Clamp minimum to avoid too-fast animations
    const clamped = Math.max(latencyMs, 10);
    
    // Normalize using logarithmic scale
    // Formula: visual_duration = 300 + log2(latency_ms / 10) * 400
    const normalized = 300 + Math.log2(clamped / 10) * 400;
    
    // Cap maximum to avoid too-slow animations
    return Math.min(normalized, 1200);
  }

  /**
   * Calculate path from source to target
   * Uses graph state to find shortest path
   */
  private calculatePath(source: string, target: string): string[] {
    // For now, use direct path
    // In future, use graph traversal algorithm (BFS/Dijkstra)
    return [source, target];
  }

  /**
   * Start packet animation loop
   */
  startAnimation(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.animate();
  }

  /**
   * Stop packet animation loop
   */
  stopAnimation(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Animation loop
   * Implements time-based packet movement
   */
  private animate(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const packetsToRemove: string[] = [];

    // Update all active packets
    this.activePackets.forEach((packet, packetId) => {
      const elapsed = now - packet.start_time;
      const duration = packet.estimated_arrival - packet.start_time;

      if (elapsed >= duration) {
        // Packet arrived
        packet.progress = 1;
        packet.status = 'arrived';
        packetsToRemove.push(packetId);
        
        // Update node state
        this.graphState.updateNodeState(packet.to_node, 'active');
        
        // Emit packet arrival event
        this.eventBus.emit({
          event_id: this.generateUUID(),
          trace_id: packet.trace_id,
          timestamp: now,
          source_node: packet.from_node,
          target_node: packet.to_node,
          event_type: 'packet_arrived',
          payload: {
            packet_id: packet.packet_id,
            latency_ms: elapsed
          },
          latency_ms: elapsed,
          status: 'success'
        });
      } else {
        // Update progress
        packet.progress = elapsed / duration;
        
        // Update intermediate node states based on progress
        this.updateIntermediateNodeStates(packet);
      }

      // Check for failure
      if (packet.status === 'failed') {
        packetsToRemove.push(packetId);
        this.graphState.updateNodeState(packet.to_node, 'failed');
      }
    });

    // Remove completed packets
    packetsToRemove.forEach(packetId => {
      this.activePackets.delete(packetId);
    });

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update intermediate node states based on packet progress
   */
  private updateIntermediateNodeStates(packet: Packet): void {
    const pathIndex = Math.floor(packet.progress * (packet.path.length - 1));
    const currentNode = packet.path[pathIndex];
    
    if (currentNode) {
      this.graphState.updateNodeState(currentNode, 'active');
    }
  }

  /**
   * Mark packet as failed
   */
  failPacket(packetId: string): void {
    const packet = this.packets.get(packetId);
    if (!packet) return;

    packet.status = 'failed';
    this.activePackets.delete(packetId);

    // Emit packet failure event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: packet.trace_id,
      timestamp: Date.now(),
      source_node: packet.from_node,
      target_node: packet.to_node,
      event_type: 'packet_failed',
      payload: {
        packet_id: packet.packet_id,
        progress: packet.progress
      },
      latency_ms: Date.now() - packet.start_time,
      status: 'failed'
    });
  }

  /**
   * Get packet by ID
   */
  getPacket(packetId: string): Packet | undefined {
    return this.packets.get(packetId);
  }

  /**
   * Get all active packets
   */
  getActivePackets(): Packet[] {
    return Array.from(this.activePackets.values());
  }

  /**
   * Get packets by trace ID
   */
  getPacketsByTrace(traceId: string): Packet[] {
    return Array.from(this.packets.values()).filter(p => p.trace_id === traceId);
  }

  /**
   * Get packet statistics
   */
  getStatistics(): {
    total_packets: number;
    active_packets: number;
    completed_packets: number;
    failed_packets: number;
    avg_latency_ms: number;
  } {
    const packets = Array.from(this.packets.values());
    const completed = packets.filter(p => p.status === 'arrived');
    const failed = packets.filter(p => p.status === 'failed');
    
    const latencies = completed.map(p => p.estimated_arrival - p.start_time);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      total_packets: packets.length,
      active_packets: this.activePackets.size,
      completed_packets: completed.length,
      failed_packets: failed.length,
      avg_latency_ms: avgLatency
    };
  }

  /**
   * Clear all packets
   */
  clear(): void {
    this.packets.clear();
    this.activePackets.clear();
  }

  /**
   * Setup event listeners
   * This implements event-driven state propagation (NO POLLING)
   */
  private setupEventListeners(): void {
    // Listen to events and create packets
    this.eventBus.subscribe('*', (event: SystemEvent) => {
      // Only create packets for transition events
      if (event.event_type === 'transition' || 
          event.event_type === 'data_flow' ||
          event.event_type === 'control_flow') {
        this.createPacket(event);
      }
    });

    // Listen to trace completion to clean up packets
    this.eventBus.subscribe('trace_complete', (event: SystemEvent) => {
      const packets = this.getPacketsByTrace(event.trace_id);
      packets.forEach(packet => {
        if (packet.status === 'traveling') {
          this.failPacket(packet.packet_id);
        }
      });
    });
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Singleton instance
let packetSimulationEngineInstance: PacketSimulationEngine | null = null;

export function getPacketSimulationEngine(): PacketSimulationEngine {
  if (!packetSimulationEngineInstance) {
    packetSimulationEngineInstance = new PacketSimulationEngine();
  }
  return packetSimulationEngineInstance;
}
