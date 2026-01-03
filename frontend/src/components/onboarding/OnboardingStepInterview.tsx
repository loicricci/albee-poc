"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface OnboardingStepInterviewProps {
  displayName: string;
  onComplete: (persona: string, conversationHistory: Message[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function OnboardingStepInterview({ displayName, onComplete, onSkip, onBack }: OnboardingStepInterviewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi ${displayName}! I'm here to help create your digital twin. Let's start - what should I know about you?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPersona, setSuggestedPersona] = useState<string | null>(null);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) throw new Error("Not logged in.");
    return token;
  }

  function apiBase() {
    const base = process.env.NEXT_PUBLIC_API_BASE;
    if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE.");
    return base;
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/onboarding/interview-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      
      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages([...updatedMessages, assistantMessage]);

      if (data.interview_complete && data.suggested_persona) {
        setInterviewComplete(true);
        setSuggestedPersona(data.suggested_persona);
      }
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      // Remove the user message on error
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptPersona() {
    if (suggestedPersona) {
      onComplete(suggestedPersona, messages);
    }
  }

  function handleRefine() {
    setInterviewComplete(false);
    setSuggestedPersona(null);
    setMessages([
      ...messages,
      {
        role: "user",
        content: "Let's refine it a bit more.",
      },
    ]);
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[#0B0B0C] dark:text-white mb-3">
          Meet your AI interviewer
        </h1>
        <p className="text-[#2E3A59]/70 dark:text-zinc-400">
          Let's create your digital twin persona together
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-950 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-[#2E3A59] text-white dark:bg-white dark:text-[#0B0B0C]"
                    : "bg-[#F5F5F5] text-[#0B0B0C] dark:bg-zinc-900 dark:text-white"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F5F5F5] dark:bg-zinc-900 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#2E3A59]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-[#2E3A59]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-[#2E3A59]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Persona Review Section */}
      {interviewComplete && suggestedPersona && (
        <div className="mb-4 rounded-2xl border-2 border-[#2E3A59] dark:border-white bg-[#2E3A59]/5 dark:bg-white/[.05] p-4">
          <h3 className="text-lg font-semibold text-[#0B0B0C] dark:text-white mb-2">
            Your Persona:
          </h3>
          <p className="text-sm text-[#2E3A59] dark:text-zinc-300 whitespace-pre-wrap mb-4">
            {suggestedPersona}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptPersona}
              className="flex-1 rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#1a2236] dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
            >
              This looks great!
            </button>
            <button
              onClick={handleRefine}
              className="flex-1 rounded-lg border border-[#2E3A59] dark:border-white px-4 py-2 text-sm font-medium text-[#2E3A59] dark:text-white transition-colors hover:bg-[#2E3A59]/10 dark:hover:bg-white/[.10]"
            >
              Let's refine it
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      {!interviewComplete && (
        <form onSubmit={handleSendMessage} className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={loading}
            className="flex-1 rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-lg bg-[#2E3A59] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#1a2236] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
          >
            Send
          </button>
        </form>
      )}

      <button
        onClick={onSkip}
        disabled={loading}
        className="w-full rounded-full border-2 border-[#E6E6E6] dark:border-white/[.20] px-6 py-3 text-sm font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#2E3A59] dark:hover:border-white/[.30] hover:bg-[#E6E6E6]/50 dark:hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Skip & Use Basic Persona
      </button>

      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#2E3A59] dark:bg-white"></div>
        </div>
        <p className="mt-2 text-xs text-[#2E3A59]/50 dark:text-zinc-500">
          Step 4 of 4
        </p>
      </div>
    </div>
  );
}






