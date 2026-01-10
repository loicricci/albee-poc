"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatButton } from "@/components/ChatButton";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { QuickUpdateComposer } from "@/components/QuickUpdateComposer";
import { CommentSection } from "@/components/CommentSection";
import Toast, { ToastType } from "@/components/Toast";
import { useAppData } from "@/contexts/AppDataContext";
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

function FeedPostCard({ item, onLike, onComment, onRepost, currentUserId, currentUserHandle, currentUserAvatar }: { 
  item: FeedPostItem; 
  onLike: (postId: string) => Promise<void>;
  onComment: (postId: string) => void;
  onRepost: (postId: string, comment: string) => void;
  currentUserId?: string;
  currentUserHandle?: string;
  currentUserAvatar?: string | null;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState(item.user_has_liked);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(item.like_count);

  // Check if this is a repost
  const isRepost = (item as any).type === "repost";
  
  // For reposts, we need to use post_id for actions (like/comment) not the repost id
  const postId = isRepost ? (item as any).post_id : item.id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleLike = async () => {
    if (isLiking) return; // Prevent multiple clicks
    
    setIsLiking(true);
    const previousLiked = optimisticLiked;
    const previousCount = optimisticLikeCount;
    
    try {
      // Optimistic update
      const newLiked = !optimisticLiked;
      setOptimisticLiked(newLiked);
      setOptimisticLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
      
      // Call API
      await onLike(postId);
    } catch (error) {
      // Revert on error
      console.error("Failed to like post:", error);
      setOptimisticLiked(previousLiked);
      setOptimisticLikeCount(previousCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = () => {
    setShowComments(!showComments);
    onComment(postId);
  };

  const handleRepost = () => {
    if (repostComment.trim()) {
      onRepost(postId, repostComment);
      setShowRepostModal(false);
      setRepostComment("");
    } else {
      onRepost(postId, "");
      setShowRepostModal(false);
    }
  };

  return (
    <>
    <div className="group relative overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm transition-all hover:shadow-lg hover:border-[#2E3A59]/20">
      {/* Repost Header - Show if this is a repost */}
      {isRepost && (
        <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-sm text-[#2E3A59]/80 border-b border-[#E6E6E6]/50 bg-[#FAFAFA]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>
            <span className="font-semibold">{(item as any).reposted_by_display_name || `@${(item as any).reposted_by_handle}`}</span>
            {' '}reposted
          </span>
        </div>
      )}

      {/* Repost Comment - Show if repost has a comment */}
      {isRepost && (item as any).repost_comment && (
        <div className="px-4 py-3 text-sm text-[#0B0B0C] italic border-l-4 border-[#2E3A59]/30 ml-4 mr-4 mt-3 pl-3 bg-[#2E3A59]/5 rounded-r-lg">
          "{(item as any).repost_comment}"
        </div>
      )}

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
            {isRepost && (
              <p className="text-xs text-[#2E3A59]/60 mt-0.5">
                Originally posted by @{(item as any).owner_handle}
              </p>
            )}
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
      <div className="p-4 flex items-center justify-between border-b border-[#E6E6E6]">
        <div className="flex items-center gap-4">
          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-1.5 text-sm transition-colors hover:text-[#C8A24A] ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ color: optimisticLiked ? '#C8A24A' : '#2E3A59' }}
          >
            <svg 
              className={`h-5 w-5 ${isLiking ? "animate-pulse" : ""}`}
              fill={optimisticLiked ? "currentColor" : "none"} 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="font-medium">{optimisticLikeCount}</span>
          </button>

          {/* Comment button */}
          <button
            onClick={handleComment}
            className="flex items-center gap-1.5 text-sm text-[#2E3A59] transition-colors hover:text-[#C8A24A]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="font-medium">{item.comment_count}</span>
          </button>

          {/* Repost button */}
          <button
            onClick={() => setShowRepostModal(true)}
            className="flex items-center gap-1.5 text-sm text-[#2E3A59] transition-colors hover:text-[#C8A24A]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-medium">Repost</span>
          </button>
        </div>

        {/* Date */}
        <span className="text-xs text-[#2E3A59]/50">
          {formatDate(item.created_at)}
        </span>
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection
          postId={item.id}
          initialCommentCount={item.comment_count}
          currentUserId={currentUserId}
          currentUserHandle={currentUserHandle}
          currentUserAvatar={currentUserAvatar}
        />
      )}
    </div>

    {/* Repost Modal */}
    {showRepostModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRepostModal(false)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Repost with Mention</h3>
            <button
              onClick={() => setShowRepostModal(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Original Post Preview */}
          <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full overflow-hidden bg-[#2E3A59] flex items-center justify-center">
                {item.agent_avatar_url ? (
                  <img src={item.agent_avatar_url} alt={item.agent_display_name || item.agent_handle} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">{(item.agent_display_name || item.agent_handle)[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{item.agent_display_name || item.agent_handle}</div>
                <div className="text-xs text-gray-500">@{item.agent_handle}</div>
              </div>
            </div>
            {item.title && <p className="text-sm font-medium text-gray-800 mb-1">{item.title}</p>}
            {item.description && <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>}
          </div>

          {/* Comment Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add your comment (optional)
            </label>
            <textarea
              value={repostComment}
              onChange={(e) => setRepostComment(e.target.value)}
              placeholder={`Reposting from @${item.agent_handle}...`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3A59] focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowRepostModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRepost}
              className="flex-1 px-4 py-2 bg-[#2E3A59] text-white rounded-lg font-medium hover:bg-[#1a2236] transition-colors"
            >
              Repost
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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

function FeedLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-[#E6E6E6] bg-white p-6 animate-pulse">
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
  const router = useRouter();

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

  const handleLikePost = async (postId: string) => {
    if (!unifiedFeedData) return;
    
    try {
      // Check current like status
      const currentItem = unifiedFeedData.items.find(item => {
        if (item.type === "post") return item.id === postId;
        if (item.type === "repost") return item.post_id === postId;
        return false;
      });
      
      if (!currentItem || currentItem.type === "update") return;
      
      const wasLiked = currentItem.user_has_liked;
      
      // Call API (cache will be invalidated)
      await toggleLikePost(postId, wasLiked);
      
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

  return (
    <NewLayoutWrapper>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
            <LeftSidebar profile={profile} avees={avees} recommendations={recommendations} onFollowAgent={handleFollowAgent} isLoadingFeed={isLoadingFeed} followingIds={followingIds} />
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
                if (item.type === "post") {
                  return <FeedPostCard 
                    key={item.id} 
                    item={item as FeedPostItem} 
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
