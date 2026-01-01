"use client";

import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

async function getToken(): Promise<string> {
  // First, try to get the current session
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    // Don't log "Invalid Refresh Token" errors as they're expected when user is not logged in
    if (!error.message?.includes("Refresh Token")) {
      console.error("[API] Error getting session:", error);
    }
    throw new Error(error.message);
  }

  // If no session, user is not logged in
  if (!data.session) {
    throw new Error("Not logged in (no session)");
  }

  // Check if token is expired or about to expire (within 60 seconds)
  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  
  if (expiresAt && expiresAt - now < 60) {
    console.log("[API] Token expiring soon, attempting refresh...");
    
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      console.error("[API] Token refresh failed:", refreshError);
      // If refresh fails, the session is truly expired
      throw new Error("Session expired (refresh failed)");
    }
    
    console.log("[API] Token refreshed successfully");
    return refreshData.session.access_token;
  }

  return data.session.access_token;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 15000
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    // Give a clearer message on timeout
    if (e?.name === "AbortError") {
      throw new Error("Request timeout. Is the backend running?");
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

export async function apiFetch(path: string, init?: RequestInit) {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  // Bubble status code in error so pages can handle 404/401 cleanly
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    
    // If we get 401 Unauthorized, the token is invalid - sign out and redirect to login
    if (res.status === 401) {
      console.error("[API] 401 Unauthorized - Session expired or invalid. Signing out...");
      // Sign out and redirect to login (but don't await to avoid blocking the error)
      supabase.auth.signOut().then(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      });
    }
    
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export async function getMyProfile() {
  try {
    return await apiFetch("/me/profile", { method: "GET" });
  } catch (e: any) {
    // 404 is normal for "profile not created yet"
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function saveMyProfile(params: {
  handle: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}) {
  return apiFetch("/me/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: params.handle,
      display_name: params.display_name || null,
      bio: params.bio || null,
      avatar_url: params.avatar_url || null,
      location: params.location || null,
      latitude: params.latitude || null,
      longitude: params.longitude || null,
      timezone: params.timezone || null,
    }),
  });
}

export async function deleteMyAccount() {
  return apiFetch("/me/account", { method: "DELETE" });
}

export async function getMyAgents() {
  return apiFetch("/me/avees", { method: "GET" });
}

export async function getAgentLimitStatus() {
  return apiFetch("/me/agent-limit-status", { method: "GET" });
}

export async function createAgent(params: { 
  handle: string; 
  display_name?: string;
  auto_research?: boolean;
  research_topic?: string;
  research_max_sources?: number;
  research_layer?: "public" | "friends" | "intimate";
}) {
  const q = new URLSearchParams();
  q.set("handle", params.handle);
  if (params.display_name) q.set("display_name", params.display_name);
  if (params.auto_research !== undefined) q.set("auto_research", params.auto_research.toString());
  if (params.research_topic) q.set("research_topic", params.research_topic);
  if (params.research_max_sources) q.set("research_max_sources", params.research_max_sources.toString());
  if (params.research_layer) q.set("research_layer", params.research_layer);

  const url = `/avees?${q.toString()}`;
  
  // Use longer timeout for agent creation with web research (90 seconds)
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetchWithTimeout(`${API_BASE}${url}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  }, 90000); // 90 second timeout for web research

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export async function getAgentByHandle(handle: string) {
  return apiFetch(`/avees/${encodeURIComponent(handle)}`, { method: "GET" });
}

export async function updateAgent(params: { 
  agentId: string; 
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  persona?: string;
}) {
  return apiFetch(`/avees/${params.agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: params.display_name !== undefined ? params.display_name : undefined,
      bio: params.bio !== undefined ? params.bio : undefined,
      avatar_url: params.avatar_url !== undefined ? params.avatar_url : undefined,
      persona: params.persona !== undefined ? params.persona : undefined,
    }),
  });
}


export async function addTrainingDocument(params: {
  agentId: string;
  layer: "public" | "friends" | "intimate";
  title?: string;
  source?: string;
  content: string;
}) {
  const q = new URLSearchParams();
  q.set("layer", params.layer);
  if (params.title) q.set("title", params.title);
  if (params.source) q.set("source", params.source);
  q.set("content", params.content);

  return apiFetch(`/avees/${params.agentId}/documents?${q.toString()}`, {
    method: "POST",
  });
}

