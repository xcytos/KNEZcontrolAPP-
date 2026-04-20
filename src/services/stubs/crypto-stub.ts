/**
 * Browser-compatible stub for Node.js crypto module
 * 
 * This stub provides minimal hash functionality using Web Crypto API
 * to replace the Node.js crypto module in browser environment.
 */

class Hash {
  private data: Uint8Array[] = [];
  // @ts-expect-error - algorithm parameter kept for API compatibility but not used in stub
  constructor(private _algorithm: string) {}

  update(data: string | Buffer): Hash {
    if (typeof data === 'string') {
      this.data.push(new TextEncoder().encode(data));
    } else {
      this.data.push(new Uint8Array(data));
    }
    return this;
  }

  digest(encoding?: string): string | Buffer {
    const combined = new Uint8Array(this.data.reduce((acc, arr) => acc + arr.length, 0));
    let offset = 0;
    for (const arr of this.data) {
      combined.set(arr, offset);
      offset += arr.length;
    }

    // Simple hash for stub (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const hexHash = Math.abs(hash).toString(16).padStart(64, '0');
    
    if (encoding === 'hex') {
      return hexHash;
    }
    
    return Buffer.from(hexHash, 'hex');
  }
}

export function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

export function randomBytes(size: number): Buffer {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

export function createHmac(_algorithm: string, _key: string | Buffer): Hash {
  return new Hash(_algorithm);
}

export function pbkdf2(
  _password: string | Buffer,
  _salt: string | Buffer,
  _iterations: number,
  keylen: number,
  _digest: string,
  callback: (err: Error | null, key: Buffer) => void
): void {
  // Stub implementation
  const key = randomBytes(keylen);
  callback(null, key);
}

export function pbkdf2Sync(
  _password: string | Buffer,
  _salt: string | Buffer,
  _iterations: number,
  keylen: number,
  _digest: string
): Buffer {
  return randomBytes(keylen);
}

export default {
  createHash,
  randomBytes,
  createHmac,
  pbkdf2,
  pbkdf2Sync,
};
