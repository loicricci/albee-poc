/**
 * API Cache with Stale-While-Revalidate Strategy
 * 
 * Provides instant loading from cache while updating in background
 * Dramatically improves perceived performance
 * 
 * IMPORTANT: Cache keys are now user-specific to prevent data leakage
 * between different user sessions on the same browser.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  version: number;
  userId?: string; // Track which user this cache belongs to
};

type CacheConfig = {
  ttl: number; // Time to live in milliseconds
  key: string;
};

// Cache TTL configuration
export const CACHE_TTL = {
  profile: 5 * 60 * 1000,       // 5 minutes
  config: 30 * 60 * 1000,        // 30 minutes
  feed: 2 * 60 * 1000,           // 2 minutes
  unifiedFeed: 2 * 60 * 1000,    // 2 minutes
  avees: 5 * 60 * 1000,          // 5 minutes
  recommendations: 10 * 60 * 1000, // 10 minutes
  onboarding: 60 * 60 * 1000,    // 1 hour
};

const CACHE_VERSION = 2; // Increment to invalidate all caches (bumped for user isolation fix)

// Store current user ID for cache isolation
const CURRENT_USER_KEY = 'cache_current_user_id';

/**
 * Set the current user ID for cache isolation
 * Call this on login/auth changes
 */
