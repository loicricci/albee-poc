"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "./supabaseClient";

type SessionData = {
  token: string;
  email: string | null;
  userId: string;
};

type Profile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
};

type SessionContextType = {
  session: SessionData | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getToken: () => Promise<string>;
};

const SessionContext = createContext<SessionContextType>({
  session: null,
  profile: null,
  loading: true,
  error: null,
  refreshSession: async () => {},
  refreshProfile: async () => {},
  getToken: async () => { throw new Error("SessionProvider not initialized"); },
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profile from cache immediately, then fetch fresh
  // Now validates that cached profile belongs to the current user
  const loadProfile = useCallback(async (token: string, userId?: string) => {
    // Try cache first for instant display
    const cachedProfile = localStorage.getItem('user_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        // CRITICAL: Validate the cached profile belongs to the current user
        // to prevent showing previous user's data
        if (userId && parsed.user_id && parsed.user_id !== userId) {
          console.log('[SessionContext] Rejecting cached profile: belongs to different user');
          localStorage.removeItem('user_profile');
          localStorage.removeItem('app_profile');
        } else {
          setProfile(parsed);
        }
      } catch {
        // Invalid cache, ignore
      }
    }

    // Fetch fresh profile in background
    try {
      const res = await fetch(`${API_BASE}/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profileData = await res.json();
        setProfile(profileData);
        localStorage.setItem('user_profile', JSON.stringify(profileData));
        localStorage.setItem('app_profile', JSON.stringify(profileData));
      }
    } catch (e) {
      console.warn("[SessionContext] Failed to fetch profile:", e);
    }
  }, []);

  const initSession = useCallback(async () => {
    try {
      const { data, error: authError } = await supabase.auth.getSession();

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        const sessionData: SessionData = {
          token: data.session.access_token,
          email: data.session.user?.email ?? null,
          userId: data.session.user?.id ?? "",
        };
        setSession(sessionData);
        
        // Load profile in parallel, passing user ID for cache validation
        loadProfile(data.session.access_token, data.session.user?.id);
      }
    } catch (e) {
      console.error("[SessionContext] Error initializing session:", e);
      setError("Failed to initialize session");
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    // Initialize session on mount
    initSession();

    // Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (authSession) {
        const sessionData: SessionData = {
          token: authSession.access_token,
          email: authSession.user?.email ?? null,
          userId: authSession.user?.id ?? "",
        };
        setSession(sessionData);
        // Pass user ID for cache validation to prevent showing previous user's data
        loadProfile(authSession.access_token, authSession.user?.id);
      } else {
        setSession(null);
        setProfile(null);
        // Clear caches on logout
        localStorage.removeItem('user_profile');
        localStorage.removeItem('app_profile');
        localStorage.removeItem('app_avees');
        localStorage.removeItem('app_recommendations');
        localStorage.removeItem('app_feed');
        localStorage.removeItem('app_unified_feed');
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [initSession, loadProfile]);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      const sessionData: SessionData = {
        token: data.session.access_token,
        email: data.session.user?.email ?? null,
        userId: data.session.user?.id ?? "",
      };
      setSession(sessionData);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.token) {
      await loadProfile(session.token, session.userId);
    }
  }, [session?.token, session?.userId, loadProfile]);

  const getToken = useCallback(async (): Promise<string> => {
    if (session?.token) {
      return session.token;
    }

    // Try to get fresh session
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("Not authenticated");
    }

    // Update local state
    const sessionData: SessionData = {
      token: data.session.access_token,
      email: data.session.user?.email ?? null,
      userId: data.session.user?.id ?? "",
    };
    setSession(sessionData);

    return data.session.access_token;
  }, [session?.token]);

  return (
    <SessionContext.Provider
      value={{
        session,
        profile,
        loading,
        error,
        refreshSession,
        refreshProfile,
        getToken,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/**
 * Hook to get the current access token
 * Will throw if not authenticated
 */
export function useAccessToken() {
  const { getToken } = useSession();
  return getToken;
}