export async function setAgentPermission(params: {
  agentId: string;
  viewerHandle: string;
  maxLayer: "public" | "friends" | "intimate";
}) {
  const q = new URLSearchParams();
  q.set("viewer_handle", params.viewerHandle);
  q.set("max_layer", params.maxLayer);

  return apiFetch(`/avees/${params.agentId}/permissions?${q.toString()}`, {
    method: "POST",
  });
}

export async function chatAsk(params: {
  agentHandle: string;
  question: string;
  layer?: "public" | "friends" | "intimate";
}) {
  const q = new URLSearchParams();
  q.set("handle", params.agentHandle);
  if (params.layer) q.set("layer", params.layer);
  q.set("question", params.question);

  return apiFetch(`/chat/ask?${q.toString()}`, { method: "POST" });
}

export async function listAgentPermissions(agentId: string) {
  return apiFetch(`/avees/${agentId}/permissions`, { method: "GET" });
}

export async function deleteAgentPermission(params: {
  agentId: string;
  viewerUserId: string;
}) {
  const q = new URLSearchParams();
  q.set("viewer_user_id", params.viewerUserId);
  return apiFetch(`/avees/${params.agentId}/permissions?${q.toString()}`, {
    method: "DELETE",
  });
}

// Feed API functions
export async function getFeed(params?: { limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  
  const url = `/feed${query.toString() ? `?${query.toString()}` : ""}`;
  return apiFetch(url, { method: "GET" });
}

export async function markUpdatesAsRead(updateIds: string[]) {
  return apiFetch("/feed/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ update_ids: updateIds }),
  });
}

export async function getAgentUpdatesForFeed(agentId: string) {
  return apiFetch(`/feed/agent/${agentId}/updates`, { method: "GET" });
}

export async function markAllAgentUpdatesAsRead(agentId: string) {
  return apiFetch(`/feed/agent/${agentId}/mark-all-read`, {
    method: "POST",
  });
}

// REST-style API wrapper for easier usage
export const api = {
  get: async <T = any>(path: string): Promise<T> => {
    return apiFetch(path, { method: "GET" });
  },
  post: async <T = any>(path: string, body?: any): Promise<T> => {
    return apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  patch: async <T = any>(path: string, body?: any): Promise<T> => {
    return apiFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put: async <T = any>(path: string, body?: any): Promise<T> => {
    return apiFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete: async <T = any>(path: string): Promise<T> => {
    return apiFetch(path, { method: "DELETE" });
  },
};


// =====================================
// POSTS API
// =====================================

export type PostData = {
  id: string;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  post_type: string;
  ai_metadata: Record<string, any>;
  visibility: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  user_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatePostData = {
  title?: string;
  description?: string;
  image_url: string;
  post_type?: string;
  ai_metadata?: Record<string, any>;
  visibility?: string;
};

export async function getPosts(userHandle?: string, limit = 20, offset = 0): Promise<{ posts: PostData[] }> {
  const params = new URLSearchParams();
  if (userHandle) params.set("user_handle", userHandle);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  
  return api.get(`/posts?${params.toString()}`);
}

export async function getPost(postId: string): Promise<PostData> {
  return api.get(`/posts/${postId}`);
}

export async function createPost(data: CreatePostData): Promise<{ id: string; message: string }> {
  return api.post("/posts", data);
}

export async function updatePost(
  postId: string,
  data: { title?: string; description?: string; visibility?: string }
): Promise<{ message: string }> {
  return api.put(`/posts/${postId}`, data);
}

export async function deletePost(postId: string): Promise<{ message: string }> {
  return api.delete(`/posts/${postId}`);
}

export async function likePost(postId: string): Promise<{ message: string }> {
  return api.post(`/posts/${postId}/like`, {});
}

export async function unlikePost(postId: string): Promise<{ message: string }> {
  return api.delete(`/posts/${postId}/like`);
}

export async function sharePost(postId: string, shareType = "repost", comment?: string): Promise<{ id: string; message: string }> {
  const params = new URLSearchParams();
  params.set("share_type", shareType);
  if (comment) params.set("comment", comment);
  
  return api.post(`/posts/${postId}/share?${params.toString()}`, {});
}
