"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { supabase } from "@/lib/supabaseClient";
import dynamic from 'next/dynamic';

// Dynamically import auto-posts page
const AutoPostsContent = dynamic(() => import('./auto-posts/page'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Auto Post Generator...</p>
      </div>
    </div>
  ),
});

interface SystemStats {
  total: {
    profiles: number;
    agents: number;
    documents: number;
    conversations: number;
    messages: number;
    followers: number;
  };
  recent_7_days: {
    profiles: number;
    agents: number;
    conversations: number;
  };
}

interface Profile {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  agent_count: number;
}

interface Agent {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  owner: {
    user_id: string;
    handle: string;
    display_name: string | null;
  };
  follower_count: number;
  document_count: number;
}

interface Document {
  id: string;
  title: string | null;
  layer: string;
  source: string | null;
  content_preview: string;
  content_length: number;
  chunk_count: number;
  created_at: string;
  agent: {
    id: string;
    handle: string;
    display_name: string | null;
  } | null;
}

interface Conversation {
  id: string;
  title: string | null;
  layer_used: string;
  message_count: number;
  created_at: string;
  agent: {
    id: string;
    handle: string;
    display_name: string | null;
  } | null;
}

type Tab = "dashboard" | "profiles" | "agents" | "documents" | "conversations" | "auto-posts";

