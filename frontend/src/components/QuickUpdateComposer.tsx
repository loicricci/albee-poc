"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GeneratePostModal } from "./GeneratePostModal";

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type QuickUpdateComposerProps = {
  agents: Agent[];
  onUpdatePosted?: () => void; // Callback to refresh feed after posting
};

const TOPIC_PRESETS = [
  { value: "work", label: "🏢 Work" },
  { value: "family", label: "👨‍👩‍👧 Family" },
  { value: "projects", label: "💼 Projects" },
  { value: "goals", label: "🎯 Goals" },
  { value: "learning", label: "📚 Learning" },
  { value: "travel", label: "🌍 Travel" },
  { value: "thoughts", label: "💭 Thoughts" },
  { value: "news", label: "📰 News" },
  { value: "other", label: "📌 Other" },
];

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in");
  return token;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE");
  return base;
}

export function QuickUpdateComposer({ agents, onUpdatePosted }: QuickUpdateComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("work");
  const [layer, setLayer] = useState<"public" | "friends" | "intimate">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  
  // Generate Post Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !selectedAgent) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await getAccessToken();

      // Generate title from first line or words of content
      const title = content
        .split("\n")[0]
        .slice(0, 100)
        .trim() || "Quick Update";

      const res = await fetch(`${apiBase()}/agents/${selectedAgent}/updates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content: content.trim(),
          topic,
          layer,
          is_pinned: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to post update: ${res.status}`);
      }

      // Success!
      setContent("");
      setSuccess(true);
      setExpanded(false);

      // Trigger feed refresh callback if provided
      if (onUpdatePosted) {
        onUpdatePosted();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to post update");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenGenerateModal() {
    if (!selectedAgent) {
      setError("Please select an agent first");
      return;
    }
    setError(null);
    setShowGenerateModal(true);
  }

  function handleGenerateSuccess() {
    setGenerateSuccess(true);
    setExpanded(false);

    // Trigger feed refresh callback if provided
    if (onUpdatePosted) {
      onUpdatePosted();
    }

    // Clear success message after 3 seconds
    setTimeout(() => setGenerateSuccess(false), 3000);
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-[#f8fafc] p-6 md:p-8 text-center">
        <svg className="mx-auto h-10 w-10 md:h-12 md:w-12 text-[#001f98]/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">No agents yet</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create an agent to start posting updates
        </p>
        <a
          href="/my-agents"
          className="inline-flex items-center gap-2 rounded-full bg-[#001f98] px-4 md:px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105"
        >
          Create Agent
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Success message for manual post */}
      {success && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-green-800">Update posted successfully!</div>
          </div>
        </div>
      )}

      {/* Success message for auto-generated post */}
      {generateSuccess && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-green-800">Post generated successfully!</div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-[#001f98]/30 transition-all">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-[#e6eaff] to-[#f8fafc] px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full shadow-lg shadow-[#001f98]/25" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                <svg className="h-4 w-4 md:h-5 md:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm md:text-base text-gray-900">What's new?</h2>
                <p className="text-xs md:text-sm text-gray-600 hidden sm:block">Share an update with your followers</p>
              </div>
            </div>
            {!expanded && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenGenerateModal}
                  disabled={!agents.length}
                  className="flex items-center gap-1.5 md:gap-2 rounded-full bg-gradient-to-r from-[#3366cc] to-[#001f98] px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <svg className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Generate Post</span>
                  <span className="sm:hidden">Generate</span>
                </button>
                <button
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-1.5 md:gap-2 rounded-full bg-[#001f98] px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 shrink-0"
                >
                  <svg className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Post Update</span>
                  <span className="sm:hidden">Post</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        {expanded && (
          <form onSubmit={handleSubmit} className="p-4 md:p-6">
            {/* Error message */}
            {error && (
              <div className="mb-4 flex items-start gap-2 md:gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs md:text-sm text-red-800">
                <svg className="h-4 w-4 md:h-5 md:w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Agent Selector */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Post as <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                required
              >
                <option value="">Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.display_name || agent.handle} (@{agent.handle})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Agent Preview */}
            {selectedAgentData && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#001f98]/20 bg-[#e6eaff] p-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-[#001f98]/30 flex items-center justify-center" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                  {selectedAgentData.avatar_url ? (
                    <img src={selectedAgentData.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {selectedAgentData.display_name || selectedAgentData.handle}
                  </div>
                  <div className="text-xs text-[#001f98]">
                    Posting to followers of @{selectedAgentData.handle}
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                What's happening? <span className="text-red-600">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share an update, announcement, or thought..."
                className="h-32 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 resize-none"
                maxLength={10000}
                required
              />
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>This will become part of your agent's knowledge</span>
                <span>{content.length} / 10,000</span>
              </div>
            </div>

            {/* Options */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                >
                  {TOPIC_PRESETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Visibility</label>
                <select
                  value={layer}
                  onChange={(e) => setLayer(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                >
                  <option value="public">🌍 Public - Everyone</option>
                  <option value="friends">👥 Friends Only</option>
                  <option value="intimate">🔒 Intimate Only</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setContent("");
                  setError(null);
                }}
                className="rounded-full border border-gray-300 px-4 md:px-6 py-2 text-sm font-medium text-gray-700 transition-all hover:border-[#001f98] hover:text-[#001f98]"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-full bg-[#001f98] px-4 md:px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting || !content.trim() || !selectedAgent}
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Posting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Post Update
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Collapsed state with quick info */}
        {!expanded && (
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="flex flex-col gap-3">
              {/* Agent selector for quick generate */}
              <div className="flex items-center gap-3">
                <label className="text-xs md:text-sm text-gray-900 font-medium shrink-0">
                  Select agent:
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs md:text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.display_name || agent.handle} (@{agent.handle})
                    </option>
                  ))}
                </select>
              </div>

              {/* Info text */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                <span className="text-xs md:text-sm text-gray-600">Generate AI-powered posts or write your own updates</span>
                <span className="text-xs text-gray-500 shrink-0">{agents.length} agent{agents.length !== 1 ? "s" : ""} available</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Post Modal */}
      {selectedAgentData && (
        <GeneratePostModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          agent={selectedAgentData}
          onSuccess={handleGenerateSuccess}
        />
      )}
    </>
  );
}

