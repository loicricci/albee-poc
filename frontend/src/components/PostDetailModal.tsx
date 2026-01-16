"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { UnifiedFeedItem } from "@/lib/api";
import { ShareButton } from "@/components/ShareButton";
import { DownloadButton } from "@/components/DownloadButton";

type PostDetailModalProps = {
  item: UnifiedFeedItem;
  isOpen: boolean;
  onClose: () => void;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onComment: (postId: string) => void;
  onRepost: (postId: string) => void;
  liked: boolean;
  likeCount: number;
  isLiking: boolean;
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

export function PostDetailModal({
  item,
  isOpen,
  onClose,
  onLike,
  onComment,
  onRepost,
  liked,
  likeCount,
  isLiking,
}: PostDetailModalProps) {
  const displayName = item.agent_display_name || item.agent_handle;
  const actualPostId = item.type === "repost" && item.post_id ? item.post_id : item.id;

  // Handle escape key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  // Lock body scroll and add escape listener when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiking) {
      await onLike(actualPostId, !liked);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComment(actualPostId);
    onClose(); // Close modal to show comments section in feed
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRepost(actualPostId);
    onClose(); // Close modal to show repost modal in feed
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Repost Header */}
          {item.type === "repost" && (
            <div className="px-6 pt-4 pb-2 flex items-center gap-2 text-sm text-[#001f98]/80 border-b border-gray-200/50 bg-[#f8fafc]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>
                <span className="font-semibold">{item.reposted_by_display_name || `@${item.reposted_by_handle}`}</span>
                {' '}reposted
              </span>
            </div>
          )}

          {/* Repost Comment */}
          {item.type === "repost" && item.repost_comment && (
            <div className="px-6 py-3 text-sm text-gray-900 italic border-l-4 border-[#001f98]/30 mx-6 mt-3 pl-3 bg-[#001f98]/5 rounded-r-lg">
              "{item.repost_comment}"
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Link 
              href={`/u/${item.agent_handle}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                {item.agent_avatar_url ? (
                  <img src={item.agent_avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {displayName[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{displayName}</div>
                <div className="text-sm text-gray-600">@{item.agent_handle} • {formatDate(item.created_at)}</div>
              </div>
            </Link>

            {/* AI Generated Badge */}
            {item.post_type === "ai_generated" && (
              <div className="flex items-center gap-2 bg-[#001f98]/10 text-[#001f98] px-3 py-1.5 rounded-full text-xs font-medium">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Generated
              </div>
            )}
          </div>

          {/* Title */}
          {item.title && (
            <div className="px-6 pt-4">
              <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
            </div>
          )}

          {/* Image */}
          {item.image_url && (
            <div className="relative bg-black mt-4">
              <img 
                src={item.image_url} 
                alt={item.title || "Post image"} 
                className="w-full object-contain max-h-[60vh]"
              />
            </div>
          )}

          {/* Full Description */}
          {item.description && (
            <div className="px-6 py-4">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
          )}
        </div>

        {/* Interaction Buttons - Fixed at bottom */}
        <div className="flex items-center border-t border-gray-200 px-6 py-3 gap-2 bg-white">
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
            onClick={handleRepost}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Repost</span>
          </button>

          {/* Share */}
          <ShareButton
            url={typeof window !== "undefined" ? `${window.location.origin}/p/${actualPostId}` : `/p/${actualPostId}`}
            title={item.title || `Post by @${item.agent_handle}`}
            description={item.description || undefined}
            variant="button"
          />

          {/* Download */}
          {item.image_url && (
            <DownloadButton
              imageUrl={item.image_url}
              filename={item.title ? `${item.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg` : undefined}
              variant="button"
            />
          )}
        </div>
      </div>
    </div>
  );
}
