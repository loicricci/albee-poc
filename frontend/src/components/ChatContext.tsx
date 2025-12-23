"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ChatWindow = {
  id: string;
  handle: string;
  displayName?: string;
};

type ChatContextType = {
  chats: ChatWindow[];
  openChat: (handle: string, displayName?: string) => void;
  closeChat: (id: string) => void;
  minimizeChat: (id: string) => void;
  maximizedChats: Set<string>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatWindow[]>([]);
  const [maximizedChats, setMaximizedChats] = useState<Set<string>>(new Set());

  const openChat = (handle: string, displayName?: string) => {
    // Check if chat already exists
    const exists = chats.find((c) => c.handle === handle);
    if (exists) {
      // Bring to front / maximize
      setMaximizedChats((prev) => new Set(prev).add(exists.id));
      return;
    }

    // Create new chat
    const id = `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newChat: ChatWindow = { id, handle, displayName };
    setChats((prev) => [...prev, newChat]);
    setMaximizedChats((prev) => new Set(prev).add(id));
  };

  const closeChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setMaximizedChats((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const minimizeChat = (id: string) => {
    setMaximizedChats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ChatContext.Provider
      value={{ chats, openChat, closeChat, minimizeChat, maximizedChats }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}


