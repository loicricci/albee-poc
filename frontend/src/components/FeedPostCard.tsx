"use client";

import { useState } from "react";
import Link from "next/link";
import { UnifiedFeedItem } from "@/lib/api";
import { CommentSection } from "@/components/CommentSection";
import { ShareButton } from "@/components/ShareButton";

type FeedPostCardProps = {
  item: UnifiedFeedItem;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onComment: (postId: string) => void;
  onRepost: (postId: string, content: string) => void;
  currentUserId?: string;
  currentUserHandle?: string;
  currentUserAvatar?: string | null;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined 
  });
}

export function FeedPostCard({ item, onLike, onComment, onRepost, currentUserId, currentUserHandle, currentUserAvatar }: FeedPostCardProps) {
  const [liked, setLiked] = useState(item.user_has_liked || false);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [isLiking, setIsLiking] = useState(false);

  // Get the actual post ID - for reposts, use post_id (original post), otherwise use id
  const actualPostId = item.type === "repost" && item.post_id ? item.post_id : item.id;

  const handleLike = async () => {
    // Prevent multiple clicks while processing
    if (isLiking) return;
    
    setIsLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;
    
    try {
      // Optimistic update
      const newLiked = !liked;
      setLiked(newLiked);
      setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
      
      // Call API
      await onLike(actualPostId, newLiked);
    } catch (error) {
      // Revert on error
      console.error("Failed to like/unlike:", error);
      setLiked(previousLiked);
      setLikeCount(previousCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = () => {
    setShowComments(!showComments);
    onComment(actualPostId);
  };

  const handleRepost = () => {
    if (repostComment.trim()) {
      onRepost(actualPostId, repostComment);
      setShowRepostModal(false);
      setRepostComment("");
    } else {
      onRepost(actualPostId, "");
      setShowRepostModal(false);
    }
  };

  const displayName = item.agent_display_name || item.agent_handle;

  // This component should ONLY render posts and reposts
  // Updates are handled by FeedUpdateCard component
  // Render as a post
  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-lg hover:border-[#001f98]/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <Link 
            href={`/u/${item.agent_handle}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
              {item.agent_avatar_url ? (
                <img src={item.agent_avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white">
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
              <div className="text-xs text-gray-600">@{item.agent_handle} • {formatDate(item.created_at)}</div>
            </div>
          </Link>
        </div>

        {/* Title */}
        {item.title && (
          <div className="px-4 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
          </div>
        )}

        {/* Image */}
        {item.image_url && (
          <div className="relative bg-black">
            <img 
              src={item.image_url} 
              alt={item.title || "Post image"} 
              className="w-full object-contain max-h-[600px]"
            />
            
            {/* AI Generated Badge */}
            {item.post_type === "ai_generated" && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Generated
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-gray-600 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center border-t border-gray-200 px-4 py-2 gap-1">
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[#e6eaff] ${
              liked ? "text-[#C8A24A]" : "text-gray-600"
            } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <svg 
              className={`h-5 w-5 ${isLiking ? "animate-pulse" : ""}`}
              fill={liked ? "currentColor" : "none"} 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{likeCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={handleComment}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{item.comment_count || 0}</span>
          </button>

          {/* Repost */}
          <button
            onClick={() => setShowRepostModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Repost</span>
          </button>

          {/* Share to External Platforms */}
          <ShareButton
            url={typeof window !== "undefined" ? `${window.location.origin}/p/${actualPostId}` : `/p/${actualPostId}`}
            title={item.title || `Post by @${item.agent_handle}`}
            description={item.description || undefined}
            variant="button"
          />
        </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection
          postId={actualPostId}
          initialCommentCount={item.comment_count || 0}
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
            <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-[#f8fafc]">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                  {item.agent_avatar_url ? (
                    <img src={item.agent_avatar_url} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{displayName[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-600">@{item.agent_handle}</div>
                </div>
              </div>
              {item.title && <p className="text-sm font-medium text-gray-900 mb-1">{item.title}</p>}
              {item.description && <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>}
            </div>

            {/* Comment Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Add your comment (optional)
              </label>
              <textarea
                value={repostComment}
                onChange={(e) => setRepostComment(e.target.value)}
                placeholder={`Reposting from @${item.agent_handle}...`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 focus:border-[#001f98] resize-none transition-all"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowRepostModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-gray-700 font-medium hover:border-[#001f98] hover:text-[#001f98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRepost}
                className="flex-1 px-4 py-2 bg-[#001f98] text-white rounded-full font-medium shadow-lg shadow-[#001f98]/25 hover:bg-[#001670] hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300"
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

