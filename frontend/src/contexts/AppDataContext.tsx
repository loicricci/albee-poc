/**
 * App Data Context
 * 
 * Centralized state management for app-wide data
 * Eliminates redundant API calls by providing shared state
 * across all components
 */

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  getProfile,
  getAppConfig,
  getUserAvees,
  getRecommendations,
  getFeed,
  getUnifiedFeed,
  getOnboardingStatus,
  invalidateAllUserCaches,
  type Profile,
  type AppConfig,
  type Avee,
  type Recommendation,
  type FeedResponse,
  type UnifiedFeedResponse,
  type OnboardingStatus,
} from "@/lib/apiClient";
import { setAuthToken, clearAuthToken } from "@/lib/authQueue";
import { clearAllCaches as clearApiCaches, setCurrentCacheUser, getCurrentCacheUser } from "@/lib/apiCache";

// Clear ALL localStorage caches including legacy keys
const clearAllLocalStorageCaches = () => {
  // Clear apiCache keys (cache_*)
  clearApiCaches();
  
  // Also clear legacy keys that are NOT prefixed with cache_
  // These are used by SessionContext and profile pages
  // NOTE: Do NOT clear 'supabase.auth.token' - this is managed by Supabase
  // and is required for session persistence across page reloads!
  const legacyKeys = [
    'user_profile', 
    'app_profile', 
    'app_avees', 
    'app_recommendations', 
    'app_feed', 
    'app_unified_feed',
    'app_config',
    // REMOVED: 'supabase.auth.token' - clearing this causes logout on page reload!
  ];
  
  legacyKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore errors
    }
  });
  
  console.log('[AppData] All localStorage caches cleared (including legacy keys)');
};

// Cache keys for sessionStorage
const CACHE_KEYS = {
  PROFILE: 'app_data_profile',
  AVEES: 'app_data_avees',
  CONFIG: 'app_data_config',
  FEED: 'app_data_feed',
  UNIFIED_FEED: 'app_data_unified_feed',
  RECOMMENDATIONS: 'app_data_recommendations',
  CURRENT_USER: 'app_data_current_user', // Track which user's data is cached
};

// Global loading lock to prevent multiple concurrent loadAppData calls
let isLoadingLocked = false;
let loadingPromise: Promise<void> | null = null;

// Get the cached user ID from sessionStorage
const getCachedUserId = (): string | null => {
  try {
    return sessionStorage.getItem(CACHE_KEYS.CURRENT_USER);
  } catch (e) {
    return null;
  }
};

// Set the cached user ID in sessionStorage
const setCachedUserId = (userId: string | null): void => {
  try {
    if (userId) {
      const previousUserId = getCachedUserId();
      if (previousUserId && previousUserId !== userId) {
        // User changed! Clear all sessionStorage cache
        console.log(`[AppData] User changed from ${previousUserId} to ${userId}, clearing sessionStorage cache`);
        clearAllCache();
      }
      sessionStorage.setItem(CACHE_KEYS.CURRENT_USER, userId);
    } else {
      sessionStorage.removeItem(CACHE_KEYS.CURRENT_USER);
    }
  } catch (e) {
    console.warn('Failed to set cached user ID:', e);
  }
};

// Cache helper functions - now with user validation
const getCachedData = <T,>(key: string, currentUserId?: string): T | null => {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp, userId } = JSON.parse(cached);
    
    // Cache valid for 5 minutes
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // CRITICAL: Validate user ID to prevent data leakage between users
    // Skip validation for non-user-specific data like config
    if (key !== CACHE_KEYS.CONFIG) {
      // If we have a current user ID, validate the cached entry
      if (currentUserId) {
        // If cached entry has no userId (legacy) or wrong userId, reject it
        if (!userId || userId !== currentUserId) {
          console.log(`[AppData] Rejecting cached ${key}: ${userId ? 'belongs to different user' : 'no user ID (legacy cache)'}`);
          sessionStorage.removeItem(key);
          return null;
        }
      }
      
      // If NO current user is set but cache has a userId, reject it
      if (!currentUserId && userId) {
        console.log(`[AppData] Rejecting cached ${key}: no current user but cache has userId`);
        sessionStorage.removeItem(key);
        return null;
      }
    }
    
    return data;
  } catch (e) {
    return null;
  }
};

