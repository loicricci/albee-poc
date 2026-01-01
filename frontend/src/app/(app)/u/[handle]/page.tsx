"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { ChatButton } from "@/components/ChatButton";
import { PostsGallery } from "@/components/PostsGallery";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type ProfileData = {
  type: "profile" | "agent";
  profile?: {
    user_id: string;
    handle: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    location: string | null;
    twitter_handle: string | null;
    linkedin_url: string | null;
    github_username: string | null;
    instagram_handle: string | null;
    website: string | null;
    occupation: string | null;
    interests: string | null;
    created_at: string | null;
  };
  agent?: {
    id: string | null;
    handle: string | null;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    follower_count: number;
    created_at: string | null;
  } | null;
  is_following: boolean;
  is_own_profile: boolean;
};

type AgentUpdate = {
  id: string;
  title: string;
  content: string;
  topic: string | null;
  layer: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string | null;
};

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

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function apiPost(path: string, query: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${apiBase()}${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const txt = await res.text();
  return txt ? JSON.parse(txt) : { ok: true };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}

function ProfileContent() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [updates, setUpdates] = useState<AgentUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const data = await apiGet<ProfileData>(`/profiles/${handle}`, token);
      setProfileData(data);
      setFollowing(data.is_following);

      // Load updates if there's an agent
      if (data.agent?.id) {
        loadUpdates(token);
      } else {
        setUpdatesLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load profile");
      setUpdatesLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadUpdates(token?: string) {
    setUpdatesLoading(true);
    try {
      const authToken = token || await getAccessToken();
      const data = await apiGet<{ total: number; updates: AgentUpdate[] }>(
        `/profiles/${handle}/updates?limit=10`,
        authToken
      );
      setUpdates(data.updates);
    } catch (e: any) {
      console.error("Failed to load updates:", e);
      setUpdates([]);
    } finally {
      setUpdatesLoading(false);
    }
  }

  async function handleFollow() {
    if (!profileData?.agent?.handle) return;

    setFollowing(true);
    try {
      const token = await getAccessToken();
      await apiPost(
        "/relationships/follow-agent-by-handle",
        { handle: profileData.agent.handle },
        token
      );
      // Reload to update follower count
      loadProfile();
    } catch (e: any) {
      setError(e?.message || "Failed to follow");
      setFollowing(profileData.is_following);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          {/* Header skeleton */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="flex items-start gap-6">
              <div className="h-32 w-32 rounded-2xl bg-gray-200"></div>
              <div className="flex-1 space-y-4">
                <div className="h-8 w-64 bg-gray-200 rounded"></div>
                <div className="h-4 w-48 bg-gray-100 rounded"></div>
                <div className="h-20 w-full bg-gray-100 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <svg className="mx-auto h-16 w-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-red-900 mb-2">Profile not found</h2>
          <p className="text-red-700 mb-6">{error || "The profile you're looking for doesn't exist."}</p>
          <Link
            href="/network"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2E3A59] px-6 py-3 text-white font-semibold hover:bg-[#1a2236] transition-colors"
          >
            Browse Network
          </Link>
        </div>
      </div>
    );
  }

  const displayProfile = profileData.type === "profile" ? profileData.profile : profileData.profile;
  const displayAgent = profileData.agent;
  const displayName = displayAgent?.display_name || displayProfile?.display_name || displayProfile?.handle || handle;
  const bio = displayAgent?.bio || displayProfile?.bio;
  const avatarUrl = displayAgent?.avatar_url || displayProfile?.avatar_url;
  const createdAt = displayAgent?.created_at || displayProfile?.created_at;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Sticky CTA Bar for Mobile */}
      {!profileData.is_own_profile && displayAgent?.handle && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E6E6E6] shadow-lg p-4 md:hidden">
          <div className="flex gap-3">
            <ChatButton
              handle={displayAgent.handle}
              displayName={displayName}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#2E3A59] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1a2236]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </ChatButton>

            <button
              onClick={handleFollow}
              disabled={following}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-all ${
                profileData.is_following
                  ? "border-2 border-[#2E3A59] text-[#2E3A59] bg-white"
                  : "bg-[#2E3A59] text-white hover:bg-[#1a2236]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {following ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </>
              ) : profileData.is_following ? (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Following
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Follow
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        {/* Banner */}
        <div className="relative h-48 bg-gradient-to-r from-[#2E3A59] to-[#1a2236] overflow-hidden">
          {profileData?.profile?.banner_url ? (
            <img src={profileData.profile.banner_url} 
              alt="Profile Banner" 
              className="h-full w-full object-cover"
            />
          ) : (
            /* Default gradient if no banner */
            <div className="h-full w-full bg-gradient-to-r from-[#2E3A59] to-[#1a2236]"></div>
          )}
        </div>

        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="relative -mt-20 mb-4">
            <div className="h-32 w-32 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* Profile Info & Actions */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#0B0B0C] mb-1">{displayName}</h1>
              <p className="text-lg text-[#2E3A59]/70 mb-4">@{handle}</p>

              {bio && (
                <p className="text-[#2E3A59] mb-4 max-w-2xl">{bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 mb-4">
                {displayAgent && (
                  <div className="text-sm">
                    <span className="font-bold text-[#0B0B0C]">{displayAgent.follower_count || 0}</span>
                    <span className="text-[#2E3A59]/70 ml-1">followers</span>
                  </div>
                )}
                {createdAt && (
                  <div className="text-sm text-[#2E3A59]/70">
                    Joined {formatDate(createdAt)}
                  </div>
                )}
              </div>

              {/* Social Links */}
              {displayProfile && (
                <div className="flex flex-wrap items-center gap-3">
                  {displayProfile.website && (
                    <a
                      href={displayProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#2E3A59] hover:text-[#1a2236] transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </a>
                  )}
                  {displayProfile.twitter_handle && (
                    <a
                      href={`https://twitter.com/${displayProfile.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#2E3A59] hover:text-[#1a2236] transition-colors"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                      </svg>
                      @{displayProfile.twitter_handle}
                    </a>
                  )}
                  {displayProfile.github_username && (
                    <a
                      href={`https://github.com/${displayProfile.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#2E3A59] hover:text-[#1a2236] transition-colors"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      @{displayProfile.github_username}
                    </a>
                  )}
                  {displayProfile.location && (
                    <div className="flex items-center gap-2 text-sm text-[#2E3A59]/70">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {displayProfile.location}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!profileData.is_own_profile && displayAgent?.handle && (
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <ChatButton
                  handle={displayAgent.handle}
                  displayName={displayName}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 ring-2 ring-[#2E3A59]/20"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat with Agent
                </ChatButton>

                <button
                  onClick={handleFollow}
                  disabled={following}
                  className={`flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold shadow-lg transition-all hover:shadow-xl hover:scale-105 ${
                    profileData.is_following
                      ? "border-2 border-[#2E3A59] text-[#2E3A59] bg-white hover:bg-gray-50 ring-2 ring-[#2E3A59]/20"
                      : "bg-gradient-to-r from-[#2E3A59] to-[#1a2236] text-white ring-2 ring-[#2E3A59]/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {following ? (
                    <>
                      <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Following...
                    </>
                  ) : profileData.is_following ? (
                    <>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Following
                    </>
                  ) : (
                    <>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Follow
                    </>
                  )}
                </button>
              </div>
            )}

            {profileData.is_own_profile && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/profile"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#2E3A59] px-8 py-4 text-base font-bold text-[#2E3A59] bg-white transition-all hover:bg-[#2E3A59]/5 shadow-lg hover:shadow-xl hover:scale-105 ring-2 ring-[#2E3A59]/20"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </Link>
                <Link
                  href="/my-agents"
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 ring-2 ring-[#2E3A59]/20"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Manage Agents
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Updates/Feed Section */}
      {displayAgent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#0B0B0C]">Updates</h2>
            {updates.length > 0 && (
              <span className="text-sm text-[#2E3A59]/70">
                {updates.length} update{updates.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {updatesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
                  <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : updates.length > 0 ? (
            <div className="space-y-4">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-lg font-semibold text-[#0B0B0C] flex-1">
                        {update.is_pinned && (
                          <span className="mr-2 text-yellow-500" title="Pinned">
                            📌
                          </span>
                        )}
                        {update.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {update.topic && (
                          <span className="rounded-full bg-[#2E3A59]/10 px-3 py-1 text-xs font-medium text-[#2E3A59]">
                            {update.topic}
                          </span>
                        )}
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          {update.layer}
                        </span>
                      </div>
                    </div>

                    <p className="text-[#2E3A59] whitespace-pre-wrap mb-4">{update.content}</p>

                    <div className="flex items-center gap-4 text-xs text-[#2E3A59]/70">
                      <div className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(update.created_at)}
                      </div>
                      {update.updated_at && update.updated_at !== update.created_at && (
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Updated {formatDate(update.updated_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E6E6E6] bg-white p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-[#0B0B0C] mb-2">No updates yet</h3>
              <p className="text-[#2E3A59]/70">
                {profileData.is_own_profile
                  ? "Start sharing updates with your followers"
                  : "This agent hasn't posted any updates yet"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Posts Gallery Section */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#0B0B0C]">Posts</h2>
        </div>
        
        <PostsGallery 
          userHandle={handle} 
          isOwnProfile={profileData?.is_own_profile || false}
        />
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <NewLayoutWrapper>
      <ProfileContent />
    </NewLayoutWrapper>
  );
}

