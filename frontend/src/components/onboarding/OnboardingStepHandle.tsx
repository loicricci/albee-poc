"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface HandleSuggestion {
  handle: string;
  available: boolean;
}

interface OnboardingStepHandleProps {
  name: string;
  onNext: (handle: string) => void;
  onBack: () => void;
}

export function OnboardingStepHandle({ name, onNext, onBack }: OnboardingStepHandleProps) {
  const [suggestions, setSuggestions] = useState<HandleSuggestion[]>([]);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [customHandle, setCustomHandle] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [customAvailable, setCustomAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [name]);

  useEffect(() => {
    if (customHandle && showCustom) {
      const timer = setTimeout(() => {
        checkCustomHandle(customHandle);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [customHandle, showCustom]);

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

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/onboarding/suggest-handles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function checkCustomHandle(handle: string) {
    const cleaned = handle.trim().toLowerCase();
    
    // Validate format
    if (cleaned.length < 3) {
      setCustomAvailable(null);
      return;
    }
    
    if (cleaned.length > 20) {
      setCustomAvailable(false);
      return;
    }
    
    if (!/^[a-z0-9_]+$/.test(cleaned)) {
      setCustomAvailable(false);
      return;
    }

    setCheckingAvailability(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/onboarding/suggest-handles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: cleaned }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      const exact = data.suggestions?.find((s: HandleSuggestion) => s.handle === cleaned);
      setCustomAvailable(exact ? exact.available : false);
    } catch {
      setCustomAvailable(null);
    } finally {
      setCheckingAvailability(false);
    }
  }

  function handleSelectSuggestion(handle: string, available: boolean) {
    if (!available) return;
    setSelectedHandle(handle);
    setShowCustom(false);
    setCustomHandle("");
  }

  function handleSubmit() {
    if (showCustom && customHandle.trim()) {
      const cleaned = customHandle.trim().toLowerCase();
      if (customAvailable && cleaned.length >= 3 && cleaned.length <= 20) {
        onNext(cleaned);
      }
    } else if (selectedHandle) {
      onNext(selectedHandle);
    }
  }

  const canProceed = showCustom 
    ? customAvailable === true && customHandle.trim().length >= 3
    : selectedHandle !== null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0B0B0C] dark:text-white mb-3">
          Choose your handle
        </h1>
        <p className="text-[#2E3A59]/70 dark:text-zinc-400">
          This is how others will find you
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="h-8 w-8 animate-spin text-[#2E3A59]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.handle}
                onClick={() => handleSelectSuggestion(suggestion.handle, suggestion.available)}
                disabled={!suggestion.available}
                className={`
                  relative rounded-lg border-2 p-4 text-left transition-all
                  ${selectedHandle === suggestion.handle
                    ? "border-[#2E3A59] bg-[#2E3A59]/5 dark:border-white dark:bg-white/[.08]"
                    : suggestion.available
                      ? "border-[#E6E6E6] dark:border-white/[.08] hover:border-[#2E3A59]/50 dark:hover:border-white/[.20]"
                      : "border-[#E6E6E6] dark:border-white/[.08] opacity-40 cursor-not-allowed"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-lg font-semibold text-[#0B0B0C] dark:text-white">
                    @{suggestion.handle}
                  </div>
                  {suggestion.available ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Available
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-red-600">Taken</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mb-6">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full rounded-lg border-2 border-dashed border-[#E6E6E6] dark:border-white/[.20] px-4 py-3 text-sm font-medium text-[#2E3A59] dark:text-white transition-colors hover:border-[#2E3A59] dark:hover:border-white/[.30] hover:bg-[#2E3A59]/5 dark:hover:bg-white/[.05]"
              >
                Or type your own
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono text-[#2E3A59]/50 dark:text-zinc-500">
                    @
                  </span>
                  <input
                    type="text"
                    value={customHandle}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setCustomHandle(val);
                      setCustomAvailable(null);
                    }}
                    placeholder="your_handle"
                    className="w-full rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 pl-8 pr-12 py-3 text-lg font-mono text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10]"
                    autoFocus
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checkingAvailability ? (
                      <svg className="h-5 w-5 animate-spin text-[#2E3A59]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : customAvailable === true ? (
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : customAvailable === false && customHandle.length >= 3 ? (
                      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-[#2E3A59]/60 dark:text-zinc-500">
                  3-20 characters, letters, numbers, and underscores only
                </p>
                <button
                  onClick={() => {
                    setShowCustom(false);
                    setCustomHandle("");
                    setCustomAvailable(null);
                  }}
                  className="text-xs text-[#2E3A59]/70 dark:text-zinc-400 hover:text-[#2E3A59] dark:hover:text-white"
                >
                  Choose from suggestions instead
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canProceed}
        className="w-full rounded-full bg-[#2E3A59] px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#1a2236] hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
      >
        Next
      </button>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#2E3A59] dark:bg-white"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
        </div>
        <p className="mt-2 text-xs text-[#2E3A59]/50 dark:text-zinc-500">
          Step 2 of 4
        </p>
      </div>
    </div>
  );
}



