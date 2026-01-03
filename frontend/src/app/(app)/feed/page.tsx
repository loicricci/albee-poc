"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { QuickUpdateComposer } from "@/components/QuickUpdateComposer";
import { FeedPostCard } from "@/components/FeedPostCard";
import { 
  getUnifiedFeed, 
  likePost, 
  unlikePost, 
  sharePost,
  UnifiedFeedItem 
} from "@/lib/api";

type Profile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Avee = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
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

function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function LeftSidebar({
  profile,
  avees,
}: {
  profile: Profile | null;
  avees: Avee[];
}) {
  return (
    <div className="hidden xl:block xl:w-80 shrink-0 space-y-6">
      {/* Profile Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-[#001f98] p-4">
          <h2 className="text-sm font-semibold text-white">Your Profile</h2>
        </div>
        <div className="p-4">
          {profile ? (
            <div className="space-y-3">
              {/* Debug info - remove later */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 p-2 bg-yellow-50 rounded">
                  Avatar URL: {profile.avatar_url || '(none)'}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full border-2 border-blue-100 bg-[#001f98] flex items-center justify-center text-white font-semibold overflow-hidden">
                  {profile.avatar_url && profile.avatar_url.trim() !== "" ? (
                    <img src={profile.avatar_url} 
                      alt={profile.display_name || profile.handle}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error("Image failed to load:", profile.avatar_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{profile.display_name ? profile.display_name[0].toUpperCase() : profile.handle[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">
                    {profile.display_name || profile.handle}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    @{profile.handle}
                  </div>
                </div>
              </div>
              {profile.bio && (
                <p className="text-sm text-gray-600 line-clamp-2">{profile.bio}</p>
              )}
              <Link
                href="/profile"
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                View profile
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No profile found.</p>
          )}
        </div>
      </div>

      {/* Avees Snapshot */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 p-4">
          <h2 className="font-semibold text-gray-900">Your Avees</h2>
          <p className="mt-1 text-xs text-gray-500">
            {avees.length} active Avee{avees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-4">
          {avees.length > 0 ? (
            <div className="space-y-3">
              {avees.slice(0, 5).map((avee) => (
                <div
                  key={avee.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2 transition-colors hover:bg-gray-50"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 bg-[#001f98] flex items-center justify-center">
                    {avee.avatar_url ? (
                      <img src={avee.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-white">
                        {(avee.display_name || avee.handle)[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate text-gray-900">
                      {avee.display_name || avee.handle}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      @{avee.handle}
                    </div>
                  </div>
                  <Link
                    href={`/chat/${avee.handle}`}
                    className="shrink-0 rounded-lg bg-[#001f98] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#001670]"
                  >
                    Chat
                  </Link>
                </div>
              ))}
              {avees.length > 5 && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  +{avees.length - 5} more
                </div>
              )}
              <Link
                href="/my-agents"
                className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                View all Avees
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No Avees yet.</p>
              <Link
                href="/my-agents"
                className="inline-flex items-center gap-2 rounded-lg bg-[#001f98] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#001670]"
              >
                Create your first Avee
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopNavigation({ profile }: { profile: Profile | null }) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6 py-3 md:py-4">
        {/* Left side - Logo and Search */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <Link
            href="/feed"
            className="group flex items-center gap-2 shrink-0"
          >
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-[#001f98] shadow-md transition-transform group-hover:scale-105">
              <span className="text-base md:text-lg font-bold text-white">A</span>
            </div>
            <span className="hidden sm:inline text-xl font-bold text-gray-900">AGENT</span>
          </Link>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-gray-400"
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
                placeholder="Search..."
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 md:py-2 pl-9 md:pl-10 pr-3 md:pr-4 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Right side - Navigation buttons */}
        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <Link
            href="/feed"
            className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-blue-50 text-[#001f98]"
            title="Home Feed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4 md:h-5 md:w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </Link>

          <Link
            href="/network"
            className="hidden sm:flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
            title="Network"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4 md:h-5 md:w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </Link>

          <Link
            href="/notifications"
            className="hidden sm:flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
            title="Notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4 md:h-5 md:w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </Link>

          <Link
            href="/profile"
            className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-[#001f98] text-white transition-all hover:bg-[#001670] overflow-hidden border-2 border-transparent hover:border-blue-200"
            title="Profile"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} 
                alt={profile.display_name || profile.handle || "Profile"}
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4 md:h-5 md:w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  // Feed page - sidebar removed for better mobile/tablet experience
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avees, setAvees] = useState<Avee[]>([]);
  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);

      try {
        const token = await getAccessToken();

        const [p, a] = await Promise.all([
          apiGet<Profile>("/me/profile", token).catch(() => null),
          apiGet<Avee[]>("/me/avees", token).catch(() => []),
        ]);

        if (!alive) return;

        console.log("Profile data loaded:", p);
        console.log("Avatar URL:", p?.avatar_url);
        setProfile(p);
        setAvees(Array.isArray(a) ? a : []);
        
        // Load feed
        loadFeed();
      } catch (e: any) {
        if (!alive) return;
        console.error("Failed to load data:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError(null);

    try {
      const feedData = await getUnifiedFeed(20, 0);
      setFeedItems(feedData.items);
    } catch (e: any) {
      console.error("Failed to load feed:", e);
      setFeedError(e?.message || "Failed to load feed");
    } finally {
      setFeedLoading(false);
    }
  }

  async function handleLike(postId: string, liked: boolean) {
    try {
      if (liked) {
        await likePost(postId);
      } else {
        await unlikePost(postId);
      }
      // Success - optimistic UI update already happened in FeedPostCard
    } catch (e: any) {
      console.error("Failed to toggle like:", e);
      // Error will be handled by FeedPostCard (revert optimistic update)
      throw e; // Re-throw to let FeedPostCard handle the error
    }
  }

  async function handleComment(postId: string) {
    // For now, just show the comments section
    // In the future, we can load actual comments here
    console.log("View comments for post:", postId);
  }

  async function handleRepost(postId: string, comment: string) {
    try {
      await sharePost(postId, "repost", comment || undefined);
      alert("Post reposted successfully!");
      // Reload feed to show the new repost
      loadFeed();
    } catch (e: any) {
      console.error("Failed to repost:", e);
      alert(e?.message || "Failed to repost");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation profile={profile} />

      <div className="mx-auto max-w-4xl px-4 md:px-6 py-4 md:py-8">
        {/* Main Feed */}
        <main className="w-full">
          <div className="mb-4 md:mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Your Feed</h1>
            <p className="mt-1 text-sm text-gray-600">Latest updates from your followed Avees</p>
          </div>

          {/* Quick Update Composer */}
          <div className="mb-4 md:mb-6">
            <QuickUpdateComposer agents={avees} onUpdatePosted={() => {
              // Reload feed to show new update
              loadFeed();
            }} />
          </div>

          {/* Feed Items */}
          {feedLoading && (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div>
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-gray-100 rounded"></div>
                    </div>
                  </div>
                  <div className="h-64 w-full bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {feedError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load feed</h3>
              <p className="text-red-700 mb-4">{feedError}</p>
              <button
                onClick={loadFeed}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!feedLoading && !feedError && feedItems.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Your feed is empty</h3>
              <p className="text-gray-600 mb-4">
                Start following agents or create your own to see updates here!
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/network"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Discover Agents
                </Link>
                <Link
                  href="/my-agents"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#001f98] px-4 py-2 text-white font-medium hover:bg-[#001670] transition-colors"
                >
                  Create Agent
                </Link>
              </div>
            </div>
          )}

          {!feedLoading && !feedError && feedItems.length > 0 && (
            <div className="space-y-4 md:space-y-6">
              {feedItems.map((item) => (
                <FeedPostCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onLike={handleLike}
                  onComment={handleComment}
                  onRepost={handleRepost}
                  currentUserId={profile?.user_id}
                  currentUserHandle={profile?.handle}
                  currentUserAvatar={profile?.avatar_url}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
