"use client";

import { useState } from "react";

interface OnboardingStepAgentTypeProps {
  onNext: (agentType: "persona" | "company") => void;
  onBack: () => void;
}

export function OnboardingStepAgentType({ onNext, onBack }: OnboardingStepAgentTypeProps) {
  const [selected, setSelected] = useState<"persona" | "company" | null>(null);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-[#001f98]/70 dark:text-zinc-400 hover:text-[#001f98] dark:hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0B0B0C] dark:text-white mb-3">
          What type of agent?
        </h1>
        <p className="text-[#001f98]/70 dark:text-zinc-400">
          Choose whether you're creating a personal digital twin or a company/brand agent
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Persona Option */}
        <button
          onClick={() => setSelected("persona")}
          className={`group relative p-6 rounded-2xl border-2 transition-all text-left ${
            selected === "persona"
              ? "border-[#001f98] dark:border-white bg-[#001f98]/5 dark:bg-white/[.05]"
              : "border-gray-200 dark:border-white/[.08] hover:border-[#001f98]/50 dark:hover:border-white/[.20] hover:bg-gray-50 dark:hover:bg-white/[.02]"
          }`}
        >
          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
            selected === "persona"
              ? "bg-[#001f98] dark:bg-white"
              : "bg-gray-100 dark:bg-zinc-800 group-hover:bg-[#001f98]/10 dark:group-hover:bg-white/[.10]"
          }`}>
            <svg 
              className={`w-7 h-7 ${
                selected === "persona" 
                  ? "text-white dark:text-[#0B0B0C]" 
                  : "text-[#001f98] dark:text-white"
              }`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>

          <h3 className={`text-lg font-semibold mb-2 ${
            selected === "persona" 
              ? "text-[#001f98] dark:text-white" 
              : "text-[#0B0B0C] dark:text-white"
          }`}>
            Personal Twin
          </h3>
          <p className="text-sm text-[#001f98]/70 dark:text-zinc-400">
            Create your digital twin that represents you — your personality, expertise, and communication style.
          </p>

          {/* Selected indicator */}
          {selected === "persona" && (
            <div className="absolute top-4 right-4">
              <div className="w-6 h-6 rounded-full bg-[#001f98] dark:bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>

        {/* Company Option */}
        <button
          onClick={() => setSelected("company")}
          className={`group relative p-6 rounded-2xl border-2 transition-all text-left ${
            selected === "company"
              ? "border-[#001f98] dark:border-white bg-[#001f98]/5 dark:bg-white/[.05]"
              : "border-gray-200 dark:border-white/[.08] hover:border-[#001f98]/50 dark:hover:border-white/[.20] hover:bg-gray-50 dark:hover:bg-white/[.02]"
          }`}
        >
          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
            selected === "company"
              ? "bg-[#001f98] dark:bg-white"
              : "bg-gray-100 dark:bg-zinc-800 group-hover:bg-[#001f98]/10 dark:group-hover:bg-white/[.10]"
          }`}>
            <svg 
              className={`w-7 h-7 ${
                selected === "company" 
                  ? "text-white dark:text-[#0B0B0C]" 
                  : "text-[#001f98] dark:text-white"
              }`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
              />
            </svg>
          </div>

          <h3 className={`text-lg font-semibold mb-2 ${
            selected === "company" 
              ? "text-[#001f98] dark:text-white" 
              : "text-[#0B0B0C] dark:text-white"
          }`}>
            Company / Brand
          </h3>
          <p className="text-sm text-[#001f98]/70 dark:text-zinc-400">
            Create an AI agent for your business or brand — its mission, values, and brand voice.
          </p>

          {/* Selected indicator */}
          {selected === "company" && (
            <div className="absolute top-4 right-4">
              <div className="w-6 h-6 rounded-full bg-[#001f98] dark:bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-white dark:text-[#0B0B0C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>
      </div>

      <button
        onClick={() => selected && onNext(selected)}
        disabled={!selected}
        className="w-full rounded-full bg-[#001f98] px-6 py-4 text-base font-semibold text-white transition-all hover:bg-[#001670] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
      >
        Continue
      </button>

      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#001f98] dark:bg-white"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-white/[.20]"></div>
        </div>
        <p className="mt-2 text-xs text-[#001f98]/50 dark:text-zinc-500">
          Step 4 of 6
        </p>
      </div>
    </div>
  );
}
