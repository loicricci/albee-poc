"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { UnifiedFeedItem, updatePost } from "@/lib/api";
import { CommentSection } from "@/components/CommentSection";
import { ShareButton } from "@/components/ShareButton";
import { DownloadButton } from "@/components/DownloadButton";
import { PostDetailModal } from "@/components/PostDetailModal";

type FeedPostCardProps = {
  item: UnifiedFeedItem;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onComment: (postId: string) => void;
  onRepost: (postId: string, content: string) => void;
  onTitleUpdate?: (postId: string, newTitle: string) => void;
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

export function FeedPostCard({ item, onLike, onComment, onRepost, onTitleUpdate, currentUserId, currentUserHandle, currentUserAvatar }: FeedPostCardProps) {
  const [liked, setLiked] = useState(item.user_has_liked || false);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  
  // Edit title state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedTitle, setEditedTitle] = useState(item.title || "");
  const [currentTitle, setCurrentTitle] = useState(item.title || "");
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  
  // Check if current user is the owner of this post
  const isOwner = !!currentUserId && item.owner_user_id === currentUserId;
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showVideoControls, setShowVideoControls] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  // Check if this is a video post
  const isVideoPost = !!(item.video_url && (item.post_type === "video" || item.post_type === "ai_generated_video"));
  
  // Video autoplay on scroll (muted)
  useEffect(() => {
    if (!isVideoPost || !videoContainerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting) {
              videoRef.current.play().catch(() => {});
              setIsPlaying(true);
            } else {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(videoContainerRef.current);
    return () => observer.disconnect();
  }, [isVideoPost]);

  // Update video progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoPost) return;

    const updateProgress = () => {
      if (video.duration) {
        setVideoProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isVideoPost]);

  const toggleVideoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    videoRef.current.currentTime = percent * videoRef.current.duration;
  };

  const formatVideoDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `0:${secs.toString().padStart(2, "0")}`;
  };

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

  // Handle card click to open detail modal
  const handleCardClick = () => {
    setShowDetailModal(true);
  };

  // Handle title edit
  const handleEditTitle = async () => {
    if (isUpdatingTitle || editedTitle === currentTitle) {
      setShowEditModal(false);
      return;
    }
    
    setIsUpdatingTitle(true);
    const previousTitle = currentTitle;
    
    try {
      // Optimistic update
      setCurrentTitle(editedTitle);
      
      // Call API
      await updatePost(actualPostId, { title: editedTitle });
      
      // Notify parent if callback provided
      if (onTitleUpdate) {
        onTitleUpdate(actualPostId, editedTitle);
      }
      
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update title:", error);
      // Revert on error
      setCurrentTitle(previousTitle);
      setEditedTitle(previousTitle);
      alert("Failed to update title. Please try again.");
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const openEditModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(currentTitle);
    setShowEditModal(true);
  };

  // Handle interactions from modal
  const handleModalLike = async (postId: string, newLiked: boolean) => {
    await onLike(postId, newLiked);
  };

  const handleModalComment = () => {
    setShowComments(true);
    onComment(actualPostId);
  };

  const handleModalRepost = () => {
    setShowRepostModal(true);
  };

  // This component should ONLY render posts and reposts
  // Updates are handled by FeedUpdateCard component
  // Render as a post
  return (
    <>
      <div 
        className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-lg hover:border-[#001f98]/30 cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <Link 
            href={`/u/${item.agent_handle}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className={`h-10 w-10 rounded-full overflow-hidden flex items-center justify-center ${item.agent_avatar_url ? 'bg-white border border-gray-200' : ''}`}
              style={item.agent_avatar_url ? undefined : {background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}
            >
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

        {/* Title with Edit Button */}
        {currentTitle && (
          <div className="px-4 pb-2 flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900 flex-1">{currentTitle}</h3>
            {isOwner && (
              <button
                onClick={openEditModal}
                className="p-1.5 text-gray-400 hover:text-[#001f98] hover:bg-[#e6eaff] rounded-lg transition-colors flex-shrink-0"
                title="Edit title"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Video or Image */}
        {isVideoPost && item.video_url ? (
          <div 
            ref={videoContainerRef}
            className="relative bg-black cursor-pointer group"
            onMouseEnter={() => setShowVideoControls(true)}
            onMouseLeave={() => setShowVideoControls(false)}
            onClick={toggleVideoPlay}
          >
            <video
              ref={videoRef}
              src={item.video_url}
              poster={item.video_thumbnail_url || item.image_url}
              className="w-full max-h-[600px] object-contain"
              loop
              muted={isMuted}
              playsInline
              preload="metadata"
            />

            {/* Play/Pause Overlay */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
              showVideoControls || !isPlaying ? "opacity-100" : "opacity-0"
            }`}>
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                {isPlaying ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Controls Bar */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity ${
              showVideoControls ? "opacity-100" : "opacity-0"
            }`}>
              {/* Progress Bar */}
              <div 
                className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer"
                onClick={handleVideoProgressClick}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Play/Pause Button */}
                  <button
                    onClick={toggleVideoPlay}
                    className="text-white hover:text-white/80 transition-colors"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Mute Button */}
                  <button
                    onClick={toggleVideoMute}
                    className="text-white hover:text-white/80 transition-colors"
                  >
                    {isMuted ? (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>

                  {/* Duration */}
                  {item.video_duration && (
                    <span className="text-white text-sm">
                      {formatVideoDuration(item.video_duration)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* AI Video Badge */}
            {item.post_type === "ai_generated_video" && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                AI Video
              </div>
            )}
          </div>
        ) : item.image_url && (
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
        <div className="flex items-center border-t border-gray-200 px-2 sm:px-4 py-2 gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-[#e6eaff] ${
              liked ? "text-[#C8A24A]" : "text-gray-600"
            } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <svg 
              className={`h-4 w-4 sm:h-5 sm:w-5 ${isLiking ? "animate-pulse" : ""}`}
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
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{item.comment_count || 0}</span>
          </button>

          {/* Repost */}
          <button
            onClick={() => setShowRepostModal(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 transition-all hover:bg-[#e6eaff] hover:text-[#001f98]"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Repost</span>
          </button>

          {/* Share to External Platforms */}
          <ShareButton
            url={typeof window !== "undefined" ? `${window.location.origin}/p/${actualPostId}` : `/p/${actualPostId}`}
            title={item.title || `Post by @${item.agent_handle}`}
            description={item.description || undefined}
            variant="button"
          />

          {/* Download Image/Video */}
          {(item.image_url || item.video_url) && (
            <DownloadButton
              imageUrl={isVideoPost && item.video_url ? item.video_url : item.image_url!}
              filename={item.title ? `${item.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}${isVideoPost ? '.mp4' : '.jpg'}` : undefined}
              variant="button"
            />
          )}
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
                <div 
                  className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center ${item.agent_avatar_url ? 'bg-white border border-gray-200' : ''}`}
                  style={item.agent_avatar_url ? undefined : {background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}
                >
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

      {/* Post Detail Modal */}
      <PostDetailModal
        item={{ ...item, title: currentTitle }}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onLike={handleModalLike}
        onComment={handleModalComment}
        onRepost={handleModalRepost}
        liked={liked}
        likeCount={likeCount}
        isLiking={isLiking}
        isOwner={isOwner}
        onEditTitle={openEditModal}
      />

      {/* Edit Title Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Post Title</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Title Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Title
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Enter post title..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 focus:border-[#001f98] transition-all"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-gray-700 font-medium hover:border-[#001f98] hover:text-[#001f98] transition-all"
                disabled={isUpdatingTitle}
              >
                Cancel
              </button>
              <button
                onClick={handleEditTitle}
                disabled={isUpdatingTitle || editedTitle === currentTitle}
                className={`flex-1 px-4 py-2 bg-[#001f98] text-white rounded-full font-medium shadow-lg shadow-[#001f98]/25 hover:bg-[#001670] hover:shadow-[#001f98]/40 hover:scale-105 transition-all duration-300 ${
                  (isUpdatingTitle || editedTitle === currentTitle) ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isUpdatingTitle ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

