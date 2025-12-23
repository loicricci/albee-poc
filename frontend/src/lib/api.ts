"use client";

import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

async function getToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in (no access token)");
  return token;
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
}) {
  return apiFetch("/me/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: params.handle,
      display_name: params.display_name || null,
      bio: params.bio || null,
      avatar_url: params.avatar_url || null,
    }),
  });
}

export async function getMyAgents() {
  return apiFetch("/me/avees", { method: "GET" });
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
