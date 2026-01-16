"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { transcribeAudio } from "@/lib/upload";

// Lazy load VoiceRecorder (only loads when user clicks record button)
const VoiceRecorder = dynamic(() => import("../VoiceRecorder").then(mod => ({ default: mod.VoiceRecorder })), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-500">Loading recorder...</div>,
});

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

  // Voice input state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);

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

  async function handleVoiceRecording(audioBlob: Blob) {
    setTranscribingAudio(true);
    setShowVoiceRecorder(false);
    setError(null);

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
      setError(`Voice transcription error: ${e.message}`);
    } finally {
      setTranscribingAudio(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-[#001f98]/70 dark:text-zinc-400 hover:text-[#001f98] dark:hover:text-white transition-colors"
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
        <p className="text-[#001f98]/70 dark:text-zinc-400">
          Let's create your digital twin persona together
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-950 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-[#001f98] text-white dark:bg-white dark:text-[#0B0B0C]"
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
                  <div className="h-2 w-2 rounded-full bg-[#001f98]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-[#001f98]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="h-2 w-2 rounded-full bg-[#001f98]/50 dark:bg-white/[.50] animate-bounce" style={{ animationDelay: "300ms" }}></div>
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
        <div className="mb-4 rounded-2xl border-2 border-[#001f98] dark:border-white bg-[#001f98]/5 dark:bg-white/[.05] p-4">
          <h3 className="text-lg font-semibold text-[#0B0B0C] dark:text-white mb-2">
            Your Persona:
          </h3>
          <p className="text-sm text-[#001f98] dark:text-zinc-300 whitespace-pre-wrap mb-4">
            {suggestedPersona}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptPersona}
              className="flex-1 rounded-lg bg-[#001f98] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#001670] dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
            >
              This looks great!
            </button>
            <button
              onClick={handleRefine}
              className="flex-1 rounded-lg border border-[#001f98] dark:border-white px-4 py-2 text-sm font-medium text-[#001f98] dark:text-white transition-colors hover:bg-[#001f98]/10 dark:hover:bg-white/[.10]"
            >
              Let's refine it
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      {!interviewComplete && (
        <div className="mb-4">
          {showVoiceRecorder ? (
            <div className="rounded-xl border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-[#001f98] dark:text-white">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                  Record Voice Message
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceRecorder(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
              <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
                Record up to 60 seconds. Your voice will be transcribed to text.
              </p>
            </div>
          ) : transcribingAudio ? (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 p-4">
              <svg className="h-5 w-5 animate-spin text-[#001f98] dark:text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-[#001f98] dark:text-white">Transcribing your voice message...</span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or use voice input..."
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#001f98] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 dark:focus:ring-white/[.10] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(true)}
                disabled={loading}
                className="rounded-lg border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 px-3 py-3 text-[#001f98] dark:text-white transition-all hover:bg-[#001f98]/10 dark:hover:bg-white/[.10] disabled:cursor-not-allowed disabled:opacity-50"
                title="Record voice message"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-lg bg-[#001f98] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#001670] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}

      <button
        onClick={onSkip}
        disabled={loading}
        className="w-full rounded-full border-2 border-gray-200 dark:border-white/[.20] px-6 py-3 text-sm font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#001f98] dark:hover:border-white/[.30] hover:bg-gray-200/50 dark:hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Skip & Use Basic Persona
      </button>

      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#001f98] dark:bg-white"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
        </div>
        <p className="mt-2 text-xs text-[#001f98]/50 dark:text-zinc-500">
          Step 4 of 5
        </p>
      </div>
    </div>
  );
}








