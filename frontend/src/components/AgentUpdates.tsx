"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type AgentUpdate = {
  id: string;
  title: string;
  content: string;
  topic?: string | null;
  layer: "public" | "friends" | "intimate";
  is_pinned: boolean;
  created_at: string;
  updated_at?: string | null;
};

type AgentUpdatesProps = {
  agentId: string;
  agentHandle: string;
};

// Topic presets with emojis
const TOPIC_PRESETS = [
  { value: "work", label: "🏢 Work", color: "bg-blue-100 text-blue-800" },
  { value: "family", label: "👨‍👩‍👧 Family", color: "bg-pink-100 text-pink-800" },
  { value: "projects", label: "💼 Projects", color: "bg-purple-100 text-purple-800" },
  { value: "goals", label: "🎯 Goals", color: "bg-green-100 text-green-800" },
  { value: "learning", label: "📚 Learning", color: "bg-indigo-100 text-indigo-800" },
  { value: "travel", label: "🌍 Travel", color: "bg-yellow-100 text-yellow-800" },
  { value: "thoughts", label: "💭 Thoughts", color: "bg-gray-100 text-gray-800" },
  { value: "news", label: "📰 News", color: "bg-red-100 text-red-800" },
  { value: "other", label: "📌 Other", color: "bg-orange-100 text-orange-800" },
];

function getTopicDisplay(topic?: string | null) {
  const preset = TOPIC_PRESETS.find((p) => p.value === topic);
  return preset || { label: topic || "Other", color: "bg-gray-100 text-gray-800" };
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

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

export function AgentUpdates({ agentId, agentHandle }: AgentUpdatesProps) {
  const [updates, setUpdates] = useState<AgentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTopic, setFormTopic] = useState("work");
  const [formLayer, setFormLayer] = useState<"public" | "friends" | "intimate">("public");
  const [formPinned, setFormPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadUpdates() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/agents/${agentId}/updates`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load updates: ${res.status}`);
      }

      const data = await res.json();
      setUpdates(Array.isArray(data) ? data : data.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load updates");
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function openCreateModal() {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormTopic("work");
    setFormLayer("public");
    setFormPinned(false);
    setShowCreateModal(true);
  }

  function openEditModal(update: AgentUpdate) {
    setEditingId(update.id);
    setFormTitle(update.title);
    setFormContent(update.content);
    setFormTopic(update.topic || "other");
    setFormLayer(update.layer);
    setFormPinned(update.is_pinned);
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const url = editingId
        ? `${apiBase()}/agents/${agentId}/updates/${editingId}`
        : `${apiBase()}/agents/${agentId}/updates`;
      
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent.trim(),
          topic: formTopic,
          layer: formLayer,
          is_pinned: formPinned,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save update: ${res.status}`);
      }

      closeModal();
      await loadUpdates();
    } catch (e: any) {
      setError(e.message || "Failed to save update");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(updateId: string) {
    if (!confirm("Delete this update? This will also remove it from the agent's knowledge base.")) {
      return;
    }

    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/agents/${agentId}/updates/${updateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to delete update: ${res.status}`);
      }

      await loadUpdates();
    } catch (e: any) {
      setError(e.message || "Failed to delete update");
    }
  }

  async function handleTogglePin(updateId: string, currentPinned: boolean) {
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/agents/${agentId}/updates/${updateId}/pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_pinned: !currentPinned }),
      });

      if (!res.ok) {
        throw new Error(`Failed to toggle pin: ${res.status}`);
      }

      await loadUpdates();
    } catch (e: any) {
      setError(e.message || "Failed to toggle pin");
    }
  }

  // Sort: pinned first, then by date
  const sortedUpdates = [...updates].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">📰 Agent Updates</h2>
              <p className="mt-1 text-sm text-gray-600">
                Share what's new - updates become part of agent knowledge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Update
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-2 transition-colors hover:bg-white/50"
            >
              <svg
                className={`h-5 w-5 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {expanded && (
          <div className="p-6">
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-600">
                <svg className="h-5 w-5 animate-spin mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading updates...</span>
              </div>
            ) : sortedUpdates.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No updates yet</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create your first update to share what's new with your agent
                </p>
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Update
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedUpdates.map((update) => {
                  const topicDisplay = getTopicDisplay(update.topic);
                  return (
                    <div
                      key={update.id}
                      className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                        update.is_pinned
                          ? "border-yellow-300 bg-yellow-50/50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {update.is_pinned && (
                              <span className="text-yellow-600" title="Pinned">
                                📌
                              </span>
                            )}
                            <h3 className="font-semibold text-gray-900">{update.title}</h3>
                          </div>
                          <div className="mb-3 text-sm text-gray-700 line-clamp-3">
                            {update.content}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className={`rounded-full px-2 py-1 font-medium ${topicDisplay.color}`}>
                              {topicDisplay.label}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                              {update.layer}
                            </span>
                            <span>{formatRelativeTime(update.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openEditModal(update)}
                            className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleTogglePin(update.id, update.is_pinned)}
                            className={`rounded p-1 transition-colors ${
                              update.is_pinned
                                ? "text-yellow-600 hover:bg-yellow-100"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                            title={update.is_pinned ? "Unpin" : "Pin"}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(update.id)}
                            className="rounded p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                            title="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && sortedUpdates.length > 0 && (
              <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                <strong>💡 Tip:</strong> Updates are automatically embedded and made searchable, allowing your agent to reference them in conversations.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? "✏️ Edit Update" : "✨ Create Update"}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="max-h-[70vh] overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">
                      Title <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g., Project progress update"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      maxLength={200}
                      required
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">
                      Content <span className="text-red-600">*</span>
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({formContent.length} / 10,000 characters)
                      </span>
                    </label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="Share what's new..."
                      className="h-40 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      maxLength={10000}
                      required
                    />
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Topic */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Topic</label>
                      <select
                        value={formTopic}
                        onChange={(e) => setFormTopic(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {TOPIC_PRESETS.map((topic) => (
                          <option key={topic.value} value={topic.value}>
                            {topic.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Layer */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                      <select
                        value={formLayer}
                        onChange={(e) => setFormLayer(e.target.value as any)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="public">Public</option>
                        <option value="friends">Friends</option>
                        <option value="intimate">Intimate</option>
                      </select>
                    </div>

                    {/* Pin */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">&nbsp;</label>
                      <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPinned}
                          onChange={(e) => setFormPinned(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="font-medium text-gray-700">📌 Pin Update</span>
                      </label>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                    <strong>💡 Tip:</strong> This update will be automatically embedded and made searchable, allowing your agent to reference it in conversations.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitting || !formTitle.trim() || !formContent.trim()}
                >
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingId ? "Save Changes" : "Create Update"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}








