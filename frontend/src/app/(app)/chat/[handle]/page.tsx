"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Avee = {
  id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type Conversation = {
  id: string;
  avee_id?: string;
  layer_used?: "public" | "friends" | "intimate";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in (no access token).");
  return token;
}

function buildUrl(path: string, query?: Record<string, string>) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
  if (!API_BASE) throw new Error("Missing NEXT_PUBLIC_API_BASE.");
  const url = new URL(`${API_BASE}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

async function apiPostQuery<T>(
  path: string,
  query: Record<string, string>,
  token: string,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

export default function ChatPage() {
  const params = useParams<{ handle: string }>();
  const handle = useMemo(() => (params?.handle ? decodeURIComponent(params.handle) : ""), [params]);

  const [phase, setPhase] = useState<"loadingAvee" | "loadingConversation" | "ready" | "error">(
    "loadingAvee"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const [avee, setAvee] = useState<Avee | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastUserText, setLastUserText] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessage]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("API_BASE:", process.env.NEXT_PUBLIC_API_BASE);
  }, []);

  useEffect(() => {
    if (!handle) return;

    let alive = true;

    const load = async () => {
      setErrorMsg("");
      setPhase("loadingAvee");
      setAvee(null);
      setConversation(null);
      setMessages([]);

      try {
        const token = await getAccessToken();

        // 1) Get avee by handle (public endpoint in your backend, no auth required,
        // but keeping auth header doesn't hurt)
        const a = await apiGet<Avee>(`/avees/${handle}`, token);
        if (!alive) return;
        setAvee(a);

        // 2) Create/reuse conversation with avee_id (QUERY PARAM, not JSON body)
        setPhase("loadingConversation");
        const conv = await apiPostQuery<Conversation>(
          "/conversations/with-avee",
          { avee_id: a.id },
          token
        );
        if (!alive) return;
        setConversation(conv);

        // 3) Load existing messages if you want (recommended)
        // Your backend has GET /conversations/{id}/messages
        const history = await apiGet<
          { role: "user" | "assistant" | "system"; content: string; created_at: string }[]
        >(`/conversations/${conv.id}/messages`, token);

        if (!alive) return;

        const mapped: ChatMessage[] = (history || []).map((m, idx) => ({
          id: `${idx}-${uid()}`,
          role: m.role,
          content: m.content,
          ts: Date.parse(m.created_at) || Date.now(),
        }));
        setMessages(mapped);

        setPhase("ready");
      } catch (e: any) {
        if (!alive) return;
        setPhase("error");
        setErrorMsg(e?.message || "Failed to load chat.");
      }
    };

    load();

    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [handle]);

  const pushMessage = (role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, content, ts: Date.now() }]);
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    if (!conversation) return;

    setIsSending(true);
    setLastUserText(text);
    setStreamingMessage("");

    pushMessage("user", text);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getAccessToken();

      // Use streaming endpoint for real-time responses
      const url = buildUrl("/chat/stream", {
        conversation_id: conversation.id,
        question: text,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.event === "start") {
                  // Start of stream
                  console.log("Stream started with model:", data.model);
                } else if (data.token) {
                  // Token received - append to streaming message
                  fullResponse += data.token;
                  setStreamingMessage(fullResponse);
                } else if (data.event === "complete") {
                  // Stream complete - add final message
                  pushMessage("assistant", fullResponse);
                  setStreamingMessage("");
                  console.log("Stream complete, message_id:", data.message_id);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Request canceled." : e?.message || "Chat failed.";
      pushMessage("system", `Error: ${msg}`);
      setStreamingMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = async () => {
    const text = input;
    setInput("");
    await send(text);
  };

  const retryLast = async () => {
    if (!lastUserText) return;
    await send(lastUserText);
  };

  const cancel = () => abortRef.current?.abort();

  const title = avee?.display_name ? `${avee.display_name} (@${handle})` : `@${handle}`;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {avee?.avatar_url && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-blue-100 bg-gradient-to-br from-blue-100 to-purple-100">
                <img src={avee.avatar_url} alt={title} className="h-full w-full object-cover" />
              </div>
            )}
            {!avee?.avatar_url && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-100 bg-gradient-to-br from-blue-100 to-purple-100">
                <svg className="h-6 w-6 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-gray-900">{handle ? title : "—"}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {conversation?.layer_used ?? "—"}
                </span>
                {conversation?.id && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="truncate text-xs font-mono">{conversation.id.slice(0, 8)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={cancel}
              disabled={!isSending}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>

            <button
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={retryLast}
              disabled={!lastUserText || isSending || phase !== "ready"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          {phase === "loadingAvee" && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-600">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium">Loading Avee...</span>
              </div>
            </div>
          )}
          
          {phase === "loadingConversation" && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-600">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium">Opening conversation...</span>
              </div>
            </div>
          )}
          
          {phase === "error" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-red-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-sm text-red-700">{errorMsg || "Failed to load chat."}</p>
            </div>
          )}

          {phase === "ready" && messages.length === 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-[#001f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Start a conversation</h3>
              <p className="text-sm text-blue-700">Say hi or ask a question to begin chatting</p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={[
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-5 py-3 text-sm shadow-sm",
                    m.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      : m.role === "assistant"
                      ? "border border-gray-200 bg-white text-gray-900"
                      : "border border-red-200 bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm shadow-sm text-gray-900">
                  {streamingMessage}
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#001f98] rounded" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 shadow-lg">
        <div className="mx-auto max-w-4xl">
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-gray-300 px-5 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={phase === "ready" ? "Type your message…" : "Loading…"}
              disabled={phase !== "ready" || isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
            <button
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSubmit}
              disabled={phase !== "ready" || isSending || !input.trim()}
            >
              {isSending ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
