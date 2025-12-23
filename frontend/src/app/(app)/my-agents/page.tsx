"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAgent, getMyAgents } from "@/lib/api";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { ChatButton } from "@/components/ChatButton";
import { supabase } from "@/lib/supabaseClient";

type Agent = {
  id?: string;
  handle: string;
  display_name?: string;
  avatar_url?: string;
  owner_user_id?: string;
  created_at?: string;
};

async function deleteAgent(agentId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in.");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
  if (!API_BASE) throw new Error("Missing NEXT_PUBLIC_API_BASE.");

  const res = await fetch(`${API_BASE}/avees/${agentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete: ${text}`);
  }
}

function MyAgentsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);

  const [newHandle, setNewHandle] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Web research fields
  const [autoResearch, setAutoResearch] = useState(false);
  const [researchTopic, setResearchTopic] = useState("");
  const [researchMaxSources, setResearchMaxSources] = useState(5);
  const [creationResult, setCreationResult] = useState<any>(null);

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAgents();

      // backend might return {items:[...]} or just [...]
      const list = Array.isArray(data) ? data : data.items;
      setAgents(list || []);
    } catch (e: any) {
      setError(e.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setCreating(true);
    setError(null);
    setCreationResult(null);

    try {
      const handle = newHandle.trim().toLowerCase();
      const display_name = newName.trim();

      if (!handle) throw new Error("Handle is required");
      // Allow lowercase letters, numbers, hyphens, and underscores
      if (!/^[a-z0-9_-]+$/.test(handle)) {
        throw new Error("Handle must be lowercase letters, numbers, hyphens, or underscores");
      }

      const result = await createAgent({
        handle,
        display_name: display_name || undefined,
        auto_research: autoResearch,
        research_topic: autoResearch ? (researchTopic.trim() || undefined) : undefined,
        research_max_sources: autoResearch ? researchMaxSources : undefined,
        research_layer: "public",
      });
      
      setCreationResult(result);
      setNewHandle("");
      setNewName("");
      setAutoResearch(false);
      setResearchTopic("");
      setResearchMaxSources(5);
      
      // Show result for a bit before closing
      setTimeout(() => {
        setShowCreateForm(false);
        setCreationResult(null);
      }, 3000);
      
      await load();
    } catch (e: any) {
      setError(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function openDeleteConfirm(agent: Agent) {
    setAgentToDelete(agent);
    setDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    setDeleteConfirmOpen(false);
    setAgentToDelete(null);
  }

  async function confirmDelete() {
    if (!agentToDelete?.id) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteAgent(agentToDelete.id);
      await load();
      closeDeleteConfirm();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0B0B0C]">My Agents</h1>
          <p className="mt-2 text-[#2E3A59]/70">Create and manage your AI personalities</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Agent
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-red-800">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-md animate-slide-up">
          <div className="border-b border-[#E6E6E6] bg-gradient-to-r from-[#2E3A59]/5 to-[#FAFAFA] px-6 py-4">
            <h2 className="font-semibold text-[#0B0B0C]">Create New Agent</h2>
            <p className="mt-1 text-sm text-[#2E3A59]/70">Set up a new AI personality</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">
                  Handle <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  placeholder="my-agent"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                />
                <div className="mt-2 text-xs text-[#2E3A59]/70">
                  Lowercase letters, numbers, hyphens, and underscores only
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">
                  Display Name
                </label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  placeholder="My Agent"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="mt-2 text-xs text-[#2E3A59]/70">
                  Optional friendly name
                </div>
              </div>
            </div>

            {/* Web Research Section */}
            <div className="mt-6 rounded-lg border border-[#C8A24A]/30 bg-[#C8A24A]/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-[#C8A24A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="font-semibold text-[#0B0B0C]">Automatic Web Research</h3>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={autoResearch}
                    onChange={(e) => setAutoResearch(e.target.checked)}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#C8A24A] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#C8A24A]/20"></div>
                </label>
              </div>
              
              <p className="mb-3 text-xs text-[#2E3A59]/70">
                Automatically gather initial knowledge from the web about a person or topic when creating the agent.
              </p>
              
              {autoResearch && (
                <div className="space-y-4 animate-slide-up">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">
                      Research Topic
                    </label>
                    <input
                      className="w-full rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#C8A24A] focus:outline-none focus:ring-2 focus:ring-[#C8A24A]/20"
                      placeholder="e.g., Elon Musk, Artificial Intelligence, etc."
                      value={researchTopic}
                      onChange={(e) => setResearchTopic(e.target.value)}
                    />
                    <div className="mt-1 text-xs text-[#2E3A59]/70">
                      Leave blank to use the agent&apos;s display name or handle
                    </div>
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">
                      Max Sources: {researchMaxSources}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      step="1"
                      value={researchMaxSources}
                      onChange={(e) => setResearchMaxSources(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#C8A24A]"
                    />
                    <div className="mt-1 flex justify-between text-xs text-[#2E3A59]/70">
                      <span>Fewer sources (faster)</span>
                      <span>More sources (comprehensive)</span>
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-white p-3 text-xs text-[#2E3A59] border border-[#C8A24A]/30">
                    <strong className="text-[#C8A24A]">Note:</strong> Web research may take 30-60 seconds depending on the number of sources. The agent will be created first, and research will happen automatically.
                  </div>
                </div>
              )}
            </div>

            {/* Success Message */}
            {creationResult && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 animate-slide-up">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800">Agent created successfully!</div>
                    {creationResult.research?.completed && (
                      <div className="mt-2 text-xs text-green-700">
                        <strong>Web Research:</strong> Added {creationResult.research.documents_added} documents ({creationResult.research.total_chunks} knowledge chunks) about &quot;{creationResult.research.topic}&quot;
                      </div>
                    )}
                    {creationResult.research?.completed === false && creationResult.research.error && (
                      <div className="mt-2 text-xs text-amber-700">
                        <strong>Note:</strong> {creationResult.research.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={onCreate}
                disabled={creating || !newHandle.trim()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {autoResearch ? "Creating & Researching (30-90s)..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Agent
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewHandle("");
                  setNewName("");
                  setAutoResearch(false);
                  setResearchTopic("");
                  setError(null);
                  setCreationResult(null);
                }}
                disabled={creating}
                className="rounded-lg border border-[#E6E6E6] px-6 py-3 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-[#2E3A59]/5 border border-[#2E3A59]/20 p-4 text-xs text-[#2E3A59]">
                <strong>Tip:</strong> Handles become part of the URL, like <code className="rounded bg-white px-1.5 py-0.5 border border-[#E6E6E6]">/my-agents/my-agent</code>
              </div>
              {autoResearch && (
                <div className="rounded-lg bg-[#C8A24A]/5 border border-[#C8A24A]/30 p-4 text-xs text-[#C8A24A]">
                  <strong>⏱️ Please wait:</strong> Web research takes 30-90 seconds. Don&apos;t close this page until you see the success message!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agents List */}
      <div className="rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E6E6E6] px-6 py-4">
          <div>
            <h2 className="font-semibold text-[#0B0B0C]">Your Agents</h2>
            <p className="mt-1 text-sm text-[#2E3A59]/70">
              {loading ? "Loading..." : `${agents.length} Agent${agents.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-all hover:border-[#2E3A59] hover:bg-[#2E3A59]/5 disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Loading your Agents...</span>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2E3A59]/10">
              <svg className="h-8 w-8 text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0B0B0C]">No Agents yet</h3>
            <p className="mt-2 text-sm text-[#2E3A59]/70">Get started by creating your first AI personality</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Agent
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E6E6]">
            {agents.map((a) => (
              <div key={a.handle} className="group px-6 py-5 transition-colors hover:bg-[#2E3A59]/5">
                  <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {a.avatar_url ? (
                      <img
                        src={a.avatar_url}
                        alt={a.display_name || a.handle}
                        className="h-14 w-14 shrink-0 rounded-xl border-2 border-[#E6E6E6] object-cover shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-xl border-2 border-[#E6E6E6] bg-gradient-to-br from-[#2E3A59] to-[#1a2236] flex items-center justify-center text-white font-bold shadow-sm">
                        {(a.display_name || a.handle)[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#0B0B0C] truncate">{a.display_name || a.handle}</h3>
                      <p className="text-sm text-[#2E3A59]/70 truncate">@{a.handle}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      className="flex items-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
                      href={`/my-agents/${a.handle}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Link>

                    <ChatButton
                      handle={a.handle}
                      displayName={a.display_name || a.handle}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:scale-105"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Chat
                    </ChatButton>

                    <button
                      onClick={() => openDeleteConfirm(a)}
                      className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slide-up">
            <div className="border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Delete Agent</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="mb-2 text-sm text-gray-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">
                  {agentToDelete.display_name || agentToDelete.handle}
                </span>
                ?
              </p>
              <p className="text-sm text-gray-600">
                All training data, conversations, and configurations for{" "}
                <span className="font-medium">@{agentToDelete.handle}</span> will be permanently removed.
              </p>
            </div>

            <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={closeDeleteConfirm}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyAgentsPage() {
  return (
    <NewLayoutWrapper>
      <MyAgentsContent />
    </NewLayoutWrapper>
  );
}
