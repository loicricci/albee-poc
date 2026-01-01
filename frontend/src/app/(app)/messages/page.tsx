"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

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

// Skeleton loader components
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

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatHandle, setNewChatHandle] = useState("");
  const [newChatType, setNewChatType] = useState<"profile" | "agent">("profile");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // PERFORMANCE: Load from cache immediately for instant UI
    const cachedConversations = localStorage.getItem('messages_conversations');
    if (cachedConversations) {
      try {
        const parsed = JSON.parse(cachedConversations);
        setConversations(parsed);
        setLoading(false); // UI ready instantly!
      } catch (e) {
        console.warn('Failed to parse cached conversations');
      }
    }
    
    // Load fresh data in background
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl("/messaging/conversations"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load conversations");

      const data = await res.json();
      setConversations(data.conversations);
      
      // PERFORMANCE: Cache for next visit
      localStorage.setItem('messages_conversations', JSON.stringify(data.conversations));
    } catch (error: any) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(buildUrl(`/messaging/conversations/${conversationId}/messages`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load messages");

      const data = await res.json();
      setMessages(data.messages);
    } catch (error: any) {
      console.error("Error loading messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || sending) return;

    if (selectedConversation.is_legacy) {
      alert("This is a legacy conversation. Please start a new chat to continue messaging.");
      return;
    }

    setSending(true);
    
    // Optimistic UI update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_type: "user",
      content: newMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    const messageContent = newMessage;
    setNewMessage("");

    try {
      const token = await getAccessToken();
      
      const res = await fetch(
        buildUrl(`/messaging/conversations/${selectedConversation.id}/messages`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: messageContent }),
        }
      );

      if (!res.ok) throw new Error("Failed to send message");

      const data = await res.json();
      
      // Replace optimistic message with real message
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== optimisticMessage.id);
        const result = [...filtered];
        if (data.user_message) {
          result.push(data.user_message);
        }
        if (data.agent_message) {
          result.push(data.agent_message);
        }
        return result;
      });
      
      // Update conversation preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, last_message_preview: messageContent, last_message_at: new Date().toISOString() }
            : c
        )
      );
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore message
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async () => {
    if (!newChatHandle.trim()) return;

    try {
      const token = await getAccessToken();
      
      const cleanHandle = newChatHandle.trim().replace(/^@/, '').toLowerCase();
      
      if (!cleanHandle) {
        alert("Please enter a valid handle");
        return;
      }
      
      const profileRes = await fetch(buildUrl(`/profiles/${cleanHandle}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!profileRes.ok) {
        const errorText = await profileRes.text();
        console.error("Profile lookup failed:", errorText);
        alert(`Profile not found: ${cleanHandle}\n\nMake sure the user exists and has set up their profile.`);
        return;
      }
      const profileData = await profileRes.json();
      
      let targetAveeId = null;
      if (newChatType === "agent") {
        const aveeRes = await fetch(buildUrl(`/avees/${cleanHandle}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!aveeRes.ok) {
          alert(`No agent found for @${cleanHandle}\n\nThis user hasn't created an agent yet. Try a Profile chat instead.`);
          return;
        }
        const aveeData = await aveeRes.json();
        targetAveeId = aveeData.id;
      }

      const res = await fetch(buildUrl("/messaging/conversations"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: profileData.user_id,
          chat_type: newChatType,
          target_avee_id: targetAveeId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to create conversation:", errorText);
        alert("Failed to create conversation. Please try again.");
        return;
      }

      const data = await res.json();
      setShowNewChat(false);
      setNewChatHandle("");
      loadConversations();
      
      const conv: Conversation = {
        id: data.id,
        chat_type: data.chat_type,
        other_participant: {
          user_id: profileData.user_id,
          handle: profileData.handle,
          display_name: profileData.display_name || profileData.handle,
          avatar_url: profileData.avatar_url,
        },
        target_avee: targetAveeId ? {
          id: targetAveeId,
          handle: cleanHandle,
          display_name: profileData.display_name || cleanHandle,
          avatar_url: profileData.avatar_url,
        } : null,
        last_message_at: new Date().toISOString(),
        last_message_preview: null,
        unread_count: 0,
      };
      setSelectedConversation(conv);
    } catch (error: any) {
      console.error("Error starting conversation:", error);
      alert(error.message || "Failed to start conversation");
    }
  };

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

  // Get message status icon based on sender type and validation
  const getMessageStatusIcon = (msg: Message) => {
    if (msg.sender_type === "user") {
      // Message from human user
      return (
        <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20" title="Sent by profile owner">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      );
    } else if (msg.sender_type === "agent") {
      if (msg.human_validated === "true") {
        // Agent message validated by human
        return (
          <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" title="AI response validated by profile owner">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      } else {
        // AI-generated message (not yet validated)
        return (
          <svg className="h-4 w-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20" title="AI-generated response">
            <path d="M13 7H7v6h6V7z" />
            <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
          </svg>
        );
      }
    } else if (msg.sender_type === "system") {
      // System message
      return (
        <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20" title="System message">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
    }
    return null;
  };
  
  // Filter conversations based on search
  const filteredList = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.other_participant.display_name.toLowerCase().includes(query) ||
      conv.other_participant.handle.toLowerCase().includes(query) ||
      (conv.last_message_preview && conv.last_message_preview.toLowerCase().includes(query))
    );
  });

  return (
    <NewLayoutWrapper>
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E6E6E6]">
      {/* Sidebar - Conversations List */}
      <div className="w-80 border-r border-[#E6E6E6] bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-[#E6E6E6] p-4 bg-[#FAFAFA]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-[#0B0B0C]">Messages</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="rounded-lg bg-[#2E3A59] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a2236] transition-colors shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-lg border border-[#E6E6E6] bg-white px-4 py-2 pl-10 text-sm focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <ConversationSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading && filteredList.length === 0 && !searchQuery && (
            <div className="px-4 py-8 text-center">
              <div className="text-[#2E3A59]/30 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-[#2E3A59]/70">No conversations yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 text-sm text-[#2E3A59] hover:text-[#1a2236] font-medium"
              >
                Start a conversation
              </button>
            </div>
          )}

          {!loading && filteredList.length === 0 && searchQuery && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#2E3A59]/70">No conversations found</p>
            </div>
          )}

          {!loading && filteredList.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`w-full border-b border-[#E6E6E6] p-4 text-left transition-colors hover:bg-[#FAFAFA] ${
                selectedConversation?.id === conv.id ? "bg-[#2E3A59]/5 border-l-4 border-l-[#2E3A59]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {/* Show agent avatar if it's an agent chat, otherwise show profile avatar */}
                  {(conv.chat_type === "agent" && conv.target_avee?.avatar_url) || conv.other_participant.avatar_url ? (
                    <img src={conv.chat_type === "agent" && conv.target_avee?.avatar_url ? conv.target_avee.avatar_url : conv.other_participant.avatar_url}
                      alt={conv.chat_type === "agent" && conv.target_avee ? conv.target_avee.display_name : conv.other_participant.display_name}
                      className="h-12 w-12 rounded-xl object-cover border-2 border-[#E6E6E6]"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#E6E6E6] bg-gradient-to-br from-[#2E3A59] to-[#1a2236]">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Agent indicator */}
                  {conv.chat_type === "agent" && (
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-[#C8A24A] p-1">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-semibold text-[#0B0B0C]">
                      {conv.chat_type === "agent" && conv.target_avee ? conv.target_avee.display_name : conv.other_participant.display_name}
                    </h3>
                    {conv.last_message_at && (
                      <span className="flex-shrink-0 text-xs text-[#2E3A59]/50">
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#2E3A59]/70">
                    @{conv.chat_type === "agent" && conv.target_avee ? conv.target_avee.handle : conv.other_participant.handle}
                    {conv.chat_type === "agent" && " • Agent"}
                  </p>
                  {conv.last_message_preview && (
                    <p className="mt-1 truncate text-sm text-[#2E3A59]/70">
                      {conv.last_message_preview}
                    </p>
                  )}
                  {conv.unread_count > 0 && (
                    <div className="mt-1 inline-flex items-center rounded-full bg-[#C8A24A] px-2 py-0.5 text-xs font-medium text-white">
                      {conv.unread_count} new
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {!selectedConversation ? (
          <div className="flex flex-1 items-center justify-center bg-[#FAFAFA]">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2E3A59]/10">
                <svg className="h-8 w-8 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#0B0B0C]">Select a conversation</h2>
              <p className="mt-1 text-sm text-[#2E3A59]/70">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="border-b border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <div className="flex items-center gap-3">
                {/* Show agent avatar if it's an agent chat, otherwise show profile avatar */}
                {(selectedConversation.chat_type === "agent" && selectedConversation.target_avee?.avatar_url) || selectedConversation.other_participant.avatar_url ? (
                  <img src={selectedConversation.chat_type === "agent" && selectedConversation.target_avee?.avatar_url ? selectedConversation.target_avee.avatar_url : selectedConversation.other_participant.avatar_url}
                    alt={selectedConversation.chat_type === "agent" && selectedConversation.target_avee ? selectedConversation.target_avee.display_name : selectedConversation.other_participant.display_name}
                    className="h-10 w-10 rounded-xl object-cover border-2 border-[#E6E6E6]"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#E6E6E6] bg-gradient-to-br from-[#2E3A59] to-[#1a2236]">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-[#0B0B0C]">
                    {selectedConversation.chat_type === "agent" && selectedConversation.target_avee ? selectedConversation.target_avee.display_name : selectedConversation.other_participant.display_name}
                  </h2>
                  <p className="text-sm text-[#2E3A59]/70">
                    @{selectedConversation.chat_type === "agent" && selectedConversation.target_avee ? selectedConversation.target_avee.handle : selectedConversation.other_participant.handle}
                    {selectedConversation.chat_type === "agent" && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#C8A24A]/10 px-2 py-0.5 text-xs font-medium text-[#C8A24A]">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Agent Chat
                    </span>
                  )}
                  {selectedConversation.is_legacy && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#E6E6E6] px-2 py-0.5 text-xs font-medium text-[#2E3A59]/70">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Read-only
                    </span>
                  )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-white">
              {loadingMessages ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <MessageSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isCurrentUser = msg.sender_type === "user";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-xl px-4 py-2 ${
                            isCurrentUser
                              ? "bg-[#2E3A59] text-white"
                              : "bg-[#FAFAFA] border border-[#E6E6E6] text-[#0B0B0C]"
                          }`}
                        >
                          {!isCurrentUser && msg.sender_info && (
                            <div className="mb-1 text-xs font-medium text-[#2E3A59]/70">
                              {msg.sender_type === "agent" && "🤖 "}
                              {msg.sender_info.display_name || msg.sender_info.handle}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          <div className={`mt-1 flex items-center gap-1.5 ${isCurrentUser ? "text-white/70" : "text-[#2E3A59]/50"}`}>
                            {getMessageStatusIcon(msg)}
                            <p className="text-xs">
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[#E6E6E6] bg-white p-4">
              {selectedConversation.is_legacy ? (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
                  <p className="text-sm text-yellow-800 flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This is a read-only conversation from the old chat system. Start a new chat to continue messaging.
                  </p>
                </div>
              ) : (
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
                  className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="rounded-lg bg-[#2E3A59] px-4 py-2 text-white hover:bg-[#1a2236] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {sending ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#0B0B0C]">
                Start New Conversation
              </h2>
              <button
                onClick={() => setShowNewChat(false)}
                className="rounded-lg p-1 hover:bg-[#FAFAFA] transition-colors"
              >
                <svg className="h-6 w-6 text-[#2E3A59]/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0B0B0C] mb-1">
                  Handle or Username
                </label>
                <input
                  type="text"
                  value={newChatHandle}
                  onChange={(e) => setNewChatHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0B0B0C] mb-2">
                  Chat Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewChatType("profile")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      newChatType === "profile"
                        ? "border-[#2E3A59] bg-[#2E3A59]/5 text-[#2E3A59]"
                        : "border-[#E6E6E6] bg-white text-[#2E3A59]/70 hover:border-[#E6E6E6]"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </div>
                  </button>
                  <button
                    onClick={() => setNewChatType("agent")}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      newChatType === "agent"
                        ? "border-[#C8A24A] bg-[#C8A24A]/5 text-[#C8A24A]"
                        : "border-[#E6E6E6] bg-white text-[#2E3A59]/70 hover:border-[#E6E6E6]"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Agent
                    </div>
                  </button>
                </div>
                <p className="mt-2 text-xs text-[#2E3A59]/70 text-center">
                  {newChatType === "profile"
                    ? "Send messages directly to their inbox"
                    : "Chat with their AI agent"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setNewChatHandle("");
                }}
                className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#2E3A59]/70 hover:bg-[#FAFAFA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startNewConversation}
                disabled={!newChatHandle.trim()}
                className="flex-1 rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a2236] disabled:opacity-50 transition-colors shadow-sm"
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </NewLayoutWrapper>
  );
}
