/**
 * PostgreSQL Connection Manager
 * Centralized utility for managing PostgreSQL connections across the application
 * Follows singleton pattern to ensure single shared connection
 */

import { postgresService } from './DatabaseService';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Default Supabase configuration
const DEFAULT_CONFIG: PostgresConfig = {
  host: 'db.sspsljqdhesqezrmspcj.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'TAQWIN%21%40%23777',
};

/**
 * Initialize PostgreSQL connection if not already connected
 * @param config Optional custom configuration (defaults to Supabase)
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function ensurePostgresConnection(
  config: PostgresConfig = DEFAULT_CONFIG
): Promise<boolean> {
  try {
    // Check if already connected
    if (postgresService.isConnected()) {
      console.log('[PostgresConnectionManager] Already connected');
      return true;
    }

    console.log('[PostgresConnectionManager] Initiating connection...');
    const connected = await postgresService.connect(config);

    if (connected) {
      console.log('[PostgresConnectionManager] Connection established successfully');
      return true;
    } else {
      console.warn('[PostgresConnectionManager] Connection failed');
      return false;
    }
  } catch (error) {
    console.error('[PostgresConnectionManager] Connection error:', error);
    return false;
  }
}

/**
 * Check if PostgreSQL is currently connected
 * @returns boolean - connection status
 */
export function isPostgresConnected(): boolean {
  return postgresService.isConnected();
}

/**
 * Get the shared PostgreSQL service instance
 * @returns PostgresService singleton instance
 */
export function getPostgresService() {
  return postgresService;
}
