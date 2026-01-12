"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useChat } from "./ChatContext";
import { useAgentCache } from "./AgentCache";
import dynamic from "next/dynamic";
import { transcribeAudio, textToSpeech } from "@/lib/upload";

// PERFORMANCE: Lazy load VoiceRecorder (only loads when user clicks record button)
const VoiceRecorder = dynamic(() => import("./VoiceRecorder").then(mod => ({ default: mod.VoiceRecorder })), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-600">Loading recorder...</div>,
});

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type Conversation = {
  id: string;
  chat_type?: "profile" | "agent";
  target_avee_id?: string;
  agent_id?: string;
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

async function createOrGetDirectConversation(
  avee_id: string,
  agent_handle: string,
  token: string
): Promise<Conversation> {
  // Get agent's owner to create a DirectConversation
  const agentRes = await fetch(buildUrl(`/avees/${agent_handle}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!agentRes.ok) {
    throw new Error("Failed to fetch agent details");
  }
  
  const agent = await agentRes.json();
  
  // Create or get DirectConversation with agent
  const res = await fetch(buildUrl("/messaging/conversations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_user_id: agent.owner_user_id,
      chat_type: "agent",
      target_avee_id: avee_id,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to create conversation");
  }

  const data = await res.json();
  return {
    id: data.id,
    chat_type: "agent",
    target_avee_id: avee_id,
  };
}

type ChatModalProps = {
  chatId: string;
  handle: string;
  displayName?: string;
};

export function ChatModal({ chatId, handle, displayName }: ChatModalProps) {
  const { closeChat, minimizeChat, maximizedChats } = useChat();
  const { getAgent: getCachedAgent, setAgent: setCachedAgent } = useAgentCache();
  const isMinimized = !maximizedChats.has(chatId);

  const [phase, setPhase] = useState<"loadingAgent" | "loadingConversation" | "ready" | "error">(
    "loadingAgent"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const [agent, setAgent] = useState<Agent | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastUserText, setLastUserText] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<string>("");

  // Voice features
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [playingAudioFor, setPlayingAudioFor] = useState<string | null>(null);
  const [loadingTTSFor, setLoadingTTSFor] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isMinimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, streamingMessage, isMinimized]);

  useEffect(() => {
    if (!handle) return;

    let alive = true;

    const load = async () => {
      setErrorMsg("");
      setPhase("loadingAgent");
      setAgent(null);
      setConversation(null);
      setMessages([]);

      try {
        const token = await getAccessToken();

        // PERFORMANCE OPTIMIZATION: Check cache first for instant loading
        let a = getCachedAgent(handle);
        if (a) {
          // Use cached data - instant UI update!
          if (!alive) return;
          setAgent(a);
          setPhase("ready"); // Set to ready immediately with cached data
          
          // Load conversation & messages in parallel in background using messaging API
          Promise.all([
            createOrGetDirectConversation(a.id, handle, token),
            // We'll load messages after getting conversation
          ]).then(([conv]) => {
            if (!alive) return;
            setConversation(conv);
            
            // PERFORMANCE: Try to load messages from cache first
            const cacheKey = `chat_messages_${conv.id}`;
            const cachedMessages = localStorage.getItem(cacheKey);
            if (cachedMessages) {
              try {
                const parsed = JSON.parse(cachedMessages);
                setMessages(parsed);
                setLoadingMessages(false); // Instant UI with cache!
              } catch (e) {
                console.warn('Failed to parse cached messages');
              }
            }
            
            // Load messages in background (non-blocking)
            setLoadingMessages(true);
            apiGet<{ messages: { role?: "user" | "assistant" | "system"; sender_type?: string; content: string; created_at: string }[] }>(
              `/messaging/conversations/${conv.id}/messages`,
              token
            )
              .then((historyResponse) => {
                if (!alive) return;
                const history = historyResponse.messages || [];
                const mapped: ChatMessage[] = history.map((m, idx) => ({
                  id: `${idx}-${uid()}`,
                  role: (m.role || m.sender_type || "user") as "user" | "assistant" | "system",
                  content: m.content,
                  ts: Date.parse(m.created_at) || Date.now(),
                }));
                setMessages(mapped);
                
                // PERFORMANCE: Cache messages
                localStorage.setItem(cacheKey, JSON.stringify(mapped));
              })
              .catch((historyError) => {
                console.error("Failed to load message history:", historyError);
              })
              .finally(() => {
                if (alive) setLoadingMessages(false);
              });
          }).catch((convError) => {
            if (!alive) return;
            setPhase("error");
            setErrorMsg(convError?.message || "Failed to open conversation.");
          });
        } else {
          // Fetch agent from API first
          a = await apiGet<Agent>(`/avees/${handle}`, token);
          if (!alive) return;
          setAgent(a);
          setCachedAgent(handle, a); // Cache for instant loading next time
          setPhase("ready"); // Ready to type while conversation loads

          // Get conversation and load messages in background using messaging API
          const conv = await createOrGetDirectConversation(a.id, handle, token);
          if (!alive) return;
          setConversation(conv);

          // Load message history in background (non-blocking)
          setLoadingMessages(true);
          try {
            // PERFORMANCE: Try cache first
            const cacheKey = `chat_messages_${conv.id}`;
            const cachedMessages = localStorage.getItem(cacheKey);
            if (cachedMessages) {
              try {
                const parsed = JSON.parse(cachedMessages);
                setMessages(parsed);
                setLoadingMessages(false); // Instant display!
              } catch (e) {
                console.warn('Failed to parse cached messages');
              }
            }
            
            const historyResponse = await apiGet<
              { messages: { role?: "user" | "assistant" | "system"; sender_type?: string; content: string; created_at: string }[] }
            >(`/messaging/conversations/${conv.id}/messages`, token);

            if (!alive) return;

            const history = historyResponse.messages || [];
            const mapped: ChatMessage[] = history.map((m, idx) => ({
              id: `${idx}-${uid()}`,
              role: (m.role || m.sender_type || "user") as "user" | "assistant" | "system",
              content: m.content,
              ts: Date.parse(m.created_at) || Date.now(),
            }));
            setMessages(mapped);
            
            // PERFORMANCE: Cache messages
            localStorage.setItem(cacheKey, JSON.stringify(mapped));
          } catch (historyError) {
            console.error("Failed to load message history:", historyError);
          } finally {
            if (alive) setLoadingMessages(false);
          }
        }

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
  }, [handle, getCachedAgent, setCachedAgent]);

  const pushMessage = useCallback((role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, content, ts: Date.now() }]);
  }, []);

  const send = useCallback(async (text: string) => {
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

      // Use unified messaging streaming endpoint with Orchestrator integration
      const url = buildUrl(`/messaging/conversations/${conversation.id}/stream`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = ""; // Buffer for incomplete lines

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines (lines ending with \n)
          const lines = buffer.split("\n");
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.event === "start") {
                  console.log("[STREAM] Started with model:", data.model, "mode:", data.mode || "default");
                } else if (data.token) {
                  fullResponse += data.token;
                  setStreamingMessage(fullResponse);
                } else if (data.event === "complete") {
                  pushMessage("assistant", fullResponse);
                  setStreamingMessage("");
                  console.log("[STREAM] Complete - message_id:", data.message_id, "decision_path:", data.decision_path);
                } else if (data.event === "escalation_offered") {
                  console.log("[STREAM] Escalation offered:", data.escalation_data);
                } else if (data.event === "error") {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.warn("[STREAM] Failed to parse SSE line:", trimmedLine, "Error:", e);
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
  }, [conversation, pushMessage]);

  const onSubmit = useCallback(async () => {
    const text = input;
    setInput("");
    await send(text);
  }, [input, send]);

  const retryLast = useCallback(async () => {
    if (!lastUserText) return;
    await send(lastUserText);
  }, [lastUserText, send]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const handleVoiceRecording = useCallback(async (audioBlob: Blob) => {
    setTranscribingAudio(true);
    setShowVoiceRecorder(false);

    try {
      // Convert blob to file
      const audioFile = new File([audioBlob], "voice-input.webm", {
        type: "audio/webm",
      });

      // Transcribe the audio
      const token = await getAccessToken();
      const result = await transcribeAudio(audioFile, token);

      // Set the transcribed text as input
      setInput(result.transcription);
    } catch (e: any) {
      pushMessage("system", `Voice transcription error: ${e.message}`);
    } finally {
      setTranscribingAudio(false);
    }
  }, [pushMessage]);

  const playMessageAudio = useCallback(async (messageId: string, messageContent: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If already playing this message, stop
    if (playingAudioFor === messageId) {
      setPlayingAudioFor(null);
      return;
    }

    setLoadingTTSFor(messageId);

    try {
      const token = await getAccessToken();
      const audioBlob = await textToSpeech(messageContent, { voice: "alloy" }, token);

      // Create audio element
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudioFor(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingAudioFor(null);
        pushMessage("system", "Failed to play audio");
        URL.revokeObjectURL(audioUrl);
      };

      setPlayingAudioFor(messageId);
      setLoadingTTSFor(null);
      await audio.play();
    } catch (e: any) {
      setLoadingTTSFor(null);
      pushMessage("system", `TTS error: ${e.message}`);
    }
  }, [playingAudioFor, pushMessage]);

  const title = useMemo(() => 
    displayName || agent?.display_name || `@${handle}`,
    [displayName, agent?.display_name, handle]
  );

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 animate-slide-up">
        <div
          onClick={() => minimizeChat(chatId)}
          className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg transition-all hover:shadow-2xl hover:border-[#001f98]/30"
        >
          <div className="flex items-center justify-between px-4 py-3" style={{background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'}}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110 overflow-hidden">
                {agent?.avatar_url ? (
                  <img 
                    src={agent.avatar_url} 
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Show fallback icon on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{title}</div>
                <div className="truncate text-xs text-white/70">Click to open chat</div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeChat(chatId);
              }}
              className="ml-2 shrink-0 rounded-lg p-1 text-white/70 transition-all hover:bg-white/20 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => minimizeChat(chatId)}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />
      
      {/* Centered Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto flex h-[90vh] max-h-[700px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-2xl"
          style={{ animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4" style={{background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'}}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm overflow-hidden">
                {agent?.avatar_url ? (
                  <img 
                    src={agent.avatar_url} 
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Show fallback icon on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-white">{title}</div>
                <div className="truncate text-sm text-white/70">
                  {conversation?.layer_used ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C8A24A]"></span>
                      {conversation.layer_used} layer
                    </span>
                  ) : phase === "ready" ? (
                    "Ready to chat"
                  ) : (
                    "Connecting..."
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => minimizeChat(chatId)}
                className="rounded-lg p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="Minimize"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              <button
                onClick={() => closeChat(chatId)}
                className="rounded-lg p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc] p-6">
            {phase === "loadingAgent" && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-white border border-gray-200 p-4 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#001f98] border-t-transparent" />
                Loading agent...
              </div>
            )}
            {phase === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Connection Error
                </div>
                {errorMsg || "Something went wrong. Please try again."}
              </div>
            )}

            {phase === "ready" && loadingMessages && messages.length === 0 && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-white border border-gray-200 p-4 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#001f98] border-t-transparent" />
                Loading history...
              </div>
            )}

            {phase === "ready" && !loadingMessages && messages.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-base font-semibold text-gray-900 mb-2">Start a conversation</div>
                <div className="text-sm text-gray-600">Send a message to begin chatting with {title}</div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    "group flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={[
                        "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "text-white shadow-md"
                          : m.role === "assistant"
                          ? "border border-gray-200 bg-white text-gray-900 shadow-sm"
                          : "border border-red-200 bg-red-50 text-red-700",
                      ].join(" ")}
                      style={m.role === "user" ? {background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'} : {}}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && (
                      <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => playMessageAudio(m.id, m.content)}
                          disabled={loadingTTSFor === m.id}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-[#e6eaff] hover:border-[#001f98]/30 disabled:opacity-50"
                          title={playingAudioFor === m.id ? "Stop audio" : "Play audio"}
                        >
                          {loadingTTSFor === m.id ? (
                            <>
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Loading...
                            </>
                          ) : playingAudioFor === m.id ? (
                            <>
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 6h12v12H6z" />
                              </svg>
                              Stop
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                              </svg>
                              Listen
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed shadow-sm text-gray-900">
                    {streamingMessage}
                    <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#001f98] rounded" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-5">
            {showVoiceRecorder ? (
              <div className="mb-4 rounded-xl border border-gray-200 bg-gradient-to-br from-[#f8fafc] to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <svg className="h-4 w-4 text-[#001f98]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                    Record Voice Message
                  </div>
                  <button
                    onClick={() => setShowVoiceRecorder(false)}
                    className="rounded-lg p-1 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <VoiceRecorder
                  onRecordingComplete={handleVoiceRecording}
                  maxDuration={60}
                />
              </div>
            ) : transcribingAudio ? (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-[#f8fafc] p-4">
                <svg className="h-5 w-5 animate-spin text-[#001f98]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="text-sm text-gray-700">
                  Transcribing your voice message...
                </div>
              </div>
            ) : null}

            <div className="mb-3 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all placeholder:text-gray-400 focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={phase === "ready" ? "Type your message..." : "Loading..."}
                disabled={phase !== "ready" || isSending || showVoiceRecorder || transcribingAudio}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
              />
              <button
                onClick={() => setShowVoiceRecorder(true)}
                disabled={phase !== "ready" || isSending || showVoiceRecorder || transcribingAudio}
                className="flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2.5 text-gray-600 transition-all hover:bg-[#e6eaff] hover:border-[#001f98]/30 disabled:cursor-not-allowed disabled:opacity-50"
                title="Record voice message"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <button
                className="flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                style={{background: 'linear-gradient(135deg, #001f98 0%, #001670 100%)'}}
                onClick={onSubmit}
                disabled={phase !== "ready" || isSending || !input.trim() || showVoiceRecorder || transcribingAudio}
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
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {conversation?.id?.slice(0, 8) ?? "—"}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  className="font-medium text-gray-600 transition-colors hover:text-[#001f98] disabled:opacity-50"
                  onClick={cancel}
                  disabled={!isSending}
                >
                  Stop
                </button>
                <button
                  className="font-medium text-gray-600 transition-colors hover:text-[#001f98] disabled:opacity-50"
                  onClick={retryLast}
                  disabled={!lastUserText || isSending || phase !== "ready"}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatModalContainer() {
  const { chats } = useChat();

  return (
    <>
      {chats.map((chat) => (
        <ChatModal
          key={chat.id}
          chatId={chat.id}
          handle={chat.handle}
          displayName={chat.displayName}
        />
      ))}
    </>
  );
}

