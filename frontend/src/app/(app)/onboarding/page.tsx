"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAppData } from "@/contexts/AppDataContext";
import { invalidateCache, clearAllCaches } from "@/lib/apiCache";
import { OnboardingStepName } from "@/components/onboarding/OnboardingStepName";
import { OnboardingStepHandle } from "@/components/onboarding/OnboardingStepHandle";
import { OnboardingStepProfile } from "@/components/onboarding/OnboardingStepProfile";
import { OnboardingStepInterview } from "@/components/onboarding/OnboardingStepInterview";
import { OnboardingStepFollowAgents } from "@/components/onboarding/OnboardingStepFollowAgents";

type Step = 1 | 2 | 3 | 4 | 5;

interface OnboardingData {
  name: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  persona: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { onboardingStatus } = useAppData();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  // FIX: Start with loading=false since AppDataContext already checked onboarding status
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [profileCreated, setProfileCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});

  // Use onboardingStatus from AppDataContext instead of making redundant API call
  useEffect(() => {
    // If AppDataContext says onboarding is completed, redirect to app
    if (onboardingStatus?.completed) {
      router.push("/app");
    }
  }, [onboardingStatus, router]);

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

  // Create profile but don't redirect - used before showing follow agents step
  async function createProfileAndProceed(persona: string | null) {
    setCreatingProfile(true);
    setError(null);

    try {
      const token = await getAccessToken();
      
      const payload = {
        handle: onboardingData.handle!,
        display_name: onboardingData.displayName || onboardingData.name,
        bio: onboardingData.bio || "",
        avatar_url: onboardingData.avatarUrl || "",
        persona: persona || `I'm ${onboardingData.displayName || onboardingData.name}, looking forward to connecting!`,
      };

      const res = await fetch(`${apiBase()}/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create profile");
      }

      // Profile created successfully - now show follow agents step
      setProfileCreated(true);
      setOnboardingData({ ...onboardingData, persona });
      setCurrentStep(5);
    } catch (err: any) {
      setError(err.message || "Failed to create profile");
    } finally {
      setCreatingProfile(false);
    }
  }

  // Final step - redirect to app
  function finishOnboarding() {
    setCompleting(true);
    
    // Clear ALL caches before redirect
    clearAllCaches();
    try {
      sessionStorage.clear();
    } catch (e) {
      // Ignore
    }
    
    // Use window.location for a hard redirect that forces a fresh page load
    window.location.href = "/app";
  }

  // Step 1: Name
  function handleNameNext(name: string) {
    setOnboardingData({ ...onboardingData, name });
    setCurrentStep(2);
  }

  // Step 2: Handle
  function handleHandleNext(handle: string) {
    setOnboardingData({ ...onboardingData, handle });
    setCurrentStep(3);
  }

  function handleHandleBack() {
    setCurrentStep(1);
  }

  // Step 3: Profile
  function handleProfileNext(data: { displayName: string; bio: string; avatarUrl: string }) {
    setOnboardingData({ 
      ...onboardingData, 
      displayName: data.displayName,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
    });
    setCurrentStep(4);
  }

  function handleProfileSkip() {
    setOnboardingData({ 
      ...onboardingData, 
      displayName: onboardingData.name || "",
      bio: "",
      avatarUrl: "",
    });
    setCurrentStep(4);
  }

  function handleProfileBack() {
    setCurrentStep(2);
  }

  // Step 4: Interview
  function handleInterviewComplete(persona: string) {
    // Create profile first, then proceed to follow agents step
    createProfileAndProceed(persona);
  }

  function handleInterviewSkip() {
    // Create profile first with default persona, then proceed to follow agents step
    createProfileAndProceed(null);
  }

  function handleInterviewBack() {
    setCurrentStep(3);
  }

  // Step 5: Follow Agents
  function handleFollowAgentsComplete() {
    // Profile already created - just redirect to app
    finishOnboarding();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#FAFAFA] to-white dark:from-gray-900 dark:via-[#0F0F10] dark:to-gray-900">
        <div className="text-center">
          <svg className="h-12 w-12 animate-spin text-[#001f98] dark:text-white mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-[#001f98]/70 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (creatingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#FAFAFA] to-white dark:from-gray-900 dark:via-[#0F0F10] dark:to-gray-900">
        <div className="text-center max-w-md px-4">
          <svg className="h-12 w-12 animate-spin text-[#001f98] dark:text-white mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Creating your profile...
          </h2>
          <p className="text-[#001f98]/70 dark:text-zinc-400">
            Setting up your account and digital twin
          </p>
        </div>
      </div>
    );
  }

  if (completing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#FAFAFA] to-white dark:from-gray-900 dark:via-[#0F0F10] dark:to-gray-900">
        <div className="text-center max-w-md px-4">
          <svg className="h-12 w-12 animate-spin text-[#001f98] dark:text-white mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Almost there...
          </h2>
          <p className="text-[#001f98]/70 dark:text-zinc-400">
            Taking you to your new feed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#FAFAFA] to-white dark:from-gray-900 dark:via-[#0F0F10] dark:to-gray-900 px-4 py-12">
      <div className="w-full">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {currentStep === 1 && (
          <OnboardingStepName onNext={handleNameNext} />
        )}

        {currentStep === 2 && onboardingData.name && (
          <OnboardingStepHandle 
            name={onboardingData.name} 
            onNext={handleHandleNext}
            onBack={handleHandleBack}
          />
        )}

        {currentStep === 3 && onboardingData.name && onboardingData.handle && (
          <OnboardingStepProfile
            name={onboardingData.name}
            handle={onboardingData.handle}
            onNext={handleProfileNext}
            onBack={handleProfileBack}
            onSkip={handleProfileSkip}
          />
        )}

        {currentStep === 4 && onboardingData.displayName && (
          <OnboardingStepInterview
            displayName={onboardingData.displayName}
            onComplete={handleInterviewComplete}
            onSkip={handleInterviewSkip}
            onBack={handleInterviewBack}
          />
        )}

        {currentStep === 5 && profileCreated && (
          <OnboardingStepFollowAgents
            onComplete={handleFollowAgentsComplete}
          />
        )}
      </div>
    </div>
  );
}








