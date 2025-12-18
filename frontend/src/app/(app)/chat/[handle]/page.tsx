"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Avee = {
  id: string;
  handle: string;
  display_name?: string | null;
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

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

    pushMessage("user", text);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getAccessToken();

      // POST /chat/ask expects conversation_id + question as QUERY params
      const resp = await apiPostQuery<{
        conversation_id: string;
        layer_used: "public" | "friends" | "intimate";
        answer: string;
        used_chunks: number;
      }>(
        "/chat/ask",
        { conversation_id: conversation.id, question: text },
        token,
        controller.signal
      );

      // Update header data (layer_used can change if convo was created earlier under different permissions)
      setConversation((c) => (c ? { ...c, layer_used: resp.layer_used } : c));

      pushMessage("assistant", resp.answer || "(No answer returned.)");
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Request canceled." : e?.message || "Chat failed.";
      pushMessage("system", `Error: ${msg}`);
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
    <div className="h-[calc(100vh-0px)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-500">Chat</div>
          <div className="font-semibold truncate">{handle ? title : "—"}</div>
          <div className="text-xs text-gray-500">
            Layer allowed: {conversation?.layer_used ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="border rounded px-2 py-1 text-sm disabled:opacity-50"
            onClick={cancel}
            disabled={!isSending}
          >
            Stop
          </button>

          <button
            className="border rounded px-2 py-1 text-sm disabled:opacity-50"
            onClick={retryLast}
            disabled={!lastUserText || isSending || phase !== "ready"}
          >
            Retry
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {phase === "loadingAvee" && <div className="text-sm text-gray-600">Loading Avee…</div>}
        {phase === "loadingConversation" && (
          <div className="text-sm text-gray-600">Opening conversation…</div>
        )}
        {phase === "error" && (
          <div className="text-sm text-red-600">{errorMsg || "Something went wrong."}</div>
        )}

        {phase === "ready" && messages.length === 0 && (
          <div className="text-sm text-gray-600">Say hi. Try a simple question first.</div>
        )}

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={[
                "max-w-[900px] whitespace-pre-wrap rounded px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-auto bg-gray-900 text-white"
                  : m.role === "assistant"
                  ? "mr-auto bg-gray-100"
                  : "mr-auto bg-red-50 text-red-700 border border-red-200",
              ].join(" ")}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
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
            className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            onClick={onSubmit}
            disabled={phase !== "ready" || isSending || !input.trim()}
          >
            Send
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Conversation: {conversation?.id ?? "—"}
        </div>
      </div>
    </div>
  );
}
