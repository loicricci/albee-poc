"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
};

type AgentCache = {
  [handle: string]: { data: Agent; timestamp: number };
};

type AgentCacheContextType = {
  getAgent: (handle: string) => Agent | null;
  setAgent: (handle: string, agent: Agent) => void;
};

const AgentCacheContext = createContext<AgentCacheContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AgentCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<AgentCache>({});

  const getAgent = (handle: string): Agent | null => {
    const cached = cache[handle];
    if (!cached) return null;

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION) {
      // Cache expired
      return null;
    }

    return cached.data;
  };

  const setAgent = (handle: string, agent: Agent) => {
    setCache((prev) => ({
      ...prev,
      [handle]: {
        data: agent,
        timestamp: Date.now(),
      },
    }));
  };

  return (
    <AgentCacheContext.Provider value={{ getAgent, setAgent }}>
      {children}
    </AgentCacheContext.Provider>
  );
}

export function useAgentCache() {
  const context = useContext(AgentCacheContext);
  if (!context) {
    throw new Error("useAgentCache must be used within AgentCacheProvider");
  }
  return context;
}







