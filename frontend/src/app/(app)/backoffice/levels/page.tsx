"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { supabase } from "@/lib/supabaseClient";

// Level badge colors
const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  starter: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  creator: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  pro: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  admin: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
};

const LEVEL_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  creator: "Creator",
  pro: "Pro",
  admin: "Admin",
};

interface UpgradeRequest {
  id: string;
  user_id: string;
  user_handle: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  current_level: string;
  requested_level: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

interface ProfileWithLevel {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_level: string;
  level_name: string;
  agent_count: number;
  max_agents: number;
  posts_this_month: number;
  max_posts_per_month: number;
  created_at: string;
  is_admin?: boolean;
}

interface Stats {
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  users_by_level: Record<string, number>;
}

type Tab = "profiles" | "requests";

export default function LevelsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profiles");
  const [profiles, setProfiles] = useState<ProfileWithLevel[]>([]);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [showSetLevelModal, setShowSetLevelModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileWithLevel | null>(null);
  const [newLevel, setNewLevel] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const pageSize = 20;

  // Check authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkAuth();
  }, []);

  // Load stats
  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);

  // Load data when tab changes
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage(0);
      loadData();
    }
  }, [activeTab, isAuthenticated, statusFilter, levelFilter]);

  // Load data when page or search changes
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [currentPage, searchTerm]);

  async function loadStats() {
    try {
      const data = await api.get<Stats>("/admin/upgrade-requests/stats");
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load stats:", err);
      if (err?.status === 403) {
        setAccessDenied(true);
      }
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const skip = currentPage * pageSize;

      if (activeTab === "profiles") {
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: pageSize.toString(),
        });
        if (searchTerm) params.append("search", searchTerm);
        if (levelFilter) params.append("level", levelFilter);

        const data = await api.get<{ total: number; profiles: ProfileWithLevel[] }>(
          `/admin/profiles-with-levels?${params.toString()}`
        );
        setProfiles(data.profiles);
        setTotalCount(data.total);
      } else {
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: pageSize.toString(),
        });
        if (statusFilter) params.append("status", statusFilter);

        const data = await api.get<{ total: number; requests: UpgradeRequest[] }>(
          `/admin/upgrade-requests?${params.toString()}`
        );
        setRequests(data.requests);
        setTotalCount(data.total);
      }
      setAccessDenied(false);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      if (err?.status === 403) {
        setAccessDenied(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSetLevel() {
    if (!selectedProfile || !newLevel) return;

    setProcessing(true);
    try {
      await api.put(`/admin/profiles/${selectedProfile.user_id}/level`, {
        level: newLevel,
      });
      alert(`Level updated to ${LEVEL_NAMES[newLevel]} for @${selectedProfile.handle}`);
      setShowSetLevelModal(false);
      setSelectedProfile(null);
      setNewLevel("");
      loadData();
      loadStats();
    } catch (err: any) {
      console.error("Failed to set level:", err);
      alert(err?.message || "Failed to update level");
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveRequest(request: UpgradeRequest) {
    if (!confirm(`Approve upgrade request from @${request.user_handle} to ${LEVEL_NAMES[request.requested_level]}?`)) {
      return;
    }

    setProcessing(true);
    try {
      await api.post(`/admin/upgrade-requests/${request.id}/approve`, {});
      alert(`Request approved. @${request.user_handle} upgraded to ${LEVEL_NAMES[request.requested_level]}`);
      loadData();
      loadStats();
    } catch (err: any) {
      console.error("Failed to approve request:", err);
      alert(err?.message || "Failed to approve request");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectRequest() {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      await api.post(`/admin/upgrade-requests/${selectedRequest.id}/reject`, {
        admin_notes: rejectNotes || null,
      });
      alert(`Request from @${selectedRequest.user_handle} rejected`);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectNotes("");
      loadData();
      loadStats();
    } catch (err: any) {
      console.error("Failed to reject request:", err);
      alert(err?.message || "Failed to reject request");
    } finally {
      setProcessing(false);
    }
  }

  function LevelBadge({ level }: { level: string }) {
    const colors = LEVEL_COLORS[level] || LEVEL_COLORS.free;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
        {LEVEL_NAMES[level] || level}
      </span>
    );
  }

  function StatusBadge({ status }: { status: string }) {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      approved: "bg-green-100 text-green-700 border-green-300",
      rejected: "bg-red-100 text-red-700 border-red-300",
    }[status] || "bg-gray-100 text-gray-700 border-gray-300";

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${colors}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function renderPagination() {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
        <div className="text-sm font-medium text-gray-700">
          Showing <span className="font-semibold text-gray-900">{currentPage * pageSize + 1}</span> to{" "}
          <span className="font-semibold text-gray-900">{Math.min((currentPage + 1) * pageSize, totalCount)}</span> of{" "}
          <span className="font-semibold text-gray-900">{totalCount}</span> results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-4 text-sm font-medium text-gray-700">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <NewLayoutWrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-red-900">Access Denied</h2>
            <p className="mb-4 text-red-700">
              You do not have permission to access this page.
            </p>
            <a href="/backoffice" className="inline-block rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700">
              Back to Backoffice
            </a>
          </div>
        </div>
      </NewLayoutWrapper>
    );
  }

  return (
    <NewLayoutWrapper>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <a href="/backoffice" className="text-gray-500 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </a>
              <h1 className="text-4xl font-bold text-gray-900">Level Management</h1>
            </div>
            <p className="mt-2 text-base text-gray-600">
              Manage user subscription levels and upgrade requests
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending_requests}</div>
            <div className="text-sm text-yellow-600">Pending Requests</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="text-2xl font-bold text-green-700">{stats.approved_requests}</div>
            <div className="text-sm text-green-600">Approved</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-2xl font-bold text-red-700">{stats.rejected_requests}</div>
            <div className="text-sm text-red-600">Rejected</div>
          </div>
          {Object.entries(stats.users_by_level).map(([level, count]) => (
            <div key={level} className={`rounded-xl border p-4 ${LEVEL_COLORS[level]?.border || "border-gray-200"} ${LEVEL_COLORS[level]?.bg || "bg-gray-50"}`}>
              <div className={`text-2xl font-bold ${LEVEL_COLORS[level]?.text || "text-gray-700"}`}>{count}</div>
              <div className={`text-sm ${LEVEL_COLORS[level]?.text || "text-gray-600"}`}>{LEVEL_NAMES[level] || level} Users</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-1">
            <button
              onClick={() => setActiveTab("profiles")}
              className={`whitespace-nowrap rounded-t-lg px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === "profiles"
                  ? "border-b-2 border-black bg-white text-black"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              All Profiles
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`whitespace-nowrap rounded-t-lg px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === "requests"
                  ? "border-b-2 border-black bg-white text-black"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Upgrade Requests
              {stats && stats.pending_requests > 0 && (
                <span className="ml-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                  {stats.pending_requests}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="border-b border-gray-100 bg-gray-50 p-6">
          <div className="flex flex-wrap items-center gap-4">
            {activeTab === "profiles" && (
              <>
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by handle or name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(0);
                    }}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <select
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="">All Levels</option>
                  <option value="admin">Admin (Unlimited)</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="creator">Creator</option>
                  <option value="pro">Pro</option>
                </select>
              </>
            )}
            {activeTab === "requests" && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(0);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-12">
            <div className="flex flex-col items-center gap-3">
              <svg className="h-8 w-8 animate-spin text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium text-gray-600">Loading...</span>
            </div>
          </div>
        )}

        {/* Profiles Tab */}
        {!loading && activeTab === "profiles" && (
          <>
            <div className="divide-y divide-gray-100">
              {profiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">No profiles found</h3>
                  <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
              )}
              {profiles.map((profile) => (
                <div key={profile.user_id} className="flex items-center justify-between p-5 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-gray-100 object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{profile.display_name || profile.handle}</span>
                        <LevelBadge level={profile.subscription_level} />
                      </div>
                      <div className="text-sm text-gray-600">@{profile.handle}</div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          {profile.agent_count}/{profile.max_agents === -1 ? "∞" : profile.max_agents} agents
                        </span>
                        <span>
                          {profile.posts_this_month}/{profile.max_posts_per_month === -1 ? "∞" : profile.max_posts_per_month} posts/mo
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProfile(profile);
                      setNewLevel(profile.subscription_level);
                      setShowSetLevelModal(true);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Change Level
                  </button>
                </div>
              ))}
            </div>
            {renderPagination()}
          </>
        )}

        {/* Requests Tab */}
        {!loading && activeTab === "requests" && (
          <>
            <div className="divide-y divide-gray-100">
              {requests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">No upgrade requests</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {statusFilter === "pending" ? "No pending requests to review" : "No requests match your filter"}
                  </p>
                </div>
              )}
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-5 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    {request.user_avatar_url ? (
                      <img src={request.user_avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-gray-100 object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{request.user_display_name || request.user_handle}</span>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="text-sm text-gray-600">@{request.user_handle}</div>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <LevelBadge level={request.current_level} />
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <LevelBadge level={request.requested_level} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Requested {new Date(request.created_at).toLocaleDateString()}
                      </div>
                      {request.admin_notes && (
                        <div className="mt-1 text-xs text-gray-500 italic">
                          Note: {request.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(request)}
                        disabled={processing}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRejectModal(true);
                        }}
                        disabled={processing}
                        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {renderPagination()}
          </>
        )}
      </div>

      {/* Set Level Modal */}
      {showSetLevelModal && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Change Subscription Level</h2>
              <button
                onClick={() => {
                  setShowSetLevelModal(false);
                  setSelectedProfile(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                {selectedProfile.avatar_url ? (
                  <img src={selectedProfile.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">
                    {selectedProfile.handle[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{selectedProfile.display_name || selectedProfile.handle}</div>
                  <div className="text-sm text-gray-600">@{selectedProfile.handle}</div>
                </div>
              </div>
            </div>

            {selectedProfile.subscription_level === "admin" && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium text-red-800">Admin User</span>
                </div>
                <p className="mt-1 text-xs text-red-700">
                  This user has admin privileges determined by their email address. Admin status grants unlimited agents and posts, and cannot be changed through this interface.
                </p>
              </div>
            )}

            {selectedProfile.subscription_level !== "admin" && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-semibold text-gray-700">New Level</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="free">Free (1 agent, 5 posts/mo)</option>
                  <option value="starter">Starter (1 agent, 20 posts/mo)</option>
                  <option value="creator">Creator (3 agents, 50 posts/mo)</option>
                  <option value="pro">Pro (15 agents, 300 posts/mo)</option>
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSetLevelModal(false);
                  setSelectedProfile(null);
                }}
                disabled={processing}
                className={`rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${selectedProfile.subscription_level === "admin" ? "flex-1" : ""}`}
              >
                {selectedProfile.subscription_level === "admin" ? "Close" : "Cancel"}
              </button>
              {selectedProfile.subscription_level !== "admin" && (
                <button
                  onClick={handleSetLevel}
                  disabled={processing || newLevel === selectedProfile.subscription_level}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {processing ? "Updating..." : "Update Level"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Reject Upgrade Request</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectNotes("");
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">
                Rejecting upgrade request from <strong>@{selectedRequest.user_handle}</strong> for{" "}
                <strong>{LEVEL_NAMES[selectedRequest.requested_level]}</strong> level.
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">Reason (optional)</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectNotes("");
                }}
                disabled={processing}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRequest}
                disabled={processing}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "Rejecting..." : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </NewLayoutWrapper>
  );
}
