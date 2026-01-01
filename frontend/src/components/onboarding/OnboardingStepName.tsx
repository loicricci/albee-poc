"use client";

import { useState } from "react";

interface OnboardingStepNameProps {
  onNext: (name: string) => void;
}

export function OnboardingStepName({ onNext }: OnboardingStepNameProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }
    
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    
    onNext(trimmedName);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0B0B0C] dark:text-white mb-3">
          Welcome! What's your name?
        </h1>
        <p className="text-[#2E3A59]/70 dark:text-zinc-400">
          We'll use this to set up your profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g., John Smith"
            className="w-full rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-4 text-lg text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10]"
            autoFocus
            required
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-full bg-[#2E3A59] px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#1a2236] hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
        >
          Next
        </button>
      </form>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#2E3A59] dark:bg-white"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
        </div>
        <p className="mt-2 text-xs text-[#2E3A59]/50 dark:text-zinc-500">
          Step 1 of 4
        </p>
      </div>
    </div>
  );
}


