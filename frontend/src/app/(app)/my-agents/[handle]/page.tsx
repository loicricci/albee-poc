"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addTrainingDocument,
  chatAsk,
  getAgentByHandle,
  setAgentPermission,
  updateAgent,
} from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";
import { ChatButton } from "@/components/ChatButton";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AgentUpdates } from "@/components/AgentUpdates";
import { generateProfileFromVoice, updateAveeProfileFromVoice } from "@/lib/upload";
import { supabase } from "@/lib/supabaseClient";

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  persona?: string | null;
};

export default function AgentEditorPage() {
  const params = useParams<{ handle: string }>();
  const handle = useMemo(() => (params?.handle || "").toString(), [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);

  // Agent Details
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dragging, setDragging] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Persona
  const [persona, setPersona] = useState("");
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaMsg, setPersonaMsg] = useState<string | null>(null);

  // Training
  const [trainLayer, setTrainLayer] = useState<"public" | "friends" | "intimate">("public");
  const [trainTitle, setTrainTitle] = useState("");
  const [trainSource, setTrainSource] = useState("");
  const [trainContent, setTrainContent] = useState("");
  const [training, setTraining] = useState(false);

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
    setDetailsMsg(null);

    try {
      const data = await getAgentByHandle(handle);
      setAgent(data);
      setDisplayName(data?.display_name || "");
      setBio(data?.bio || "");
      setAvatarUrl(data?.avatar_url || "");
      setPersona((data?.persona || "").toString());
    } catch (e: any) {
      setError(e.message || "Failed to load Agent");
      setAgent(null);
      setDisplayName("");
      setBio("");
      setAvatarUrl("");
      setPersona("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (handle) load();
  }, [handle]);

  async function onSaveDetails() {
    if (!agent?.id) return;

    setDetailsSaving(true);
    setError(null);
    setOkMsg(null);
    setDetailsMsg(null);

    try {
      const dn = displayName.trim();
      const b = bio.trim();

      if (dn && dn.length > 100) {
        throw new Error("Display name too long (max 100 characters)");
      }
      if (b && b.length > 500) {
        throw new Error("Bio too long (max 500 characters)");
      }

      await updateAgent({ 
        agentId: agent.id, 
        display_name: dn || "", 
        bio: b || "",
        avatar_url: avatarUrl.trim() || "",
      });
      
      setAgent({ ...agent, display_name: dn, bio: b, avatar_url: avatarUrl.trim() });
      setDetailsMsg("Details saved successfully.");
    } catch (e: any) {
      setDetailsMsg(e.message || "Failed to save details");
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleAvatarFile(file: File) {
    if (!agent?.id) return;

    setError(null);
    setDetailsMsg(null);

    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadImageToBucket({
        bucket: "avee-avatars",
        folder: `agent-${agent.id}`,
        file,
      });

      setAvatarUrl(publicUrl);
      setDetailsMsg("Avatar uploaded! Click 'Save Details' to apply.");
    } catch (e: any) {
      setDetailsMsg(e.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onAvatarDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onAvatarDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  async function onAvatarDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setDetailsMsg("Please drop an image file");
      return;
    }

    await handleAvatarFile(file);
  }

  function onAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleAvatarFile(file);
  }

  async function onSavePersona() {
    if (!agent?.id) return;

    setPersonaSaving(true);
    setError(null);
    setOkMsg(null);
    setPersonaMsg(null);

    try {
      const p = persona.trim();

      if (p.length > 40000) {
        throw new Error("Persona too long (max 40,000 characters)");
      }

      await updateAgent({ agentId: agent.id, persona: p });
      setPersona(p);
      setPersonaMsg("Persona saved successfully.");
    } catch (e: any) {
      setPersonaMsg(e.message || "Failed to save persona");
    } finally {
      setPersonaSaving(false);
    }
  }

  async function onAddDoc() {
    if (!agent?.id) return;

    setTraining(true);
    setError(null);
    setOkMsg(null);

    try {
      const content = trainContent.trim();
      if (!content) throw new Error("Content is required");

      const res = await addTrainingDocument({
        agentId: agent.id,
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

  async function onSetPermission() {
    if (!agent?.id) return;

    setSavingPerm(true);
    setError(null);
    setOkMsg(null);

    try {
      const vh = viewerHandle.trim().toLowerCase();
      if (!vh) throw new Error("viewer_handle is required");

      await setAgentPermission({
        agentId: agent.id,
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
    if (!agent?.handle) return;

    setAsking(true);
    setError(null);
    setOkMsg(null);
    setAnswer(null);

    try {
      const q = question.trim();
      if (!q) throw new Error("Question is required");

      const res = await chatAsk({
        agentHandle: agent.handle,
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
    if (!agent?.id) return;

    setGeneratingFromVoice(true);
    setError(null);
    setOkMsg(null);
    setVoiceGenerationResult(null);

    try {
      // Get access token
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        throw new Error("Not authenticated. Please log in again.");
      }
      const token = data.session.access_token;

      // Convert blob to file
      const audioFile = new File([audioBlob], "voice-intro.webm", {
        type: "audio/webm",
      });

      // Call API to generate profile from voice
      const result = await updateAveeProfileFromVoice(agent.id, audioFile, token);

      setVoiceGenerationResult({
        transcript: result.transcript,
        persona: result.updated_fields.persona || "",
        bio: result.updated_fields.bio || "",
        display_name: result.updated_fields.display_name || "",
      });

      // Update local state with new values
      setPersona(result.updated_fields.persona || "");
      setBio(result.updated_fields.bio || "");
      setDisplayName(result.updated_fields.display_name || "");
      
      // Update agent object
      if (agent) {
        setAgent({
          ...agent,
          persona: result.updated_fields.persona,
          bio: result.updated_fields.bio,
          display_name: result.updated_fields.display_name,
        });
      }

      setOkMsg(
        "Profile generated from voice! Your persona, bio, and display name have been updated."
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
    setBio(voiceGenerationResult.bio);
    setDisplayName(voiceGenerationResult.display_name);

    setOkMsg("Voice-generated profile applied! Remember to save your changes.");
    setVoiceGenerationResult(null);
    setShowVoiceSection(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Loading Agent editor...</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-red-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent not found</h3>
          <p className="text-sm text-gray-600 mb-6">The requested Agent could not be loaded.</p>
          <Link
            href="/my-agents"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            Back to My Agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Editor</h1>
          <p className="mt-2 text-gray-600">
            Configure <span className="font-semibold">@{handle}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/my-agents"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
          <ChatButton
            handle={handle}
            displayName={agent?.display_name || handle}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Test Chat
          </ChatButton>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-red-800">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {okMsg && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-green-800">{okMsg}</div>
          </div>
          <button onClick={() => setOkMsg(null)} className="text-green-600 hover:text-green-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Voice Profile Generation Card */}
        <div className="overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 bg-white/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">🎙️ AI Profile Generation from Voice</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Record a 30-second intro and let AI create your persona
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVoiceSection(!showVoiceSection)}
              className="rounded-lg p-2 transition-colors hover:bg-white/50"
            >
              <svg
                className={`h-5 w-5 text-gray-600 transition-transform ${
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
            <div className="p-6">
              <div className="mb-4 rounded-lg border border-purple-200 bg-white p-4 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 shrink-0 text-purple-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">How it works:</div>
                    <ol className="list-decimal list-inside space-y-1 text-gray-700">
                      <li>Record a 30-second voice introduction talking about yourself</li>
                      <li>AI (GPT-4o) transcribes your speech using Whisper</li>
                      <li>AI generates a persona, bio, and display name based on your intro</li>
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
                <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-white p-6">
                  <svg className="h-8 w-8 animate-spin text-purple-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-900">Generating your profile...</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Transcribing audio and analyzing your personality with GPT-4o
                    </div>
                  </div>
                </div>
              )}

              {voiceGenerationResult && (
                <div className="space-y-4 rounded-lg border border-purple-200 bg-white p-6">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-900">📝 Transcript:</div>
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 italic">
                      "{voiceGenerationResult.transcript}"
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-900">🎭 Generated Persona:</div>
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs font-mono text-gray-700">
                      {voiceGenerationResult.persona}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-900">📋 Generated Bio:</div>
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      {voiceGenerationResult.bio}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-900">✨ Display Name:</div>
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      {voiceGenerationResult.display_name}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={applyVoiceProfile}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Apply This Profile
                    </button>
                    <button
                      onClick={() => {
                        setVoiceGenerationResult(null);
                        setShowVoiceSection(false);
                      }}
                      className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent Details Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Agent Details</h2>
            <p className="mt-1 text-sm text-gray-600">Basic information and appearance</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Avatar Upload */}
              <div className="lg:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Avatar</label>
                <div
                  onDragOver={onAvatarDragOver}
                  onDragLeave={onAvatarDragLeave}
                  onDrop={onAvatarDrop}
                  onClick={() => avatarFileInputRef.current?.click()}
                  className={[
                    "group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                    dragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50",
                    uploadingAvatar ? "pointer-events-none opacity-60" : "",
                  ].join(" ")}
                >
                  {avatarUrl ? (
                    <>
                      <img
                        src={avatarUrl}
                        alt="Agent avatar"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="text-center text-white">
                          <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-medium">Change Avatar</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                      {uploadingAvatar ? (
                        <>
                          <svg className="h-8 w-8 animate-spin text-[#001f98] mb-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="text-sm text-gray-600">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Drop image here</p>
                          <p className="text-xs text-gray-500">or click to browse</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarFileSelect}
                />
              </div>

              {/* Form Fields */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Handle</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 font-mono">
                    @{agent.handle}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Handle cannot be changed</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Display Name
                    <span className="ml-2 text-xs font-normal text-gray-500">(max 100 chars)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setDetailsMsg(null);
                    }}
                    placeholder="e.g., Jenny's AI Assistant"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Bio
                    <span className="ml-2 text-xs font-normal text-gray-500">(max 500 chars)</span>
                  </label>
                  <textarea
                    className="h-24 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setDetailsMsg(null);
                    }}
                    placeholder="A brief description of this Agent..."
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">{bio.length}/500 characters</p>
                </div>
              </div>
            </div>

            {detailsMsg && (
              <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                detailsMsg.includes("success") || detailsMsg.includes("saved")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
                {detailsMsg}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={onSaveDetails}
                disabled={detailsSaving || uploadingAvatar}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {detailsSaving ? (
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
                    Save Details
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Persona Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Persona</h2>
                <p className="mt-1 text-sm text-gray-600">Define personality, tone, and behavior</p>
              </div>
              <div className="text-xs text-gray-500">
                {personaMeta.chars.toLocaleString()} chars · {personaMeta.lines} lines
              </div>
            </div>
          </div>
          <div className="p-6">
            <textarea
              className="h-64 w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setPersonaMsg(null);
              }}
              placeholder="Define the Agent's personality, values, tone, and boundaries here..."
            />
            
            {personaMsg && (
              <div className={`mt-3 rounded-lg px-4 py-2 text-sm ${
                personaMsg.includes("success") || personaMsg.includes("saved")
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}>
                {personaMsg}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Injected as system prompt. Max 40,000 characters.
              </div>
              <button
                onClick={onSavePersona}
                disabled={personaSaving}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
        {agent?.id && (
          <AgentUpdates agentId={agent.id} agentHandle={agent.handle} />
        )}

        {/* Training Data Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Training Data</h2>
            <p className="mt-1 text-sm text-gray-600">Add knowledge and context for this Agent</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={trainLayer}
                  onChange={(e) => setTrainLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Title (optional)</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={trainTitle}
                  onChange={(e) => setTrainTitle(e.target.value)}
                  placeholder="e.g., Bio, FAQ, Memories"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Source (optional)</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={trainSource}
                  onChange={(e) => setTrainSource(e.target.value)}
                  placeholder="e.g., LinkedIn, website, notes"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Content</label>
                <textarea
                  className="h-40 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={trainContent}
                  onChange={(e) => setTrainContent(e.target.value)}
                  placeholder="Paste training content here..."
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={onAddDoc}
                disabled={training}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>
          </div>
        </div>

        {/* Permissions Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Permissions</h2>
            <p className="mt-1 text-sm text-gray-600">Control who can access different layers</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Viewer Handle</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={viewerHandle}
                  onChange={(e) => setViewerHandle(e.target.value)}
                  placeholder="e.g., john-doe"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Max Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Test Agent</h2>
            <p className="mt-1 text-sm text-gray-600">Ask questions to test responses</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={testLayer}
                  onChange={(e) => setTestLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Question</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask something..."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onAsk}
                disabled={asking}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>

            {answer && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
