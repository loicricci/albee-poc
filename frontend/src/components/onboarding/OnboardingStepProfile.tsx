"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface OnboardingStepProfileProps {
  name: string;
  handle: string;
  onNext: (data: { displayName: string; bio: string; avatarUrl: string }) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function OnboardingStepProfile({ name, handle, onNext, onBack, onSkip }: OnboardingStepProfileProps) {
  const [displayName, setDisplayName] = useState(name);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("File must be an image");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("app-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("app-images")
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    onNext({
      displayName: displayName.trim() || name,
      bio: bio.trim(),
      avatarUrl,
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
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
          Tell us about yourself
        </h1>
        <p className="text-[#2E3A59]/70 dark:text-zinc-400">
          You can always change this later
        </p>
      </div>

      <div className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="h-24 w-24 rounded-full border-2 border-[#E6E6E6] dark:border-white/[.20] bg-gradient-to-br from-[#2E3A59] to-[#1a2236] overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {(displayName || name)[0].toUpperCase()}
                </span>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>

          <label className="cursor-pointer text-sm font-medium text-[#2E3A59] dark:text-white hover:underline">
            {avatarUrl ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {uploadError && (
            <p className="mt-2 text-sm text-red-600">{uploadError}</p>
          )}
        </div>

        {/* Display Name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#0B0B0C] dark:text-zinc-300">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            className="w-full rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10]"
          />
          <p className="mt-1 text-xs text-[#2E3A59]/60 dark:text-zinc-500">
            Your handle: @{handle}
          </p>
        </div>

        {/* Bio */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#0B0B0C] dark:text-zinc-300">
            Bio <span className="text-[#2E3A59]/50 dark:text-zinc-500">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => {
              if (e.target.value.length <= 160) {
                setBio(e.target.value);
              }
            }}
            placeholder="Tell us a bit about yourself..."
            rows={3}
            className="w-full rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10] resize-none"
          />
          <p className="mt-1 text-xs text-[#2E3A59]/60 dark:text-zinc-500 text-right">
            {bio.length}/160
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full rounded-full bg-[#2E3A59] px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#1a2236] hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
        >
          Next
        </button>

        <button
          onClick={onSkip}
          disabled={uploading}
          className="w-full rounded-full border-2 border-[#E6E6E6] dark:border-white/[.20] px-6 py-4 text-base font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#2E3A59] dark:hover:border-white/[.30] hover:bg-[#E6E6E6]/50 dark:hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
          <div className="h-2 w-2 rounded-full bg-[#2E3A59] dark:bg-white"></div>
          <div className="h-2 w-2 rounded-full bg-[#E6E6E6] dark:bg-white/[.20]"></div>
        </div>
        <p className="mt-2 text-xs text-[#2E3A59]/50 dark:text-zinc-500">
          Step 3 of 4
        </p>
      </div>
    </div>
  );
}



