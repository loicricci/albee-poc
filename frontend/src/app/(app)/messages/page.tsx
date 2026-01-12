"use client";

import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

// =============================================================================
// Types
// =============================================================================

type Profile = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
};

type Avee = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  owner_user_id?: string | null;
};

type Conversation = {
  id: string;
  chat_type: "profile" | "agent";
  other_participant: Profile;
  target_avee?: Avee | null;
  last_message_at: string;
  last_message_preview?: string | null;
  unread_count: number;
  is_legacy?: boolean;
  is_agent_owner?: boolean;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_user_id?: string | null;
  sender_type: "user" | "agent" | "system";
  sender_avee_id?: string | null;
  content: string;
  created_at: string;
  sender_info?: any;
  human_validated?: string;
};

type Escalation = {
  id: string;
  avee_id: string;
  avee_handle: string | null;
  conversation_id: string;
  user_info: {
    user_id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  original_message: string;
  context_summary: string | null;
  escalation_reason: string;
  status: "pending" | "answered" | "declined";
  offered_at: string;
  accepted_at: string | null;
};

type AgentConversation = {
  id: string;
  chat_type: string;
  anonymized_user: {
    initials: string;
    avatar_color: string;
  };
  target_avee: Avee;
  last_message_at: string;
  last_message_preview: string | null;
  message_count: number;
};

type AgentInsights = {
  total_conversations: number;
  total_messages: number;
  pending_escalations: number;
  answered_escalations: number;
  recent_questions: { content: string; created_at: string }[];
  agents: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    conversation_count: number;
    message_count_30d: number;
    pending_escalations: number;
  }[];
};

type ActiveSection = "my_chats" | "escalations" | "agent_activity";

// =============================================================================
// Helper Functions
// =============================================================================

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in");
  return token;
}

function buildUrl(path: string) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
  if (!API_BASE) throw new Error("Missing NEXT_PUBLIC_API_BASE");
  return `${API_BASE}${path}`;
}

// =============================================================================
// Skeleton Components
// =============================================================================

