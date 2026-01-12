"use client";

import { useState } from "react";
import Link from "next/link";

type PostData = {
  id: string;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string;
  ai_metadata: Record<string, any>;
  visibility: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  user_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  user_handle: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  content: string;
  parent_comment_id: string | null;
  like_count: number;
  reply_count: number;
  user_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

type ImagePostProps = {
  post: PostData;
  onLike?: (postId: string, liked: boolean) => Promise<void> | void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  isOwnPost?: boolean;
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

export function ImagePost({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  isOwnPost = false,
}: ImagePostProps) {
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.user_has_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return; // Prevent multiple clicks
    
    setIsLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;
    
    try {
      // Optimistic update
      const newLiked = !liked;
      setLiked(newLiked);
      setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
      
      // Call API if handler provided
      await onLike?.(post.id, newLiked);
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
    onComment?.(post.id);
  };

  const handleShare = () => {
    setShowShareMenu(!showShareMenu);
  };

  const displayName = post.owner_display_name || post.owner_handle;
  const isAIGenerated = post.post_type === "ai_generated";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link 
          href={`/u/${post.owner_handle}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center">
            {post.owner_avatar_url ? (
              <img src={post.owner_avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
            <div className="text-xs text-[#001f98]/70">@{post.owner_handle} • {formatDate(post.created_at)}</div>
          </div>
        </Link>

        {isOwnPost && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="p-2 text-[#001f98]/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete post"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <div className="px-4 pb-2">
          <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
        </div>
      )}

      {/* Image */}
      <div className="relative bg-black">
        <img src={post.image_url} 
          alt={post.title || "Post image"} 
          className="w-full object-contain max-h-[600px]"
        />
        
        {/* AI Generated Badge */}
        {isAIGenerated && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Generated
          </div>
        )}
      </div>

      {/* Description */}
      {post.description && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-[#001f98] whitespace-pre-wrap">{post.description}</p>
        </div>
      )}

      {/* AI Metadata (if available) */}
      {isAIGenerated && post.ai_metadata && Object.keys(post.ai_metadata).length > 0 && (
        <div className="px-4 pb-3">
          <details className="text-xs text-[#001f98]/70">
            <summary className="cursor-pointer hover:text-[#001f98] flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AI Details
            </summary>
            <div className="mt-2 ml-4 space-y-1">
              {post.ai_metadata.model && <div>Model: {post.ai_metadata.model}</div>}
              {post.ai_metadata.style && <div>Style: {post.ai_metadata.style}</div>}
              {post.ai_metadata.quality && <div>Quality: {post.ai_metadata.quality}</div>}
            </div>
          </details>
        </div>
      )}

      {/* Interaction Buttons */}
      <div className="flex items-center border-t border-gray-200 px-4 py-2 gap-1">
        {/* Like */}
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[#001f98]/5 ${
            liked ? "text-red-600" : "text-[#001f98]"
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#001f98] transition-all hover:bg-[#001f98]/5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>{post.comment_count}</span>
        </button>

        {/* Share */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#001f98] transition-all hover:bg-[#001f98]/5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>{post.share_count}</span>
          </button>

          {/* Share Menu */}
          {showShareMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-10">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + `/posts/${post.id}`);
                  setShowShareMenu(false);
                  alert("Link copied!");
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#001f98] hover:bg-[#001f98]/5 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy link
              </button>
              <button
                onClick={() => {
                  onShare?.(post.id);
                  setShowShareMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#001f98] hover:bg-[#001f98]/5 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Repost
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-200 bg-[#FAFAFA] p-4">
          <div className="text-sm text-[#001f98]/70 mb-4">
            Comments feature coming soon!
          </div>
          {/* TODO: Add comment list and input */}
        </div>
      )}
    </div>
  );
}






