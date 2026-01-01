"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getAppConfig, type AppConfig } from "@/lib/config";

export function NewLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <TopNavigation />
      <div className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </div>
    </div>
  );
}

type Profile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
};

type SearchResult = {
  avee_id: string;
  avee_handle: string;
  avee_display_name: string | null;
  avee_avatar_url: string | null;
  avee_bio: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
};

function TopNavigation() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Start with null to avoid hydration mismatch
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({});
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Load app config from cache immediately, then fetch fresh
    const cachedConfig = localStorage.getItem('app_config');
    if (cachedConfig) {
      try {
        setAppConfig(JSON.parse(cachedConfig));
      } catch (e) {
        console.warn("Failed to parse cached app config");
      }
    }

    // Fetch app configuration (logo, app name, etc.)
    getAppConfig()
      .then((config) => {
        console.log("[AppConfig] Loaded:", config);
        setAppConfig(config);
        localStorage.setItem('app_config', JSON.stringify(config));
      })
      .catch((error) => {
        // Gracefully handle missing config (table not created yet)
        console.warn("App config not available:", error);
        const defaultConfig = { app_name: "AVEE" };
        setAppConfig(defaultConfig);
        localStorage.setItem('app_config', JSON.stringify(defaultConfig));
      });
  }, []);

  useEffect(() => {
    let alive = true;
    let profileFetched = false;

    // Load profile from cache immediately
    const cachedProfile = localStorage.getItem('user_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setProfile(parsed);
        profileFetched = true;
      } catch (e) {
        console.warn("Failed to parse cached profile");
      }
    }

    // Also check app_profile cache (shared with app page)
    if (!profileFetched) {
      const appProfile = localStorage.getItem('app_profile');
      if (appProfile) {
        try {
          const parsed = JSON.parse(appProfile);
          setProfile(parsed);
          localStorage.setItem('user_profile', appProfile);
          profileFetched = true;
        } catch (e) {
          console.warn("Failed to parse app profile cache");
        }
      }
    }

    async function syncSession() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setUserEmail(data.session?.user?.email ?? null);
      
      // Only fetch profile if not already cached and session exists
      if (data.session?.access_token && !profileFetched) {
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
          const res = await fetch(`${apiBase}/me/profile`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (res.ok) {
            const profileData = await res.json();
            if (alive) {
              setProfile(profileData);
              localStorage.setItem('user_profile', JSON.stringify(profileData));
              localStorage.setItem('app_profile', JSON.stringify(profileData));
            }
          }
        } catch (error) {
          console.error("Failed to fetch profile:", error);
        }
      }
    }

    syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUserEmail(session?.user?.email ?? null);
      
      // Fetch profile on auth change
      if (session?.access_token) {
        (async () => {
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
            const res = await fetch(`${apiBase}/me/profile`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const profileData = await res.json();
              if (alive) {
                setProfile(profileData);
                localStorage.setItem('user_profile', JSON.stringify(profileData));
                localStorage.setItem('app_profile', JSON.stringify(profileData));
              }
            }
          } catch (error) {
            console.error("Failed to fetch profile:", error);
          }
        })();
      } else {
        // Clear all caches on logout
        setProfile(null);
        localStorage.removeItem('user_profile');
        localStorage.removeItem('app_profile');
        localStorage.removeItem('app_avees');
        localStorage.removeItem('app_recommendations');
        localStorage.removeItem('app_feed');
        localStorage.removeItem('app_config');
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Perform search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const url = new URL(`${apiBase}/network/search-agents`);
      url.searchParams.set("query", query);
      url.searchParams.set("limit", "8");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      if (res.ok) {
        const results = await res.json();
        setSearchResults(Array.isArray(results) ? results : []);
        setShowSearchDropdown(true);
      }
    } catch (e) {
      console.error("Search error:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    if (showSearchDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchDropdown]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  const handleSearchResultClick = (agentHandle: string) => {
    setShowSearchDropdown(false);
    setSearchQuery("");
    router.push(`/u/${agentHandle}`);
  };

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left side - Logo and Search */}
        <div className="flex items-center gap-4">
          {/* App Logo */}
          <Link
            href="/app"
            className="group flex items-center gap-2 transition-all"
          >
            {appConfig.app_logo_url && appConfig.app_logo_url.trim() !== "" ? (
              // Custom logo uploaded by admin - show image + AVEE text
              <>
                <div className="relative h-10 w-10">
                  <img 
                    src={appConfig.app_logo_url} 
                    alt={appConfig.app_name || "App Logo"}
                    className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    onLoad={(e) => {
                      // Fade in smoothly once loaded
                      e.currentTarget.style.opacity = '1';
                    }}
                    onError={(e) => {
                      console.error("Failed to load logo:", appConfig.app_logo_url);
                      // Hide broken image
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{ opacity: 0, transition: 'opacity 0.2s ease-in' }}
                  />
                </div>
                <span className="text-xl font-bold text-gray-900">AVEE</span>
              </>
            ) : (
              // Default fallback logo
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105" style={{background: 'linear-gradient(135deg, #2E3A59 0%, #1a2236 100%)'}}>
                  <span className="text-lg font-bold text-white">A</span>
                </div>
                <span className="hidden text-xl font-bold text-[#0B0B0C] md:block">{appConfig.app_name || "AVEE"}</span>
              </>
            )}
          </Link>

          <div className="hidden w-96 md:block">
            <div className="relative" ref={searchDropdownRef}>
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search Agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              
              {/* Search Results Dropdown */}
              {showSearchDropdown && (
                <div className="absolute top-full mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-xl z-50 max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                      <div className="mt-2">Searching...</div>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No agents found for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.avee_id}
                          onClick={() => handleSearchResultClick(result.avee_handle)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full" style={{background: 'linear-gradient(135deg, #2E3A59 0%, #1a2236 100%)'}}>
                            {result.avee_avatar_url ? (
                              <img src={result.avee_avatar_url}
                                alt={result.avee_display_name || result.avee_handle}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                                {result.avee_handle[0]?.toUpperCase() || "A"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900">
                                {result.avee_display_name || result.avee_handle}
                              </div>
                              {result.is_followed && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  Following
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{result.avee_handle}
                            </div>
                            {result.avee_bio && (
                              <div className="mt-1 truncate text-xs text-gray-400">
                                {result.avee_bio}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Navigation buttons */}
        <div className="flex items-center gap-2">
          {/* Home Icon */}
          <Link
            href="/app"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-blue-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
            title="Home Feed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </Link>

          {/* My Agent Icon - Only for non-admin users */}
          {!profile?.is_admin && (
            <Link
              href="/agent"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-purple-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
              title="My Agent"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </Link>
          )}

          {/* My Agents Icon - Only for admin users */}
          {profile?.is_admin && (
            <Link
              href="/my-agents"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-purple-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
              title="My Agents"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                />
              </svg>
            </Link>
          )}

          {/* Network Icon */}
          <Link
            href="/network"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-blue-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
            title="Network"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </Link>

          {/* Messages Icon */}
          <Link
            href="/messages"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-blue-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
            title="Messages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </Link>

          {/* Notifications Icon */}
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600"
            title="Notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {/* Notification badge */}
            <span className="absolute right-1 top-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8A24A] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A24A]"></span>
            </span>
          </Link>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* Profile Menu */}
          <div className="relative group">
            <Link
              href="/profile"
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-gray-700 transition-all hover:bg-[#E6E6E6]/50"
              title="Profile"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden" style={{background: 'linear-gradient(135deg, #2E3A59 0%, #1a2236 100%)'}}>
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.display_name || profile.handle || "Profile"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Hide broken image on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{userEmail ? userEmail[0].toUpperCase() : "?"}</span>
                )}
              </div>
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Link>
            
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-2 w-56 origin-top-right scale-0 rounded-lg border border-[#E6E6E6] bg-white py-2 shadow-xl transition-all group-hover:scale-100">
              <div className="border-b border-[#E6E6E6] px-4 py-3">
                <div className="text-xs text-[#2E3A59]/70">Signed in as</div>
                <div className="truncate text-sm font-medium text-[#0B0B0C]">
                  {userEmail || "User"}
                </div>
              </div>
              <Link
                href="/profile"
                className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </Link>
              {profile?.handle && (
                <Link
                  href={`/u/${profile.handle}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Profile
                </Link>
              )}
              <Link
                href="/messages"
                className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Messages
              </Link>
              {/* Only show My Agent for non-admin users */}
              {!profile?.is_admin && (
                <Link
                  href="/agent"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  My Agent
                </Link>
              )}
              {/* Only show My Agents for admin users */}
              {profile?.is_admin && (
                <Link
                  href="/my-agents"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  My Agents
                </Link>
              )}
              {/* Only show Backoffice for admin users */}
              {userEmail === "loic.ricci@gmail.com" && (
                <Link
                  href="/backoffice"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#0B0B0C] hover:bg-[#2E3A59]/5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Backoffice
                </Link>
              )}
              <div className="my-1 border-t border-[#E6E6E6]"></div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50/50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
