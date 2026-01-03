"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  getComments, 
  createComment, 
  deleteComment,
  CommentData 
} from "@/lib/api";

type CommentSectionProps = {
  postId: string;
  initialCommentCount: number;
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

function CommentItem({ 
  comment, 
  currentUserId, 
  onDelete 
}: { 
  comment: CommentData; 
  currentUserId?: string;
  onDelete: (commentId: string) => void;
}) {
  const isOwnComment = currentUserId === comment.user_id;
  const displayName = comment.user_display_name || comment.user_handle;

  return (
    <div className="flex gap-3 py-3">
      {/* Avatar */}
      <Link href={`/u/${comment.user_handle}`} className="shrink-0">
        <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center">
          {comment.user_avatar_url ? (
            <img src={comment.user_avatar_url} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-white">
              {displayName[0].toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      {/* Comment Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/u/${comment.user_handle}`} className="font-semibold text-sm text-gray-900 hover:underline">
            {displayName}
          </Link>
          <span className="text-xs text-gray-500">@{comment.user_handle}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
        </div>
        
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2">
          {isOwnComment && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({ 
  postId, 
  initialCommentCount,
  currentUserId,
  currentUserHandle,
  currentUserAvatar 
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function loadComments() {
    setLoading(true);
    setError(null);

    try {
      const data = await getComments(postId);
      setComments(data.comments);
    } catch (e: any) {
      console.error("Failed to load comments:", e);
      setError(e?.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    setSubmitting(true);
    
    try {
      await createComment(postId, newComment.trim());
      setNewComment("");
      // Reload comments to show the new one
      await loadComments();
    } catch (e: any) {
      console.error("Failed to post comment:", e);
      alert(e?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment(commentId);
      // Remove from local state
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e: any) {
      console.error("Failed to delete comment:", e);
      alert(e?.message || "Failed to delete comment");
    }
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      {/* Comment Input */}
      <form onSubmit={handleSubmitComment} className="mb-4">
        <div className="flex gap-3">
          <div className="shrink-0">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center">
              {currentUserAvatar ? (
                <img src={currentUserAvatar} alt="You" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {currentUserHandle ? currentUserHandle[0].toUpperCase() : "?"}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#001f98] focus:border-transparent resize-none text-sm"
              rows={2}
              disabled={submitting}
            />
            
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-[#001f98] text-white rounded-lg text-sm font-medium hover:bg-[#001670] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Posting..." : "Comment"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-1">
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#001f98]"></div>
            <p className="text-sm text-gray-600 mt-2">Loading comments...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button
              onClick={loadComments}
              className="text-sm text-[#001f98] hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-gray-600">No comments yet.</p>
            <p className="text-xs text-gray-500 mt-1">Be the first to comment!</p>
          </div>
        )}

        {!loading && !error && comments.length > 0 && (
          <>
            <div className="text-sm font-semibold text-gray-900 mb-3">
              {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
            </div>
            <div className="divide-y divide-gray-200">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

