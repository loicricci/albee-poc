"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { ChatButton } from "@/components/ChatButton";

type FollowingAgent = {
  avee_id: string;
  avee_handle: string;
  avee_display_name?: string | null;
  avee_avatar_url?: string | null;
  avee_bio?: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name?: string | null;
  is_followed?: boolean; // Flag from backend indicating if already following
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in (no access token).");
  return token;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE.");
  return base;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function apiPostQuery<T>(
  path: string,
  query: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  // some endpoints may return empty; handle both
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : { ok: true }) as T;
}

function NetworkContent() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [items, setItems] = useState<FollowingAgent[]>([]);
  const [handleInput, setHandleInput] = useState("");
  const [followingAgentIds, setFollowingAgentIds] = useState<Set<string>>(new Set());
  const [unfollowingAgentIds, setUnfollowingAgentIds] = useState<Set<string>>(new Set());
  
  // Search suggestions state
  const [searchResults, setSearchResults] = useState<FollowingAgent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Suggested agents state
  const [suggestedAgents, setSuggestedAgents] = useState<FollowingAgent[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const [suggestedPage, setSuggestedPage] = useState(0);
  const [hasMoreSuggested, setHasMoreSuggested] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const SUGGESTED_LIMIT = 6;

  // Guard against duplicate initial loads (React StrictMode double-mount)
  const hasInitializedRef = useRef(false);
  const loadingRef = useRef(false);
  const suggestedLoadingRef = useRef(false);

  const normalizedHandle = useMemo(() => handleInput.trim().toLowerCase(), [handleInput]);

  const load = async (force: boolean = false) => {
    // Guard against duplicate concurrent loads
    if (loadingRef.current && !force) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:load',message:'load() SKIPPED - already loading',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return;
    }
    loadingRef.current = true;
    // #region agent log
    const loadStart = Date.now();
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:load',message:'load() START',data:{},timestamp:loadStart,sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    setPhase("loading");
    setErrorMsg("");

    try {
      // #region agent log
      const tokenStart = Date.now();
      // #endregion
      const token = await getAccessToken();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:load',message:'getAccessToken done',data:{tokenDurationMs:Date.now()-tokenStart},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      const apiStart = Date.now();
      // #endregion
      const data = await apiGet<FollowingAgent[]>("/network/following-agents", token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:load',message:'load() COMPLETE',data:{apiDurationMs:Date.now()-apiStart,totalDurationMs:Date.now()-loadStart,itemCount:Array.isArray(data)?data.length:0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setItems(Array.isArray(data) ? data : []);
      setPhase("ready");
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e?.message || "Failed to load network.");
    } finally {
      loadingRef.current = false;
    }
  };

  const loadSuggestedAgents = async (page: number = 0, withTransition: boolean = false, force: boolean = false) => {
    // Guard against duplicate concurrent loads (unless it's a page change or forced)
    if (suggestedLoadingRef.current && !withTransition && !force) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:loadSuggestedAgents',message:'loadSuggestedAgents() SKIPPED - already loading',data:{page},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return;
    }
    suggestedLoadingRef.current = true;
    // #region agent log
    const suggestedStart = Date.now();
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:loadSuggestedAgents',message:'loadSuggestedAgents() START',data:{page,withTransition},timestamp:suggestedStart,sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (withTransition) {
      setIsTransitioning(true);
      // Short delay for exit animation
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    setLoadingSuggested(true);
    try {
      // #region agent log
      const tokenStart = Date.now();
      // #endregion
      const token = await getAccessToken();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:loadSuggestedAgents',message:'getAccessToken done',data:{tokenDurationMs:Date.now()-tokenStart},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      const apiStart = Date.now();
      // #endregion
      const url = new URL(`${apiBase()}/network/search-agents`);
      url.searchParams.set("query", "");
      url.searchParams.set("limit", String(SUGGESTED_LIMIT));
      url.searchParams.set("offset", String(page * SUGGESTED_LIMIT));
      url.searchParams.set("include_followed", "false"); // Exclude agents already followed

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:loadSuggestedAgents',message:'loadSuggestedAgents() COMPLETE',data:{apiDurationMs:Date.now()-apiStart,totalDurationMs:Date.now()-suggestedStart,agentCount:Array.isArray(data)?data.length:0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Double-check on client side: filter out any agents marked as followed
        const unfollowedAgents = Array.isArray(data) 
          ? data.filter((agent: FollowingAgent) => !agent.is_followed)
          : [];
        setSuggestedAgents(unfollowedAgents);
        // If we got fewer results than the limit, we've reached the end
        setHasMoreSuggested(unfollowedAgents.length >= SUGGESTED_LIMIT);
        setSuggestedPage(page);
      }
    } catch (e: any) {
      console.error("Failed to load suggested agents:", e);
      setSuggestedAgents([]);
    } finally {
      setLoadingSuggested(false);
      suggestedLoadingRef.current = false;
      if (withTransition) {
        // Allow enter animation to play
        setTimeout(() => setIsTransitioning(false), 50);
      }
    }
  };

  const searchAgents = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);

    try {
      const token = await getAccessToken();
      const url = new URL(`${apiBase()}/network/search-agents`);
      url.searchParams.set("query", query);
      url.searchParams.set("limit", "8");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      }
    } catch (e: any) {
      console.error("Search error:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (handleInput.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchAgents(handleInput);
      }, 300);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleInput]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Guard against duplicate initial loads (React StrictMode double-mount)
    if (hasInitializedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:useEffect',message:'Network page mount SKIPPED - already initialized',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return;
    }
    hasInitializedRef.current = true;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'network/page.tsx:useEffect',message:'Network page mount - starting data load',data:{apiBase:process.env.NEXT_PUBLIC_API_BASE},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,E'})}).catch(()=>{});
    // #endregion
    console.log("API_BASE:", process.env.NEXT_PUBLIC_API_BASE);
    load();
    loadSuggestedAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const follow = async (handleToFollow?: string, agentId?: string) => {
    const targetHandle = handleToFollow || normalizedHandle;
    if (!targetHandle) return;

    // Mark this specific agent as being followed
    if (agentId) {
      setFollowingAgentIds(prev => new Set(prev).add(agentId));
    }
    setErrorMsg("");

    try {
      const token = await getAccessToken();
      await apiPostQuery("/relationships/follow-agent-by-handle", { handle: targetHandle }, token);

      setHandleInput("");
      setSearchResults([]);
      setShowDropdown(false);
      await load();
      await loadSuggestedAgents(); // Refresh suggested agents
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to follow agent.");
    } finally {
      // Remove the agent from the following state
      if (agentId) {
        setFollowingAgentIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(agentId);
          return newSet;
        });
      }
    }
  };

  const selectAgent = (agent: FollowingAgent) => {
    follow(agent.avee_handle, agent.avee_id);
  };

  const unfollow = async (agentId: string) => {
    setUnfollowingAgentIds(prev => new Set(prev).add(agentId));
    setErrorMsg("");

    try {
      const token = await getAccessToken();
      const url = new URL(`${apiBase()}/relationships/unfollow-agent`);
      url.searchParams.set("avee_id", agentId);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      await load();
      await loadSuggestedAgents(); // Refresh suggested agents
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to unfollow agent.");
    } finally {
      setUnfollowingAgentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  };

  const handlePreviousSuggested = () => {
    if (suggestedPage > 0 && !loadingSuggested) {
      loadSuggestedAgents(suggestedPage - 1, true);
    }
  };

  const handleNextSuggested = () => {
    if (hasMoreSuggested && !loadingSuggested) {
      loadSuggestedAgents(suggestedPage + 1, true);
    }
  };

  const handleRefreshSuggested = () => {
    if (!loadingSuggested) {
      setSuggestedPage(0);
      loadSuggestedAgents(0, true);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Network</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          Follow agents to chat with them
        </p>
      </div>

      {/* Error Message */}
      {errorMsg ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-red-800">{errorMsg}</div>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-600 hover:text-red-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Suggested Agents */}
      {(suggestedAgents.length > 0 || suggestedPage > 0) && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Suggested Agents</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Discover agents you might like to follow</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Refresh button */}
                <button
                  onClick={handleRefreshSuggested}
                  disabled={loadingSuggested}
                  className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 transition-colors hover:bg-[#001f98]/10 hover:text-[#001f98] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Shuffle suggestions"
                >
                  <svg className={`h-4 w-4 ${loadingSuggested ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {/* Previous button */}
                <button
                  onClick={handlePreviousSuggested}
                  disabled={suggestedPage === 0 || loadingSuggested}
                  className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 transition-colors hover:bg-[#001f98]/10 hover:text-[#001f98] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous suggestions"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {/* Next button */}
                <button
                  onClick={handleNextSuggested}
                  disabled={!hasMoreSuggested || loadingSuggested}
                  className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 transition-colors hover:bg-[#001f98]/10 hover:text-[#001f98] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next suggestions"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 relative min-h-[200px]">
            {loadingSuggested ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm font-medium">Loading suggestions...</span>
                </div>
              </div>
            ) : suggestedAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="h-12 w-12 text-[#001f98]/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-[#001f98]/70 mb-2">No more suggestions available</p>
                {suggestedPage > 0 && (
                  <button
                    onClick={handlePreviousSuggested}
                    className="text-sm text-[#001f98] hover:underline"
                  >
                    ← Go back to previous suggestions
                  </button>
                )}
              </div>
            ) : (
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
              {suggestedAgents.map((agent) => (
                <div
                  key={agent.avee_id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white to-[#f8fafc] p-3 sm:p-4 transition-all hover:border-[#001f98] hover:shadow-md"
                >
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      {/* Avatar */}
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center shadow-sm">
                        {agent.avee_avatar_url ? (
                          <img src={agent.avee_avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      {/* Agent Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {agent.avee_display_name || agent.avee_handle}
                        </h3>
                        <p className="text-xs text-[#001f98]/70 truncate">@{agent.avee_handle}</p>
                        <p className="mt-0.5 text-xs text-[#001f98]/50 truncate">
                          by {agent.owner_display_name || agent.owner_handle}
                        </p>
                      </div>
                    </div>
                    
                    {/* Bio - with minimum height to ensure alignment */}
                    <div className="min-h-[40px] mb-3 flex items-start">
                      {agent.avee_bio && (
                        <p className="text-xs text-[#001f98]/70 line-clamp-2 leading-relaxed">
                          {agent.avee_bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Follow Button - always at bottom */}
                  <button
                    onClick={() => selectAgent(agent)}
                    disabled={followingAgentIds.has(agent.avee_id)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#001670] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {followingAgentIds.has(agent.avee_id) ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Following...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Follow
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Follow box */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Follow an Agent</h2>
          <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Find and follow agents by their handle</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
            <div className="relative flex-1 w-full sm:w-auto" ref={dropdownRef}>
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <input
                className="w-full rounded-lg border border-gray-200 py-2.5 sm:py-3 pl-9 sm:pl-10 pr-10 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                placeholder="Search agents..."
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") follow();
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                disabled={followingAgentIds.size > 0}
              />
              {isSearching && (
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#001f98]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              
              {/* Dropdown with search results */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="max-h-96 overflow-y-auto">
                    {searchResults.map((agent) => (
                      <button
                        key={agent.avee_id}
                        onClick={() => selectAgent(agent)}
                        className="w-full border-b border-gray-200 px-4 py-3 text-left transition-colors hover:bg-[#001f98]/5 last:border-b-0"
                        disabled={followingAgentIds.has(agent.avee_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center">
                            {agent.avee_avatar_url ? (
                              <img src={agent.avee_avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">
                              {agent.avee_display_name || agent.avee_handle}
                              <span className="ml-2 text-sm text-[#001f98]/70 font-normal">@{agent.avee_handle}</span>
                            </div>
                            {agent.avee_bio && (
                              <p className="text-xs text-[#001f98]/70 truncate">{agent.avee_bio}</p>
                            )}
                            <p className="text-xs text-[#001f98]/50">
                              by {agent.owner_display_name || agent.owner_handle}
                            </p>
                          </div>
                          <svg className="h-5 w-5 shrink-0 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results message */}
              {showDropdown && !isSearching && searchResults.length === 0 && handleInput.trim().length >= 2 && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="px-4 py-6 text-center text-sm text-[#001f98]/70">
                    <svg className="mx-auto mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    No agents found matching "{handleInput}"
                  </div>
                </div>
              )}
            </div>
            <button
              className="flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#001670] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!normalizedHandle || followingAgentIds.size > 0}
              onClick={() => follow()}
              title="Follow"
            >
              {followingAgentIds.size > 0 ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="hidden sm:inline">Following...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Follow</span>
                </>
              )}
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5 disabled:opacity-50"
              disabled={phase === "loading"}
              onClick={() => load(true)}
              title="Refresh"
            >
              <svg className={`h-4 w-4 ${phase === "loading" ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-[#001f98]/5 border border-[#001f98]/20 p-3 text-xs text-[#001f98]">
            <strong>Tip:</strong> Follow agents directly to interact with them. Access levels are controlled by the agent owner.
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Following</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
              {phase === "loading" ? "Loading..." : `${items.length} agent${items.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {phase === "error" ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load network</h3>
            <p className="text-sm text-gray-600 mb-4">Check that the backend is running and endpoints exist</p>
            <button
              onClick={() => load(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#001f98] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        ) : null}

        {phase === "loading" ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Loading your network...</span>
            </div>
          </div>
        ) : null}

        {phase === "ready" && items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#001f98]/10 to-[#001f98]/5">
              <svg className="h-10 w-10 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No agents followed yet</h3>
            <p className="text-sm text-[#001f98]/70 mb-6">Follow an agent to start chatting</p>
          </div>
        ) : null}

        {phase === "ready" && items.length > 0 && (
          <div className="divide-y divide-gray-200">
            {items.map((x) => (
              <div key={x.avee_id} className="group px-4 sm:px-6 py-4 sm:py-5 transition-colors hover:bg-[#001f98]/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center shadow-sm">
                      {x.avee_avatar_url ? (
                        <img src={x.avee_avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {x.avee_display_name || x.avee_handle}
                        <span className="ml-2 text-xs sm:text-sm text-[#001f98]/70 font-normal hidden sm:inline">@{x.avee_handle}</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-[#001f98]/70 truncate sm:hidden">
                        @{x.avee_handle}
                      </p>
                      <p className="text-xs sm:text-sm text-[#001f98]/70 truncate hidden sm:block">
                        Owner: {x.owner_display_name || x.owner_handle} <span className="text-[#001f98]/50">(@{x.owner_handle})</span>
                      </p>
                      {x.avee_bio && (
                        <p className="text-xs text-[#001f98]/70 mt-1 line-clamp-1 hidden sm:block">{x.avee_bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Desktop: Full buttons with text */}
                  <div className="hidden sm:flex shrink-0 items-center gap-2">
                    <ChatButton
                      handle={x.avee_handle}
                      displayName={x.avee_display_name || x.avee_handle}
                      className="flex items-center gap-2 rounded-lg bg-[#001f98] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#001670] hover:shadow-md"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Chat
                    </ChatButton>

                    <Link
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
                      href={`/u/${encodeURIComponent(x.avee_handle)}`}
                      title="View profile"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </Link>

                    <button
                      onClick={() => unfollow(x.avee_id)}
                      disabled={unfollowingAgentIds.has(x.avee_id)}
                      className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Unfollow agent"
                    >
                      {unfollowingAgentIds.has(x.avee_id) ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Unfollowing...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                          Unfollow
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mobile: Icon-only buttons */}
                  <div className="flex sm:hidden shrink-0 items-center gap-1.5">
                    <ChatButton
                      handle={x.avee_handle}
                      displayName={x.avee_display_name || x.avee_handle}
                      className="flex items-center justify-center rounded-lg bg-[#001f98] p-2.5 text-white shadow-sm transition-all hover:bg-[#001670]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </ChatButton>

                    <Link
                      className="flex items-center justify-center rounded-lg border border-gray-200 p-2.5 text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
                      href={`/u/${encodeURIComponent(x.avee_handle)}`}
                      title="View profile"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </Link>

                    <button
                      onClick={() => unfollow(x.avee_id)}
                      disabled={unfollowingAgentIds.has(x.avee_id)}
                      className="flex items-center justify-center rounded-lg border border-red-200 p-2.5 text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Unfollow agent"
                    >
                      {unfollowingAgentIds.has(x.avee_id) ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#001f98]/20 bg-gradient-to-br from-[#001f98]/5 to-[#f8fafc] shadow-sm">
        <div className="p-4 sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-900">
            <svg className="h-5 w-5 text-[#001f98] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How It Works
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-[#001f98]">
            <li className="flex items-start gap-2">
              <svg className="h-5 w-5 shrink-0 text-[#001f98] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Follow agents directly:</strong> You now follow agents themselves, not their owners</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-5 w-5 shrink-0 text-[#001f98] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Chat instantly:</strong> Once you follow an agent, you can chat with it</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-5 w-5 shrink-0 text-[#001f98] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Access controlled by owner:</strong> The agent owner determines your access level (public/friends/intimate)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function NetworkPage() {
  return (
    <NewLayoutWrapper>
      <NetworkContent />
    </NewLayoutWrapper>
  );
}
