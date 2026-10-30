import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  memoryLocalCache,
  disableNetwork,
  setLogLevel,
  Firestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '@/firebase-applet-config.json';

// Silence internal @firebase/firestore console.error spam on free-tier quota exhaustion / backoff
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported
}

const app = initializeApp(firebaseConfig);
const config = firebaseConfig as any;
const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? config.firestoreDatabaseId
  : undefined;

let firestoreDb: Firestore;
try {
  // Use memoryLocalCache so previously stuck mutations in IndexedDB are never replayed on startup
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
    },
    dbId
  );
} catch {
  firestoreDb = getFirestore(app, dbId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

const QUOTA_FLAG_KEY = 'shafa_firestore_quota_tripped';
let quotaTrippedInMemory = false;

export function isQuotaOrOfflineError(err: any): boolean {
  const msg = String(err?.message || err?.code || err || '').toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('resource-exhausted') ||
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('circuit-breaker') ||
    msg.includes('timeout')
  );
}

export function isFirestoreQuotaTripped(): boolean {
  if (quotaTrippedInMemory) return true;
  try {
    if (sessionStorage.getItem(QUOTA_FLAG_KEY) === '1') {
      quotaTrippedInMemory = true;
      return true;
    }
  } catch {
    // Ignore sessionStorage errors
  }
  return false;
}

export function tripFirestoreQuota(): void {
  quotaTrippedInMemory = true;
  try {
    sessionStorage.setItem(QUOTA_FLAG_KEY, '1');
  } catch {
    // Ignore sessionStorage errors
  }
  try {
    disableNetwork(db).catch(() => {});
  } catch {
    // Ignore disableNetwork errors
  }
}

if (isFirestoreQuotaTripped()) {
  try {
    disableNetwork(db).catch(() => {});
  } catch {
    // Ignore
  }
}

/**
 * Executes a Firestore read or write operation with a fast timeout and quota circuit breaker.
 * If Firestore daily read/write quota is exhausted (causing rejections or write-stream backoff hangs),
 * it immediately trips the circuit breaker, disables background Firestore retries, and throws so callers
 * can seamlessly fall back to local cache.
 */
export async function runFirestoreOp<T>(op: () => Promise<T>, timeoutMs: number = 2000): Promise<T> {
  if (isFirestoreQuotaTripped()) {
    throw new Error('quota-circuit-breaker');
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race<T>([
      op(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('firestore-op-timeout'));
        }, timeoutMs);
      }),
    ]);
    return result;
  } catch (err: any) {
    if (isQuotaOrOfflineError(err)) {
      tripFirestoreQuota();
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function readLocalCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export default app;


