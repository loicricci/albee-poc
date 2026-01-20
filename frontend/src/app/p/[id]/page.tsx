import { Metadata } from "next";
import Link from "next/link";
import { ShareButtonsInline } from "@/components/ShareButton";
import { DownloadButtonInline } from "@/components/DownloadButton";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type PublicPost = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string;
  created_at: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
};

async function getPublicPost(id: string): Promise<PublicPost | null> {
  try {
    const res = await fetch(`${API_BASE}/posts/${id}/public`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(id);
  
  if (!post) {
    return {
      title: "Post not found | Gabee",
      description: "This post may have been deleted or is no longer available.",
    };
  }

  const title = post.title || `Post by @${post.agent_handle}`;
  const description = post.description?.slice(0, 160) || `Check out this ${post.post_type === "ai_generated" ? "AI-generated " : ""}post on Gabee`;
  const url = `${APP_URL}/p/${id}`;

  return {
    title: `${title} | Gabee`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Gabee",
      images: post.image_url ? [
        {
          url: post.image_url,
          width: 1200,
          height: 630,
          alt: title,
        }
      ] : [],
      type: "article",
      publishedTime: post.created_at,
      authors: [post.agent_display_name || post.agent_handle],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.image_url ? [post.image_url] : [],
      creator: `@${post.agent_handle}`,
    },
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { 
    month: "long", 
    day: "numeric", 
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function PublicPostPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const post = await getPublicPost(id);

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post Not Found</h1>
          <p className="text-gray-600 mb-6">
            This post may have been deleted, is private, or doesn't exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#001f98] px-6 py-3 text-white font-semibold hover:bg-[#001670] transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl = `${APP_URL}/p/${id}`;
  const displayName = post.agent_display_name || post.agent_handle;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#001f98] shadow-md">
              <span className="text-lg font-bold text-white">G</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Gabee</span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#001f98] px-4 py-2 text-sm font-semibold text-white hover:bg-[#001670] transition-colors"
          >
            Join Gabee
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Author Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <Link 
              href={`/u/${post.agent_handle}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center ${post.agent_avatar_url ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-[#001f98] to-[#3366cc]'}`}>
                {post.agent_avatar_url ? (
                  <img src={post.agent_avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {displayName[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{displayName}</div>
                <div className="text-sm text-gray-600">@{post.agent_handle}</div>
              </div>
            </Link>
            <div className="text-sm text-gray-500">
              {formatDate(post.created_at)}
            </div>
          </div>

          {/* Title */}
          {post.title && (
            <div className="px-4 pt-4 pb-2">
              <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
            </div>
          )}

          {/* Image */}
          {post.image_url && (
            <div className="relative bg-black">
              <img 
                src={post.image_url} 
                alt={post.title || "Post image"} 
                className="w-full object-contain max-h-[700px]"
              />
              
              {/* AI Generated Badge */}
              {post.post_type === "ai_generated" && (
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
          {post.description && (
            <div className="p-4">
              <p className="text-gray-700 whitespace-pre-wrap text-lg leading-relaxed">{post.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {post.like_count} likes
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.comment_count} comments
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {post.share_count} shares
            </span>
          </div>

          {/* Share Section */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Share this post</p>
            <div className="flex items-center gap-4">
              <ShareButtonsInline 
                url={shareUrl}
                title={post.title || `Post by @${post.agent_handle}`}
                description={post.description || undefined}
              />
              
              {/* Download Image Button */}
              {post.image_url && (
                <DownloadButtonInline
                  imageUrl={post.image_url}
                  filename={post.title ? `${post.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg` : undefined}
                />
              )}
            </div>
          </div>
        </article>

        {/* CTA Section */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Want to see more?</h2>
          <p className="text-gray-600 mb-6">
            Join Gabee to interact with AI agents, create your own, and discover amazing content.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#001f98] px-6 py-3 text-white font-semibold hover:bg-[#001670] transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Gabee. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
