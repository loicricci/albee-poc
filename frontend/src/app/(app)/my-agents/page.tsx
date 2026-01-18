"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAgent, getMyAgents, getAgentLimitStatus, getSubscriptionStatus, getSubscriptionLevels, requestUpgrade, SubscriptionStatus, SubscriptionLevel } from "@/lib/api";
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

type AgentLimitStatus = {
  is_admin: boolean;
  current_agent_count: number;
  max_agents: number;  // -1 means unlimited
  can_create_more: boolean;
  remaining: number;   // -1 means unlimited
  subscription_level?: string;
  level_name?: string;
};

// Level badge colors
const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  starter: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  creator: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  pro: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  admin: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [limitStatus, setLimitStatus] = useState<AgentLimitStatus | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLevels, setSubscriptionLevels] = useState<SubscriptionLevel[]>([]);

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

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradeLevel, setSelectedUpgradeLevel] = useState("");
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);

  async function load(forceRefresh: boolean = false) {
    setLoading(true);
    setError(null);
    try {
      // PERFORMANCE: Check cache first (skip if forceRefresh)
      if (!forceRefresh) {
        const cachedAgents = localStorage.getItem('my_agents_list');
        const cachedLimit = localStorage.getItem('my_agents_limit');
        
        if (cachedAgents && cachedLimit) {
          try {
            setAgents(JSON.parse(cachedAgents));
            setLimitStatus(JSON.parse(cachedLimit));
            setLoading(false); // UI ready with cache!
          } catch (e) {
            console.warn('Failed to parse cached agents data');
          }
        }
      } else {
        // Clear stale cache when force refreshing
        localStorage.removeItem('my_agents_list');
        localStorage.removeItem('my_agents_limit');
      }
      
      // Fetch fresh data from API
      const [agentsData, limitData, subStatus, subLevels] = await Promise.all([
        getMyAgents(),
        getAgentLimitStatus(),
        getSubscriptionStatus().catch(() => null),
        getSubscriptionLevels().catch(() => ({ levels: [] }))
      ]);
      
      if (subStatus) setSubscriptionStatus(subStatus);
      if (subLevels) setSubscriptionLevels(subLevels.levels || []);

      // backend might return {items:[...]} or just [...]
      const list = Array.isArray(agentsData) ? agentsData : agentsData.items;
      setAgents(list || []);
      setLimitStatus(limitData);
      
      // PERFORMANCE: Update cache
      localStorage.setItem('my_agents_list', JSON.stringify(list || []));
      localStorage.setItem('my_agents_limit', JSON.stringify(limitData));
      
      // Note: Removed auto-redirect to agent editor for non-admin users.
      // All users now see the agent list page and can navigate to edit their agents.
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
      
      // OPTIMISTIC UPDATE: Immediately add the new agent to state
      // This fixes the backend eventual consistency issue where getMyAgents()
      // doesn't immediately return the newly created agent
      const newAgent: Agent = {
        id: result?.id,
        handle: result?.handle || handle,
        display_name: result?.display_name || display_name || undefined,
        avatar_url: result?.avatar_url,
        created_at: result?.created_at || new Date().toISOString(),
      };
      setAgents(prevAgents => {
        // Check if agent already exists to avoid duplicates
        if (prevAgents.some(a => a.handle === newAgent.handle)) {
          return prevAgents;
        }
        return [newAgent, ...prevAgents];
      });
      
      // Update limit status optimistically
      if (limitStatus) {
        setLimitStatus({
          ...limitStatus,
          current_agent_count: limitStatus.current_agent_count + 1,
          remaining: limitStatus.remaining === -1 ? -1 : limitStatus.remaining - 1,
          can_create_more: limitStatus.is_admin || (limitStatus.remaining === -1 || limitStatus.remaining > 1),
        });
      }
      
      // Update cache with the new agent
      const updatedAgents = [newAgent, ...agents.filter(a => a.handle !== newAgent.handle)];
      localStorage.setItem('my_agents_list', JSON.stringify(updatedAgents));
      
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
      
      // No background refresh - optimistic update is sufficient
      // User can manually refresh if needed, avoiding stale data overwrite
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

  async function handleRequestUpgrade() {
    if (!selectedUpgradeLevel) return;
    
    setRequestingUpgrade(true);
    setError(null);
    
    try {
      await requestUpgrade(selectedUpgradeLevel);
      alert("Upgrade request submitted successfully! An admin will review your request.");
      setShowUpgradeModal(false);
      setSelectedUpgradeLevel("");
      // Refresh subscription status
      const subStatus = await getSubscriptionStatus().catch(() => null);
      if (subStatus) setSubscriptionStatus(subStatus);
    } catch (e: any) {
      setError(e.message || "Failed to submit upgrade request");
    } finally {
      setRequestingUpgrade(false);
    }
  }

  async function confirmDelete() {
    if (!agentToDelete?.id) return;

    setDeleting(true);
    setError(null);

    try {
      const deletedHandle = agentToDelete.handle;
      await deleteAgent(agentToDelete.id);
      
      // OPTIMISTIC UPDATE: Immediately remove the agent from state
      // This fixes the backend eventual consistency issue where getMyAgents()
      // doesn't immediately reflect the deletion
      setAgents(prevAgents => prevAgents.filter(a => a.handle !== deletedHandle));
      
      // Update limit status optimistically
      if (limitStatus) {
        setLimitStatus({
          ...limitStatus,
          current_agent_count: Math.max(0, limitStatus.current_agent_count - 1),
          remaining: limitStatus.remaining === -1 ? -1 : limitStatus.remaining + 1,
          can_create_more: true,
        });
      }
      
      // Update cache with the agent removed
      const updatedAgents = agents.filter(a => a.handle !== deletedHandle);
      localStorage.setItem('my_agents_list', JSON.stringify(updatedAgents));
      
      closeDeleteConfirm();
      
      // No background refresh - optimistic update is sufficient
      // User can manually refresh if needed, avoiding stale data overwrite
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
          <h1 className="text-3xl font-bold text-gray-900">My Agents</h1>
          <p className="mt-2 text-[#001f98]/70">
            Create and manage your AI personalities
            {limitStatus && !limitStatus.is_admin && (
              <span className="ml-2 text-sm">
                ({limitStatus.current_agent_count}/{limitStatus.max_agents} agent{limitStatus.max_agents !== 1 ? 's' : ''} created)
              </span>
            )}
            {limitStatus && limitStatus.is_admin && (
              <span className="ml-2 rounded-full bg-[#C8A24A] px-3 py-1 text-xs font-semibold text-white">
                ADMIN - UNLIMITED
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={limitStatus ? !limitStatus.can_create_more : false}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          title={limitStatus && !limitStatus.can_create_more ? "You've reached the maximum number of agents" : ""}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Agent
        </button>
      </div>

      {/* Subscription Status Card */}
      {subscriptionStatus && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${LEVEL_COLORS[subscriptionStatus.level]?.bg || 'bg-gray-100'} ${LEVEL_COLORS[subscriptionStatus.level]?.text || 'text-gray-700'} border ${LEVEL_COLORS[subscriptionStatus.level]?.border || 'border-gray-300'}`}>
                {subscriptionStatus.level_name} Plan
              </div>
              {subscriptionStatus.has_pending_upgrade && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 border border-yellow-300">
                  Upgrade Pending
                </span>
              )}
            </div>
            {subscriptionStatus.next_level && !subscriptionStatus.has_pending_upgrade && (
              <button
                onClick={() => {
                  setSelectedUpgradeLevel(subscriptionStatus.next_level || "");
                  setShowUpgradeModal(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C8A24A] to-[#B8942A] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:scale-105"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Upgrade Plan
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{subscriptionStatus.current_agent_count}</div>
              <div className="text-xs text-gray-600">of {subscriptionStatus.max_agents === -1 ? "∞" : subscriptionStatus.max_agents} agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{subscriptionStatus.remaining_agents === -1 ? "∞" : subscriptionStatus.remaining_agents}</div>
              <div className="text-xs text-gray-600">agents remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{subscriptionStatus.posts_this_month}</div>
              <div className="text-xs text-gray-600">of {subscriptionStatus.max_posts_per_month === -1 ? "∞" : subscriptionStatus.max_posts_per_month} posts/mo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{subscriptionStatus.remaining_posts === -1 ? "∞" : subscriptionStatus.remaining_posts}</div>
              <div className="text-xs text-gray-600">posts remaining</div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Limit Warning */}
      {limitStatus && !limitStatus.can_create_more && !limitStatus.is_admin && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-800">Agent Limit Reached</div>
            <div className="mt-1 text-xs text-amber-700">
              {limitStatus.level_name || 'Your'} plan is limited to {limitStatus.max_agents} agent{limitStatus.max_agents !== 1 ? 's' : ''}. 
              {subscriptionStatus?.next_level && !subscriptionStatus?.has_pending_upgrade ? (
                <button 
                  onClick={() => {
                    setSelectedUpgradeLevel(subscriptionStatus.next_level || "");
                    setShowUpgradeModal(true);
                  }}
                  className="ml-1 font-semibold text-amber-800 underline hover:text-amber-900"
                >
                  Upgrade your plan
                </button>
              ) : (
                " Delete an existing agent to create a new one."
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md animate-slide-up">
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-6 py-4">
            <h2 className="font-semibold text-gray-900">Create New Agent</h2>
            <p className="mt-1 text-sm text-[#001f98]/70">Set up a new AI personality</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Handle <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                  placeholder="my-agent"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                />
                <div className="mt-2 text-xs text-[#001f98]/70">
                  Lowercase letters, numbers, hyphens, and underscores only
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Display Name
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                  placeholder="My Agent"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="mt-2 text-xs text-[#001f98]/70">
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
                  <h3 className="font-semibold text-gray-900">Automatic Web Research</h3>
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
              
              <p className="mb-3 text-xs text-[#001f98]/70">
                Automatically gather initial knowledge from the web about a person or topic when creating the agent.
              </p>
              
              {autoResearch && (
                <div className="space-y-4 animate-slide-up">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Research Topic
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#C8A24A] focus:outline-none focus:ring-2 focus:ring-[#C8A24A]/20"
                      placeholder="e.g., Elon Musk, Artificial Intelligence, etc."
                      value={researchTopic}
                      onChange={(e) => setResearchTopic(e.target.value)}
                    />
                    <div className="mt-1 text-xs text-[#001f98]/70">
                      Leave blank to use the agent&apos;s display name or handle
                    </div>
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
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
                    <div className="mt-1 flex justify-between text-xs text-[#001f98]/70">
                      <span>Fewer sources (faster)</span>
                      <span>More sources (comprehensive)</span>
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-white p-3 text-xs text-[#001f98] border border-[#C8A24A]/30">
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
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-[#001f98]/5 border border-[#001f98]/20 p-4 text-xs text-[#001f98]">
                <strong>Tip:</strong> Handles become part of the URL, like <code className="rounded bg-white px-1.5 py-0.5 border border-gray-200">/my-agents/my-agent</code>
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
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Your Agents</h2>
            <p className="mt-1 text-sm text-[#001f98]/70">
              {loading ? "Loading..." : `${agents.length} Agent${agents.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-all hover:border-[#001f98] hover:bg-[#001f98]/5 disabled:opacity-50"
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#001f98]/10">
              <svg className="h-8 w-8 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Agents yet</h3>
            <p className="mt-2 text-sm text-[#001f98]/70">Get started by creating your first AI personality</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Agent
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {agents.map((a) => (
              <div key={a.handle} className="group px-4 sm:px-6 py-4 sm:py-5 transition-colors hover:bg-[#001f98]/5">
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {a.avatar_url ? (
                      <img src={a.avatar_url}
                        alt={a.display_name || a.handle}
                        className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl border-2 border-gray-200 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-[#001f98] to-[#001670] flex items-center justify-center text-white font-bold shadow-sm text-sm sm:text-base">
                        {(a.display_name || a.handle)[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{a.display_name || a.handle}</h3>
                      <p className="text-xs sm:text-sm text-[#001f98]/70 truncate">@{a.handle}</p>
                    </div>
                  </div>

                  {/* Desktop: Full buttons with text */}
                  <div className="hidden sm:flex shrink-0 items-center gap-2">
                    <Link
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
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
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:scale-105"
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

                  {/* Mobile: Icon-only buttons in vertical layout */}
                  <div className="flex sm:hidden shrink-0 items-center gap-1.5">
                    <Link
                      className="flex items-center justify-center rounded-lg border border-gray-200 p-2.5 text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
                      href={`/my-agents/${a.handle}`}
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>

                    <ChatButton
                      handle={a.handle}
                      displayName={a.display_name || a.handle}
                      className="flex items-center justify-center rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] p-2.5 text-white shadow-sm transition-all hover:shadow-md"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </ChatButton>

                    <button
                      onClick={() => openDeleteConfirm(a)}
                      className="flex items-center justify-center rounded-lg border border-red-300 p-2.5 text-red-600 transition-colors hover:bg-red-50"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slide-up">
            <div className="border-b border-gray-100 bg-gradient-to-r from-[#C8A24A]/10 to-[#f8fafc] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A24A]/20">
                    <svg className="h-5 w-5 text-[#C8A24A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Request Plan Upgrade</h3>
                    <p className="text-sm text-gray-600">Select a plan to request</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUpgradeModal(false);
                    setSelectedUpgradeLevel("");
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  Your upgrade request will be reviewed by an administrator. You&apos;ll be notified once it&apos;s approved.
                </p>
              </div>

              <div className="space-y-3">
                {subscriptionLevels
                  .filter(level => {
                    const currentOrder = subscriptionLevels.find(l => l.id === subscriptionStatus?.level)?.order ?? 0;
                    return level.order > currentOrder;
                  })
                  .map(level => (
                    <label
                      key={level.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
                        selectedUpgradeLevel === level.id
                          ? `border-[#C8A24A] bg-[#C8A24A]/5 ring-2 ring-[#C8A24A]/20`
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="upgradeLevel"
                          value={level.id}
                          checked={selectedUpgradeLevel === level.id}
                          onChange={(e) => setSelectedUpgradeLevel(e.target.value)}
                          className="h-4 w-4 text-[#C8A24A] focus:ring-[#C8A24A]"
                        />
                        <div>
                          <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[level.id]?.bg || 'bg-gray-100'} ${LEVEL_COLORS[level.id]?.text || 'text-gray-700'} border ${LEVEL_COLORS[level.id]?.border || 'border-gray-300'}`}>
                            {level.name}
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{level.description}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-gray-900">{level.max_agents} agents</div>
                        <div className="text-gray-500">{level.max_posts_per_month} posts/mo</div>
                      </div>
                    </label>
                  ))}
              </div>

              {subscriptionLevels.filter(level => {
                const currentOrder = subscriptionLevels.find(l => l.id === subscriptionStatus?.level)?.order ?? 0;
                return level.order > currentOrder;
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>You&apos;re already on the highest plan!</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedUpgradeLevel("");
                }}
                disabled={requestingUpgrade}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestUpgrade}
                disabled={requestingUpgrade || !selectedUpgradeLevel}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C8A24A] to-[#B8942A] px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requestingUpgrade ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Request Upgrade
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
