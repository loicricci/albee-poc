"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type SuggestedAgent = {
  avee_id: string;
  avee_handle: string;
  avee_display_name?: string | null;
  avee_avatar_url?: string | null;
  avee_bio?: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name?: string | null;
  is_followed?: boolean;
};

interface OnboardingStepFollowAgentsProps {
  onComplete: () => void;
}

export function OnboardingStepFollowAgents({ onComplete }: OnboardingStepFollowAgentsProps) {
  const [agents, setAgents] = useState<SuggestedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const hasInitializedRef = useRef(false);

  const LIMIT = 9;

  async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) throw new Error("Not logged in.");
    return token;
  }

  function apiBase() {
    const base = process.env.NEXT_PUBLIC_API_BASE;
    if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE.");
    return base;
  }

  async function loadAgents(pageNum: number = 0, refresh: boolean = false) {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const url = new URL(`${apiBase()}/network/search-agents`);
      url.searchParams.set("query", "");
      url.searchParams.set("limit", String(LIMIT));
      url.searchParams.set("offset", String(pageNum * LIMIT));
      url.searchParams.set("include_followed", "false");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const unfollowedAgents = Array.isArray(data)
        ? data.filter((agent: SuggestedAgent) => !agent.is_followed && !followedIds.has(agent.avee_id))
        : [];

      setAgents(unfollowedAgents);
      setHasMore(unfollowedAgents.length >= LIMIT);
      setPage(pageNum);
    } catch (e: any) {
      setError(e.message || "Failed to load agents");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    loadAgents(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFollow(agent: SuggestedAgent) {
    setFollowingIds(prev => new Set(prev).add(agent.avee_id));
    setError(null);

    try {
      const token = await getAccessToken();
      const base = apiBase();
      const endpoint = `${base}/relationships/follow-agent-by-handle?handle=${encodeURIComponent(agent.avee_handle)}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`Failed to follow: ${errorText}`);
      }

      // Mark as followed and remove from list
      setFollowedIds(prev => new Set(prev).add(agent.avee_id));
      setAgents(prev => prev.filter(a => a.avee_id !== agent.avee_id));
    } catch (e: any) {
      console.error("Follow error:", e);
      setError(e.message || "Failed to follow agent. Please try again.");
    } finally {
      setFollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agent.avee_id);
        return newSet;
      });
    }
  }

  function handleRefresh() {
    setPage(0);
    loadAgents(0, true);
  }

  function handlePrevious() {
    if (page > 0) {
      loadAgents(page - 1);
    }
  }

  function handleNext() {
    if (hasMore) {
      loadAgents(page + 1);
    }
  }

  const followedCount = followedIds.size;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[#0B0B0C] dark:text-white mb-3">
          Discover Agents to Follow
        </h1>
        <p className="text-[#001f98]/70 dark:text-zinc-400">
          Follow some agents to populate your feed with content
        </p>
        {followedCount > 0 && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
            {followedCount} agent{followedCount !== 1 ? "s" : ""} followed
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[#001f98]/70 dark:text-zinc-400">
          {loading ? "Loading..." : `${agents.length} suggestion${agents.length !== 1 ? "s" : ""}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 dark:text-zinc-400 transition-colors hover:bg-[#001f98]/10 dark:hover:bg-white/[.10] hover:text-[#001f98] dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh suggestions"
          >
            <svg className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handlePrevious}
            disabled={page === 0 || loading}
            className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 dark:text-zinc-400 transition-colors hover:bg-[#001f98]/10 dark:hover:bg-white/[.10] hover:text-[#001f98] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={!hasMore || loading}
            className="flex items-center justify-center rounded-lg p-2 text-[#001f98]/70 dark:text-zinc-400 transition-colors hover:bg-[#001f98]/10 dark:hover:bg-white/[.10] hover:text-[#001f98] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="mb-6 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-[#001f98]/70 dark:text-zinc-400">
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Loading suggestions...</span>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#001f98]/10 to-[#001f98]/5 dark:from-white/[.10] dark:to-white/[.05]">
              <svg className="h-8 w-8 text-[#001f98] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0B0B0C] dark:text-white mb-2">
              {followedCount > 0 ? "All caught up!" : "No agents available"}
            </h3>
            <p className="text-sm text-[#001f98]/70 dark:text-zinc-400 mb-4">
              {followedCount > 0
                ? "You've followed some great agents. Continue to start exploring!"
                : "Check back later for new agents to discover."}
            </p>
            {page > 0 && (
              <button
                onClick={handlePrevious}
                className="text-sm text-[#001f98] dark:text-white hover:underline"
              >
                ← Go back to previous suggestions
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.avee_id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 p-4 transition-all hover:border-[#001f98] dark:hover:border-white/[.20] hover:shadow-md"
              >
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Avatar */}
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 dark:border-white/[.10] bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center shadow-sm">
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
                      <h3 className="font-semibold text-[#0B0B0C] dark:text-white truncate text-sm">
                        {agent.avee_display_name || agent.avee_handle}
                      </h3>
                      <p className="text-xs text-[#001f98]/70 dark:text-zinc-400 truncate">@{agent.avee_handle}</p>
                      <p className="mt-0.5 text-xs text-[#001f98]/50 dark:text-zinc-500 truncate">
                        by {agent.owner_display_name || agent.owner_handle}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="min-h-[40px] mb-3 flex items-start">
                    {agent.avee_bio && (
                      <p className="text-xs text-[#001f98]/70 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {agent.avee_bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Follow Button */}
                <button
                  onClick={() => handleFollow(agent)}
                  disabled={followingIds.has(agent.avee_id)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#001670] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
                >
                  {followingIds.has(agent.avee_id) ? (
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

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onComplete}
          className="w-full rounded-lg bg-[#001f98] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#001670] hover:shadow-lg dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
        >
          {followedCount > 0 ? `Continue (${followedCount} followed)` : "Continue"}
        </button>
        {followedCount === 0 && (
          <button
            onClick={onComplete}
            className="w-full rounded-full border-2 border-gray-200 dark:border-white/[.20] px-6 py-3 text-sm font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#001f98] dark:hover:border-white/[.30] hover:bg-gray-100 dark:hover:bg-white/[.08]"
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#001f98] dark:bg-white"></div>
        </div>
        <p className="mt-2 text-xs text-[#001f98]/50 dark:text-zinc-500">
          Step 5 of 5
        </p>
      </div>
    </div>
  );
}