export function setCurrentCacheUser(userId: string | null): void {
  try {
    if (userId) {
      const previousUserId = localStorage.getItem(CURRENT_USER_KEY);
      if (previousUserId && previousUserId !== userId) {
        // User changed! Clear all caches from previous user
        console.log(`[Cache] User changed from ${previousUserId} to ${userId}, clearing all caches`);
        clearAllCaches();
      }
      localStorage.setItem(CURRENT_USER_KEY, userId);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (e) {
    console.warn('Failed to set cache user:', e);
  }
}

/**
 * Get the current user ID for cache validation
 */
export function getCurrentCacheUser(): string | null {
  try {
    return localStorage.getItem(CURRENT_USER_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Get item from localStorage cache
 * Now validates that cached data belongs to the current user
 */
function getCacheItem<T>(key: string): CacheEntry<T> | null {
  try {
    const item = localStorage.getItem(`cache_${key}`);
    if (!item) return null;

    const cached = JSON.parse(item) as CacheEntry<T>;
    
    // Check cache version
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    // CRITICAL: Validate user ID to prevent data leakage between users
    // Skip validation for non-user-specific data like 'config'
    if (key !== 'config') {
      const currentUserId = getCurrentCacheUser();
      
      // If we have a current user ID, validate the cached entry
      if (currentUserId) {
        // If cached entry has no userId (legacy) or wrong userId, reject it
        if (!cached.userId || cached.userId !== currentUserId) {
          console.log(`[Cache] Rejecting cached ${key}: ${cached.userId ? 'belongs to different user' : 'no user ID (legacy cache)'}`);
          localStorage.removeItem(`cache_${key}`);
          return null;
        }
      }
      
      // If NO current user is set but cache has a userId, reject it
      // (This happens when cache wasn't properly cleared on logout)
      if (!currentUserId && cached.userId) {
        console.log(`[Cache] Rejecting cached ${key}: no current user but cache has userId`);
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
    }

    return cached;
  } catch (e) {
    console.warn(`Failed to get cache item ${key}:`, e);
    return null;
  }
}

/**
 * Set item in localStorage cache
 * Now includes user ID for validation on retrieval
 */
function setCacheItem<T>(key: string, data: T): void {
  try {
    const currentUserId = getCurrentCacheUser();
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      userId: currentUserId || undefined, // Include user ID for validation
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    console.warn(`Failed to set cache item ${key}:`, e);
    // If localStorage is full, clear old caches
    clearOldCaches();
  }
}

/**
 * Check if cache entry is stale (older than TTL)
 */
function isStale(entry: CacheEntry<any>, ttl: number): boolean {
  return Date.now() - entry.timestamp > ttl;
}

/**
 * Clear old cache entries (keep only last 1 hour)
 */
function clearOldCaches(): void {
  try {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith('cache_')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const cached = JSON.parse(item);
            if (cached.timestamp < oneHourAgo) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to clear old caches:', e);
  }
}

// Track background revalidations to prevent duplicates
const revalidating = new Set<string>();

// Track recent fetches with timestamps to prevent duplicate fetches within short window
const recentFetches = new Map<string, { promise: Promise<any>; timestamp: number }>();
const DEBOUNCE_WINDOW_MS = 100; // 100ms debounce window

/**
 * Revalidate cache in background
 */
async function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate?: (data: T) => void
): Promise<void> {
  // Prevent duplicate background revalidations
  if (revalidating.has(key)) {
    return;
  }

  revalidating.add(key);

  try {
    const data = await fetcher();
    setCacheItem(key, data);
    
    // Notify if there's an update callback
    if (onUpdate) {
      onUpdate(data);
    }
  } catch (e) {
    console.warn(`Background revalidation failed for ${key}:`, e);
  } finally {
    revalidating.delete(key);
  }
}

/**
 * Cached fetch with stale-while-revalidate strategy and debouncing
 * 
 * @param key - Unique cache key
 * @param fetcher - Function that fetches fresh data
 * @param ttl - Time to live in milliseconds
 * @param onUpdate - Optional callback when background revalidation completes
 * @returns Cached or fresh data
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  onUpdate?: (data: T) => void
): Promise<T> {
  const cached = getCacheItem<T>(key);

  // Cache hit and not stale - return immediately
  if (cached && !isStale(cached, ttl)) {
    return cached.data;
  }

  // Cache hit but stale - return stale data and revalidate in background
  if (cached && isStale(cached, ttl)) {
    // Return stale data immediately for instant loading
    revalidateInBackground(key, fetcher, onUpdate);
    return cached.data;
  }

  // Cache miss - check for recent fetch in debounce window
  const recent = recentFetches.get(key);
  if (recent && (Date.now() - recent.timestamp) < DEBOUNCE_WINDOW_MS) {
    // Return the existing promise instead of making duplicate request
    console.log(`[Cache] Debounce hit for ${key}, reusing in-flight request`);
    return recent.promise;
  }

  // Cache miss - fetch and cache
  const promise = fetcher().then(data => {
    setCacheItem(key, data);
    // Clean up after request completes
    setTimeout(() => recentFetches.delete(key), DEBOUNCE_WINDOW_MS);
    return data;
  }).catch(e => {
    recentFetches.delete(key);
    throw e;
  });

  // Track this fetch
  recentFetches.set(key, { promise, timestamp: Date.now() });
  
  return promise;
}

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(key: string): void {
  try {
    localStorage.removeItem(`cache_${key}`);
  } catch (e) {
    console.warn(`Failed to invalidate cache ${key}:`, e);
  }
}

/**
 * Invalidate all caches matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(`cache_`) && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn(`Failed to invalidate cache pattern ${pattern}:`, e);
  }
}

/**
 * Clear all caches (but KEEP the user ID tracker for detecting user changes)
 */
export function clearAllCaches(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      // Clear all cache_ keys EXCEPT the current user tracker
      if (key.startsWith('cache_') && key !== CURRENT_USER_KEY) {
        localStorage.removeItem(key);
      }
    }
    console.log('[Cache] All caches cleared (user tracker preserved)');
  } catch (e) {
    console.warn('Failed to clear all caches:', e);
  }
}

/**
 * Clear all caches AND reset the user tracker (full reset)
 */
export function clearAllCachesAndUser(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(CURRENT_USER_KEY);
    console.log('[Cache] All caches and user tracker cleared');
  } catch (e) {
    console.warn('Failed to clear all caches:', e);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
} {
  try {
    const keys = Object.keys(localStorage);
    let totalEntries = 0;
    let totalSize = 0;
    let oldestEntry: number | null = null;

    for (const key of keys) {
      if (key.startsWith('cache_')) {
        totalEntries++;
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length;
          try {
            const cached = JSON.parse(item);
            if (!oldestEntry || cached.timestamp < oldestEntry) {
              oldestEntry = cached.timestamp;
            }
          } catch (e) {
            // Invalid entry
          }
        }
      }
    }

    return { totalEntries, totalSize, oldestEntry };
  } catch (e) {
    return { totalEntries: 0, totalSize: 0, oldestEntry: null };
  }
}


