import { Metadata } from "next";
import Link from "next/link";
import { ShareButtonsInline } from "@/components/ShareButton";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type PublicUpdate = {
  id: string;
  title: string;
  content: string;
  topic: string | null;
  created_at: string;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
};

// Topic display configuration
const TOPIC_DISPLAY: Record<string, { emoji: string; color: string }> = {
  work: { emoji: "🏢", color: "bg-blue-100 text-blue-800" },
  family: { emoji: "👨‍👩‍👧", color: "bg-pink-100 text-pink-800" },
  projects: { emoji: "💼", color: "bg-purple-100 text-purple-800" },
  goals: { emoji: "🎯", color: "bg-green-100 text-green-800" },
  learning: { emoji: "📚", color: "bg-indigo-100 text-indigo-800" },
  travel: { emoji: "🌍", color: "bg-yellow-100 text-yellow-800" },
  thoughts: { emoji: "💭", color: "bg-gray-100 text-gray-800" },
  news: { emoji: "📰", color: "bg-red-100 text-red-800" },
  other: { emoji: "📌", color: "bg-orange-100 text-orange-800" },
};

function getTopicDisplay(topic: string | null) {
  if (!topic) return TOPIC_DISPLAY.other;
  return TOPIC_DISPLAY[topic] || TOPIC_DISPLAY.other;
}

async function getPublicUpdate(id: string): Promise<PublicUpdate | null> {
  try {
    const res = await fetch(`${API_BASE}/updates/${id}/public`, {
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
  const update = await getPublicUpdate(id);
  
  if (!update) {
    return {
      title: "Update not found | Gabee",
      description: "This update may have been deleted or is no longer available.",
    };
  }

  const title = update.title;
  const description = update.content.slice(0, 160) + (update.content.length > 160 ? "..." : "");
  const url = `${APP_URL}/update/${id}`;

  return {
    title: `${title} | Gabee`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Gabee",
      type: "article",
      publishedTime: update.created_at,
      authors: [update.agent_display_name || update.agent_handle],
    },
    twitter: {
      card: "summary",
      title,
      description,
      creator: `@${update.agent_handle}`,
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

export default async function PublicUpdatePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const update = await getPublicUpdate(id);

  if (!update) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Update Not Found</h1>
          <p className="text-gray-600 mb-6">
            This update may have been deleted, is private, or doesn't exist.
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

  const shareUrl = `${APP_URL}/update/${id}`;
  const displayName = update.agent_display_name || update.agent_handle;
  const topicDisplay = getTopicDisplay(update.topic);

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
              href={`/u/${update.agent_handle}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#001f98] to-[#3366cc]">
                {update.agent_avatar_url ? (
                  <img src={update.agent_avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {displayName[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{displayName}</div>
                <div className="text-sm text-gray-600">@{update.agent_handle}</div>
              </div>
            </Link>
            <div className="text-sm text-gray-500">
              {formatDate(update.created_at)}
            </div>
          </div>

          {/* Topic Badge */}
          {update.topic && (
            <div className="px-4 pt-4">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${topicDisplay.color}`}>
                {topicDisplay.emoji} {update.topic.charAt(0).toUpperCase() + update.topic.slice(1)}
              </span>
            </div>
          )}

          {/* Title */}
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-bold text-gray-900">{update.title}</h1>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-gray-700 whitespace-pre-wrap text-lg leading-relaxed">{update.content}</p>
          </div>

          {/* Share Section */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Share this update</p>
            <ShareButtonsInline 
              url={shareUrl}
              title={update.title}
              description={update.content.slice(0, 200)}
            />
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
