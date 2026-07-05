type Timestamped = Record<string, any>;

function parseTime(ts: string | number | Date | undefined | null): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime();
}

function byRecentDesc<T extends Timestamped>(field: string): (a: T, b: T) => number {
  return (a, b) => parseTime(b[field]) - parseTime(a[field]);
}

function byRecentAsc<T extends Timestamped>(field: string): (a: T, b: T) => number {
  return (a, b) => parseTime(a[field]) - parseTime(b[field]);
}

export { parseTime, byRecentDesc, byRecentAsc };

export function sortByRecent<T extends Timestamped>(items: T[], field: string): T[] {
  return [...items].sort(byRecentDesc(field));
}

export function sortByOldest<T extends Timestamped>(items: T[], field: string): T[] {
  return [...items].sort(byRecentAsc(field));
}

export function sortProjects<T extends { created_at?: string; last_accessed?: string }>(items: T[]): T[] {
  return sortByRecent(items, 'last_accessed' in items[0] || 'created_at' in items[0]
    ? (items[0]?.last_accessed ? 'last_accessed' : 'created_at')
    : 'created_at');
}

export function sortSessions<T extends { updated_at?: string; updatedAt?: string; created_at?: string; createdAt?: string; lastActivity?: string | Date }>(items: T[]): T[] {
  const first = items[0];
  if (!first) return items;
  if ('updatedAt' in first) return sortByRecent(items, 'updatedAt');
  if ('updated_at' in first) return sortByRecent(items, 'updated_at');
  if ('lastActivity' in first) return sortByRecent(items, 'lastActivity');
  if ('createdAt' in first) return sortByRecent(items, 'createdAt');
  return sortByRecent(items, 'created_at');
}

export function sortDocuments<T extends { updated_at?: string; created_at?: string }>(items: T[]): T[] {
  return sortByRecent(items, 'updated_at' in (items[0] || {}) ? 'updated_at' : 'created_at');
}

export function sortTickets<T extends { updated_at?: string; created_at?: string }>(items: T[]): T[] {
  return sortByRecent(items, 'updated_at' in (items[0] || {}) ? 'updated_at' : 'created_at');
}
