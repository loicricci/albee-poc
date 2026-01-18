"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatButton } from "@/components/ChatButton";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { QuickUpdateComposer } from "@/components/QuickUpdateComposer";
import { ShareButton } from "@/components/ShareButton";
import Toast, { ToastType } from "@/components/Toast";
import { FeedPostCard } from "@/components/FeedPostCard";
import { FirstPostModal } from "@/components/FirstPostModal";
import { useAppData, getFirstPostStatus, setFirstPostStatus } from "@/contexts/AppDataContext";
import { followAgent as apiFollowAgent, markAgentRead as apiMarkAgentRead, toggleLikePost, repostPost as apiRepostPost } from "@/lib/apiClient";

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

// Unified Feed Types (Posts + Updates)
type FeedPostItem = {
  id: string;
  type: "post";
  agent_id?: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string;
  like_count: number;
  comment_count: number;
  user_has_liked: boolean;
  created_at: string;
};

type FeedUpdateItem = {
  id: string;
  type: "update";
  agent_id: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  title: string;
  content: string;
  topic: string | null;
  layer: string;
  is_pinned: boolean;
  is_read: boolean;
  created_at: string;
};

type FeedRepostItem = {
  id: string;
  type: "repost";
  post_id: string;
  agent_id?: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string;
  like_count: number;
  comment_count: number;
  user_has_liked: boolean;
  created_at: string;
  repost_comment?: string | null;
  reposted_by_handle: string;
  reposted_by_display_name: string | null;
  reposted_at: string;
};

type UnifiedFeedItem = FeedPostItem | FeedUpdateItem | FeedRepostItem;