const setCachedData = <T,>(key: string, data: T, userId?: string): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ 
      data, 
      timestamp: Date.now(),
      userId: userId || getCachedUserId(), // Include user ID for validation
    }));
  } catch (e) {
    console.warn('Failed to cache data:', e);
  }
};

const clearAllCache = (): void => {
  Object.values(CACHE_KEYS).forEach(key => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  });
  console.log('[AppData] SessionStorage cache cleared');
};

// First Post Onboarding Tracking
// Tracks whether user has completed or skipped the first post creation popup
const FIRST_POST_KEY_PREFIX = 'first_post_onboarding_';

export const getFirstPostStatus = (userId: string): 'completed' | 'skipped' | null => {
  try {
    const value = localStorage.getItem(`${FIRST_POST_KEY_PREFIX}${userId}`);
    if (value === 'completed' || value === 'skipped') {
      return value;
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const setFirstPostStatus = (userId: string, status: 'completed' | 'skipped'): void => {
  try {
    localStorage.setItem(`${FIRST_POST_KEY_PREFIX}${userId}`, status);
    console.log(`[AppData] First post status set to '${status}' for user ${userId}`);
  } catch (e) {
    console.warn('[AppData] Failed to set first post status:', e);
  }
};

export const clearFirstPostStatus = (userId: string): void => {
  try {
    localStorage.removeItem(`${FIRST_POST_KEY_PREFIX}${userId}`);
    console.log(`[AppData] First post status cleared for user ${userId}`);
  } catch (e) {
    // Ignore
  }
};

export type AppData = {
  // User data
  profile: Profile | null;
  avees: Avee[];
  
  // Config
  appConfig: AppConfig;
  
  // Feed data
  feed: FeedResponse | null;
  unifiedFeed: UnifiedFeedResponse | null;
  recommendations: Recommendation[];
  
  // Onboarding
  onboardingStatus: OnboardingStatus | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingCritical: boolean; // Profile and auth
  isLoadingFeed: boolean;     // Feed/recommendations (Phase 2)
  
  // Refresh functions
  refreshProfile: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  refreshAll: () => Promise<void>;
};

const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}

// Dynamic favicon component - updates the browser favicon when config changes
function DynamicFavicon({ faviconUrl }: { faviconUrl?: string }) {
  useEffect(() => {
    if (!faviconUrl) return;
    
    // Find existing favicon link or create a new one
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    // Update the href
    link.href = faviconUrl;
    
    // Also update apple-touch-icon if it exists or create it
    let appleIcon: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = faviconUrl;
    
    console.log('[DynamicFavicon] Updated favicon to:', faviconUrl);
  }, [faviconUrl]);
  
  return null;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avees, setAvees] = useState<Avee[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({});
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [unifiedFeed, setUnifiedFeed] = useState<UnifiedFeedResponse | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCritical, setIsLoadingCritical] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);

  // Refresh functions
  const refreshProfile = async () => {
    try {
      const profileData = await getProfile((updated) => setProfile(updated));
      setProfile(profileData);
    } catch (e) {
      console.error("Failed to refresh profile:", e);
    }
  };

  const refreshFeed = async () => {
    try {
      const [feedData, unifiedFeedData] = await Promise.all([
        getFeed(10, (updated) => setFeed(updated)),
        getUnifiedFeed(20, (updated) => setUnifiedFeed(updated)),
      ]);
      setFeed(feedData);
      setUnifiedFeed(unifiedFeedData);
    } catch (e) {
      console.error("Failed to refresh feed:", e);
    }
  };

  const refreshAll = async () => {
    try {
      setIsLoading(true);
      await loadAppData();
    } finally {
      setIsLoading(false);
    }
  };

  // Load all app data with aggressive caching and parallel loading
  const loadAppData = async () => {
    // Prevent multiple concurrent loads - reuse existing promise if loading
    if (isLoadingLocked && loadingPromise) {
      console.log('[AppData] Already loading, waiting for existing load...');
      return loadingPromise;
    }
    
    isLoadingLocked = true;
    const loadStartTime = performance.now();
    
    // Reset feed loading state at the start of each load
    setIsLoadingFeed(true);
    
    loadingPromise = (async () => {
    try {
      // Get current user ID for cache validation
      const currentUserId = getCachedUserId();
      
      // Step 1: Load from cache immediately (instant render!)
      // Pass current user ID to validate cached data belongs to this user
      const cachedProfile = getCachedData<Profile>(CACHE_KEYS.PROFILE, currentUserId || undefined);
      const cachedAvees = getCachedData<Avee[]>(CACHE_KEYS.AVEES, currentUserId || undefined);
      const cachedConfig = getCachedData<AppConfig>(CACHE_KEYS.CONFIG, currentUserId || undefined);
      const cachedFeed = getCachedData<FeedResponse>(CACHE_KEYS.FEED, currentUserId || undefined);
      const cachedUnifiedFeed = getCachedData<UnifiedFeedResponse>(CACHE_KEYS.UNIFIED_FEED, currentUserId || undefined);
      const cachedRecommendations = getCachedData<Recommendation[]>(CACHE_KEYS.RECOMMENDATIONS, currentUserId || undefined);
      
      // Show cached data immediately if available
      if (cachedProfile) {
        console.log("[AppData] Using cached profile");
        setProfile(cachedProfile);
        setIsLoadingCritical(false);
      }
      if (cachedAvees) {
        console.log("[AppData] Using cached avees");
        setAvees(cachedAvees);
      }
      if (cachedConfig) {
        console.log("[AppData] Using cached config");
        setAppConfig(cachedConfig);
      }
      if (cachedFeed) {
        console.log("[AppData] Using cached feed");
        setFeed(cachedFeed);
      }
      if (cachedUnifiedFeed) {
        console.log("[AppData] Using cached unified feed");
        setUnifiedFeed(cachedUnifiedFeed);
      }
      if (cachedRecommendations) {
        console.log("[AppData] Using cached recommendations");
        setRecommendations(cachedRecommendations);
      }
      
      // If we have all cached data, page is ready immediately!
      const hasCriticalCache = cachedProfile && cachedConfig;
      if (hasCriticalCache) {
        console.log("[AppData] Page ready from cache in <50ms");
        setIsLoading(false);
      }
      
      // Step 2: Load data in TWO phases to avoid connection pool bottleneck
      // Phase 1: Critical data only (fast!)
      console.log("[AppData] Phase 1: Loading critical data...");
      const phase1Start = performance.now();
      
      const timings: Record<string, number> = {};
      const timeRequest = async <T,>(name: string, promise: Promise<T>): Promise<T> => {
        const start = performance.now();
        const result = await promise;
        timings[name] = performance.now() - start;
        console.log(`[AppData] ${name}: ${Math.round(timings[name])}ms`);
        return result;
      };
      
      // Phase 1: Only critical for page render
      const [profileData, configData, onboardingData] = await Promise.all([
        timeRequest('Profile', getProfile((updated) => {
          setProfile(updated);
          setCachedData(CACHE_KEYS.PROFILE, updated);
          setIsLoadingCritical(false);
        }).catch((e) => {
          console.error("Failed to load profile:", e);
          return cachedProfile;
        })),
        
        timeRequest('Config', getAppConfig((updated) => {
          setAppConfig(updated);
          setCachedData(CACHE_KEYS.CONFIG, updated);
        }).catch((e) => {
          console.warn("Failed to load config:", e);
          return cachedConfig || {};
        })),
        
        timeRequest('Onboarding', getOnboardingStatus((updated) => setOnboardingStatus(updated)).catch((e) => {
          console.error("Failed to load onboarding status:", e);
          return null;
        })),
      ]);
      
      const phase1Time = performance.now() - phase1Start;
      console.log(`[AppData] Phase 1 complete in ${Math.round(phase1Time)}ms`);
      
      // Check onboarding before loading heavy data
      if (onboardingData && !onboardingData.completed) {
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const alreadyOnOnboarding = currentPath === '/onboarding' || currentPath.startsWith('/onboarding/');
        
        // Always set loading states to false so the page can render
        setIsLoadingCritical(false);
        setIsLoading(false);
        
        // Only redirect if NOT already on onboarding page
        if (!alreadyOnOnboarding) {
          console.log("[AppData] Onboarding not completed, redirecting...");
          router.push("/onboarding");
        } else {
          console.log("[AppData] Already on onboarding page, skipping redirect");
        }
        return;
      }
      
      // Update critical state immediately - user can see the page now!
      if (profileData) {
        setProfile(profileData);
        setCachedData(CACHE_KEYS.PROFILE, profileData);
      }
      if (configData) {
        setAppConfig(configData);
        setCachedData(CACHE_KEYS.CONFIG, configData);
      }
      if (onboardingData) {
        setOnboardingStatus(onboardingData);
      }
      
      // CRITICAL: Set loading to false AFTER Phase 1!
      // This makes the page usable in ~1.5s instead of waiting ~10s for Phase 2
      setIsLoadingCritical(false);
      setIsLoading(false);
      
      const phase1TotalTime = performance.now() - loadStartTime;
      console.log(`[AppData] Page ready in ${Math.round(phase1TotalTime)}ms (Phase 1 complete)`);
      
      // OPTIMIZATION: Skip Phase 2 (feed loading) for pages that don't need it
      // This eliminates 6+ seconds of DB queries for pages like /network, /messages, /profile
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const needsFeedData = currentPath === '/app' || currentPath.startsWith('/app/') || currentPath === '/feed' || currentPath.startsWith('/feed/');
      
      if (!needsFeedData) {
        console.log(`[AppData] Skipping Phase 2 - page ${currentPath} doesn't need feed data`);
        setIsLoadingFeed(false);
        return; // Skip all Phase 2 loading!
      }
      
      // Phase 2: Heavy data (avees, feeds) - load in BACKGROUND (non-blocking!)
      // User can already see the page; data will appear as it loads
      console.log("[AppData] Phase 2: Loading feeds and agents in background...");
      const phase2Start = performance.now();
      
      // Phase 2a: Load most critical data FIRST (sequential to reduce DB contention)
      // UnifiedFeed is the main content users see
      const unifiedFeedData = await timeRequest('UnifiedFeed', getUnifiedFeed(10, (updated) => {
        setUnifiedFeed(updated);
        setCachedData(CACHE_KEYS.UNIFIED_FEED, updated);
      }).catch((e) => {
        console.error("Failed to load unified feed:", e);
        return cachedUnifiedFeed;
      }));
      
      if (unifiedFeedData) {
        setUnifiedFeed(unifiedFeedData);
        setCachedData(CACHE_KEYS.UNIFIED_FEED, unifiedFeedData);
      }
      
      // Main feed is ready - stop showing loading skeleton
      setIsLoadingFeed(false);
      
      // Phase 2b: Load remaining data in background (less critical)
      Promise.all([
        timeRequest('Avees', getUserAvees((updated) => {
          setAvees(updated);
          setCachedData(CACHE_KEYS.AVEES, updated);
        }).catch((e) => {
          console.error("Failed to load avees:", e);
          return cachedAvees || [];
        })),
        
        timeRequest('Feed', getFeed(5, (updated) => {
          setFeed(updated);
          setCachedData(CACHE_KEYS.FEED, updated);
        }).catch((e) => {
          console.error("Failed to load feed:", e);
          return cachedFeed;
        })),
        
        timeRequest('Recommendations', getRecommendations(3, (updated) => {
          setRecommendations(updated);
          setCachedData(CACHE_KEYS.RECOMMENDATIONS, updated);
        }).catch((e) => {
          console.error("Failed to load recommendations:", e);
          return cachedRecommendations || [];
        })),
      ]).then(([aveesData, feedData, recommendationsData]) => {
        // Update state with the returned data
        if (aveesData) {
          setAvees(aveesData);
          setCachedData(CACHE_KEYS.AVEES, aveesData);
        }
        if (feedData) {
          setFeed(feedData);
          setCachedData(CACHE_KEYS.FEED, feedData);
        }
        if (recommendationsData) {
          setRecommendations(recommendationsData);
          setCachedData(CACHE_KEYS.RECOMMENDATIONS, recommendationsData);
        }
        
        const phase2Time = performance.now() - phase2Start;
        console.log(`[AppData] Phase 2b complete in ${Math.round(phase2Time)}ms (background)`);
      }).catch((e) => {
        console.error("[AppData] Phase 2b failed:", e);
      });
      
      // Note: Phase 2 is now non-blocking, so this represents Phase 1 time only
      // Phase 2 continues in background and logs its own completion
      
    } catch (e) {
      console.error("[AppData] Failed to load app data:", e);
      setIsLoading(false);
      setIsLoadingCritical(false);
    } finally {
      isLoadingLocked = false;
      loadingPromise = null;
    }
    })();
    
    return loadingPromise;
  };

  // Initialize on mount
  useEffect(() => {
    let alive = true;
    let isInitialLoad = true;

    (async () => {
      // Get initial session and set auth token
      const sessionStart = performance.now();
      console.log('[AppDataContext] Checking initial session...');
      const { data } = await supabase.auth.getSession();
      const sessionDuration = performance.now() - sessionStart;
      console.log(`[AppDataContext] Session check took ${Math.round(sessionDuration)}ms`);
      
      if (!alive) return;

      if (data.session?.access_token) {
        // CRITICAL: Set the current user ID for cache isolation
        // This ensures we validate cached data belongs to this user
        const userId = data.session.user?.id;
        if (userId) {
          setCurrentCacheUser(userId);  // localStorage cache isolation
          setCachedUserId(userId);      // sessionStorage cache isolation
          console.log('[AppDataContext] Initial load - set cache user ID:', userId);
        }
        
        setAuthToken(data.session.access_token);
        console.log('[AppDataContext] Session found, loading data (initial)...');
        await loadAppData();
        isInitialLoad = false; // Mark that we've done initial load
      } else {
        // No session - clear any stale cache user
        setCurrentCacheUser(null);
        setCachedUserId(null);
        setIsLoading(false);
        setIsLoadingCritical(false);
        // CRITICAL: Set isInitialLoad to false so that when user logs in,
        // the SIGNED_IN handler runs fully and clears caches
        isInitialLoad = false;
      }
    })();

    // Listen for auth changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log(`[AppDataContext] Auth state change: ${_event}, isInitialLoad: ${isInitialLoad}`);
        
        if (!alive) return;

        // Only skip SIGNED_IN if we already loaded data with a valid session
        // If user was logged out and is now logging in, we MUST run the full handler
        // to clear caches and load fresh data
        if (isInitialLoad && _event === 'SIGNED_IN') {
          // Check if we actually had a session before - if not, DON'T skip!
          // This handles the case where user goes to login page, logs in,
          // and we need to load their data fresh
          const hadPreviousSession = profile !== null;
          
          if (hadPreviousSession) {
            console.log('[AppDataContext] Skipping duplicate initial load (had previous session)');
            
            // Even though we skip loading, still ensure user ID is set correctly
            const userId = session?.user?.id;
            if (userId) {
              setCurrentCacheUser(userId);
              setCachedUserId(userId);
              console.log('[AppDataContext] Set cache user ID during skip:', userId);
            }
            
            isInitialLoad = false;
            return;
          } else {
            console.log('[AppDataContext] NOT skipping - user is logging in fresh');
            // Fall through to the SIGNED_IN handler below
          }
        }

        if (session?.access_token) {
          setAuthToken(session.access_token);
          
          // On SIGNED_IN (new login), don't block - let the UI navigate and load data asynchronously
          // On TOKEN_REFRESHED, reload data to ensure we have latest info
          if (_event === 'SIGNED_IN') {
            const userId = session.user?.id;
            const previousUserId = getCurrentCacheUser();
            const isSameUser = userId && previousUserId && userId === previousUserId;
            
            // CRITICAL FIX: Set loading states FIRST, before any state resets
            // This ensures React renders loading state, not empty state
            setIsLoading(true);
            setIsLoadingCritical(true);
            setIsLoadingFeed(true);
            
            // Only clear caches if user actually changed (different user logging in)
            // This preserves cache for same user re-logins (e.g., token refresh, page reload)
            if (!isSameUser) {
              console.log('[AppDataContext] Sign-in detected with different/new user, clearing old cache...');
              
              // CRITICAL: Clear ALL caches before loading new user's data!
              // This prevents showing previous user's cached data
              clearAuthToken();
              invalidateAllUserCaches();  // Clear apiClient in-memory cache
              clearAllLocalStorageCaches();  // Clear ALL localStorage caches (cache_* + legacy keys)
              clearAllCache();            // Clear sessionStorage cache
              
              // Reset data state AFTER loading states are set
              setProfile(null);
              setAvees([]);
              setFeed(null);
              setUnifiedFeed(null);
              setRecommendations([]);
              setOnboardingStatus(null);
            } else {
              console.log('[AppDataContext] Same user re-logging in, preserving cache for fast load');
            }
            
            // Set the current user ID for cache isolation
            // This ensures cached data is validated against the current user
            if (userId) {
              setCurrentCacheUser(userId);  // localStorage cache isolation
              setCachedUserId(userId);      // sessionStorage cache isolation
              console.log('[AppDataContext] Set cache user ID:', userId);
            }
            
            // Now set the new auth token
            setAuthToken(session.access_token);
            
            // DON'T await - let this run in background so sign-in completes quickly
            loadAppData().catch(e => console.error('[AppDataContext] Failed to load data:', e));
          } else {
            console.log('[AppDataContext] Reloading data due to auth change...');
            setIsLoading(true);
            setIsLoadingCritical(true);
            await loadAppData();
          }
        } else {
          // No session - but only clear caches on EXPLICIT logout, not on initial page load
          // INITIAL_SESSION with no session just means user isn't logged in yet
          if (_event === 'SIGNED_OUT') {
            // User explicitly logged out - clear auth but PRESERVE caches for same-user re-login
            // Security note: Cache entries have embedded userId and are validated on read,
            // so a different user logging in won't see cached data from previous user
            console.log('[AppDataContext] User explicitly logged out, clearing auth only (preserving caches for same-user re-login)');
            clearAuthToken();
            // NOT calling invalidateAllUserCaches() - this clears localStorage cache
            // NOT clearing localStorage/sessionStorage caches or user tracker
            // This allows same-user re-login to use cached data for instant loading
          } else {
            // INITIAL_SESSION with no session - just not logged in, DON'T clear caches
            console.log('[AppDataContext] No session on initial load (not clearing caches)');
          }
          
          // Always reset UI state when no session
          setProfile(null);
          setAvees([]);
          setFeed(null);
          setUnifiedFeed(null);
          setRecommendations([]);
          setOnboardingStatus(null);
          setIsLoading(false);
          setIsLoadingCritical(false);
        }
      }
    );

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const value: AppData = {
    profile,
    avees,
    appConfig,
    feed,
    unifiedFeed,
    recommendations,
    onboardingStatus,
    isLoading,
    isLoadingCritical,
    isLoadingFeed,
    refreshProfile,
    refreshFeed,
    refreshAll,
  };

  return (
    <AppDataContext.Provider value={value}>
      <DynamicFavicon faviconUrl={appConfig.app_favicon_url} />
      {children}
    </AppDataContext.Provider>
  );
}

