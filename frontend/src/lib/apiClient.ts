/**
 * Centralized API Client
 * 
 * Provides:
 * - Automatic auth token handling
 * - Request deduplication
 * - Smart caching with stale-while-revalidate
 * - Error handling
 */

import { getAuthToken } from "./authQueue";
import { cachedFetch, CACHE_TTL, invalidateCache, invalidateCachePattern } from "./apiCache";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Clear all in-flight requests (call when auth changes)
 * This prevents stale request promises from being reused after user switch
 */
export function clearInFlightRequests(): void {
  inFlightRequests.clear();
}

/**
 * Base API fetch with auth and error handling
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error("Not authenticated");
  }

  const url = `${API_BASE}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * API GET with request deduplication
 * Prevents multiple identical requests from being sent simultaneously
 */
async function apiGet<T>(path: string): Promise<T> {
  const key = `GET:${path}`;
  
  // If this request is already in flight, return the existing promise
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // Create new request
  const promise = apiFetch<T>(path).finally(() => {
    // Remove from in-flight when done
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * API GET with caching
 */
async function apiGetCached<T>(
  path: string,
  cacheKey: string,
  ttl: number,
  onUpdate?: (data: T) => void
): Promise<T> {
  return cachedFetch(
    cacheKey,
    () => apiGet<T>(path),
    ttl,
    onUpdate
  );
}

// ============================================
// Typed API Methods
// ============================================

export type Profile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
};

export type AppConfig = {
  app_name?: string;
  app_logo_url?: string;
  app_cover_url?: string;
  app_favicon_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
};

export type Avee = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type Recommendation = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  owner_user_id: string;
};

export type FeedResponse = {
  items: any[];
  total_items: number;
  total_unread: number;
};

export type UnifiedFeedResponse = {
  items: any[];
  total_items: number;
  has_more: boolean;
};

export type OnboardingStatus = {
  completed: boolean;
  current_step?: number;
};

/**
 * Get user profile (cached)
 */
export async function getProfile(onUpdate?: (data: Profile) => void): Promise<Profile> {
  return apiGetCached<Profile>(
    "/me/profile",
    "profile",
    CACHE_TTL.profile,
    onUpdate
  );
}

/**
 * Get app configuration (cached)
 */
export async function getAppConfig(onUpdate?: (data: AppConfig) => void): Promise<AppConfig> {
  return apiGetCached<AppConfig>(
    "/config",
    "config",
    CACHE_TTL.config,
    onUpdate
  );
}

/**
 * Get user's avees/agents (cached)
 */
export async function getUserAvees(onUpdate?: (data: Avee[]) => void): Promise<Avee[]> {
  return apiGetCached<Avee[]>(
    "/me/avees",
    "avees",
    CACHE_TTL.avees,
    onUpdate
  );
}

/**
 * Get recommendations (cached)
 */
export async function getRecommendations(
  limit: number = 5,
  onUpdate?: (data: Recommendation[]) => void
): Promise<Recommendation[]> {
  return apiGetCached<Recommendation[]>(
    `/avees?limit=${limit}`,
    `recommendations_${limit}`,
    CACHE_TTL.recommendations,
    onUpdate
  );
}

/**
 * Get feed (cached)
 */
export async function getFeed(
  limit: number = 10,
  onUpdate?: (data: FeedResponse) => void
): Promise<FeedResponse> {
  return apiGetCached<FeedResponse>(
    `/feed?limit=${limit}`,
    `feed_${limit}`,
    CACHE_TTL.feed,
    onUpdate
  );
}

/**
 * Get unified feed (cached)
 */
export async function getUnifiedFeed(
  limit: number = 20,
  onUpdate?: (data: UnifiedFeedResponse) => void
): Promise<UnifiedFeedResponse> {
  return apiGetCached<UnifiedFeedResponse>(
    `/feed/unified?limit=${limit}`,
    `unified_feed_${limit}`,
    CACHE_TTL.unifiedFeed,
    onUpdate
  );
}

/**
 * Get onboarding status (cached)
 */
export async function getOnboardingStatus(
  onUpdate?: (data: OnboardingStatus) => void
): Promise<OnboardingStatus> {
  return apiGetCached<OnboardingStatus>(
    "/onboarding/status",
    "onboarding_status",
    CACHE_TTL.onboarding,
    onUpdate
  );
}

/**
 * Mark agent updates as read (invalidates cache)
 */
export async function markAgentRead(agentId: string): Promise<void> {
  await apiFetch(`/feed/agent/${agentId}/mark-all-read`, {
    method: "POST",
  });
  
  // Invalidate feed caches
  invalidateCachePattern("feed");
  invalidateCachePattern("unified_feed");
}

/**
 * Like/unlike a post (invalidates cache)
 */
export async function toggleLikePost(postId: string, isLiked: boolean): Promise<void> {
  await apiFetch(`/posts/${postId}/like`, {
    method: isLiked ? "DELETE" : "POST",
  });
  
  // Invalidate unified feed cache
  invalidateCachePattern("unified_feed");
}

/**
 * Repost a post (invalidates cache)
 */
export async function repostPost(postId: string, comment?: string): Promise<void> {
  const url = new URL(`${API_BASE}/posts/${postId}/share`);
  url.searchParams.set("share_type", "repost");
  if (comment && comment.trim()) {
    url.searchParams.set("comment", comment.trim());
  }
  
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  // Invalidate unified feed cache
  invalidateCachePattern("unified_feed");
}

/**
 * Follow an agent (invalidates cache)
 */
export async function followAgent(aveeId: string): Promise<void> {
  await apiFetch(`/relationships/follow-agent?avee_id=${aveeId}`, {
    method: "POST",
  });
  
  // Invalidate relevant caches
  invalidateCachePattern("feed");
  invalidateCachePattern("unified_feed");
  invalidateCachePattern("recommendations");
}

/**
 * Invalidate all user-specific caches (call on logout or user switch)
 */
export function invalidateAllUserCaches(): void {
  // CRITICAL: Also clear in-flight requests to prevent stale promises
  clearInFlightRequests();
  
  invalidateCache("profile");
  invalidateCache("avees");
  invalidateCachePattern("feed");
  invalidateCachePattern("unified_feed");
  invalidateCachePattern("recommendations");
  invalidateCache("onboarding_status");
}