const ConversationSkeleton = () => (
  <div className="w-full border-b border-[#E6E6E6] p-4 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="h-12 w-12 rounded-xl bg-gray-200"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

const MessageSkeleton = () => (
  <div className="flex justify-start animate-pulse">
    <div className="max-w-[70%] rounded-xl px-4 py-2 bg-gray-200">
      <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-32"></div>
    </div>
  </div>
);

// =============================================================================
// Message Bubble Component
// =============================================================================

const MessageBubble = memo(({ msg, isCurrentUser, getMessageStatusIcon, formatTime }: {
  msg: Message;
  isCurrentUser: boolean;
  getMessageStatusIcon: (msg: Message) => React.ReactNode;
  formatTime: (timestamp: string) => string;
}) => {
  return (
    <div className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-xl px-4 py-2 ${
          isCurrentUser
            ? "bg-[#001f98] text-white"
            : "bg-[#f8fafc] border border-[#E6E6E6] text-gray-900"
        }`}
      >
        {!isCurrentUser && msg.sender_info && (
          <div className="mb-1 text-xs font-medium text-[#001f98]/70">
            {msg.sender_type === "agent" && "🤖 "}
            {msg.sender_info.display_name || msg.sender_info.handle}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
        <div className={`mt-1 flex items-center gap-1.5 ${isCurrentUser ? "text-white/70" : "text-[#001f98]/50"}`}>
          {getMessageStatusIcon(msg)}
          <p className="text-xs">{formatTime(msg.created_at)}</p>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

// =============================================================================
// Main Component
// =============================================================================

export default function MessagesPage() {
  const router = useRouter();
  
  // Section state
  const [activeSection, setActiveSection] = useState<ActiveSection>("my_chats");
  
  // My Chats state
  const [myConversations, setMyConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // Escalations state
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerLayer, setAnswerLayer] = useState<"public" | "friends" | "intimate">("public");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  
  // Agent Activity state
  const [agentConversations, setAgentConversations] = useState<AgentConversation[]>([]);
  const [selectedAgentConversation, setSelectedAgentConversation] = useState<AgentConversation | null>(null);
  const [agentMessages, setAgentMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<AgentInsights | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatHandle, setNewChatHandle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  // =============================================================================
  // Data Loading
  // =============================================================================

  // Load all data on mount - with guard to prevent duplicate calls from StrictMode
  useEffect(() => {
    // Guard against duplicate initialization (React StrictMode double-mount)
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMyConversations(),
        loadEscalations(),
        loadAgentActivity(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyConversations = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl("/messaging/conversations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter to only show conversations where user is NOT the agent owner
        const filtered = (data.conversations || []).filter(
          (c: Conversation) => !c.is_agent_owner
        );
        setMyConversations(filtered);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  const loadEscalations = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl("/orchestrator/queue"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEscalations(data.escalations || []);
      }
    } catch (e) {
      console.error("Failed to load escalations:", e);
    }
  };

  const loadAgentActivity = async () => {
    try {
      const token = await getAccessToken();
      const [convRes, insightsRes] = await Promise.all([
        fetch(buildUrl("/messaging/agent-conversations"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildUrl("/messaging/agent-insights"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      if (convRes.ok) {
        const data = await convRes.json();
        setAgentConversations(data.conversations || []);
      }
      
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data);
      }
    } catch (e) {
      console.error("Failed to load agent activity:", e);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl(`/messaging/conversations/${conversationId}/messages?limit=50`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      setMessages([]);
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedAgentConversation) {
      setAgentMessages([]);
      loadMessages(selectedAgentConversation.id).then(() => {
        // Copy to agent messages state
        setAgentMessages(messages);
      });
    }
  }, [selectedAgentConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentMessages]);

  // =============================================================================
  // Actions
  // =============================================================================

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || sending) return;

    setSending(true);
    const messageContent = newMessage;
    setNewMessage("");

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_type: "user",
      content: messageContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl(`/messaging/conversations/${selectedConversation.id}/stream`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: messageContent }),
      });

      if (!res.ok) throw new Error("Failed to send");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      // Add streaming placeholder
      const streamingMsg: Message = {
        id: `streaming-${Date.now()}`,
        conversation_id: selectedConversation.id,
        sender_type: "agent",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, streamingMsg]);

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
                if (data.token) {
                  fullResponse += data.token;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMsg.id ? { ...m, content: fullResponse } : m
                    )
                  );
                }
              } catch (e) {}
            }
          }
        }
      }

      // Refresh data after sending
      loadMyConversations();
      loadEscalations();
    } catch (e) {
      console.error("Error sending:", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const answerEscalation = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:entry',message:'answerEscalation called',data:{hasEscalation:!!selectedEscalation,escalationId:selectedEscalation?.id,aveeId:selectedEscalation?.avee_id,answerText:answerText?.substring(0,50),answerLayer},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    if (!selectedEscalation || !answerText.trim()) return;

    setSubmittingAnswer(true);
    try {
      const token = await getAccessToken();
      
      // Post as Agent Update - this is the correct way to answer escalations
      // The update will be saved as knowledge and shared with followers
      const updatePayload = {
        title: `Q: ${selectedEscalation.original_message.substring(0, 100)}${selectedEscalation.original_message.length > 100 ? '...' : ''}`,
        content: answerText,
        topic: "knowledge",
        layer: answerLayer,
        is_pinned: false,
      };
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:beforeFetch',message:'About to create Agent Update',data:{url:`/agents/${selectedEscalation.avee_id}/updates`,hasToken:!!token,payload:updatePayload},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      
      const res = await fetch(buildUrl(`/agents/${selectedEscalation.avee_id}/updates`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      // #region agent log
      const responseText = await res.clone().text();
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:afterFetch',message:'Agent Update API response',data:{status:res.status,ok:res.ok,statusText:res.statusText,responseBody:responseText?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion

      if (res.ok) {
        // Mark escalation as answered and send reply to conversation
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:markAnswered',message:'Marking escalation as answered',data:{escalationId:selectedEscalation.id,answer:answerText.substring(0,50),layer:answerLayer},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        const markRes = await fetch(buildUrl(`/orchestrator/queue/${selectedEscalation.id}/mark-answered`), {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ answer: answerText, layer: answerLayer }),
        });
        
        // #region agent log
        const markResText = await markRes.clone().text();
        fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:markAnsweredResponse',message:'Mark answered response',data:{status:markRes.status,ok:markRes.ok,body:markResText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        setSelectedEscalation(null);
        setAnswerText("");
        loadEscalations();
        loadAgentActivity();
      } else {
        alert("Failed to send answer");
      }
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messages/page.tsx:answerEscalation:catch',message:'Exception caught',data:{error:String(e),errorMessage:(e as Error)?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error("Error answering:", e);
      alert("Error sending answer");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const declineEscalation = async (escalationId: string) => {
    if (!confirm("Are you sure you want to decline this question?")) return;

    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl(`/orchestrator/queue/${escalationId}/decline`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        loadEscalations();
      }
    } catch (e) {
      console.error("Error declining:", e);
    }
  };

  const startNewConversation = async () => {
    if (!newChatHandle.trim()) return;

    try {
      const token = await getAccessToken();
      const cleanHandle = newChatHandle.trim().replace(/^@/, "").toLowerCase();

      // Look up the agent first - users always chat with agents
      const aveeRes = await fetch(buildUrl(`/avees/${cleanHandle}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!aveeRes.ok) {
        alert(`No agent found for @${cleanHandle}. Make sure you enter a valid agent handle.`);
        return;
      }
      const aveeData = await aveeRes.json();

      // Get the profile associated with this agent (the owner)
      const profileRes = await fetch(buildUrl(`/profiles/${cleanHandle}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!profileRes.ok) {
        alert(`Profile not found for agent @${cleanHandle}`);
        return;
      }
      const profileData = await profileRes.json();

      // Create conversation - always as agent type
      const res = await fetch(buildUrl("/messaging/conversations"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: profileData.user_id,
          chat_type: "agent",
          target_avee_id: aveeData.id,
        }),
      });

      if (res.ok) {
        setShowNewChat(false);
        setNewChatHandle("");
        loadMyConversations();
      }
    } catch (e) {
      console.error("Error starting conversation:", e);
    }
  };

  // =============================================================================
  // Helpers
  // =============================================================================

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getMessageStatusIcon = (msg: Message) => {
    if (msg.sender_type === "user") {
      return (
        <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      );
    } else if (msg.sender_type === "agent") {
      return (
        <svg className="h-4 w-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 7H7v6h6V7z" />
          <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  };

  // Filter functions
  const filteredMyConversations = useMemo(() => {
    if (!searchQuery.trim()) return myConversations;
    const q = searchQuery.toLowerCase();
    return myConversations.filter(
      (c) =>
        c.other_participant.display_name.toLowerCase().includes(q) ||
        c.other_participant.handle.toLowerCase().includes(q) ||
        c.target_avee?.display_name.toLowerCase().includes(q)
    );
  }, [myConversations, searchQuery]);

  const pendingEscalations = useMemo(
    () => escalations.filter((e) => e.status === "pending"),
    [escalations]
  );

  const answeredEscalations = useMemo(
    () => escalations.filter((e) => e.status === "answered"),
    [escalations]
  );

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <NewLayoutWrapper>
      <div className="flex h-[calc(100vh-200px)] bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E6E6E6]">
        {/* =================================================================== */}
        {/* LEFT SIDEBAR */}
        {/* =================================================================== */}
        <div className="w-80 border-r border-[#E6E6E6] bg-white flex flex-col">
          {/* Section Tabs */}
          <div className="p-3 border-b border-[#E6E6E6] bg-[#f8fafc]">
            <div className="flex gap-1 bg-[#E6E6E6]/50 rounded-lg p-1">
              {/* My Chats Tab */}
              <button
                onClick={() => {
                  setActiveSection("my_chats");
                  setSelectedEscalation(null);
                  setSelectedAgentConversation(null);
                }}
                className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-all ${
                  activeSection === "my_chats"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-[#001f98]/70 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Chats</span>
                  {filteredMyConversations.length > 0 && (
                    <span className="text-[10px] bg-[#001f98]/10 px-1.5 rounded-full">
                      {filteredMyConversations.length}
                    </span>
                  )}
                </div>
              </button>

              {/* Escalations Tab */}
              <button
                onClick={() => {
                  setActiveSection("escalations");
                  setSelectedConversation(null);
                  setSelectedAgentConversation(null);
                }}
                className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-all relative ${
                  activeSection === "escalations"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-[#001f98]/70 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Requests</span>
                </div>
                {pendingEscalations.length > 0 && (
                  <span className="absolute -top-1 -right-0 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                    {pendingEscalations.length}
                  </span>
                )}
              </button>

              {/* Agent Activity Tab */}
              <button
                onClick={() => {
                  setActiveSection("agent_activity");
                  setSelectedConversation(null);
                  setSelectedEscalation(null);
                }}
                className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-all ${
                  activeSection === "agent_activity"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-[#001f98]/70 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Activity</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <ConversationSkeleton key={i} />
                ))}
              </div>
            ) : (
              <>
                {/* ========== MY CHATS SECTION ========== */}
                {activeSection === "my_chats" && (
                  <div>
                    {/* New Chat Button */}
                    <div className="p-3 border-b border-[#E6E6E6]">
                      <button
                        onClick={() => setShowNewChat(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C8A24A] px-4 py-2 text-sm font-medium text-white hover:bg-[#b8923a] transition-colors"
                      >
                        <span className="text-base">🤖</span>
                        Chat with an Agent
                      </button>
                    </div>

                    {filteredMyConversations.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-[#001f98]/30 mb-2">
                          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <p className="text-sm text-[#001f98]/70">No conversations yet</p>
                        <p className="text-xs text-[#001f98]/50 mt-1">
                          Start chatting with agents!
                        </p>
                      </div>
                    ) : (
                      filteredMyConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`w-full border-b border-[#E6E6E6] p-4 text-left transition-colors hover:bg-[#f8fafc] ${
                            selectedConversation?.id === conv.id
                              ? "bg-[#001f98]/5 border-l-4 border-l-[#001f98]"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              {conv.target_avee?.avatar_url ? (
                                <img
                                  src={conv.target_avee.avatar_url}
                                  alt={conv.target_avee.display_name}
                                  className="h-10 w-10 rounded-xl object-cover border border-[#E6E6E6]"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#001f98] to-[#1a2236] flex items-center justify-center text-white text-xs font-bold">
                                  {conv.target_avee?.display_name?.slice(0, 2).toUpperCase() || "??"}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 bg-[#C8A24A] rounded-full p-0.5">
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between">
                                <h4 className="font-medium text-gray-900 truncate text-sm">
                                  {conv.target_avee?.display_name || conv.other_participant.display_name}
                                </h4>
                                <span className="text-[10px] text-[#001f98]/50 flex-shrink-0">
                                  {formatTime(conv.last_message_at)}
                                </span>
                              </div>
                              <p className="text-xs text-[#001f98]/60 truncate">
                                {conv.last_message_preview || "No messages yet"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* ========== ESCALATIONS SECTION ========== */}
                {activeSection === "escalations" && (
                  <div>
                    {/* Pending Section */}
                    <div className="p-3 bg-orange-50 border-b border-orange-100">
                      <h3 className="text-xs font-semibold text-orange-800 flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        PENDING ({pendingEscalations.length})
                      </h3>
                    </div>

                    {pendingEscalations.length === 0 ? (
                      <div className="p-6 text-center border-b border-[#E6E6E6]">
                        <div className="text-green-400 mb-2">
                          <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-[#001f98]/70">All caught up!</p>
                        <p className="text-xs text-[#001f98]/50">No pending questions</p>
                      </div>
                    ) : (
                      pendingEscalations.map((esc) => (
                        <button
                          key={esc.id}
                          onClick={() => setSelectedEscalation(esc)}
                          className={`w-full border-b border-[#E6E6E6] p-4 text-left transition-colors hover:bg-orange-50 ${
                            selectedEscalation?.id === esc.id
                              ? "bg-orange-50 border-l-4 border-l-orange-500"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">
                              {esc.user_info.display_name?.slice(0, 2).toUpperCase() || "??"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between">
                                <h4 className="font-medium text-gray-900 text-sm">
                                  {esc.user_info.display_name}
                                </h4>
                                <span className="text-[10px] text-[#001f98]/50">
                                  {formatTime(esc.offered_at)}
                                </span>
                              </div>
                              <p className="text-xs text-[#001f98]/70 line-clamp-2 mt-1">
                                &quot;{esc.original_message}&quot;
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}

                    {/* Answered Section */}
                    {answeredEscalations.length > 0 && (
                      <>
                        <div className="p-3 bg-green-50 border-b border-green-100">
                          <h3 className="text-xs font-semibold text-green-800 flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ANSWERED ({answeredEscalations.length})
                          </h3>
                        </div>
                        {answeredEscalations.slice(0, 5).map((esc) => (
                          <div
                            key={esc.id}
                            className="w-full border-b border-[#E6E6E6] p-4 text-left bg-green-50/30"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">
                                {esc.user_info.display_name?.slice(0, 2).toUpperCase() || "??"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between">
                                  <h4 className="font-medium text-gray-900/60 text-sm">
                                    {esc.user_info.display_name}
                                  </h4>
                                  <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                    Answered
                                  </span>
                                </div>
                                <p className="text-xs text-[#001f98]/50 line-clamp-1 mt-1">
                                  &quot;{esc.original_message}&quot;
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ========== AGENT ACTIVITY SECTION ========== */}
                {activeSection === "agent_activity" && (
                  <div>
                    {/* Insights Summary */}
                    {insights && (
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border-b border-purple-100">
                        <h3 className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          INSIGHTS (30 days)
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/60 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-purple-700">{insights.total_conversations}</div>
                            <div className="text-[10px] text-purple-600">Conversations</div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-indigo-700">{insights.total_messages}</div>
                            <div className="text-[10px] text-indigo-600">Messages</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agent Conversations (Anonymized) */}
                    <div className="p-3 bg-[#f8fafc] border-b border-[#E6E6E6]">
                      <h3 className="text-xs font-semibold text-[#001f98]/70">
                        CONVERSATIONS WITH YOUR AGENTS
                      </h3>
                    </div>

                    {agentConversations.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-[#001f98]/30 mb-2">
                          <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                          </svg>
                        </div>
                        <p className="text-sm text-[#001f98]/70">No conversations yet</p>
                        <p className="text-xs text-[#001f98]/50">
                          When people chat with your agents, it&apos;ll show here
                        </p>
                      </div>
                    ) : (
                      agentConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedAgentConversation(conv)}
                          className={`w-full border-b border-[#E6E6E6] p-4 text-left transition-colors hover:bg-purple-50/50 ${
                            selectedAgentConversation?.id === conv.id
                              ? "bg-purple-50 border-l-4 border-l-purple-500"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Anonymized Avatar */}
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: conv.anonymized_user.avatar_color }}
                            >
                              {conv.anonymized_user.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between">
                                <h4 className="font-medium text-gray-900 text-sm">
                                  Anonymous User
                                </h4>
                                <span className="text-[10px] text-[#001f98]/50">
                                  {formatTime(conv.last_message_at)}
                                </span>
                              </div>
                              <p className="text-xs text-purple-600 mb-1">
                                → {conv.target_avee.display_name}
                              </p>
                              <p className="text-xs text-[#001f98]/60 truncate">
                                {conv.message_count} messages
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* MAIN CONTENT AREA */}
        {/* =================================================================== */}
        <div className="flex-1 flex flex-col bg-[#f8fafc] min-h-0 overflow-hidden">
          {/* Empty States */}
          {activeSection === "my_chats" && !selectedConversation && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#001f98]/10">
                  <svg className="h-8 w-8 text-[#001f98]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Select a conversation</h2>
                <p className="text-sm text-[#001f98]/70">Choose a chat to start messaging</p>
              </div>
            </div>
          )}

          {activeSection === "escalations" && !selectedEscalation && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Escalation Requests</h2>
                <p className="text-sm text-[#001f98]/70 mt-2">
                  When users ask questions your AI agent can&apos;t answer, they appear here.
                  <br />
                  <span className="text-orange-600 font-medium">Your answers are saved as knowledge</span> so the AI can handle similar questions in the future.
                </p>
              </div>
            </div>
          )}

          {activeSection === "agent_activity" && !selectedAgentConversation && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Agent Activity</h2>
                <p className="text-sm text-[#001f98]/70 mt-2">
                  See anonymized conversations people are having with your agents.
                  <br />
                  <span className="text-purple-600 font-medium">User identities are hidden</span> for privacy.
                </p>
                
                {/* Recent Questions */}
                {insights && insights.recent_questions.length > 0 && (
                  <div className="mt-6 text-left bg-white rounded-xl p-4 border border-purple-100">
                    <h3 className="text-sm font-semibold text-purple-700 mb-3">Recent Questions</h3>
                    <div className="space-y-2">
                      {insights.recent_questions.slice(0, 5).map((q, i) => (
                        <div key={i} className="text-xs text-[#001f98]/70 bg-purple-50 rounded-lg p-2">
                          &quot;{q.content}&quot;
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat View for My Chats */}
          {activeSection === "my_chats" && selectedConversation && (
            <>
              {/* Header */}
              <div className="border-b border-[#E6E6E6] bg-white p-4">
                <div className="flex items-center gap-3">
                  {selectedConversation.target_avee?.avatar_url ? (
                    <img
                      src={selectedConversation.target_avee.avatar_url}
                      alt={selectedConversation.target_avee.display_name}
                      className="h-10 w-10 rounded-xl object-cover border border-[#E6E6E6]"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#001f98] to-[#1a2236] flex items-center justify-center text-white text-xs font-bold">
                      {selectedConversation.target_avee?.display_name?.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.target_avee?.display_name}
                    </h2>
                    <p className="text-xs text-[#001f98]/60">
                      @{selectedConversation.target_avee?.handle}
                      <span className="ml-2 text-[#C8A24A]">• Agent Chat</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-white">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => <MessageSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isCurrentUser={msg.sender_type === "user"}
                        getMessageStatusIcon={getMessageStatusIcon}
                        formatTime={formatTime}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-[#E6E6E6] bg-white p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="rounded-lg bg-[#001f98] px-4 py-2 text-white hover:bg-[#1a2236] disabled:opacity-50"
                  >
                    {sending ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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
            </>
          )}

          {/* Escalation Detail View */}
          {activeSection === "escalations" && selectedEscalation && (
            <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
              {/* Header */}
              <div className="border-b border-[#E6E6E6] bg-orange-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                      {selectedEscalation.user_info.display_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        {selectedEscalation.user_info.display_name}
                      </h2>
                      <p className="text-xs text-[#001f98]/60">
                        @{selectedEscalation.user_info.handle} • Asked {formatTime(selectedEscalation.offered_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => declineEscalation(selectedEscalation.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Decline
                  </button>
                </div>
              </div>

              {/* Question */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                    <h3 className="text-sm font-semibold text-orange-800 mb-3">Question:</h3>
                    <p className="text-gray-900">{selectedEscalation.original_message}</p>
                  </div>

                  {selectedEscalation.context_summary && (
                    <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h3 className="text-xs font-semibold text-blue-800 mb-2">Context:</h3>
                      <p className="text-sm text-[#001f98]/70">{selectedEscalation.context_summary}</p>
                    </div>
                  )}

                  <div className="mt-6 bg-green-50 rounded-xl p-4 border border-green-100">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="text-sm font-medium text-green-800">Your answer will be saved as knowledge</span>
                    </div>
                    <p className="text-xs text-green-700">
                      The AI will use this answer to respond to similar questions in the future.
                    </p>
                  </div>
                </div>
              </div>

              {/* Answer Input */}
              <div className="border-t border-[#E6E6E6] bg-white p-4 flex-shrink-0">
                <div className="max-w-2xl mx-auto">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 resize-none"
                  />
                  
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <div className="flex gap-2 flex-shrink-0">
                      {(["public", "friends", "intimate"] as const).map((layer) => (
                        <button
                          key={layer}
                          onClick={() => setAnswerLayer(layer)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            answerLayer === layer
                              ? "bg-orange-100 text-orange-800 font-medium"
                              : "bg-[#f8fafc] text-[#001f98]/70 hover:bg-[#E6E6E6]"
                          }`}
                        >
                          {layer.charAt(0).toUpperCase() + layer.slice(1)}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={answerEscalation}
                      disabled={submittingAnswer || !answerText.trim()}
                      className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors flex-shrink-0 shadow-sm"
                    >
                      {submittingAnswer ? "Sending..." : "✓ Submit Answer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Activity Conversation View (Read-only) */}
          {activeSection === "agent_activity" && selectedAgentConversation && (
            <>
              {/* Header */}
              <div className="border-b border-[#E6E6E6] bg-purple-50 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedAgentConversation.anonymized_user.avatar_color }}
                  >
                    {selectedAgentConversation.anonymized_user.initials}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Anonymous User</h2>
                    <p className="text-xs text-purple-600">
                      Chatting with {selectedAgentConversation.target_avee.display_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages (Read-only) */}
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => <MessageSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isCurrentUser={msg.sender_type === "user"}
                        getMessageStatusIcon={getMessageStatusIcon}
                        formatTime={formatTime}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Read-only notice */}
              <div className="border-t border-[#E6E6E6] bg-purple-50 p-4 text-center">
                <p className="text-sm text-purple-700">
                  👀 Read-only view of this conversation
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* NEW CHAT MODAL */}
      {/* =================================================================== */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Chat with an Agent</h2>
              <button
                onClick={() => setShowNewChat(false)}
                className="rounded-lg p-1 hover:bg-[#f8fafc]"
              >
                <svg className="h-6 w-6 text-[#001f98]/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Agent Handle</label>
                <input
                  type="text"
                  value={newChatHandle}
                  onChange={(e) => setNewChatHandle(e.target.value)}
                  placeholder="@eltonjohn"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                />
                <p className="mt-1 text-xs text-[#001f98]/50">
                  Enter the handle of the agent you want to chat with
                </p>
              </div>

              {/* Info box explaining the flow */}
              <div className="bg-[#C8A24A]/10 rounded-lg p-3 border border-[#C8A24A]/20">
                <div className="flex gap-2">
                  <svg className="h-5 w-5 text-[#C8A24A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[#C8A24A]">How it works</p>
                    <p className="text-xs text-[#001f98]/70 mt-1">
                      The AI agent will respond to your messages. If it can&apos;t answer, 
                      the question is forwarded to the profile owner who can provide a response.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewChat(false)}
                className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#001f98]/70 hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                onClick={startNewConversation}
                disabled={!newChatHandle.trim()}
                className="flex-1 rounded-lg bg-[#C8A24A] px-4 py-2 text-sm font-medium text-white hover:bg-[#b8923a] disabled:opacity-50"
              >
                🤖 Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </NewLayoutWrapper>
  );
}
