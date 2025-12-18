import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

async function getToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const token = data.session?.access_token;
  if (!token) throw new Error("No access token in session");
  return token;
}

export async function apiFetch(path: string, init?: RequestInit) {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");

  const token = await getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export async function getMyProfile() {
  return apiFetch("/me/profile", { method: "GET" });
}

export async function saveMyProfile(params: {
  handle: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}) {
  const q = new URLSearchParams();
  q.set("handle", params.handle);
  if (params.display_name !== undefined) q.set("display_name", params.display_name);
  if (params.bio !== undefined) q.set("bio", params.bio);
  if (params.avatar_url !== undefined) q.set("avatar_url", params.avatar_url);

  return apiFetch(`/me/profile?${q.toString()}`, { method: "POST" });
}

export async function getMyAvees() {
  return apiFetch("/me/avees", { method: "GET" });
}

export async function createAvee(params: {
  handle: string;
  display_name?: string;
}) {
  const q = new URLSearchParams();
  q.set("handle", params.handle);
  if (params.display_name) q.set("display_name", params.display_name);

  return apiFetch(`/avees?${q.toString()}`, { method: "POST" });
}

export async function getAveeByHandle(handle: string) {
  return apiFetch(`/avees/${encodeURIComponent(handle)}`, { method: "GET" });
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

  // send question as query param (works with your current backend style)
  q.set("question", params.question);

  return apiFetch(`/chat/ask?${q.toString()}`, { method: "POST" });
}
