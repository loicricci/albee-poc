"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { DownloadButton } from "@/components/DownloadButton";

type VideoPostData = {
  id: string;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string;  // Fallback thumbnail
  video_url: string;
  video_duration: number | null;
  video_thumbnail_url: string | null;
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

type VideoPostProps = {
  post: VideoPostData;
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `0:${secs.toString().padStart(2, "0")}`;
}

export function VideoPost({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  isOwnPost = false,
}: VideoPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.user_has_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isLiking, setIsLiking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Autoplay on scroll (muted)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting) {
              videoRef.current.play().catch(() => {
                // Autoplay might be blocked
              });
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

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Update progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, []);

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;
    
    try {
      const newLiked = !liked;
      setLiked(newLiked);
      setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
      await onLike?.(post.id, newLiked);
    } catch (error) {
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

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    videoRef.current.currentTime = percent * videoRef.current.duration;
  };

  const displayName = post.owner_display_name || post.owner_handle;
  const isAIGenerated = post.post_type === "ai_generated_video";
  const thumbnailUrl = post.video_thumbnail_url || post.image_url;

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

      {/* Video Player */}
      <div 
        ref={containerRef}
        className="relative bg-black cursor-pointer group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={post.video_url}
          poster={thumbnailUrl}
          className="w-full max-h-[600px] object-contain"
          loop
          muted={isMuted}
          playsInline
          preload="metadata"
        />

        {/* Play/Pause Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
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
          showControls ? "opacity-100" : "opacity-0"
        }`}>
          {/* Progress Bar */}
          <div 
            className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleProgressClick(e);
            }}
          >
            <div 
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
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
              {post.video_duration && (
                <span className="text-white text-sm">
                  {formatDuration(post.video_duration)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Generated Badge */}
        {isAIGenerated && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            AI Video
          </div>
        )}
      </div>

      {/* Description */}
      {post.description && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-gray-900 whitespace-pre-wrap">{post.description}</p>
        </div>
      )}

      {/* AI Metadata */}
      {isAIGenerated && post.ai_metadata && Object.keys(post.ai_metadata).length > 0 && (
        <div className="px-4 pb-3">
          <details className="text-xs text-[#001f98]/70">
            <summary className="cursor-pointer hover:text-[#001f98] flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AI Video Details
            </summary>
            <div className="mt-2 ml-4 space-y-1">
              {post.ai_metadata.model && <div>Model: {post.ai_metadata.model}</div>}
              {post.ai_metadata.duration && <div>Duration: {post.ai_metadata.duration}s</div>}
              {post.ai_metadata.topic && <div>Topic: {post.ai_metadata.topic}</div>}
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
        <ShareButton
          url={typeof window !== "undefined" ? `${window.location.origin}/p/${post.id}` : `/p/${post.id}`}
          title={post.title || `Video by @${post.owner_handle}`}
          description={post.description || undefined}
          variant="button"
        />

        {/* Download Video */}
        <DownloadButton
          imageUrl={post.video_url}
          filename={post.title ? `${post.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.mp4` : undefined}
          variant="button"
        />
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-200 bg-[#FAFAFA] p-4">
          <div className="text-sm text-[#001f98]/70 mb-4">
            Comments feature coming soon!
          </div>
        </div>
      )}
    </div>
  );
}
