"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type UnifiedFeedItem = FeedPostItem | FeedUpdateItem;

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
      {/* Update count badge */}
      <div className="absolute right-6 top-6 flex flex-col items-center gap-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A24A] text-lg font-bold text-white shadow-md">
          {item.unread_count > 0 ? item.unread_count : item.total_updates}
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

function FeedPostCard({ item, onLike }: { item: FeedPostItem; onLike: (postId: string) => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleLike = async () => {
    try {
      await onLike(item.id);
    } catch (error) {
      console.error("Failed to like post:", error);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm transition-all hover:shadow-lg hover:border-[#2E3A59]/20">
      {/* Header with agent/user info */}
      <div className="p-4 border-b border-[#E6E6E6]">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#E6E6E6] bg-gradient-to-br from-[#FAFAFA] to-[#E6E6E6] flex items-center justify-center shadow-sm">
            {item.agent_avatar_url ? (
              <img 
                src={item.agent_avatar_url} 
                alt={item.agent_display_name || item.agent_handle} 
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <svg className="h-6 w-6 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>

          {/* Agent/User info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#0B0B0C] truncate">
              {item.agent_display_name || item.agent_handle}
            </h3>
            <p className="text-xs text-[#2E3A59]/70 truncate">
              @{item.agent_handle}
              {item.owner_display_name && item.agent_id && (
                <span> · by {item.owner_display_name}</span>
              )}
            </p>
          </div>

          {/* Post type badge */}
          <div className="shrink-0 rounded-lg bg-[#2E3A59]/10 px-2 py-1 text-xs font-semibold text-[#2E3A59]">
            {item.post_type === "ai_generated" ? "AI" : "Post"}
          </div>
        </div>

        {/* Title if exists */}
        {item.title && (
          <h4 className="mt-3 text-base font-semibold text-[#0B0B0C]">
            {item.title}
          </h4>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full bg-[#FAFAFA]" style={{ paddingBottom: '75%' }}>
        <img 
          src={item.image_url} 
          alt={item.title || "Post image"} 
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23E6E6E6" width="400" height="300"/%3E%3Ctext fill="%232E3A59" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
          }}
        />
      </div>

      {/* Description if exists */}
      {item.description && (
        <div className="p-4 border-b border-[#E6E6E6]">
          <p className="text-sm text-[#0B0B0C] line-clamp-3">{item.description}</p>
        </div>
      )}

      {/* Interaction buttons */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Like button */}
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-sm transition-colors hover:text-[#C8A24A]"
            style={{ color: item.user_has_liked ? '#C8A24A' : '#2E3A59' }}
          >
            <svg className="h-5 w-5" fill={item.user_has_liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="font-medium">{item.like_count}</span>
          </button>

          {/* Comment button */}
          <button
            className="flex items-center gap-1.5 text-sm text-[#2E3A59] transition-colors hover:text-[#C8A24A]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="font-medium">{item.comment_count}</span>
          </button>
        </div>

        {/* Date */}
        <span className="text-xs text-[#2E3A59]/50">
          {formatDate(item.created_at)}
        </span>
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
    <div className="group relative overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-[#2E3A59]/20">
      {/* Header with agent info */}
      <div className="mb-4 flex items-start gap-4">
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[#0B0B0C] truncate">
              {item.agent_display_name || item.agent_handle}
            </h3>
          </div>
          <p className="text-sm text-[#2E3A59]/70">
            @{item.agent_handle}
            {item.owner_display_name && (
              <span> · by {item.owner_display_name}</span>
            )}
          </p>
          <p className="mt-1 text-xs text-[#2E3A59]/50">
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
      <div className="mb-4 rounded-lg border border-[#2E3A59]/20 bg-gradient-to-r from-[#2E3A59]/5 to-[#FAFAFA] px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-base font-bold text-[#2E3A59]">{item.title}</p>
        </div>
        <p className="text-sm text-[#0B0B0C] line-clamp-4">{item.content}</p>
        {item.topic && (
          <span className="mt-3 inline-block rounded-full bg-[#2E3A59]/10 px-3 py-1 text-xs font-medium text-[#2E3A59]">
            {item.topic}
          </span>
        )}
      </div>

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
          Chat about this
        </ChatButton>
        {!item.is_read && (
          <button
            onClick={handleMarkRead}
            className="shrink-0 rounded-lg border border-[#2E3A59] px-4 py-3 text-sm font-medium text-[#2E3A59] transition-colors hover:bg-[#2E3A59] hover:text-white"
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
              <div className="space-y-2">
                <Link
                  href={`/u/${profile.handle}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
                >
                  View profile
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <ChatButton
                  handle={profile.handle}
                  displayName={profile.display_name || profile.handle}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a2236]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat
                </ChatButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#2E3A59]/70">No profile found.</p>
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
  const [unifiedFeedData, setUnifiedFeedData] = useState<UnifiedFeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    (async () => {
      // First, check onboarding status
      try {
        const token = await getAccessToken();
        const statusRes = await fetch(`${apiBase()}/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (!statusData.completed) {
            // Redirect to onboarding if not completed
            router.push("/onboarding");
            return;
          }
        }
      } catch (e) {
        console.error("Failed to check onboarding status:", e);
        // Continue to load app - might be an API issue
      }

      // Load from cache immediately for instant UI
      try {
        const cachedProfile = localStorage.getItem('app_profile');
        const cachedAvees = localStorage.getItem('app_avees');
        const cachedRecs = localStorage.getItem('app_recommendations');
        const cachedFeed = localStorage.getItem('app_feed');
        const cachedUnifiedFeed = localStorage.getItem('app_unified_feed');
        
        if (cachedProfile) setProfile(JSON.parse(cachedProfile));
        if (cachedAvees) setAvees(JSON.parse(cachedAvees));
        if (cachedRecs) setRecommendations(JSON.parse(cachedRecs));
        if (cachedFeed) setFeedData(JSON.parse(cachedFeed));
        if (cachedUnifiedFeed) setUnifiedFeedData(JSON.parse(cachedUnifiedFeed));
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
        const [r, f, uf] = await Promise.all([
          apiGet<Recommendation[]>("/avees?limit=5", token).catch(() => []),
          apiGet<FeedResponse>("/feed?limit=10", token).catch((e) => {
            console.error("[Feed] Failed to fetch feed:", e);
            return null;
          }),
          apiGet<UnifiedFeedResponse>("/feed/unified?limit=20", token).catch((e) => {
            console.error("[UnifiedFeed] Failed to fetch unified feed:", e);
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
        if (uf) {
          setUnifiedFeedData(uf);
          localStorage.setItem('app_unified_feed', JSON.stringify(uf));
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
      
      // Refresh feeds to include newly followed agent
      const token = await getAccessToken();
      const [f, uf] = await Promise.all([
        apiGet<FeedResponse>("/feed?limit=10", token),
        apiGet<UnifiedFeedResponse>("/feed/unified?limit=20", token),
      ]);
      setFeedData(f);
      setUnifiedFeedData(uf);
      localStorage.setItem('app_feed', JSON.stringify(f));
      localStorage.setItem('app_unified_feed', JSON.stringify(uf));
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
      
      // Optimistically update UI for old feed
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

      // Optimistically update unified feed
      setUnifiedFeedData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => {
            if (item.type === "update" && item.agent_id === agentId) {
              return { ...item, is_read: true } as FeedUpdateItem;
            }
            return item;
          })
        };
      });
      
      // Refresh feeds in background
      const uf = await apiGet<UnifiedFeedResponse>("/feed/unified?limit=20", token);
      setUnifiedFeedData(uf);
      localStorage.setItem('app_unified_feed', JSON.stringify(uf));
    } catch (e: any) {
      console.error("Failed to mark as read:", e);
      alert("Failed to mark updates as read. Please try again.");
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const token = await getAccessToken();
      
      // Check current like status
      const currentPost = unifiedFeedData?.items.find(
        item => item.type === "post" && item.id === postId
      ) as FeedPostItem | undefined;
      
      if (!currentPost) return;
      
      const wasLiked = currentPost.user_has_liked;
      const method = wasLiked ? "DELETE" : "POST";
      
      const res = await fetch(`${apiBase()}/posts/${postId}/like`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Optimistically update UI
      setUnifiedFeedData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => {
            if (item.type === "post" && item.id === postId) {
              return {
                ...item,
                user_has_liked: !wasLiked,
                like_count: wasLiked ? item.like_count - 1 : item.like_count + 1
              } as FeedPostItem;
            }
            return item;
          })
        };
      });
    } catch (e: any) {
      console.error("Failed to like/unlike post:", e);
      // Silently fail - like actions shouldn't be intrusive
    }
  };

  return (
    <NewLayoutWrapper>
      <div className="mx-auto flex max-w-7xl gap-6">
        {/* Left Sidebar - Hidden on smaller screens (< 1024px) */}
        {loading ? (
          <div className="hidden lg:block w-80 shrink-0">
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
          <div className="hidden lg:block">
            <LeftSidebar profile={profile} avees={avees} recommendations={recommendations} onFollowAgent={handleFollowAgent} />
          </div>
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
            <QuickUpdateComposer agents={avees} onUpdatePosted={async () => {
              // Refresh feeds after posting update
              try {
                const token = await getAccessToken();
                const [f, uf] = await Promise.all([
                  apiGet<FeedResponse>("/feed?limit=10", token),
                  apiGet<UnifiedFeedResponse>("/feed/unified?limit=20", token),
                ]);
                setFeedData(f);
                setUnifiedFeedData(uf);
                localStorage.setItem('app_feed', JSON.stringify(f));
                localStorage.setItem('app_unified_feed', JSON.stringify(uf));
              } catch (e) {
                console.error("Failed to refresh feeds:", e);
              }
            }} />
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
          ) : unifiedFeedData && unifiedFeedData.items.length > 0 ? (
            <div className="space-y-6">
              {unifiedFeedData.items.map((item) => {
                if (item.type === "post") {
                  return <FeedPostCard key={item.id} item={item as FeedPostItem} onLike={handleLikePost} />;
                } else {
                  return <FeedUpdateCard key={item.id} item={item as FeedUpdateItem} onMarkRead={handleMarkAgentRead} />;
                }
              })}
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
                Follow some agents or create your own to see updates and posts here.
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
