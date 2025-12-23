"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChatButton } from "@/components/ChatButton";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { QuickUpdateComposer } from "@/components/QuickUpdateComposer";

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

type FeedItemUpdate = {
  id: string;
  title: string;
  content: string;
  topic: string | null;
  layer: string;
  is_pinned: boolean;
  created_at: string;
  is_read: boolean;
};

type FeedItem = {
  agent_id: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  agent_bio: string | null;
  is_own_agent: boolean;
  unread_count: number;
  total_updates: number;
  latest_update: FeedItemUpdate | null;
  owner_user_id: string;
  owner_handle: string | null;
  owner_display_name: string | null;
};

type FeedResponse = {
  items: FeedItem[];
  total_items: number;
  total_unread: number;
};

// Recommendation type
type Recommendation = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  owner_user_id: string;
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

function AveeFeedCard({ item, onMarkRead }: { item: FeedItem; onMarkRead: (agentId: string) => void }) {
  const [isStarred, setIsStarred] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleMarkAllRead = async () => {
    try {
      await onMarkRead(item.agent_id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-[#2E3A59]/20">
      {/* Update count badge with unread indicator */}
      <div className="absolute right-6 top-6 flex flex-col items-center rounded-xl border-2 border-[#2E3A59]/20 bg-gradient-to-br from-[#2E3A59]/10 to-[#2E3A59]/5 px-4 py-2">
        <div className="flex items-center gap-1">
          <div className="text-lg font-bold text-[#2E3A59]">{item.total_updates}</div>
          {item.unread_count > 0 && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C8A24A] text-[10px] font-bold text-white">
              {item.unread_count}
            </div>
          )}
        </div>
        <div className="text-xs font-medium text-[#2E3A59]/70">updates</div>
      </div>

      {/* Own agent badge */}
      {item.is_own_agent && (
        <div className="absolute left-6 top-6 rounded-lg bg-[#C8A24A]/10 px-3 py-1 text-xs font-semibold text-[#C8A24A]">
          Your Agent
        </div>
      )}

      {/* Main content */}
      <div className="mb-4 flex items-start gap-4" style={{ marginTop: item.is_own_agent ? '2rem' : '0' }}>
        {/* Avatar */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-[#E6E6E6] bg-gradient-to-br from-[#FAFAFA] to-[#E6E6E6] flex items-center justify-center shadow-sm">
          {item.agent_avatar_url ? (
            <img 
              src={item.agent_avatar_url} 
              alt={item.agent_display_name || item.agent_handle} 
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <svg className="h-8 w-8 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0 pr-20">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[#0B0B0C] truncate">
              {item.agent_display_name || item.agent_handle}
            </h3>
            <button
              onClick={() => setIsStarred(!isStarred)}
              className="shrink-0 text-xl transition-transform hover:scale-110"
              aria-label={isStarred ? "Unstar" : "Star"}
            >
              {isStarred ? "⭐" : "☆"}
            </button>
          </div>
          <p className="text-sm text-[#2E3A59]/70">
            @{item.agent_handle}
            {!item.is_own_agent && item.owner_display_name && (
              <span> · by {item.owner_display_name}</span>
            )}
          </p>
          {item.latest_update && (
            <p className="mt-1 text-xs text-[#2E3A59]/50">
              Latest update: {formatDate(item.latest_update.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Latest update box */}
      {item.latest_update ? (
        <div className="mb-4 rounded-lg border border-[#2E3A59]/20 bg-gradient-to-r from-[#2E3A59]/5 to-[#FAFAFA] px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-[#2E3A59]">{item.latest_update.title}</p>
            {!item.latest_update.is_read && (
              <span className="shrink-0 inline-block h-2 w-2 rounded-full bg-[#C8A24A]" title="Unread" />
            )}
          </div>
          <p className="text-sm text-[#0B0B0C] line-clamp-2">{item.latest_update.content}</p>
          {item.latest_update.topic && (
            <span className="mt-2 inline-block rounded-full bg-[#2E3A59]/10 px-2 py-1 text-xs text-[#2E3A59]">
              {item.latest_update.topic}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3 text-center">
          <p className="text-sm text-[#2E3A59]/50">No updates yet</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <ChatButton
          handle={item.agent_handle}
          displayName={item.agent_display_name || item.agent_handle}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#2E3A59] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1a2236] hover:shadow-lg hover:scale-[1.02]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Get updated
        </ChatButton>
        {item.unread_count > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="shrink-0 rounded-lg border border-[#2E3A59] px-4 py-3 text-sm font-medium text-[#2E3A59] transition-colors hover:bg-[#2E3A59] hover:text-white"
            title="Mark all as read"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function to validate if a URL is a valid image URL
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  
  // Check if it starts with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  
  // Try to parse as URL
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function followAgent(aveeId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/relationships/follow-agent?avee_id=${aveeId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

function LeftSidebar({
  profile,
  avees,
  recommendations,
  onFollowAgent,
}: {
  profile: Profile | null;
  avees: Avee[];
  recommendations: Recommendation[];
  onFollowAgent: (aveeId: string) => void;
}) {
  // Validate the avatar URL
  const hasValidAvatar = profile && isValidImageUrl(profile.avatar_url);
  
  return (
    <div className="w-80 shrink-0 space-y-6">
      {/* Profile Card */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#2E3A59] to-[#1a2236] p-4">
          <h2 className="text-sm font-semibold text-white">Your Profile</h2>
        </div>
        <div className="p-4">
          {profile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full border-2 border-[#2E3A59]/20 bg-gradient-to-br from-[#2E3A59] to-[#1a2236] flex items-center justify-center text-white font-semibold overflow-hidden">
                  {hasValidAvatar ? (
                    <img 
                      src={profile.avatar_url!} 
                      alt={profile.display_name || profile.handle}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Silently hide the image and show the initial instead
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  {!hasValidAvatar && (
                    <span>{profile.display_name ? profile.display_name[0].toUpperCase() : profile.handle[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#0B0B0C] truncate">
                    {profile.display_name || profile.handle}
                  </div>
                  <div className="text-sm text-[#2E3A59]/70 truncate">
                    @{profile.handle}
                  </div>
                </div>
              </div>
              {profile.bio && (
                <p className="text-sm text-[#2E3A59]/70 line-clamp-2">{profile.bio}</p>
              )}
              <Link
                href="/profile"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
              >
                View profile
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[#2E3A59]/70">No profile found.</p>
          )}
        </div>
      </div>

      {/* Agents Snapshot */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="border-b border-[#E6E6E6] bg-[#FAFAFA] p-4">
          <h2 className="font-semibold text-[#0B0B0C]">Your Agents</h2>
          <p className="mt-1 text-xs text-[#2E3A59]/70">
            {avees.length} active Agent{avees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-4">
          {avees.length > 0 ? (
            <div className="space-y-3">
              {avees.slice(0, 5).map((avee) => {
                const hasValidAveeAvatar = isValidImageUrl(avee.avatar_url);
                return (
                <div
                  key={avee.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#E6E6E6] p-2 transition-colors hover:bg-[#2E3A59]/5"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-[#E6E6E6] bg-gradient-to-br from-[#2E3A59] to-[#1a2236] flex items-center justify-center">
                    {hasValidAveeAvatar ? (
                      <img 
                        src={avee.avatar_url!} 
                        alt="" 
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-white">
                        {(avee.display_name || avee.handle)[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate text-[#0B0B0C]">
                      {avee.display_name || avee.handle}
                    </div>
                    <div className="text-xs text-[#2E3A59]/70 truncate">
                      @{avee.handle}
                    </div>
                  </div>
                  <ChatButton
                    handle={avee.handle}
                    displayName={avee.display_name || avee.handle}
                    className="shrink-0 rounded-lg bg-[#2E3A59] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a2236]"
                  >
                    Chat
                  </ChatButton>
                </div>
              );
              })}
              {avees.length > 5 && (
                <div className="text-xs text-[#2E3A59]/70 text-center pt-2">
                  +{avees.length - 5} more
                </div>
              )}
              <Link
                href="/my-agents"
                className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
              >
                View all Agents
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[#2E3A59]/70 mb-3">No Agents yet.</p>
              <Link
                href="/my-agents"
                className="inline-flex items-center gap-2 rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a2236]"
              >
                Create your first Agent
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="border-b border-[#E6E6E6] bg-[#FAFAFA] p-4">
          <h2 className="font-semibold text-[#0B0B0C]">Recommended</h2>
          <p className="mt-1 text-xs text-[#2E3A59]/70">Discover new Agents</p>
        </div>
        <div className="divide-y divide-[#E6E6E6] p-4 space-y-4">
          {recommendations.length > 0 ? (
            recommendations.map((rec) => {
              const hasValidRecAvatar = isValidImageUrl(rec.avatar_url);
              return (
                <div key={rec.id} className="pt-4 first:pt-0">
                  <div className="flex items-start gap-3 mb-2">
                    {/* Avatar */}
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-[#E6E6E6] bg-gradient-to-br from-[#2E3A59] to-[#1a2236] flex items-center justify-center">
                      {hasValidRecAvatar ? (
                        <img 
                          src={rec.avatar_url!} 
                          alt={rec.display_name || rec.handle} 
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {(rec.display_name || rec.handle)[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#0B0B0C] truncate">
                        {rec.display_name || rec.handle}
                      </div>
                      <div className="text-xs text-[#2E3A59]/70 truncate">@{rec.handle}</div>
                    </div>
                  </div>
                  {rec.bio && (
                    <p className="text-xs text-[#2E3A59]/70 mb-3 line-clamp-2">
                      {rec.bio}
                    </p>
                  )}
                  <button 
                    onClick={() => onFollowAgent(rec.id)}
                    className="w-full rounded-lg border border-[#2E3A59] px-3 py-2 text-xs font-medium text-[#2E3A59] transition-colors hover:bg-[#2E3A59] hover:text-white"
                  >
                    Follow
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[#2E3A59]/70">No recommendations available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function AppHomePage() {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avees, setAvees] = useState<Avee[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feedData, setFeedData] = useState<FeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Load from cache immediately for instant UI
      try {
        const cachedProfile = localStorage.getItem('app_profile');
        const cachedAvees = localStorage.getItem('app_avees');
        const cachedRecs = localStorage.getItem('app_recommendations');
        const cachedFeed = localStorage.getItem('app_feed');
        
        if (cachedProfile) setProfile(JSON.parse(cachedProfile));
        if (cachedAvees) setAvees(JSON.parse(cachedAvees));
        if (cachedRecs) setRecommendations(JSON.parse(cachedRecs));
        if (cachedFeed) setFeedData(JSON.parse(cachedFeed));
      } catch (e) {
        console.warn("Failed to load from cache:", e);
      }

      try {
        const token = await getAccessToken();

        // Fetch critical data first (profile + avees)
        const [p, a] = await Promise.all([
          apiGet<Profile>("/me/profile", token).catch(() => null),
          apiGet<Avee[]>("/me/avees", token).catch(() => []),
        ]);

        if (!alive) return;

        // Update immediately with critical data
        if (p) {
          setProfile(p);
          localStorage.setItem('app_profile', JSON.stringify(p));
        }
        if (Array.isArray(a)) {
          setAvees(a);
          localStorage.setItem('app_avees', JSON.stringify(a));
        }

        // Fetch non-critical data in background (recommendations + feed)
        const [r, f] = await Promise.all([
          apiGet<Recommendation[]>("/avees?limit=5", token).catch(() => []),
          apiGet<FeedResponse>("/feed?limit=10", token).catch((e) => {
            console.error("[Feed] Failed to fetch feed:", e);
            return null;
          }),
        ]);

        if (!alive) return;

        if (Array.isArray(r)) {
          setRecommendations(r);
          localStorage.setItem('app_recommendations', JSON.stringify(r));
        }
        if (f) {
          setFeedData(f);
          localStorage.setItem('app_feed', JSON.stringify(f));
        }
      } catch (e: any) {
        if (!alive) return;
        console.error("Failed to load data:", e);
      } finally {
        if (alive) {
          setLoading(false);
          setFeedLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const handleFollowAgent = async (aveeId: string) => {
    try {
      await followAgent(aveeId);
      // Remove from recommendations and add to following
      setRecommendations(prev => prev.filter(r => r.id !== aveeId));
      setFollowingIds(prev => new Set(prev).add(aveeId));
      
      // Refresh feed to include newly followed agent (with limit)
      const token = await getAccessToken();
      const f = await apiGet<FeedResponse>("/feed?limit=10", token);
      setFeedData(f);
      localStorage.setItem('app_feed', JSON.stringify(f));
    } catch (e: any) {
      console.error("Failed to follow agent:", e);
      alert("Failed to follow agent. Please try again.");
    }
  };

  const handleMarkAgentRead = async (agentId: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/feed/agent/${agentId}/mark-all-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Optimistically update UI
      setFeedData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: Math.max(0, prev.total_unread - (prev.items.find(i => i.agent_id === agentId)?.unread_count || 0)),
          items: prev.items.map(item => 
            item.agent_id === agentId 
              ? { ...item, unread_count: 0, latest_update: item.latest_update ? { ...item.latest_update, is_read: true } : null }
              : item
          )
        };
      });
      
      // Refresh feed in background to ensure accuracy
      const f = await apiGet<FeedResponse>("/feed?limit=10", token);
      setFeedData(f);
      localStorage.setItem('app_feed', JSON.stringify(f));
    } catch (e: any) {
      console.error("Failed to mark as read:", e);
      alert("Failed to mark updates as read. Please try again.");
    }
  };

  return (
    <NewLayoutWrapper>
      <div className="mx-auto flex max-w-7xl gap-6">
        {/* Left Sidebar */}
        {loading ? (
          <div className="w-80 shrink-0">
            <div className="rounded-2xl border border-[#E6E6E6] bg-white p-6">
              <div className="flex items-center gap-2 text-sm text-[#2E3A59]/70">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            </div>
          </div>
        ) : (
          <LeftSidebar profile={profile} avees={avees} recommendations={recommendations} onFollowAgent={handleFollowAgent} />
        )}

        {/* Main Feed */}
        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#0B0B0C]">Your Feed</h1>
              <p className="mt-1 text-sm text-[#2E3A59]/70">
                Latest updates from your followed Agents
                {feedData && feedData.total_unread > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#C8A24A]/10 px-2 py-0.5 text-xs font-semibold text-[#C8A24A]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C8A24A]"></span>
                    {feedData.total_unread} unread
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Update Composer */}
          <div className="mb-6">
            <QuickUpdateComposer agents={avees} />
          </div>

          {/* Feed Content */}
          {feedLoading ? (
            <div className="rounded-2xl border border-[#E6E6E6] bg-white p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-[#2E3A59]/70">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading feed...
              </div>
            </div>
          ) : feedData && feedData.items.length > 0 ? (
            <div className="space-y-6">
              {feedData.items.map((item) => (
                <AveeFeedCard key={item.agent_id} item={item} onMarkRead={handleMarkAgentRead} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E6E6E6] bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2E3A59]/10">
                <svg className="h-8 w-8 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#0B0B0C]">No updates yet</h3>
              <p className="mb-6 text-sm text-[#2E3A59]/70">
                Follow some agents or create your own to see updates here.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/network"
                  className="rounded-lg border border-[#2E3A59] px-4 py-2 text-sm font-medium text-[#2E3A59] transition-colors hover:bg-[#2E3A59] hover:text-white"
                >
                  Discover Agents
                </Link>
                <Link
                  href="/my-agents"
                  className="rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a2236]"
                >
                  Create Agent
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </NewLayoutWrapper>
  );
}
