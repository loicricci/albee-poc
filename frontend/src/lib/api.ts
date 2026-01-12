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
  branding_guidelines?: string;
  // Logo watermark settings
  logo_enabled?: boolean;
  logo_url?: string;
  logo_position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  logo_size?: string; // 5-100 percentage as string
  // Auto-post topic personalization
  preferred_topics?: string; // Comma-separated topics
  location?: string; // Agent's location context
}) {
  return apiFetch(`/avees/${params.agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: params.display_name !== undefined ? params.display_name : undefined,
      bio: params.bio !== undefined ? params.bio : undefined,
      avatar_url: params.avatar_url !== undefined ? params.avatar_url : undefined,
      persona: params.persona !== undefined ? params.persona : undefined,
      branding_guidelines: params.branding_guidelines !== undefined ? params.branding_guidelines : undefined,
      // Logo watermark settings
      logo_enabled: params.logo_enabled !== undefined ? params.logo_enabled : undefined,
      logo_url: params.logo_url !== undefined ? params.logo_url : undefined,
      logo_position: params.logo_position !== undefined ? params.logo_position : undefined,
      logo_size: params.logo_size !== undefined ? params.logo_size : undefined,
      // Auto-post topic personalization
      preferred_topics: params.preferred_topics !== undefined ? params.preferred_topics : undefined,
      location: params.location !== undefined ? params.location : undefined,
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

// ========== Notifications API ==========

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
  notification_type?: string;
}) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  if (params?.unread_only) query.set("unread_only", "true");
  if (params?.notification_type) query.set("notification_type", params.notification_type);
  
  const queryString = query.toString();
  const path = `/notifications/${queryString ? `?${queryString}` : ""}`;
  
  // Use extended timeout (30s) for notifications - they can be slow due to DB contention
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  }, 30000); // 30 second timeout

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function getUnreadNotificationCount() {
  return apiFetch("/notifications/unread-count", { method: "GET" });
}

export async function getUnreadMessagesCount() {
  return apiFetch("/messaging/unread-count", { method: "GET" });
}

export async function markNotificationsRead(notificationIds: string[]) {
  return apiFetch("/notifications/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notification_ids: notificationIds }),
  });
}

export async function markAllNotificationsRead() {
  return apiFetch("/notifications/mark-all-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function deleteNotification(notificationId: string) {
  return apiFetch(`/notifications/${notificationId}`, {
    method: "DELETE",
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

// =====================================
// TWITTER INTEGRATION
// =====================================

export type TwitterConfig = {
  connected: boolean;
  twitter_username?: string;
  twitter_display_name?: string;
  twitter_user_id?: string;
  created_at?: string;
};

export type TwitterOAuthInit = {
  auth_url: string;
  state: string;
  oauth_token?: string;
  oauth_token_secret?: string;
};

export async function initiateTwitterOAuth(): Promise<TwitterOAuthInit> {
  return api.get("/twitter/oauth/initiate");
}

export async function getTwitterConfig(): Promise<TwitterConfig> {
  return api.get("/twitter/config");
}

export async function disconnectTwitter(): Promise<{ success: boolean; message: string }> {
  return api.delete("/twitter/config");
}

export async function getTwitterStatus(): Promise<{
  server_configured: boolean;
  user_connected: boolean;
  config?: TwitterConfig;
}> {
  return api.get("/twitter/status");
}

export async function updateAgentTwitterSettings(
  agentId: string,
  enabled: boolean,
  postingMode: 'auto' | 'manual'
): Promise<{ ok: boolean; twitter_sharing_enabled: boolean; twitter_posting_mode: string }> {
  const params = new URLSearchParams();
  params.set("enabled", enabled.toString());
  params.set("posting_mode", postingMode);
  
  return api.put(`/avees/${agentId}/twitter-settings?${params.toString()}`, {});
}

export async function postToTwitter(postId: string): Promise<{ success: boolean; twitter_url: string; tweet_id: string }> {
  return api.post(`/posts/${postId}/post-to-twitter`, {});
}

export async function getPostTwitterStatus(postId: string): Promise<{
  can_post: boolean;
  reason?: string;
  twitter_url?: string;
}> {
  return api.get(`/posts/${postId}/twitter-status`);
}

export async function getPendingTwitterPosts(limit = 20): Promise<{ posts: PostData[]; total: number }> {
  return api.get(`/posts/pending-twitter?limit=${limit}`);
}

// =====================================
// COMMENTS API
// =====================================

export type CommentData = {
  id: string;
  post_id: string;
  user_id: string;
  user_handle: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  content: string;
  parent_comment_id: string | null;
  like_count: number;
  reply_count: number;
  user_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

export async function getComments(postId: string, limit = 50, offset = 0): Promise<{ comments: CommentData[] }> {
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  
  return api.get(`/posts/${postId}/comments?${params.toString()}`);
}

export async function createComment(
  postId: string,
  content: string,
  parentCommentId?: string
): Promise<{ id: string; message: string }> {
  return api.post(`/posts/${postId}/comments`, {
    content,
    parent_comment_id: parentCommentId || null,
  });
}

export async function deleteComment(commentId: string): Promise<{ message: string }> {
  return api.delete(`/comments/${commentId}`);
}

export async function likeComment(commentId: string): Promise<{ message: string }> {
  return api.post(`/comments/${commentId}/like`, {});
}

export async function unlikeComment(commentId: string): Promise<{ message: string }> {
  return api.delete(`/comments/${commentId}/like`);
}

// =====================================
// UNIFIED FEED API
// =====================================

export type UnifiedFeedItem = {
  id: string;
  type: "post" | "update" | "repost";  // Three distinct content types
  agent_id?: string | null;
  agent_handle: string;
  agent_display_name: string | null;
  agent_avatar_url: string | null;
  owner_user_id: string;
  owner_handle: string;
  owner_display_name: string | null;
  created_at: string;
  // Post-specific fields (also used by reposts for original post data)
  title?: string | null;
  description?: string | null;
  image_url?: string;
  post_type?: string;  // Valid values: 'image', 'ai_generated', 'text' (NOT 'update')
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  user_has_liked?: boolean;
  // Update-specific fields (AgentUpdate content)
  content?: string;
  topic?: string | null;
  layer?: string;
  is_pinned?: boolean;
  is_read?: boolean;
  // Repost-specific fields
  repost_id?: string;
  repost_comment?: string | null;
  reposted_by_user_id?: string;
  reposted_by_handle?: string;
  reposted_by_display_name?: string | null;
  reposted_by_avatar_url?: string | null;
  reposted_at?: string;
  post_id?: string;  // Original post ID for reposts
};

export type UnifiedFeedResponse = {
  items: UnifiedFeedItem[];
  total_items: number;
  has_more: boolean;
};

export async function getUnifiedFeed(limit = 20, offset = 0): Promise<UnifiedFeedResponse> {
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  
  return api.get(`/feed/unified?${params.toString()}`);
}

// =====================================
// DIAGNOSTIC / AUTO-POST API
// =====================================

export type DiagnosticGenerateRequest = {
  avee_id: string;
  topic?: string | null;
  category?: string | null;
  image_engine?: string;
};

export type DiagnosticStepData = {
  step_number: number;
  step_name: string;
  duration: number;
  success: boolean;
  error: string | null;
  data: any;
};

export type DiagnosticResult = {
  success: boolean;
  agent_handle: string;
  total_duration: number;
  steps: DiagnosticStepData[];
  messages: Array<{ timestamp: number; message: string }>;
  final_result: any;
  image_engine: string;
  post_id?: string;
  error?: string;
  error_trace?: string;
};

/**
 * Generate a post via the diagnostic endpoint with extended timeout (90 seconds)
 * This is needed because post generation involves multiple AI API calls:
 * - Topic fetching (~5s)
 * - Image generation (~50-60s)
 * - Description generation (~5s)
 */
export async function diagnosticGeneratePost(
  request: DiagnosticGenerateRequest
): Promise<DiagnosticResult> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  // Use 90 second timeout for post generation
  const res = await fetchWithTimeout(
    `${API_BASE}/auto-post/diagnostic/generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    90000 // 90 seconds
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  throw new Error("Expected JSON response from diagnostic endpoint");
}


// =====================================
// POST PREVIEW/APPROVAL API
// =====================================

export type PreviewPostRequest = {
  avee_id: string;
  topic?: string | null;
  category?: string | null;
  image_engine?: string;
  reference_image_url?: string | null;
  feedback?: string | null;
  previous_preview_id?: string | null;
};

export type PreviewPostResponse = {
  preview_id: string;
  avee_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string;
  description: string;
  image_url: string;
  topic: {
    topic: string;
    description?: string;
    category?: string;
    source?: string;
  };
  image_prompt: string;
  image_engine: string;
  generated_at: string;
};

export type ConfirmPostRequest = {
  preview_id: string;
  avee_id: string;
  title?: string;
  description?: string;
};

export type ConfirmPostResponse = {
  success: boolean;
  post_id: string;
  image_url: string;
  view_url: string;
};

export type CancelPreviewRequest = {
  preview_id: string;
  avee_id: string;
};

/**
 * Generate a post preview WITHOUT saving to database.
 * Returns preview data for user approval.
 * 
 * If feedback is provided, it will be used to guide the regeneration.
 */
export async function previewGeneratePost(
  request: PreviewPostRequest
): Promise<PreviewPostResponse> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  // Use 90 second timeout for preview generation (same as regular post generation)
  const res = await fetchWithTimeout(
    `${API_BASE}/auto-post/preview`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    90000 // 90 seconds
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Confirm and save a previewed post to the database.
 * Moves image from temp to permanent storage.
 */
export async function confirmGeneratedPost(
  request: ConfirmPostRequest
): Promise<ConfirmPostResponse> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetchWithTimeout(
    `${API_BASE}/auto-post/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    30000 // 30 seconds
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Cancel a preview and cleanup temp storage.
 */
export async function cancelPostPreview(
  request: CancelPreviewRequest
): Promise<{ success: boolean; message: string }> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetchWithTimeout(
    `${API_BASE}/auto-post/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    15000 // 15 seconds
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}


