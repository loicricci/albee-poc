"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  addTrainingDocument,
  chatAsk,
  getMyProfile,
  setAgentPermission,
  updateAgent,
  saveMyProfile,
} from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";
import { ChatButton } from "@/components/ChatButton";
import { AgentUpdates } from "@/components/AgentUpdates";
import { TrainingDocuments } from "@/components/TrainingDocuments";
import { updateAveeProfileFromVoice } from "@/lib/upload";
import { supabase } from "@/lib/supabaseClient";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

// PERFORMANCE: Lazy load VoiceRecorder (only loads when needed)
const VoiceRecorder = dynamic(() => import("@/components/VoiceRecorder").then(mod => ({ default: mod.VoiceRecorder })), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-600">Loading recorder...</div>,
});

type Profile = {
  user_id?: string;
  handle?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  is_admin?: boolean;
  agent_id?: string;
  persona?: string;
};

function AgentEditorContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Persona
  const [persona, setPersona] = useState("");
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaMsg, setPersonaMsg] = useState<string | null>(null);
  const [uploadingPersona, setUploadingPersona] = useState(false);
  const personaFileInputRef = useRef<HTMLInputElement>(null);

  // Training
  const [trainLayer, setTrainLayer] = useState<"public" | "friends" | "intimate">("public");
  const [trainTitle, setTrainTitle] = useState("");
  const [trainSource, setTrainSource] = useState("");
  const [trainContent, setTrainContent] = useState("");
  const [training, setTraining] = useState(false);
  const [trainingMode, setTrainingMode] = useState<"text" | "file" | "url">("text");
  
  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL extraction
  const [extractUrl, setExtractUrl] = useState("");
  const [extractingUrl, setExtractingUrl] = useState(false);
  const [showLinkedInWarning, setShowLinkedInWarning] = useState(false);

  // Permissions
  const [viewerHandle, setViewerHandle] = useState("");
  const [maxLayer, setMaxLayer] = useState<"public" | "friends" | "intimate">("friends");
  const [savingPerm, setSavingPerm] = useState(false);

  // Test
  const [testLayer, setTestLayer] = useState<"public" | "friends" | "intimate">("public");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  // Voice Profile Generation
  const [generatingFromVoice, setGeneratingFromVoice] = useState(false);
  const [voiceGenerationResult, setVoiceGenerationResult] = useState<{
    transcript: string;
    persona: string;
    bio: string;
    display_name: string;
  } | null>(null);
  const [showVoiceSection, setShowVoiceSection] = useState(false);

  const personaMeta = useMemo(() => {
    const lines = persona ? persona.split("\n").length : 0;
    return { chars: persona.length, lines };
  }, [persona]);

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    setAnswer(null);
    setPersonaMsg(null);

    try {
      const data = await getMyProfile();
      if (!data) {
        throw new Error("No profile found. Please create your profile first.");
      }

      setProfile(data);
      setPersona((data?.persona || "").toString());
    } catch (e: any) {
      setError(e.message || "Failed to load profile");
      setProfile(null);
      setPersona("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePersonaFile(file: File) {
    if (!profile?.agent_id) return;

    setError(null);
    setPersonaMsg(null);
    setUploadingPersona(true);

    try {
      // Check file type
      if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
        throw new Error("Please upload a .txt or .md file");
      }

      // Check file size (max 40KB for 40,000 chars)
      if (file.size > 40000) {
        throw new Error("Persona file too large (max 40,000 characters)");
      }

      // Read file content
      const text = await file.text();
      
      if (text.length > 40000) {
        throw new Error("Persona content too long (max 40,000 characters)");
      }

      // Update persona state
      setPersona(text);
      setPersonaMsg(`Persona file "${file.name}" loaded. Click 'Save Persona' to apply.`);
    } catch (e: any) {
      setPersonaMsg(e.message || "Failed to load persona file");
    } finally {
      setUploadingPersona(false);
    }
  }

  function onPersonaFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePersonaFile(file);
  }

  async function onSavePersona() {
    if (!profile || !profile.agent_id) return;

    setPersonaSaving(true);
    setError(null);
    setOkMsg(null);
    setPersonaMsg(null);

    try {
      const p = persona.trim();

      if (p.length > 40000) {
        throw new Error("Persona too long (max 40,000 characters)");
      }

      await updateAgent({ agentId: profile.agent_id, persona: p });
      setPersona(p);
      setPersonaMsg("Persona saved successfully.");
      
      // Update cache
      localStorage.setItem('user_profile', JSON.stringify({ ...profile, persona: p }));
    } catch (e: any) {
      setPersonaMsg(e.message || "Failed to save persona");
    } finally {
      setPersonaSaving(false);
    }
  }

  async function onAddDoc() {
    if (!profile?.agent_id) return;

    setTraining(true);
    setError(null);
    setOkMsg(null);

    try {
      const content = trainContent.trim();
      if (!content) throw new Error("Content is required");

      const res = await addTrainingDocument({
        agentId: profile.agent_id,
        layer: trainLayer,
        title: trainTitle.trim() || undefined,
        source: trainSource.trim() || undefined,
        content,
      });

      setTrainTitle("");
      setTrainSource("");
      setTrainContent("");

      setOkMsg(
        `Training saved. Layer "${res.layer}". Chunks created: ${res.chunks ?? "ok"}.`
      );
    } catch (e: any) {
      setError(e.message || "Failed to add training document");
    } finally {
      setTraining(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.agent_id) return;

    setUploadingFile(true);
    setError(null);
    setOkMsg(null);

    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        throw new Error("Not authenticated");
      }
      const token = data.session.access_token;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("layer", trainLayer);
      if (trainTitle.trim()) {
        formData.append("title", trainTitle.trim());
      }

      const apiBase = process.env.NEXT_PUBLIC_API_BASE;
      const res = await fetch(`${apiBase}/avees/${profile.agent_id}/documents/upload-file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        // Handle different error response formats
        let errorMessage: string;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          // FastAPI validation errors come as array
          errorMessage = errorData.detail.map((err: any) => 
            err.msg || err.message || JSON.stringify(err)
          ).join(', ');
        } else if (errorData.detail) {
          errorMessage = JSON.stringify(errorData.detail);
        } else {
          errorMessage = `Failed to upload file: ${res.status}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await res.json();

      setTrainTitle("");
      setOkMsg(
        `File "${result.original_filename}" processed successfully! ${result.chunks} chunks created.`
      );

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e: any) {
      setError(e.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleExtractFromUrl() {
    if (!profile?.agent_id || !extractUrl.trim()) return;

    setExtractingUrl(true);
    setError(null);
    setOkMsg(null);
    setShowLinkedInWarning(false);

    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        throw new Error("Not authenticated");
      }
      const token = data.session.access_token;

      const apiBase = process.env.NEXT_PUBLIC_API_BASE;
      
      const res = await fetch(`${apiBase}/avees/${profile.agent_id}/documents/from-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: extractUrl.trim(),
          layer: trainLayer,
          title: trainTitle.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        let errorMessage: string;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => 
            err.msg || err.message || JSON.stringify(err)
          ).join(', ');
        } else if (errorData.detail) {
          errorMessage = JSON.stringify(errorData.detail);
        } else {
          errorMessage = `Failed to extract content: ${res.status}`;
        }
        
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('linkedin')) {
          setShowLinkedInWarning(true);
        }
        
        throw new Error(errorMessage);
      }

      const result = await res.json();

      setExtractUrl("");
      setTrainTitle("");
      setOkMsg(
        `Content extracted from URL! ${result.chunks} chunks created. Title: "${result.title}"`
      );
    } catch (e: any) {
      const errorMessage = e.message || "Failed to extract content from URL";
      setError(errorMessage);
    } finally {
      setExtractingUrl(false);
    }
  }

  async function onSetPermission() {
    if (!profile?.agent_id) return;

    setSavingPerm(true);
    setError(null);
    setOkMsg(null);

    try {
      const vh = viewerHandle.trim().toLowerCase();
      if (!vh) throw new Error("viewer_handle is required");

      await setAgentPermission({
        agentId: profile.agent_id,
        viewerHandle: vh,
        maxLayer,
      });

      setOkMsg(`Permission saved: ${vh} → max layer "${maxLayer}".`);
      setViewerHandle("");
    } catch (e: any) {
      setError(e.message || "Failed to set permission");
    } finally {
      setSavingPerm(false);
    }
  }

  async function onAsk() {
    if (!profile?.handle) return;

    setAsking(true);
    setError(null);
    setOkMsg(null);
    setAnswer(null);

    try {
      const q = question.trim();
      if (!q) throw new Error("Question is required");

      const res = await chatAsk({
        agentHandle: profile.handle,
        layer: testLayer,
        question: q,
      });

      const textOut =
        typeof res === "string"
          ? res
          : res.answer || res.text || JSON.stringify(res, null, 2);

      setAnswer(textOut);
    } catch (e: any) {
      setError(e.message || "Failed to ask");
    } finally {
      setAsking(false);
    }
  }

  async function onVoiceRecordingComplete(audioBlob: Blob) {
    if (!profile?.agent_id) return;

    setGeneratingFromVoice(true);
    setError(null);
    setOkMsg(null);
    setVoiceGenerationResult(null);

    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        throw new Error("Not authenticated. Please log in again.");
      }
      const token = data.session.access_token;

      const audioFile = new File([audioBlob], "voice-intro.webm", {
        type: "audio/webm",
      });

      const result = await updateAveeProfileFromVoice(profile.agent_id, audioFile, token);

      setVoiceGenerationResult({
        transcript: result.transcript,
        persona: result.updated_fields.persona || "",
        bio: result.updated_fields.bio || "",
        display_name: result.updated_fields.display_name || "",
      });

      // Update local state
      setPersona(result.updated_fields.persona || "");
      
      setOkMsg(
        "Profile generated from voice! Your persona has been updated."
      );
    } catch (e: any) {
      setError(e.message || "Failed to generate profile from voice");
    } finally {
      setGeneratingFromVoice(false);
    }
  }

  function applyVoiceProfile() {
    if (!voiceGenerationResult) return;

    setPersona(voiceGenerationResult.persona);

    setOkMsg("Voice-generated persona applied! Remember to save your changes.");
    setVoiceGenerationResult(null);
    setShowVoiceSection(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-[#2E3A59]">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Loading Agent editor...</span>
        </div>
      </div>
    );
  }

  // If user is admin, show message that agents are managed separately
  if (profile?.is_admin) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-[#0B0B0C]">Admin User</h2>
          <p className="mb-4 text-[#2E3A59]/70">
            As an admin user, you manage agents through the <strong>My Agents</strong> page.
          </p>
          <Link
            href="/my-agents"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Go to My Agents
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-red-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-[#0B0B0C] mb-2">Profile not found</h3>
          <p className="text-sm text-[#2E3A59]/70 mb-6">Please create your profile first.</p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            Go to Account Settings
          </Link>
        </div>
      </div>
    );
  }

  // Show "Create Agent" CTA if no agent exists
  if (!profile.agent_id) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0B0B0C] mb-3">Create Your AI Agent</h1>
          <p className="text-base sm:text-lg text-[#2E3A59]/70">
            Set up your personal AI agent to interact with others
          </p>
        </div>

        <div className="rounded-3xl border-2 border-[#E6E6E6] bg-gradient-to-br from-white via-[#FAFAFA] to-white p-8 sm:p-12 shadow-lg">
          {/* Illustration */}
          <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#2E3A59]/10 to-[#C8A24A]/10">
            <svg className="h-16 w-16 text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-[#0B0B0C] mb-4">You don't have an AI agent yet</h2>
            <p className="text-[#2E3A59]/70 max-w-2xl mx-auto mb-6">
              An AI agent is your personal digital assistant that can interact with others on your behalf. 
              Create one to define its personality, train it with your knowledge, and let it represent you.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#0B0B0C] mb-1">Custom Personality</h3>
              <p className="text-xs text-[#2E3A59]/70">Define how your agent thinks and responds</p>
            </div>

            <div className="text-center p-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#0B0B0C] mb-1">Knowledge Base</h3>
              <p className="text-xs text-[#2E3A59]/70">Train it with your documents and information</p>
            </div>

            <div className="text-center p-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#0B0B0C] mb-1">Smart Interactions</h3>
              <p className="text-xs text-[#2E3A59]/70">Let others chat with your AI agent</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm text-[#2E3A59]/70 mb-4">
              <strong>First step:</strong> Make sure you've completed your profile with a username
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Complete Profile & Create Agent
              </Link>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-[#E6E6E6] px-6 py-4 text-base font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
              </svg>
              <div>
                <strong className="font-semibold">How it works:</strong>
                <ol className="mt-2 ml-4 list-decimal space-y-1">
                  <li>Complete your profile with a username (required)</li>
                  <li>Your agent will be automatically created when you save your profile</li>
                  <li>Return here to customize your agent's personality and knowledge</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B0B0C]">My Agent</h1>
          <p className="mt-2 text-sm sm:text-base text-[#2E3A59]/70">
            Configure your AI agent <span className="font-semibold">@{profile.handle}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {profile.handle && (
            <ChatButton
              handle={profile.handle}
              displayName={profile?.display_name || profile.handle}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-3 sm:px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Test Chat</span>
              <span className="sm:hidden">Chat</span>
            </ChatButton>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4 animate-slide-up">
          <svg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-medium text-red-800 break-words">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {okMsg && (
        <div className="mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3 rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4 animate-slide-up">
          <svg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-medium text-green-800 break-words">{okMsg}</div>
          </div>
          <button onClick={() => setOkMsg(null)} className="text-green-600 hover:text-green-800 shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Voice Profile Generation Card */}
        <div className="overflow-hidden rounded-2xl border border-[#C8A24A]/30 bg-gradient-to-br from-[#C8A24A]/5 to-white shadow-sm">
          <div className="flex items-start sm:items-center justify-between border-b border-[#C8A24A]/20 bg-white/50 px-4 sm:px-6 py-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#C8A24A] shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-[#0B0B0C]">🎙️ AI Profile Generation from Voice</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#2E3A59]/70">
                  Record a 30-second intro and let AI create your persona
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVoiceSection(!showVoiceSection)}
              className="rounded-lg p-2 transition-colors hover:bg-white/50 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#2E3A59] transition-transform ${
                  showVoiceSection ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showVoiceSection && (
            <div className="p-4 sm:p-6">
              <div className="mb-4 rounded-lg border border-[#C8A24A]/30 bg-white p-3 sm:p-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-[#C8A24A] mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#0B0B0C] mb-1">How it works:</div>
                    <ol className="list-decimal list-inside space-y-1 text-[#2E3A59]/80">
                      <li>Record a 30-second voice introduction talking about yourself</li>
                      <li>AI (GPT-4o) transcribes your speech using Whisper</li>
                      <li>AI generates a persona based on your intro</li>
                      <li>Review and apply the generated profile to your agent</li>
                    </ol>
                  </div>
                </div>
              </div>

              {!generatingFromVoice && !voiceGenerationResult && (
                <VoiceRecorder
                  onRecordingComplete={onVoiceRecordingComplete}
                  maxDuration={30}
                  className="mb-4"
                />
              )}

              {generatingFromVoice && (
                <div className="flex items-start sm:items-center gap-3 rounded-lg border border-[#C8A24A]/30 bg-white p-4 sm:p-6">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-[#C8A24A] shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-semibold text-[#0B0B0C]">Generating your profile...</div>
                    <div className="text-xs sm:text-sm text-[#2E3A59]/70 mt-1">
                      Transcribing audio and analyzing your personality with GPT-4o
                    </div>
                  </div>
                </div>
              )}

              {voiceGenerationResult && (
                <div className="space-y-3 sm:space-y-4 rounded-lg border border-[#C8A24A]/30 bg-white p-4 sm:p-6">
                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-[#0B0B0C]">📝 Transcript:</div>
                    <div className="rounded-lg bg-[#E6E6E6]/50 p-2 sm:p-3 text-xs sm:text-sm text-[#2E3A59]/80 italic break-words">
                      "{voiceGenerationResult.transcript}"
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-[#0B0B0C]">🎭 Generated Persona:</div>
                    <div className="max-h-32 sm:max-h-40 overflow-y-auto rounded-lg bg-[#E6E6E6]/50 p-2 sm:p-3 text-xs font-mono text-[#2E3A59]/80 break-words">
                      {voiceGenerationResult.persona}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-2">
                    <button
                      onClick={applyVoiceProfile}
                      className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C8A24A] to-[#a8862a] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Apply This Persona
                    </button>
                    <button
                      onClick={() => {
                        setVoiceGenerationResult(null);
                        setShowVoiceSection(false);
                      }}
                      className="rounded-lg border border-[#E6E6E6] px-4 sm:px-6 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Persona Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Persona</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">Define personality, tone, and behavior</p>
              </div>
              <div className="text-xs text-gray-500 shrink-0">
                {personaMeta.chars.toLocaleString()} chars · {personaMeta.lines} lines
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {/* File Upload Section */}
            <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => personaFileInputRef.current?.click()}
                disabled={uploadingPersona}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700 transition-all hover:border-purple-400 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingPersona ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading file...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Persona File (.txt or .md)
                  </>
                )}
              </button>
              <input
                ref={personaFileInputRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={onPersonaFileSelect}
              />
              <div className="text-xs text-gray-500 flex items-center">
                <svg className="h-4 w-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
                </svg>
                Upload a persona file to quickly load content
              </div>
            </div>

            <textarea
              className="h-48 sm:h-64 w-full rounded-lg border border-gray-300 px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs sm:text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setPersonaMsg(null);
              }}
              placeholder="Define the Agent's personality, values, tone, and boundaries here..."
            />
            
            {personaMsg && (
              <div className={`mt-3 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm ${
                personaMsg.includes("success") || personaMsg.includes("saved") || personaMsg.includes("loaded")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {personaMsg}
              </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-500">
                Injected as system prompt. Max 40,000 characters.
              </div>
              <button
                onClick={onSavePersona}
                disabled={personaSaving}
                className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {personaSaving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Persona
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Agent Updates Card */}
        {profile?.agent_id && (
          <AgentUpdates agentId={profile.agent_id} agentHandle={profile.handle || ""} />
        )}

        {/* Training Documents List Card */}
        {profile?.agent_id && (
          <TrainingDocuments agentId={profile.agent_id} agentHandle={profile.handle || ""} />
        )}

        {/* Training Data Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
          <div className="border-b border-[#E6E6E6] bg-gradient-to-r from-[#2E3A59]/5 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-[#0B0B0C]">Training Data</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#2E3A59]/70">Add knowledge and context for this Agent</p>
          </div>
          <div className="p-4 sm:p-6">
            {/* Tab Selection */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              <button
                onClick={() => setTrainingMode("text")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "text"
                    ? "bg-[#2E3A59] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                📝 Text
              </button>
              <button
                onClick={() => setTrainingMode("file")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "file"
                    ? "bg-[#2E3A59] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                📁 Upload File
              </button>
              <button
                onClick={() => setTrainingMode("url")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "url"
                    ? "bg-[#2E3A59] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                🔗 From URL
              </button>
            </div>

            {/* Common: Layer and Title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Layer</label>
                <select
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={trainLayer}
                  onChange={(e) => setTrainLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Title (optional)</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={trainTitle}
                  onChange={(e) => setTrainTitle(e.target.value)}
                  placeholder="e.g., Bio, FAQ, Memories"
                />
              </div>
            </div>

            {/* Text Mode */}
            {trainingMode === "text" && (
              <>
                <div className="sm:col-span-3 mb-4">
                  <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Source (optional)</label>
                  <input
                    className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={trainSource}
                    onChange={(e) => setTrainSource(e.target.value)}
                    placeholder="e.g., LinkedIn, website, notes"
                  />
                </div>

                <div className="sm:col-span-3 mb-4">
                  <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Content</label>
                  <textarea
                    className="h-32 sm:h-40 w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 sm:py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={trainContent}
                    onChange={(e) => setTrainContent(e.target.value)}
                    placeholder="Paste training content here..."
                  />
                </div>

                <button
                  onClick={onAddDoc}
                  disabled={training}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {training ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Training Document
                    </>
                  )}
                </button>
              </>
            )}

            {/* File Upload Mode */}
            {trainingMode === "file" && (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">
                    Upload File
                  </label>
                  <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.md,.markdown,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                      className="hidden"
                      disabled={uploadingFile}
                    />
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingFile ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Choose File
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-xs text-gray-500">
                      Supported: PDF, Word, Excel, CSV, Markdown, Images (JPG, PNG, etc.)
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Max file size: 50MB</p>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                  <strong>💡 How it works:</strong> Files are automatically processed to extract text content. Images are analyzed with GPT-4 Vision to extract text and descriptions.
                </div>
              </>
            )}

            {/* URL Mode */}
            {trainingMode === "url" && (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">URL</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>

                <button
                  onClick={handleExtractFromUrl}
                  disabled={extractingUrl || !extractUrl.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {extractingUrl ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Extracting...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Extract from URL
                    </>
                  )}
                </button>

                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                    <strong>💡 How it works:</strong> Content is extracted from web pages, articles, and blog posts. The system automatically cleans and formats the text for training.
                  </div>
                  
                  {showLinkedInWarning && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <strong>⚠️ LinkedIn Note:</strong> LinkedIn profiles cannot be scraped directly due to authentication requirements. To add your LinkedIn profile:
                          <ol className="mt-2 ml-4 list-decimal space-y-1">
                            <li>Go to your LinkedIn profile</li>
                            <li>Copy the text content manually</li>
                            <li>Use the <strong>📝 Text</strong> tab to paste it</li>
                          </ol>
                          <p className="mt-2">Or export your LinkedIn data: Settings → Data Privacy → Get a copy of your data</p>
                        </div>
                        <button
                          onClick={() => setShowLinkedInWarning(false)}
                          className="shrink-0 text-amber-600 hover:text-amber-800"
                          title="Dismiss"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Permissions Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
          <div className="border-b border-[#E6E6E6] bg-gradient-to-r from-[#C8A24A]/10 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-[#0B0B0C]">Permissions</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#2E3A59]/70">Control who can access different layers</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Viewer Handle</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={viewerHandle}
                  onChange={(e) => setViewerHandle(e.target.value)}
                  placeholder="e.g., john-doe"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Max Layer</label>
                <select
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={maxLayer}
                  onChange={(e) => setMaxLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={onSetPermission}
                disabled={savingPerm}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C8A24A] to-[#a8862a] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPerm ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.8-2.6A4.002 4.002 0 0119 8v0a4 4 0 013 3m-3-3a4 4 0 01-2.4 3.6M9 12a4.002 4.002 0 003.6-2.4M9 12A4 4 0 015 8" />
                    </svg>
                    Grant Access
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Test Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
          <div className="border-b border-[#E6E6E6] bg-gradient-to-r from-[#2E3A59]/5 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-[#0B0B0C]">Test Agent</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#2E3A59]/70">Ask questions to test responses</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Layer</label>
                <select
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={testLayer}
                  onChange={(e) => setTestLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Question</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-3 sm:px-4 py-2 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask something..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onAsk}
                disabled={asking}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {asking ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Asking...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Ask Question
                  </>
                )}
              </button>

              {answer && (
                <button
                  type="button"
                  onClick={() => setAnswer(null)}
                  className="rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
                >
                  Clear
                </button>
              )}
            </div>

            {answer && (
              <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#E6E6E6]/50 p-3 sm:p-4 text-xs sm:text-sm text-[#0B0B0C] whitespace-pre-wrap break-words">
                {answer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <NewLayoutWrapper>
      <AgentEditorContent />
    </NewLayoutWrapper>
  );
}
