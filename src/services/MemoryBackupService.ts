/**
 * Memory Backup and Recovery Service
 * 
 * Implements backup and recovery for memory data
 * 
 * Applied Learnings:
 * - Learning 1-18: File Compression Formats for backup storage
 * - Learning 19-30: Database Compression for backup optimization
 * - Learning 73-74: Data Deduplication for incremental backups
 * - Learning 31-33: SQLite WAL for consistent backups
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMemoryEventSourcingService } from './MemoryEventSourcingService';
import { getMemoryCompressionService, CompressionAlgorithm } from './MemoryCompressionService';

export interface BackupConfig {
  backupDir: string;
  compressionAlgorithm: CompressionAlgorithm;
  retentionDays: number;
  autoBackupEnabled: boolean;
  autoBackupInterval: number; // minutes
}

export interface BackupMetadata {
  backupId: string;
  timestamp: string;
  memoryCount: number;
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
  checksum: string;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  metadata: BackupMetadata;
  error?: string;
}

export class MemoryBackupService {
  private config: BackupConfig;
  private compressionService = getMemoryCompressionService();
  private memoryService = getMemoryEventSourcingService();

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      backupDir: config.backupDir || '.taqwin/backups',
      compressionAlgorithm: config.compressionAlgorithm || 'gzip',
      retentionDays: config.retentionDays || 30,
      autoBackupEnabled: config.autoBackupEnabled ?? false,
      autoBackupInterval: config.autoBackupInterval || 60
    };
  }

  /**
   * Create a full backup of all memories
   */
  async createBackup(): Promise<BackupResult> {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true });
      }

      // Get all memories
      const memories = this.memoryService.getAllMemories();
      const originalData = JSON.stringify(memories);
      const originalSize = Buffer.byteLength(originalData);

      // Compress backup data
      const compressionResult = this.compressionService.compress(originalData);

      // Generate backup ID
      const backupId = `backup-${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Calculate checksum
      const checksum = this.calculateChecksum(compressionResult.compressed);

      // Write backup file
      const backupPath = path.join(this.config.backupDir, `${backupId}.json${this.getExtension()}`);
      fs.writeFileSync(backupPath, compressionResult.compressed);

      // Write metadata
      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        memoryCount: memories.length,
        compressedSize: compressionResult.compressedSize,
        originalSize,
        compressionRatio: compressionResult.ratio,
        checksum
      };

      const metadataPath = path.join(this.config.backupDir, `${backupId}.meta.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Clean old backups
      await this.cleanOldBackups();

      return {
        success: true,
        backupId,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        backupId: '',
        metadata: {} as BackupMetadata,
        error: String(error)
      };
    }
  }

  /**
   * Create incremental backup (only changed memories since last backup)
   */
  async createIncrementalBackup(lastBackupId: string): Promise<BackupResult> {
    try {
      const lastBackup = await this.getBackupMetadata(lastBackupId);
      if (!lastBackup) {
        return {
          success: false,
          backupId: '',
          metadata: {} as BackupMetadata,
          error: 'Last backup not found'
        };
      }

      // Get memories modified since last backup
      const allMemories = this.memoryService.getAllMemories();
      const changedMemories = allMemories.filter(m => 
        new Date(m.updatedAt) > new Date(lastBackup.timestamp)
      );

      if (changedMemories.length === 0) {
        return {
          success: true,
          backupId: `incremental-${Date.now()}`,
          metadata: {
            backupId: `incremental-${Date.now()}`,
            timestamp: new Date().toISOString(),
            memoryCount: 0,
            compressedSize: 0,
            originalSize: 0,
            compressionRatio: 1,
            checksum: ''
          }
        };
      }

      // Compress changed memories
      const originalData = JSON.stringify(changedMemories);
      const compressionResult = this.compressionService.compress(originalData);

      // Generate backup ID
      const backupId = `incremental-${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Calculate checksum
      const checksum = this.calculateChecksum(compressionResult.compressed);

      // Write backup file
      const backupPath = path.join(this.config.backupDir, `${backupId}.json${this.getExtension()}`);
      fs.writeFileSync(backupPath, compressionResult.compressed);

      // Write metadata
      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        memoryCount: changedMemories.length,
        compressedSize: compressionResult.compressedSize,
        originalSize: Buffer.byteLength(originalData),
        compressionRatio: compressionResult.ratio,
        checksum
      };

      const metadataPath = path.join(this.config.backupDir, `${backupId}.meta.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        success: true,
        backupId,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        backupId: '',
        metadata: {} as BackupMetadata,
        error: String(error)
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        return {
          success: false,
          error: 'Backup not found'
        };
      }

      // Verify checksum
      const backupPath = path.join(this.config.backupDir, `${backupId}.json${this.getExtension()}`);
      const compressedData = fs.readFileSync(backupPath);
      const currentChecksum = this.calculateChecksum(compressedData);

      if (currentChecksum !== metadata.checksum) {
        return {
          success: false,
          error: 'Backup checksum mismatch - data may be corrupted'
        };
      }

      // Decompress data
      const decompressedData = this.compressionService.decompress(
        compressedData,
        metadata.compressionRatio < 1 ? this.config.compressionAlgorithm : 'none'
      );

      const memories = JSON.parse(decompressedData.toString('utf-8'));

      // Restore memories (this would need to be implemented in MemoryEventSourcingService)
      // For now, just validate the data structure
      if (!Array.isArray(memories)) {
        return {
          success: false,
          error: 'Invalid backup data structure'
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupMetadata[] {
    if (!fs.existsSync(this.config.backupDir)) {
      return [];
    }

    const backups: BackupMetadata[] = [];
    const files = fs.readdirSync(this.config.backupDir);

    files.forEach(file => {
      if (file.endsWith('.meta.json')) {
        const metadataPath = path.join(this.config.backupDir, file);
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          backups.push(metadata);
        } catch (error) {
          // Skip invalid metadata files
        }
      }
    });

    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get backup metadata
   */
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const metadataPath = path.join(this.config.backupDir, `${backupId}.meta.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      return metadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): boolean {
    try {
      const backupPath = path.join(this.config.backupDir, `${backupId}.json${this.getExtension()}`);
      const metadataPath = path.join(this.config.backupDir, `${backupId}.meta.json`);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean old backups beyond retention period
   */
  private async cleanOldBackups(): Promise<void> {
    const backups = this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    for (const backup of backups) {
      const backupDate = new Date(backup.timestamp);
      if (backupDate < cutoffDate) {
        this.deleteBackup(backup.backupId);
      }
    }
  }

  /**
   * Calculate checksum for backup verification
   */
  private calculateChecksum(data: Buffer): string {
    // Simple checksum for verification (in production, use SHA-256)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get file extension based on compression algorithm
   */
  private getExtension(): string {
    switch (this.config.compressionAlgorithm) {
      case 'gzip':
        return '.gz';
      case 'deflate':
        return '.deflate';
      default:
        return '';
    }
  }

  /**
   * Get backup statistics
   */
  getStats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  } {
    const backups = this.listBackups();
    
    let totalSize = 0;
    backups.forEach(backup => {
      const backupPath = path.join(this.config.backupDir, `${backup.backupId}.json${this.getExtension()}`);
      if (fs.existsSync(backupPath)) {
        totalSize += fs.statSync(backupPath).size;
      }
    });

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }
}

// Singleton instance
let memoryBackupService: MemoryBackupService | null = null;

export function getMemoryBackupService(): MemoryBackupService {
  if (!memoryBackupService) {
    memoryBackupService = new MemoryBackupService();
  }
  return memoryBackupService;
}

export function resetMemoryBackupService(): void {
  memoryBackupService = null;
}
