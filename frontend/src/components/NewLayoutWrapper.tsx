"use client";

import Link from "next/link";
import { ReactNode, useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, usePathname } from "next/navigation";
import { useAppData } from "@/contexts/AppDataContext";
import { getUnreadNotificationCount, getUnreadMessagesCount } from "@/lib/api";
import { getAuthToken } from "@/lib/authQueue";

export function NewLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc]">
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
  is_followed?: boolean;
};

function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Get shared app data from context
  const { profile, appConfig } = useAppData();
  const userEmail = profile?.user_id ? `${profile.handle}@app` : null;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // Unread counts state
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // Check if user is on notifications or messages page
  const isOnNotificationsPage = pathname === "/notifications" || pathname.startsWith("/notifications/");
  const isOnMessagesPage = pathname === "/messages" || pathname.startsWith("/messages/");
  
  // Clear notification count when visiting notifications page
  useEffect(() => {
    if (isOnNotificationsPage) {
      setUnreadNotificationCount(0);
    }
  }, [isOnNotificationsPage]);
  
  // Clear message count when visiting messages page
  useEffect(() => {
    if (isOnMessagesPage) {
      setUnreadMessageCount(0);
    }
  }, [isOnMessagesPage]);
  
  // Fetch unread counts on mount and when profile changes
  useEffect(() => {
    if (!profile) return;
    
    const fetchUnreadCounts = async () => {
      try {
        const [notifResult, msgResult] = await Promise.all([
          getUnreadNotificationCount(),
          getUnreadMessagesCount(),
        ]);
        // Only update counts if not on the respective page
        if (!isOnNotificationsPage) {
          setUnreadNotificationCount(notifResult?.unread_count || 0);
        }
        if (!isOnMessagesPage) {
          setUnreadMessageCount(msgResult?.unread_count || 0);
        }
      } catch (e) {
        console.error("Failed to fetch unread counts:", e);
      }
    };
    
    fetchUnreadCounts();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [profile, isOnNotificationsPage, isOnMessagesPage]);

  // Perform search function
  // FIX: Uses centralized authQueue for consistent token handling
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);

    try {
      // Use centralized auth token instead of direct supabase.auth.getSession()
      const token = await getAuthToken();
      if (!token) {
        console.log("[Search] No auth token available");
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const url = new URL(`${apiBase}/network/search-agents`);
      url.searchParams.set("query", query);
      url.searchParams.set("limit", "8");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const results = await res.json();
        setSearchResults(Array.isArray(results) ? results : []);
        setShowSearchDropdown(true);
      } else if (res.status === 401) {
        // Token expired - authQueue will handle refresh on next call
        console.warn("[Search] 401 error, token may have expired");
        setSearchResults([]);
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
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    if (showSearchDropdown || showProfileDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchDropdown, showProfileDropdown]);

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
    // Cache will be cleared by the auth state change listener in AppDataContext
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
              // Custom logo uploaded by admin - show image + app name text
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
                <span className="text-xl font-bold text-gray-900">{appConfig.app_name || "AGENT"}</span>
              </>
            ) : (
              // Default fallback logo
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-[#001f98]/25 transition-transform group-hover:scale-105" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                  <span className="text-lg font-bold text-white">A</span>
                </div>
                <span className="hidden text-xl font-bold text-gray-900 md:block">{appConfig.app_name || "AGENT"}</span>
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
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 focus:border-[#001f98]"
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
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full" style={{background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'}}>
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
                                <span className="rounded-full bg-[#e6eaff] px-2 py-0.5 text-xs font-medium text-[#001f98]">
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-[#001f98] hover:bg-[#e6eaff]"
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

          {/* My Agents Icon - All users now access the full agent editor */}
          <Link
            href="/my-agents"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-[#001f98] hover:bg-[#e6eaff]"
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
                d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z"
              />
            </svg>
          </Link>

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
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:text-[#001f98] hover:bg-[#e6eaff]"
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
            {/* Messages badge - only show if there are unread messages and not on messages page */}
            {unreadMessageCount > 0 && !isOnMessagesPage && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#001f98] text-[10px] font-bold text-white shadow-sm">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </Link>

          {/* Notifications Icon */}
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
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
            {/* Notification badge - only show if there are unread notifications and not on notifications page */}
            {unreadNotificationCount > 0 && !isOnNotificationsPage && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#001f98] text-[10px] font-bold text-white shadow-sm">
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            )}
          </Link>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* Profile Menu */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-gray-700 transition-all hover:bg-[#e6eaff]"
              title="Profile"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden" style={{background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'}}>
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
                className={`h-4 w-4 text-gray-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}
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
            </button>
            
            {/* Dropdown menu */}
            {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-gray-200 bg-white py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="text-xs text-gray-500">Signed in as</div>
                <div className="truncate text-sm font-medium text-gray-900">
                  {userEmail || "User"}
                </div>
              </div>
              <Link
                href="/profile"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-[#e6eaff]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </Link>
              {profile?.handle && (
                <Link
                  href={`/u/${profile.handle}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-[#e6eaff]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Profile
                </Link>
              )}
              <Link
                href="/messages"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-[#e6eaff]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Messages
              </Link>
              {/* My Agents - All users now access the full agent editor */}
              <Link
                href="/my-agents"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-[#e6eaff]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                </svg>
                My Agents
              </Link>
              {/* Only show Backoffice for admin users */}
              {profile?.is_admin && (
                <Link
                  href="/backoffice"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-[#e6eaff]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Backoffice
                </Link>
              )}
              <div className="my-1 border-t border-gray-200"></div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
