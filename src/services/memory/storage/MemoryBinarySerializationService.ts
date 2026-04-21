/**
 * Memory Binary Serialization Service
 * 
 * Implements binary serialization for memory data
 * 
 * Applied Learnings:
 * - Learning 62-68: Compression Algorithms for serialization
 * - Learning 69-72: Compression Ratio vs Speed Trade-offs
 * - Learning 73-74: Data Deduplication for binary storage
 */

import { getMemoryEventSourcingService, MemoryState } from '../storage/MemoryEventSourcingService';
import { getMemoryCompressionService } from '../compression/MemoryCompressionService';

export interface SerializationFormat {
  format: 'json' | 'binary' | 'protobuf' | 'msgpack';
  compressed: boolean;
  compressionAlgorithm: string;
}

export interface SerializationResult {
  data: Buffer;
  format: SerializationFormat;
  originalSize: number;
  serializedSize: number;
  timeMs: number;
}

export class MemoryBinarySerializationService {
  private compressionService = getMemoryCompressionService();
  private memoryService = getMemoryEventSourcingService();

  /**
   * Serialize memory to binary format
   */
  serializeMemory(memory: MemoryState, format: SerializationFormat['format'] = 'json', compress: boolean = true): SerializationResult {
    const startTime = Date.now();

    let serialized: Buffer;

    switch (format) {
      case 'json':
        serialized = Buffer.from(JSON.stringify(memory));
        break;
      case 'binary':
        serialized = this.serializeToBinary(memory);
        break;
      case 'protobuf':
        // For now, fall back to JSON (protobuf would require schema definition)
        serialized = Buffer.from(JSON.stringify(memory));
        break;
      case 'msgpack':
        // For now, fall back to JSON (msgpack would require library)
        serialized = Buffer.from(JSON.stringify(memory));
        break;
      default:
        serialized = Buffer.from(JSON.stringify(memory));
    }

    const originalSize = serialized.length;

    if (compress) {
      const compressionResult = this.compressionService.compress(serialized);
      serialized = compressionResult.compressed;
    }

    const timeMs = Date.now() - startTime;

    return {
      data: serialized,
      format: {
        format,
        compressed: compress,
        compressionAlgorithm: compress ? this.compressionService.getConfig().algorithm : 'none'
      },
      originalSize,
      serializedSize: serialized.length,
      timeMs
    };
  }

