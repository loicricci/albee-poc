"use client";

import { useEffect, useState } from "react";
import { ImagePost } from "@/components/ImagePost";
import { getPosts, likePost, unlikePost, sharePost, deletePost, type PostData } from "@/lib/api";

type PostsGalleryProps = {
  userHandle: string;
  isOwnProfile?: boolean;
};

export function PostsGallery({ userHandle, isOwnProfile = false }: PostsGalleryProps) {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, [userHandle]);

  async function loadPosts() {
    setLoading(true);
    setError(null);

    try {
      const data = await getPosts(userHandle);
      setPosts(data.posts);
    } catch (e: any) {
      setError(e?.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(postId: string, liked: boolean) {
    try {
      if (liked) {
        await likePost(postId);
      } else {
        await unlikePost(postId);
      }
      // Post component optimistically updates UI
    } catch (e: any) {
      console.error("Failed to toggle like:", e);
      // Reload to revert optimistic update
      loadPosts();
    }
  }

  async function handleShare(postId: string) {
    try {
      await sharePost(postId);
      alert("Post shared!");
      // Reload to update share count
      loadPosts();
    } catch (e: any) {
      alert(e?.message || "Failed to share post");
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e: any) {
      alert(e?.message || "Failed to delete post");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-24 bg-gray-100 rounded"></div>
              </div>
            </div>
            <div className="h-64 w-full bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load posts</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadPosts}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E6E6E6] bg-white p-12 text-center">
        <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-[#0B0B0C] mb-2">No posts yet</h3>
        <p className="text-[#2E3A59]/70">
          {isOwnProfile
            ? "Start sharing your AI-generated images and other content"
            : "This user hasn't posted anything yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <ImagePost
          key={post.id}
          post={post}
          onLike={handleLike}
          onShare={handleShare}
          onDelete={isOwnProfile ? handleDelete : undefined}
          isOwnPost={isOwnProfile}
        />
      ))}
    </div>
  );
}








