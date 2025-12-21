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

export async function getMyAvees() {
  return apiFetch("/me/avees", { method: "GET" });
}

export async function createAvee(params: { handle: string; display_name?: string }) {
  const q = new URLSearchParams();
  q.set("handle", params.handle);
  if (params.display_name) q.set("display_name", params.display_name);

  return apiFetch(`/avees?${q.toString()}`, { method: "POST" });
}

export async function getAveeByHandle(handle: string) {
  return apiFetch(`/avees/${encodeURIComponent(handle)}`, { method: "GET" });
}

export async function updateAvee(params: { aveeId: string; persona: string }) {
  return apiFetch(`/avees/${params.aveeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona: params.persona }),
  });
}


export async function addTrainingDocument(params: {
  aveeId: string;
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

  return apiFetch(`/avees/${params.aveeId}/documents?${q.toString()}`, {
    method: "POST",
  });
}

export async function setAveePermission(params: {
  aveeId: string;
  viewerHandle: string;
  maxLayer: "public" | "friends" | "intimate";
}) {
  const q = new URLSearchParams();
  q.set("viewer_handle", params.viewerHandle);
  q.set("max_layer", params.maxLayer);

  return apiFetch(`/avees/${params.aveeId}/permissions?${q.toString()}`, {
    method: "POST",
  });
}

export async function chatAsk(params: {
  aveeHandle: string;
  question: string;
  layer?: "public" | "friends" | "intimate";
}) {
  const q = new URLSearchParams();
  q.set("handle", params.aveeHandle);
  if (params.layer) q.set("layer", params.layer);
  q.set("question", params.question);

  return apiFetch(`/chat/ask?${q.toString()}`, { method: "POST" });
}

export async function listAveePermissions(aveeId: string) {
  return apiFetch(`/avees/${aveeId}/permissions`, { method: "GET" });
}

export async function deleteAveePermission(params: {
  aveeId: string;
  viewerUserId: string;
}) {
  const q = new URLSearchParams();
  q.set("viewer_user_id", params.viewerUserId);
  return apiFetch(`/avees/${params.aveeId}/permissions?${q.toString()}`, {
    method: "DELETE",
  });
}