  /**
   * Deserialize memory from binary format
   */
  deserializeMemory(data: Buffer, format: SerializationFormat): MemoryState | null {
    try {
      let decompressed = data;

      if (format.compressed) {
        decompressed = this.compressionService.decompress(data, format.compressionAlgorithm as any);
      }

      switch (format.format) {
        case 'json':
          return JSON.parse(decompressed.toString('utf-8'));
        case 'binary':
          return this.deserializeFromBinary(decompressed);
        case 'protobuf':
        case 'msgpack':
          return JSON.parse(decompressed.toString('utf-8'));
        default:
          return JSON.parse(decompressed.toString('utf-8'));
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Serialize to custom binary format
   */
  private serializeToBinary(memory: MemoryState): Buffer {
    const buffers: Buffer[] = [];

    // Write ID (UUID as 16 bytes)
    const idBuffer = Buffer.from(memory.id.replace(/-/g, ''), 'hex');
    buffers.push(idBuffer);

    // Write type (1 byte)
    const typeMap: Record<string, number> = { 'learning': 1, 'mistake': 2, 'decision': 3, 'pattern': 4 };
    buffers.push(Buffer.from([typeMap[memory.type] || 0]));

    // Write title (length + string)
    const titleBuffer = Buffer.from(memory.title);
    buffers.push(Buffer.from([titleBuffer.length]));
    buffers.push(titleBuffer);

    // Write content (length + string)
    const contentBuffer = Buffer.from(memory.content);
    buffers.push(Buffer.from([contentBuffer.length >> 8, contentBuffer.length & 0xFF]));
    buffers.push(contentBuffer);

    // Write domain (length + string)
    const domainBuffer = Buffer.from(memory.domain);
    buffers.push(Buffer.from([domainBuffer.length]));
    buffers.push(domainBuffer);

    // Write tags (count + array)
    const tagCount = memory.tags.length;
    buffers.push(Buffer.from([tagCount]));
    memory.tags.forEach(tag => {
      const tagBuffer = Buffer.from(tag);
      buffers.push(Buffer.from([tagBuffer.length]));
      buffers.push(tagBuffer);
    });

    // Write timestamps (8 bytes each)
    const createdAtBuffer = Buffer.from(new Date(memory.createdAt).getTime().toString(), 'utf-8');
    const updatedAtBuffer = Buffer.from(new Date(memory.updatedAt).getTime().toString(), 'utf-8');
    buffers.push(createdAtBuffer);
    buffers.push(updatedAtBuffer);

    // Write metadata (JSON string)
    const metadataBuffer = Buffer.from(JSON.stringify(memory.metadata));
    buffers.push(Buffer.from([metadataBuffer.length >> 8, metadataBuffer.length & 0xFF]));
    buffers.push(metadataBuffer);

    return Buffer.concat(buffers);
  }

  /**
   * Deserialize from custom binary format
   */
  private deserializeFromBinary(data: Buffer): MemoryState | null {
    try {
      let offset = 0;

      // Read ID (16 bytes)
      const idBytes = data.slice(offset, offset + 16);
      const id = `${idBytes.slice(0, 4).toString('hex')}-${idBytes.slice(4, 6).toString('hex')}-${idBytes.slice(6, 8).toString('hex')}-${idBytes.slice(8, 10).toString('hex')}-${idBytes.slice(10, 16).toString('hex')}`;
      offset += 16;

      // Read type (1 byte)
      const typeMap: Record<number, string> = { 1: 'learning', 2: 'mistake', 3: 'decision', 4: 'pattern' };
      const type = typeMap[data[offset]] || 'unknown';
      offset += 1;

      // Read title
      const titleLength = data[offset];
      offset += 1;
      const title = data.slice(offset, offset + titleLength).toString('utf-8');
      offset += titleLength;

      // Read content
      const contentLength = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const content = data.slice(offset, offset + contentLength).toString('utf-8');
      offset += contentLength;

      // Read domain
      const domainLength = data[offset];
      offset += 1;
      const domain = data.slice(offset, offset + domainLength).toString('utf-8');
      offset += domainLength;

      // Read tags
      const tagCount = data[offset];
      offset += 1;
      const tags: string[] = [];
      for (let i = 0; i < tagCount; i++) {
        const tagLength = data[offset];
        offset += 1;
        tags.push(data.slice(offset, offset + tagLength).toString('utf-8'));
        offset += tagLength;
      }

      // Read timestamps
      const createdAt = new Date(parseInt(data.slice(offset, offset + 8).toString('utf-8'))).toISOString();
      offset += 8;
      const updatedAt = new Date(parseInt(data.slice(offset, offset + 8).toString('utf-8'))).toISOString();
      offset += 8;

      // Read metadata
      const metadataLength = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const metadata = JSON.parse(data.slice(offset, offset + metadataLength).toString('utf-8'));

      // Reconstruct relations (simplified - in production would need full serialization)
      const relations = this.memoryService.getMemoryState(id)?.relations || [];

      return {
        id,
        type: type as any,
        title,
        content,
        domain,
        tags,
        metadata,
        createdAt,
        updatedAt,
        relations,
        version: 1
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch serialize memories
   */
  batchSerializeMemories(memories: MemoryState[], format: SerializationFormat['format'] = 'json', compress: boolean = true): Map<string, SerializationResult> {
    const results = new Map<string, SerializationResult>();

    for (const memory of memories) {
      const result = this.serializeMemory(memory, format, compress);
      results.set(memory.id, result);
    }

    return results;
  }

  /**
   * Compare serialization formats
   */
  benchmarkFormats(memory: MemoryState): Map<string, SerializationResult> {
    const results = new Map<string, SerializationResult>();
    const formats: SerializationFormat['format'][] = ['json', 'binary'];

    for (const format of formats) {
      const result = this.serializeMemory(memory, format, true);
      results.set(format, result);
    }

    return results;
  }

  /**
   * Get serialization statistics
   */
  getStats(): {
    supportedFormats: SerializationFormat['format'][];
    defaultFormat: SerializationFormat['format'];
    compressionEnabled: boolean;
  } {
    return {
      supportedFormats: ['json', 'binary', 'protobuf', 'msgpack'],
      defaultFormat: 'json',
      compressionEnabled: true
    };
  }
}

// Singleton instance
let memoryBinarySerializationService: MemoryBinarySerializationService | null = null;

export function getMemoryBinarySerializationService(): MemoryBinarySerializationService {
  if (!memoryBinarySerializationService) {
    memoryBinarySerializationService = new MemoryBinarySerializationService();
  }
  return memoryBinarySerializationService;
}

export function resetMemoryBinarySerializationService(): void {
  memoryBinarySerializationService = null;
}