export default function BackofficePage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [createProfileData, setCreateProfileData] = useState({
    handle: "",
    display_name: "",
    email: "",
  });
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({
    user_id: "",
    handle: "",
    new_password: "",
    confirm_password: "",
  });
  const [resettingPassword, setResettingPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pageSize = 20;

  // Check authentication before loading any data
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

  // Load dashboard stats (only if authenticated)
  useEffect(() => {
    if (isAuthenticated && activeTab === "dashboard") {
      loadStats();
    }
  }, [activeTab, isAuthenticated]);

  // Load data when tab changes (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage(0);
      setSearchTerm("");
      loadTabData();
    }
  }, [activeTab, isAuthenticated]);

  // Load data when page changes (only if authenticated)
  useEffect(() => {
    if (isAuthenticated && activeTab !== "dashboard") {
      loadTabData();
    }
  }, [currentPage, searchTerm, isAuthenticated]);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await api.get<SystemStats>("/admin/stats");
      setStats(data);
      setAccessDenied(false); // Reset access denied if successful
    } catch (err: any) {
      console.error("Failed to load stats:", err);
      if (err?.status === 403 || err?.message?.includes("403")) {
        setAccessDenied(true);
      } else if (err?.status === 401 || err?.message?.includes("401")) {
        // Session expired - will be handled by apiFetch redirect
        console.log("[Backoffice] Session expired, redirecting to login...");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTabData() {
    if (activeTab === "dashboard") return;

    setLoading(true);
    try {
      const skip = currentPage * pageSize;

      switch (activeTab) {
        case "profiles": {
          const data = await api.get<{ total: number; profiles: Profile[] }>(
            `/admin/profiles?skip=${skip}&limit=${pageSize}&search=${searchTerm}`
          );
          setProfiles(data.profiles);
          setTotalCount(data.total);
          break;
        }
        case "agents": {
          const data = await api.get<{ total: number; agents: Agent[] }>(
            `/admin/agents?skip=${skip}&limit=${pageSize}&search=${searchTerm}`
          );
          setAgents(data.agents);
          setTotalCount(data.total);
          break;
        }
        case "documents": {
          const data = await api.get<{ total: number; documents: Document[] }>(
            `/admin/documents?skip=${skip}&limit=${pageSize}`
          );
          setDocuments(data.documents);
          setTotalCount(data.total);
          break;
        }
        case "conversations": {
          const data = await api.get<{
            total: number;
            conversations: Conversation[];
          }>(`/admin/conversations?skip=${skip}&limit=${pageSize}`);
          setConversations(data.conversations);
          setTotalCount(data.total);
          break;
        }
      }
      setAccessDenied(false); // Reset access denied if successful
    } catch (err: any) {
      console.error(`Failed to load ${activeTab}:`, err);
      if (err?.status === 403 || err?.message?.includes("403")) {
        setAccessDenied(true);
      } else if (err?.status === 401 || err?.message?.includes("401")) {
        // Session expired - will be handled by apiFetch redirect
        console.log("[Backoffice] Session expired, redirecting to login...");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProfile() {
    if (!createProfileData.handle || !createProfileData.email) {
      alert("Handle and email are required");
      return;
    }

    setCreatingProfile(true);
    try {
      await api.post("/admin/profiles/create", createProfileData);
      alert("Profile created successfully");
      setShowCreateProfileModal(false);
      setCreateProfileData({ handle: "", display_name: "", email: "" });
      loadTabData(); // Reload profiles
    } catch (err: any) {
      console.error("Failed to create profile:", err);
      
      // Better error message for common issues
      let errorMessage = "Failed to create profile: ";
      if (err?.message?.includes("Supabase configuration missing")) {
        errorMessage += "Backend configuration error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in backend/.env";
      } else if (err?.message?.includes("already exists")) {
        errorMessage += "This handle or email is already in use.";
      } else {
        errorMessage += err?.message || "Unknown error";
      }
      
      alert(errorMessage);
    } finally {
      setCreatingProfile(false);
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordData.new_password || resetPasswordData.new_password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (resetPasswordData.new_password !== resetPasswordData.confirm_password) {
      alert("Passwords do not match");
      return;
    }

    setResettingPassword(true);
    try {
      await api.post(`/admin/profiles/${resetPasswordData.user_id}/reset-password`, {
        user_id: resetPasswordData.user_id,
        new_password: resetPasswordData.new_password,
      });
      alert(`Password reset successfully for @${resetPasswordData.handle}`);
      setShowResetPasswordModal(false);
      setResetPasswordData({ user_id: "", handle: "", new_password: "", confirm_password: "" });
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      
      let errorMessage = "Failed to reset password: ";
      if (err?.message?.includes("Supabase configuration missing")) {
        errorMessage += "Backend configuration error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in backend/.env";
      } else {
        errorMessage += err?.message || "Unknown error";
      }
      
      alert(errorMessage);
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleDelete(type: string, id: string) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      await api.delete(`/admin/${type}/${id}`);
      alert(`${type} deleted successfully`);
      loadTabData();
      if (activeTab === "dashboard") loadStats();
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
      alert(`Failed to delete ${type}`);
    }
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
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span className="flex items-center px-4 text-sm font-medium text-gray-700">
            Page <span className="mx-1 font-semibold text-gray-900">{currentPage + 1}</span> of{" "}
            <span className="ml-1 font-semibold text-gray-900">{totalPages}</span>
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            Next
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Show access denied message if user doesn't have permission
  if (accessDenied) {
    return (
      <NewLayoutWrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <svg
                className="h-16 w-16 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-red-900">Access Denied</h2>
            <p className="mb-4 text-red-700">
              You do not have permission to access the backoffice. This area is restricted to authorized administrators only.
            </p>
            <a
              href="/"
              className="inline-block rounded-lg bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700"
            >
              Return to Home
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
            <h1 className="text-4xl font-bold text-gray-900">Backoffice Dashboard</h1>
            <p className="mt-2 text-base text-gray-600">
              Manage profiles, agents, documents, and conversations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/backoffice/diagnostic"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Diagnostic Tool
            </a>
            <a
              href="/backoffice/app-settings"
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              App Settings
            </a>
          </div>
        </div>
      </div>

          {/* Tabs */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-1">
                {(
                  [
                    "dashboard",
                    "profiles",
                    "agents",
                    "documents",
                    "conversations",
                    "auto-posts",
                  ] as Tab[]
                ).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      "whitespace-nowrap rounded-t-lg px-6 py-3 text-sm font-semibold capitalize transition-all",
                      activeTab === tab
                        ? "border-b-2 border-black bg-white text-black"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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

            {/* Dashboard Tab */}
            {!loading && activeTab === "dashboard" && stats && (
              <div className="p-8">
                <h2 className="mb-6 text-2xl font-bold text-gray-900">System Overview</h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Profiles Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-blue-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-blue-900">Profiles</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-blue-900">
                          {stats.total.profiles}
                        </div>
                        {stats.recent_7_days.profiles > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            +{stats.recent_7_days.profiles} this week
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Agents Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-purple-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-purple-900">Agents</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-purple-900">
                          {stats.total.agents}
                        </div>
                        {stats.recent_7_days.agents > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-purple-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            +{stats.recent_7_days.agents} this week
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Documents Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-green-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-green-900">Documents</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-green-900">
                          {stats.total.documents}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conversations Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50 to-amber-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-amber-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-amber-900">Conversations</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-amber-900">
                          {stats.total.conversations}
                        </div>
                        {stats.recent_7_days.conversations > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            +{stats.recent_7_days.conversations} this week
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-rose-50 to-rose-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-rose-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-rose-900">Messages</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-rose-900">
                          {stats.total.messages}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Followers Card */}
                  <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-indigo-600 p-2">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-indigo-900">Followers</div>
                        </div>
                        <div className="mt-3 text-3xl font-bold text-indigo-900">
                          {stats.total.followers}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Profiles Tab */}
            {!loading && activeTab === "profiles" && (
              <>
                <div className="border-b border-gray-100 bg-gray-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search profiles by handle or name..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(0);
                        }}
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <button
                      onClick={() => setShowCreateProfileModal(true)}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Profile
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {profiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="rounded-full bg-gray-100 p-6">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900">No profiles found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {searchTerm ? "Try adjusting your search terms" : "There are no profiles in the system yet"}
                      </p>
                    </div>
                  )}
                  {profiles.map((profile) => (
                    <div
                      key={profile.user_id}
                      className="flex items-center justify-between p-5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url}
                            alt=""
                            className="h-12 w-12 rounded-full border-2 border-gray-100 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">
                            {profile.display_name || profile.handle}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>@{profile.handle}</span>
                            <span className="text-gray-400">•</span>
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {profile.agent_count} agents
                            </span>
                          </div>
                          {profile.bio && (
                            <div className="mt-1 text-xs text-gray-500 line-clamp-1">
                              {profile.bio}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`/u/${profile.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 hover:border-blue-300"
                          title="View Profile Dashboard"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </a>
                        <button
                          onClick={() => {
                            setResetPasswordData({
                              user_id: profile.user_id,
                              handle: profile.handle,
                              new_password: "",
                              confirm_password: "",
                            });
                            setShowResetPasswordModal(true);
                          }}
                          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-all hover:bg-amber-100 hover:border-amber-300"
                          title="Reset Password"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Reset Password
                        </button>
                        <button
                          onClick={() =>
                            handleDelete("profiles", profile.user_id)
                          }
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination()}
              </>
            )}

            {/* Agents Tab */}
            {!loading && activeTab === "agents" && (
              <>
                <div className="border-b border-gray-100 bg-gray-50 p-6">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search agents by handle or name..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(0);
                      }}
                      className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {agents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="rounded-full bg-gray-100 p-6">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900">No agents found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {searchTerm ? "Try adjusting your search terms" : "There are no agents in the system yet"}
                      </p>
                    </div>
                  )}
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        {agent.avatar_url ? (
                          <img src={agent.avatar_url}
                            alt=""
                            className="h-12 w-12 rounded-full border-2 border-gray-100 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">
                            {agent.display_name || agent.handle}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>@{agent.handle}</span>
                            <span className="text-gray-400">•</span>
                            <span>by @{agent.owner.handle}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              {agent.follower_count} followers
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {agent.document_count} documents
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete("agents", agent.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination()}
              </>
            )}

            {/* Documents Tab */}
            {!loading && activeTab === "documents" && (
              <>
                <div className="divide-y divide-gray-100">
                  {documents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="rounded-full bg-gray-100 p-6">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900">No documents found</h3>
                      <p className="mt-1 text-sm text-gray-500">There are no documents in the system yet</p>
                    </div>
                  )}
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start justify-between p-5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex flex-1 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-400 to-green-600">
                          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">
                            {doc.title || "Untitled Document"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                              {doc.layer}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {doc.content_length.toLocaleString()} chars
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              {doc.chunk_count} chunks
                            </span>
                          </div>
                          {doc.agent && (
                            <div className="mt-1 text-xs text-gray-500">
                              Agent: <span className="font-medium">@{doc.agent.handle}</span>
                            </div>
                          )}
                          {doc.source && (
                            <div className="mt-1 text-xs text-gray-500">
                              Source: <span className="font-medium">{doc.source}</span>
                            </div>
                          )}
                          <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {doc.content_preview}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 shrink-0">
                        <button
                          onClick={() => handleDelete("documents", doc.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination()}
              </>
            )}

            {/* Conversations Tab */}
            {!loading && activeTab === "conversations" && (
              <>
                <div className="divide-y divide-gray-100">
                  {conversations.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="rounded-full bg-gray-100 p-6">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900">No conversations found</h3>
                      <p className="mt-1 text-sm text-gray-500">There are no conversations in the system yet</p>
                    </div>
                  )}
                  {conversations.map((convo) => (
                    <div
                      key={convo.id}
                      className="flex items-start justify-between p-5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex flex-1 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600">
                          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">
                            {convo.title || "Untitled Conversation"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              {convo.message_count} messages
                            </span>
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                              {convo.layer_used}
                            </span>
                          </div>
                          {convo.agent && (
                            <div className="mt-1 text-xs text-gray-500">
                              Agent: <span className="font-medium">@{convo.agent.handle}</span>
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(convo.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <button
                          onClick={() =>
                            handleDelete("conversations", convo.id)
                          }
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination()}
              </>
            )}

            {/* Auto Posts Tab */}
            {activeTab === "auto-posts" && (
              <div className="mt-6">
                <AutoPostsContent />
              </div>
            )}
          </div>

      {/* Create Profile Modal */}
      {showCreateProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Create New Profile</h2>
              <button
                onClick={() => {
                  setShowCreateProfileModal(false);
                  setCreateProfileData({ handle: "", display_name: "", email: "" });
                }}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Handle <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createProfileData.handle}
                  onChange={(e) =>
                    setCreateProfileData({ ...createProfileData, handle: e.target.value })
                  }
                  placeholder="johndoe"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-gray-500">Unique username for the profile</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  value={createProfileData.display_name}
                  onChange={(e) =>
                    setCreateProfileData({ ...createProfileData, display_name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createProfileData.email}
                  onChange={(e) =>
                    setCreateProfileData({ ...createProfileData, email: e.target.value })
                  }
                  placeholder="john@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email verification will be skipped for admin-created accounts
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateProfileModal(false);
                  setCreateProfileData({ handle: "", display_name: "", email: "" });
                }}
                disabled={creatingProfile}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={creatingProfile}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingProfile ? "Creating..." : "Create Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordData({ user_id: "", handle: "", new_password: "", confirm_password: "" });
                }}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Resetting password for:</p>
                  <p className="mt-1">@{resetPasswordData.handle}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={resetPasswordData.new_password}
                  onChange={(e) =>
                    setResetPasswordData({ ...resetPasswordData, new_password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  minLength={6}
                />
                <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={resetPasswordData.confirm_password}
                  onChange={(e) =>
                    setResetPasswordData({ ...resetPasswordData, confirm_password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  minLength={6}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordData({ user_id: "", handle: "", new_password: "", confirm_password: "" });
                }}
                disabled={resettingPassword}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resettingPassword ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </NewLayoutWrapper>
  );
}