type UnifiedFeedResponse = {
  items: UnifiedFeedItem[];
  total_items: number;
  has_more: boolean;
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
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-[#001f98]/20">
      {/* Update count badge */}
      <div className="absolute right-6 top-6 flex flex-col items-center gap-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A24A] text-lg font-bold text-white shadow-md">
          {item.unread_count > 0 ? item.unread_count : item.total_updates}
        </div>
        <div className="text-xs font-medium text-[#001f98]/70">updates</div>
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
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-[#f8fafc] to-gray-200 flex items-center justify-center shadow-sm">
          {item.agent_avatar_url ? (
            <img 
              src={item.agent_avatar_url} 
              alt={item.agent_display_name || item.agent_handle} 
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <svg className="h-8 w-8 text-[#001f98]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0 pr-20">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 truncate">
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
          <p className="text-sm text-[#001f98]/70">
            @{item.agent_handle}
            {!item.is_own_agent && item.owner_display_name && (
              <span> · by {item.owner_display_name}</span>
            )}
          </p>
          {item.latest_update && (
            <p className="mt-1 text-xs text-[#001f98]/50">
              Latest update: {formatDate(item.latest_update.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Latest update box */}
      {item.latest_update ? (
        <div className="mb-4 rounded-lg border border-[#001f98]/20 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-[#001f98]">{item.latest_update.title}</p>
            {!item.latest_update.is_read && (
              <span className="shrink-0 inline-block h-2 w-2 rounded-full bg-[#C8A24A]" title="Unread" />
            )}
          </div>
          <p className="text-sm text-gray-900 line-clamp-2">{item.latest_update.content}</p>
          {item.latest_update.topic && (
            <span className="mt-2 inline-block rounded-full bg-[#001f98]/10 px-2 py-1 text-xs text-[#001f98]">
              {item.latest_update.topic}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-gray-200 bg-[#f8fafc] px-4 py-3 text-center">
          <p className="text-sm text-[#001f98]/50">No updates yet</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <ChatButton
          handle={item.agent_handle}
          displayName={item.agent_display_name || item.agent_handle}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#001670] hover:shadow-lg hover:scale-[1.02]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Get updated
        </ChatButton>
        {item.unread_count > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="shrink-0 rounded-lg border border-[#001f98] px-4 py-3 text-sm font-medium text-[#001f98] transition-colors hover:bg-[#001f98] hover:text-white"
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

function FeedUpdateCard({ item, onMarkRead }: { item: FeedUpdateItem; onMarkRead: (agentId: string) => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleMarkRead = async () => {
    try {
      await onMarkRead(item.agent_id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-[#001f98]/20">
      {/* Header with agent info */}
      <div className="mb-4 flex items-start gap-4">
        {/* Avatar */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-[#f8fafc] to-gray-200 flex items-center justify-center shadow-sm">
          {item.agent_avatar_url ? (
            <img 
              src={item.agent_avatar_url} 
              alt={item.agent_display_name || item.agent_handle} 
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <svg className="h-8 w-8 text-[#001f98]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {item.agent_display_name || item.agent_handle}
            </h3>
          </div>
          <p className="text-sm text-[#001f98]/70">
            @{item.agent_handle}
            {item.owner_display_name && (
              <span> · by {item.owner_display_name}</span>
            )}
          </p>
          <p className="mt-1 text-xs text-[#001f98]/50">
            {formatDate(item.created_at)}
          </p>
        </div>

        {/* Unread indicator */}
        {!item.is_read && (
          <div className="shrink-0 flex flex-col items-center">
            <span className="inline-block h-3 w-3 rounded-full bg-[#C8A24A]" title="Unread" />
          </div>
        )}
      </div>

      {/* Update content box */}
      <div className="mb-4 rounded-lg border border-[#001f98]/20 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-base font-bold text-[#001f98]">{item.title}</p>
        </div>
        <p className="text-sm text-gray-900 line-clamp-4">{item.content}</p>
        {item.topic && (
          <span className="mt-3 inline-block rounded-full bg-[#001f98]/10 px-3 py-1 text-xs font-medium text-[#001f98]">
            {item.topic}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <ChatButton
          handle={item.agent_handle}
          displayName={item.agent_display_name || item.agent_handle}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#001670] hover:shadow-lg hover:scale-[1.02]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat about this
        </ChatButton>
        {!item.is_read && (
          <button
            onClick={handleMarkRead}
            className="shrink-0 rounded-lg border border-[#001f98] px-4 py-3 text-sm font-medium text-[#001f98] transition-colors hover:bg-[#001f98] hover:text-white"
            title="Mark as read"
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

function LeftSidebar({
  profile,
  avees,
  recommendations,
  onFollowAgent,
  isLoadingFeed,
  followingIds,
}: {
  profile: Profile | null;
  avees: Avee[];
  recommendations: Recommendation[];
  onFollowAgent: (aveeId: string) => void;
  isLoadingFeed: boolean;
  followingIds: Set<string>;
}) {
  // Filter out already-followed agents from recommendations (with safety check)
  const filteredRecommendations = (recommendations || []).filter(rec => !followingIds.has(rec.id));
  // Validate the avatar URL
  const hasValidAvatar = profile && isValidImageUrl(profile.avatar_url);
  
  return (
    <div className="w-80 shrink-0 space-y-6">
      {/* Profile Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#001f98] to-[#001670] p-4">
          <h2 className="text-sm font-semibold text-white">Your Profile</h2>
        </div>
        <div className="p-4">
          {profile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full border-2 border-[#001f98]/20 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center text-white font-semibold overflow-hidden">
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
                  <div className="font-semibold text-gray-900 truncate">
                    {profile.display_name || profile.handle}
                  </div>
                  <div className="text-sm text-gray-900 truncate">
                    @{profile.handle}
                  </div>
                </div>
              </div>
              {profile.bio && (
                <p className="text-sm text-gray-900 line-clamp-2">{profile.bio}</p>
              )}
              <div className="space-y-2">
                <Link
                  href={`/u/${profile.handle}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
                >
                  View profile
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <ChatButton
                  handle={profile.handle}
                  displayName={profile.display_name || profile.handle}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#001f98] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001670]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat
                </ChatButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#001f98]/70">No profile found.</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-[#f8fafc] p-4">
          <h2 className="font-semibold text-gray-900">Recommended</h2>
          <p className="mt-1 text-xs text-gray-900">Discover new Agents</p>
        </div>
        <div className="divide-y divide-gray-200 p-4 space-y-4">
          {isLoadingFeed ? (
            // Skeleton loader for recommendations
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="pt-4 first:pt-0 animate-pulse">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-3" />
                  <div className="h-8 bg-gray-200 rounded w-full" />
                </div>
              ))}
            </>
          ) : filteredRecommendations.length > 0 ? (
            filteredRecommendations.map((rec) => {
              const hasValidRecAvatar = isValidImageUrl(rec.avatar_url);
              return (
                <div key={rec.id} className="pt-4 first:pt-0">
                  <div className="flex items-start gap-3 mb-2">
                    {/* Avatar */}
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center">
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
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {rec.display_name || rec.handle}
                      </div>
                      <div className="text-xs text-gray-900 truncate">@{rec.handle}</div>
                    </div>
                  </div>
                  {rec.bio && (
                    <p className="text-xs text-gray-900 mb-3 line-clamp-2">
                      {rec.bio}
                    </p>
                  )}
                  <button 
                    onClick={() => onFollowAgent(rec.id)}
                    className="w-full rounded-lg border border-[#001f98] px-3 py-2 text-xs font-medium text-[#001f98] transition-colors hover:bg-[#001f98] hover:text-white"
                  >
                    Follow
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[#001f98]/70">No recommendations available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 animate-pulse">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-16 w-16 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppHomePage() {
  // Get shared app data from context (no redundant API calls!)
  const { 
    profile, 
    avees, 
    recommendations, 
    feed: feedData, 
    unifiedFeed: unifiedFeedData,
    isLoading: loading,
    isLoadingFeed,
    refreshFeed 
  } = useAppData();
  
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showFirstPostModal, setShowFirstPostModal] = useState(false);
  const router = useRouter();

  // Check if we should show the first post modal for new users
  useEffect(() => {
    // Only check once loading is complete and we have profile data
    if (loading || !profile?.user_id) return;
    
    // Check if user has already completed or skipped first post
    const firstPostStatus = getFirstPostStatus(profile.user_id);
    if (firstPostStatus) {
      // Already completed or skipped
      return;
    }
    
    // Check if user has at least one agent (created during onboarding)
    if (avees.length === 0) {
      // No agents yet - wait for them to be loaded
      return;
    }
    
    // Check if user has any posts in their feed (indicating they've already posted)
    // If unified feed has items that are posts from the user's agents, don't show modal
    const userHasPosts = unifiedFeedData?.items.some(item => {
      if (item.type === 'post' || item.type === 'repost') {
        // Check if this post belongs to one of the user's agents
        return avees.some(agent => agent.id === item.agent_id);
      }
      return false;
    });
    
    if (userHasPosts) {
      // User already has posts, mark as completed
      setFirstPostStatus(profile.user_id, 'completed');
      return;
    }
    
    // Show the first post modal for new users!
    setShowFirstPostModal(true);
  }, [loading, profile?.user_id, avees, unifiedFeedData]);

  const handleFollowAgent = async (aveeId: string) => {
    // OPTIMISTIC UPDATE: Show immediate feedback to user
    setFollowingIds(prev => new Set(prev).add(aveeId));
    setToast({ message: "Agent followed successfully!", type: "success" });
    
    // BACKGROUND: Fire API and refresh without blocking UI
    try {
      await apiFollowAgent(aveeId);
      
      // Refresh feeds in background to load new recommendations
      refreshFeed();
    } catch (e: any) {
      // ROLLBACK: Revert optimistic update on failure
      console.error("Failed to follow agent:", e);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(aveeId);
        return next;
      });
      setToast({ message: "Failed to follow agent. Please try again.", type: "error" });
    }
  };

  const handleMarkAgentRead = async (agentId: string) => {
    try {
      await apiMarkAgentRead(agentId);
      
      // Refresh feed (cache will be invalidated and reloaded)
      await refreshFeed();
    } catch (e: any) {
      console.error("Failed to mark as read:", e);
      setToast({ message: "Failed to mark updates as read. Please try again.", type: "error" });
    }
  };

  const handleLikePost = async (postId: string, liked: boolean) => {
    try {
      // Call API - liked is the NEW state (true = liking, false = unliking)
      // toggleLikePost expects the PREVIOUS state, so we invert
      await toggleLikePost(postId, !liked);
      
      // Refresh feed to show updated counts
      await refreshFeed();
    } catch (e: any) {
      console.error("Failed to like/unlike post:", e);
      // Silently fail - like actions shouldn't be intrusive
    }
  };

  const handleCommentPost = async (postId: string) => {
    console.log("Comment on post:", postId);
    // For now, just log - full implementation with CommentSection component can be added later
  };

  const handleRepostPost = async (postId: string, comment: string) => {
    try {
      await apiRepostPost(postId, comment);
      
      setToast({ message: "Post reposted successfully!", type: "success" });
      
      // Refresh feed to show new repost
      await refreshFeed();
    } catch (e: any) {
      console.error("[Repost] Failed:", e);
      const errorMsg = e.message || "Please try again.";
      setToast({ message: `Failed to repost: ${errorMsg}`, type: "error" });
    }
  };

  // Handle first post modal actions
  const handleFirstPostSkip = () => {
    if (profile?.user_id) {
      setFirstPostStatus(profile.user_id, 'skipped');
    }
    setShowFirstPostModal(false);
  };

  const handleFirstPostSuccess = () => {
    if (profile?.user_id) {
      setFirstPostStatus(profile.user_id, 'completed');
    }
    setShowFirstPostModal(false);
    setToast({ message: "Congratulations! Your first post is live!", type: "success" });
    // Refresh feed to show the new post
    refreshFeed();
  };

  // Get the primary agent for the first post modal (first agent in the list)
  const primaryAgent = avees.length > 0 ? avees[0] : null;

  return (
    <NewLayoutWrapper>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* First Post Modal for new users */}
      {showFirstPostModal && primaryAgent && (
        <FirstPostModal
          isOpen={showFirstPostModal}
          onClose={() => setShowFirstPostModal(false)}
          onSkip={handleFirstPostSkip}
          agent={{
            id: primaryAgent.id,
            handle: primaryAgent.handle,
            display_name: primaryAgent.display_name,
            avatar_url: primaryAgent.avatar_url,
          }}
          onSuccess={handleFirstPostSuccess}
        />
      )}
      
      <div className="mx-auto flex max-w-7xl gap-6">
        {/* Left Sidebar - Hidden on smaller screens (< 1024px) */}
        {loading ? (
          <div className="hidden lg:block w-80 shrink-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 text-sm text-[#001f98]/70">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <LeftSidebar profile={profile} avees={avees} recommendations={recommendations} onFollowAgent={handleFollowAgent} isLoadingFeed={isLoadingFeed} followingIds={followingIds} />
          </div>
        )}

        {/* Main Feed */}
        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
              <p className="mt-1 text-sm text-[#001f98]/70">
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
            <QuickUpdateComposer agents={avees} onUpdatePosted={async () => {
              // Refresh feeds after posting update
              await refreshFeed();
            }} />
          </div>

          {/* Feed Content */}
          {/* Show skeleton if: general loading OR feed is still loading */}
          {loading || isLoadingFeed ? (
            <FeedLoadingSkeleton />
          ) : unifiedFeedData && unifiedFeedData.items.length > 0 ? (
            <div className="space-y-6">
              {unifiedFeedData.items.map((item) => {
                if (item.type === "post" || item.type === "repost") {
                  return <FeedPostCard 
                    key={item.id} 
                    item={item} 
                    onLike={handleLikePost} 
                    onComment={handleCommentPost} 
                    onRepost={handleRepostPost}
                    currentUserId={profile?.user_id}
                    currentUserHandle={profile?.handle}
                    currentUserAvatar={profile?.avatar_url}
                  />;
                } else {
                  return <FeedUpdateCard key={item.id} item={item as FeedUpdateItem} onMarkRead={handleMarkAgentRead} />;
                }
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#001f98]/10">
                <svg className="h-8 w-8 text-[#001f98]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">No updates yet</h3>
              <p className="mb-6 text-sm text-[#001f98]/70">
                Follow some agents or create your own to see updates and posts here.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/network"
                  className="rounded-lg border border-[#001f98] px-4 py-2 text-sm font-medium text-[#001f98] transition-colors hover:bg-[#001f98] hover:text-white"
                >
                  Discover Agents
                </Link>
                <Link
                  href="/my-agents"
                  className="rounded-lg bg-[#001f98] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#001670]"
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
