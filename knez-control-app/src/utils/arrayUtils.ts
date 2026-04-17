/**
 * Array utility functions for common operations
 */

/**
 * Deduplicate an array of strings and remove a specific value, then limit to N items
 * 
 * @param items - Array of strings to deduplicate
 * @param exclude - Value to exclude from the result
 * @param limit - Maximum number of items to return (default: 4)
 * @returns Deduplicated array with excluded value removed, limited to N items
 */
export function deduplicateAndExclude(items: string[], exclude: string, limit: number = 4): string[] {
  return [...new Set(items)].filter(a => a !== exclude).slice(0, limit);
}
