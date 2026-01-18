"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  addTrainingDocument,
  chatAsk,
  getAgentByHandle,
  setAgentPermission,
  updateAgent,
  updateAgentTwitterSettings,
  getTwitterConfig,
  updateAgentLinkedInSettings,
  getLinkedInConfig,
  LinkedInOrganization,
} from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";
import { ChatButton } from "@/components/ChatButton";
import { AgentUpdates } from "@/components/AgentUpdates";
import { TrainingDocuments } from "@/components/TrainingDocuments";
import { ReferenceImageUpload } from "@/components/ReferenceImageUpload";
import { MoodBoardUpload } from "@/components/MoodBoardUpload";
import { generateProfileFromVoice, updateAveeProfileFromVoice } from "@/lib/upload";
import { supabase } from "@/lib/supabaseClient";

// PERFORMANCE: Lazy load VoiceRecorder (only loads when needed)
const VoiceRecorder = dynamic(() => import("@/components/VoiceRecorder").then(mod => ({ default: mod.VoiceRecorder })), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-600">Loading recorder...</div>,
});

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  persona?: string | null;
  agent_type?: "persona" | "company" | null;
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
  const [agentType, setAgentType] = useState<"persona" | "company">("persona");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dragging, setDragging] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

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

  // Twitter settings
  const [twitterSharingEnabled, setTwitterSharingEnabled] = useState(false);
  const [twitterPostingMode, setTwitterPostingMode] = useState<"auto" | "manual">("manual");
  const [savingTwitterSettings, setSavingTwitterSettings] = useState(false);
  const [twitterSettingsMsg, setTwitterSettingsMsg] = useState<string | null>(null);
  const [userTwitterConfig, setUserTwitterConfig] = useState<{ connected: boolean; twitter_username?: string } | null>(null);
  const [loadingTwitterConfig, setLoadingTwitterConfig] = useState(true);

  // LinkedIn settings
  const [linkedinSharingEnabled, setLinkedinSharingEnabled] = useState(false);
  const [linkedinPostingMode, setLinkedinPostingMode] = useState<"auto" | "manual">("manual");
  const [linkedinTargetType, setLinkedinTargetType] = useState<"personal" | "organization">("personal");
  const [linkedinOrganizationId, setLinkedinOrganizationId] = useState<string | null>(null);
  const [savingLinkedinSettings, setSavingLinkedinSettings] = useState(false);
  const [linkedinSettingsMsg, setLinkedinSettingsMsg] = useState<string | null>(null);
  const [userLinkedinConfig, setUserLinkedinConfig] = useState<{ connected: boolean; linkedin_username?: string; organizations?: LinkedInOrganization[] } | null>(null);
  const [loadingLinkedinConfig, setLoadingLinkedinConfig] = useState(true);

  // Reference images for OpenAI Image Edits
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referenceMaskUrl, setReferenceMaskUrl] = useState<string | null>(null);
  const [imageEditInstructions, setImageEditInstructions] = useState<string | null>(null);
  const [showReferenceSection, setShowReferenceSection] = useState(false);

  // Branding Guidelines for image generation
  const [brandingGuidelines, setBrandingGuidelines] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState<string | null>(null);
  const [showBrandingSection, setShowBrandingSection] = useState(false);

  // Logo Watermark Settings for autopost images
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">("bottom-right");
  const [logoSize, setLogoSize] = useState<number>(10); // 5-100 percentage
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [showLogoSection, setShowLogoSection] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-post topic personalization
  const [preferredTopics, setPreferredTopics] = useState("");
  const [agentLocation, setAgentLocation] = useState("");
  const [autopostPrefsSaving, setAutopostPrefsSaving] = useState(false);
  const [autopostPrefsMsg, setAutopostPrefsMsg] = useState<string | null>(null);
  const [showAutopostPrefsSection, setShowAutopostPrefsSection] = useState(false);

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
      setAgentType((data?.agent_type as "persona" | "company") || "persona");
      setPersona((data?.persona || "").toString());
      
      // Load Twitter settings from agent data
      setTwitterSharingEnabled(data?.twitter_sharing_enabled === true || data?.twitter_sharing_enabled === "true");
      setTwitterPostingMode((data?.twitter_posting_mode as "auto" | "manual") || "manual");
      
      // Load LinkedIn settings from agent data
      setLinkedinSharingEnabled(data?.linkedin_sharing_enabled === true || data?.linkedin_sharing_enabled === "true");
      setLinkedinPostingMode((data?.linkedin_posting_mode as "auto" | "manual") || "manual");
      setLinkedinTargetType((data?.linkedin_target_type as "personal" | "organization") || "personal");
      setLinkedinOrganizationId(data?.linkedin_organization_id || null);
      
      // Load reference image settings
      setReferenceImageUrl(data?.reference_image_url || null);
      setReferenceMaskUrl(data?.reference_image_mask_url || null);
      setImageEditInstructions(data?.image_edit_instructions || null);
      
      // Load branding guidelines
      setBrandingGuidelines(data?.branding_guidelines || "");
      
      // Load logo watermark settings
      setLogoEnabled(data?.logo_enabled === true);
      setLogoUrl(data?.logo_url || null);
      setLogoPosition((data?.logo_position as typeof logoPosition) || "bottom-right");
      // Parse logo size - support both legacy strings and numeric values
      const rawSize = data?.logo_size;
      if (rawSize) {
        if (rawSize === "small") setLogoSize(5);
        else if (rawSize === "medium") setLogoSize(10);
        else if (rawSize === "large") setLogoSize(15);
        else setLogoSize(parseInt(rawSize) || 10);
      } else {
        setLogoSize(10);
      }
      
      // Load auto-post topic personalization settings
      setPreferredTopics(data?.preferred_topics || "");
      setAgentLocation(data?.location || "");
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
  
  // Load user's Twitter connection status
  useEffect(() => {
    async function loadTwitterConfig() {
      try {
        const config = await getTwitterConfig();
        setUserTwitterConfig(config);
      } catch (e) {
        console.error("Failed to load Twitter config:", e);
        setUserTwitterConfig(null);
      } finally {
        setLoadingTwitterConfig(false);
      }
    }
    loadTwitterConfig();
  }, []);

  // Load user's LinkedIn connection status
  useEffect(() => {
    async function loadLinkedInConfig() {
      try {
        const config = await getLinkedInConfig();
        setUserLinkedinConfig(config);
      } catch (e) {
        console.error("Failed to load LinkedIn config:", e);
        setUserLinkedinConfig(null);
      } finally {
        setLoadingLinkedinConfig(false);
      }
    }
    loadLinkedInConfig();
  }, []);

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
        agent_type: agentType,
      });
      
      setAgent({ ...agent, display_name: dn, bio: b, avatar_url: avatarUrl.trim(), agent_type: agentType });
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

  async function handlePersonaFile(file: File) {
    if (!agent?.id) return;

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

  async function onSaveTwitterSettings() {
    if (!agent?.id) return;

    setSavingTwitterSettings(true);
    setTwitterSettingsMsg(null);

    try {
      await updateAgentTwitterSettings(agent.id, twitterSharingEnabled, twitterPostingMode);
      setTwitterSettingsMsg("Twitter settings saved successfully.");
    } catch (e: any) {
      setTwitterSettingsMsg(e.message || "Failed to save Twitter settings");
    } finally {
      setSavingTwitterSettings(false);
    }
  }

  async function onSaveLinkedInSettings() {
    if (!agent?.id) return;

    setSavingLinkedinSettings(true);
    setLinkedinSettingsMsg(null);

    try {
      await updateAgentLinkedInSettings(agent.id, {
        enabled: linkedinSharingEnabled,
        posting_mode: linkedinPostingMode,
        target_type: linkedinTargetType,
        organization_id: linkedinTargetType === "organization" ? linkedinOrganizationId || undefined : undefined,
      });
      setLinkedinSettingsMsg("LinkedIn settings saved successfully.");
    } catch (e: any) {
      setLinkedinSettingsMsg(e.message || "Failed to save LinkedIn settings");
    } finally {
      setSavingLinkedinSettings(false);
    }
  }

  async function onSaveBrandingGuidelines() {
    if (!agent?.id) return;

    setBrandingSaving(true);
    setError(null);
    setOkMsg(null);
    setBrandingMsg(null);

    try {
      const bg = brandingGuidelines.trim();

      if (bg.length > 5000) {
        throw new Error("Branding guidelines too long (max 5,000 characters)");
      }

      await updateAgent({ agentId: agent.id, branding_guidelines: bg });
      setBrandingMsg("Branding guidelines saved successfully.");
    } catch (e: any) {
      setBrandingMsg(e.message || "Failed to save branding guidelines");
    } finally {
      setBrandingSaving(false);
    }
  }

  async function onSaveLogoSettings() {
    if (!agent?.id) return;

    setLogoSaving(true);
    setError(null);
    setOkMsg(null);
    setLogoMsg(null);

    try {
      await updateAgent({
        agentId: agent.id,
        logo_enabled: logoEnabled,
        logo_url: logoUrl || undefined,
        logo_position: logoPosition,
        logo_size: String(logoSize),
      });
      setLogoMsg("Logo settings saved successfully.");
    } catch (e: any) {
      setLogoMsg(e.message || "Failed to save logo settings");
    } finally {
      setLogoSaving(false);
    }
  }

  async function onSaveAutopostPrefs() {
    if (!agent?.id) return;

    setAutopostPrefsSaving(true);
    setError(null);
    setOkMsg(null);
    setAutopostPrefsMsg(null);

    try {
      await updateAgent({
        agentId: agent.id,
        preferred_topics: preferredTopics,
        location: agentLocation,
      });
      setAutopostPrefsMsg("Auto-post preferences saved successfully.");
    } catch (e: any) {
      setAutopostPrefsMsg(e.message || "Failed to save auto-post preferences");
    } finally {
      setAutopostPrefsSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !agent?.id) return;

    // Validate file type (PNG only for transparency support)
    const validTypes = ["image/png"];
    if (!validTypes.includes(file.type)) {
      setLogoMsg("Please upload a PNG file (supports transparency)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoMsg("Logo file too large (max 5MB)");
      return;
    }

    setUploadingLogo(true);
    setLogoMsg(null);

    try {
      const { publicUrl } = await uploadImageToBucket({
        bucket: "app-images",
        folder: `agent-logos/${agent.id}`,
        file
      });
      setLogoUrl(publicUrl);
      setLogoMsg("Logo uploaded! Don't forget to save settings.");
    } catch (err: any) {
      setLogoMsg(err.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
    }
  }

  function removeLogo() {
    setLogoUrl(null);
    setLogoMsg("Logo removed. Don't forget to save settings.");
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !agent?.id) return;

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
      const res = await fetch(`${apiBase}/avees/${agent.id}/documents/upload-file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[File Upload] Error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = {};
        }
        
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
          errorMessage = errorText || `Failed to upload file: ${res.status}`;
        }
        
        console.error('[File Upload] Error message:', errorMessage);
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
    if (!agent?.id || !extractUrl.trim()) return;

    setExtractingUrl(true);
    setError(null);
    setOkMsg(null);
    setShowLinkedInWarning(false); // Hide previous warnings

    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        throw new Error("Not authenticated");
      }
      const token = data.session.access_token;

      const apiBase = process.env.NEXT_PUBLIC_API_BASE;
      
      console.log('[URL Extract] Starting extraction from:', extractUrl.trim());
      console.log('[URL Extract] API Base:', apiBase);
      
      const res = await fetch(`${apiBase}/avees/${agent.id}/documents/from-url`, {
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

      console.log('[URL Extract] Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.log('[URL Extract] Error data:', errorData);
        
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
          errorMessage = `Failed to extract content: ${res.status}`;
        }
        
        console.error('[URL Extract] Error:', errorMessage);
        
        // Check if it's a LinkedIn-related error
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('linkedin')) {
          setShowLinkedInWarning(true);
        }
        
        throw new Error(errorMessage);
      }

      const result = await res.json();
      
      console.log('[URL Extract] Success! Chunks created:', result.chunks);

      setExtractUrl("");
      setTrainTitle("");
      setOkMsg(
        `Content extracted from URL! ${result.chunks} chunks created. Title: "${result.title}"`
      );
    } catch (e: any) {
      console.error('[URL Extract] Exception caught:', e);
      const errorMessage = e.message || "Failed to extract content from URL";
      console.error('[URL Extract] Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setExtractingUrl(false);
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
        <div className="flex items-center gap-3 text-[#001f98]">
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
          <p className="text-sm text-[#001f98]/70 mb-6">The requested Agent could not be loaded.</p>
          <Link
            href="/my-agents"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            Back to My Agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Agent Editor</h1>
          <p className="mt-2 text-sm sm:text-base text-[#001f98]/70">
            Configure <span className="font-semibold">@{handle}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/my-agents"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <ChatButton
            handle={handle}
            displayName={agent?.display_name || handle}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-3 sm:px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Test Chat</span>
            <span className="sm:hidden">Chat</span>
          </ChatButton>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
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
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">🎙️ AI Profile Generation from Voice</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
                  Record a 30-second intro and let AI create your persona
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVoiceSection(!showVoiceSection)}
              className="rounded-lg p-2 transition-colors hover:bg-white/50 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#001f98] transition-transform ${
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
                    <div className="font-semibold text-gray-900 mb-1">How it works:</div>
                    <ol className="list-decimal list-inside space-y-1 text-[#001f98]/80">
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
                <div className="flex items-start sm:items-center gap-3 rounded-lg border border-[#C8A24A]/30 bg-white p-4 sm:p-6">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-[#C8A24A] shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-semibold text-gray-900">Generating your profile...</div>
                    <div className="text-xs sm:text-sm text-[#001f98]/70 mt-1">
                      Transcribing audio and analyzing your personality with GPT-4o
                    </div>
                  </div>
                </div>
              )}

              {voiceGenerationResult && (
                <div className="space-y-3 sm:space-y-4 rounded-lg border border-[#C8A24A]/30 bg-white p-4 sm:p-6">
                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-gray-900">📝 Transcript:</div>
                    <div className="rounded-lg bg-gray-200/50 p-2 sm:p-3 text-xs sm:text-sm text-[#001f98]/80 italic break-words">
                      "{voiceGenerationResult.transcript}"
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-gray-900">🎭 Generated Persona:</div>
                    <div className="max-h-32 sm:max-h-40 overflow-y-auto rounded-lg bg-gray-200/50 p-2 sm:p-3 text-xs font-mono text-[#001f98]/80 break-words">
                      {voiceGenerationResult.persona}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-gray-900">📋 Generated Bio:</div>
                    <div className="rounded-lg bg-gray-200/50 p-2 sm:p-3 text-xs sm:text-sm text-[#001f98]/80 break-words">
                      {voiceGenerationResult.bio}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs sm:text-sm font-semibold text-gray-900">✨ Display Name:</div>
                    <div className="rounded-lg bg-gray-200/50 p-2 sm:p-3 text-xs sm:text-sm text-[#001f98]/80 break-words">
                      {voiceGenerationResult.display_name}
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
                      Apply This Profile
                    </button>
                    <button
                      onClick={() => {
                        setVoiceGenerationResult(null);
                        setShowVoiceSection(false);
                      }}
                      className="rounded-lg border border-gray-200 px-4 sm:px-6 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
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
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Agent Details</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Basic information and appearance</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Avatar Upload */}
              <div className="lg:col-span-1 max-w-xs mx-auto lg:mx-0 w-full">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Avatar</label>
                <div
                  onDragOver={onAvatarDragOver}
                  onDragLeave={onAvatarDragLeave}
                  onDrop={onAvatarDrop}
                  onClick={() => avatarFileInputRef.current?.click()}
                  className={[
                    "group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                    dragging
                      ? "border-[#001f98] bg-[#001f98]/5"
                      : "border-gray-200 bg-gray-200/50 hover:border-[#001f98] hover:bg-[#001f98]/5",
                    uploadingAvatar ? "pointer-events-none opacity-60" : "",
                  ].join(" ")}
                >
                  {avatarUrl ? (
                    <>
                      <img src={avatarUrl}
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
                          <p className="text-sm text-[#001f98]/70">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <svg className="h-12 w-12 text-[#001f98]/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-semibold text-gray-900 mb-1">Drop image here</p>
                          <p className="text-xs text-[#001f98]/70">or click to browse</p>
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
                  <div className="rounded-lg border border-gray-200 bg-gray-200/50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#001f98]/70 font-mono break-all">
                    @{agent.handle}
                  </div>
                  <p className="mt-1 text-xs text-[#001f98]/70">Handle cannot be changed</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Agent Type</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 bg-white"
                    value={agentType}
                    onChange={(e) => {
                      setAgentType(e.target.value as "persona" | "company");
                      setDetailsMsg(null);
                    }}
                  >
                    <option value="persona">👤 Personal Twin</option>
                    <option value="company">🏢 Company / Brand</option>
                  </select>
                  <p className="mt-1 text-xs text-[#001f98]/70">
                    {agentType === "persona" 
                      ? "A digital twin representing you — your personality and expertise" 
                      : "An AI agent representing your business or brand"}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Display Name
                    <span className="ml-2 text-xs font-normal text-[#001f98]/70">(max 100 chars)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
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
                    <span className="ml-2 text-xs font-normal text-[#001f98]/70">(max 500 chars)</span>
                  </label>
                  <textarea
                    className="h-24 w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setDetailsMsg(null);
                    }}
                    placeholder="A brief description of this Agent..."
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-[#001f98]/70">{bio.length}/500 characters</p>
                </div>
              </div>
            </div>

            {detailsMsg && (
              <div className={`mt-4 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ${
                detailsMsg.includes("success") || detailsMsg.includes("saved")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-[#001f98]/5 text-[#001f98] border border-[#001f98]/20"
              }`}>
                {detailsMsg}
              </div>
            )}

            <div className="mt-4 sm:mt-6 flex items-center justify-end">
              <button
                onClick={onSaveDetails}
                disabled={detailsSaving || uploadingAvatar}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-4 sm:px-6 py-2 sm:py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Branding Guidelines Card */}
        <div className="overflow-hidden rounded-2xl border border-[#C8A24A]/30 bg-white shadow-sm">
          <div className="flex items-start sm:items-center justify-between border-b border-[#C8A24A]/20 bg-gradient-to-r from-[#C8A24A]/10 to-amber-50 px-4 sm:px-6 py-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#C8A24A] to-amber-600 shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">🎨 Branding Guidelines</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
                  Colors, fonts, and visual style for AI-generated images
                  {brandingGuidelines && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Configured
                  </span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBrandingSection(!showBrandingSection)}
              className="rounded-lg p-2 transition-colors hover:bg-amber-100 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#001f98] transition-transform ${showBrandingSection ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showBrandingSection && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Mood Board Upload Section */}
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-full bg-amber-200 p-1.5">
                    <svg className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Upload Mood Board</h3>
                    <p className="text-xs text-amber-700">AI extracts visual direction from your images</p>
                  </div>
                </div>
                
                {agent?.id && (
                  <MoodBoardUpload
                    agentId={agent.id}
                    agentHandle={handle}
                    currentGuidelines={brandingGuidelines}
                    onGuidelinesExtracted={(guidelines) => {
                      setBrandingGuidelines(guidelines);
                      setBrandingMsg("Visual direction extracted! Review and save below.");
                    }}
                  />
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-amber-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-amber-600 font-medium">or edit manually</span>
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-amber-900 mb-1">How it works:</div>
                    <p className="text-amber-800 mb-2">
                      These guidelines will be used when generating AI images during autopost to ensure visual consistency with your brand.
                    </p>
                    <div className="font-medium text-amber-900 mb-1">Recommended sections:</div>
                    <div className="rounded bg-amber-100/50 p-2 font-mono text-xs text-amber-800">
                      === COLOR PALETTE ===<br/>
                      Primary: #hexcode - description<br/><br/>
                      === COMPOSITION STYLE ===<br/>
                      Abstract, flowing forms, layered depth<br/><br/>
                      === VISUAL TECHNIQUES ===<br/>
                      Gradients, silhouettes, textures<br/><br/>
                      === MOOD & ATMOSPHERE ===<br/>
                      Contemplative, sophisticated<br/><br/>
                      === AVOID ===<br/>
                      Literal scenes, photorealistic faces
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Visual Guidelines
                  <span className="ml-2 text-xs font-normal text-[#001f98]/70">(max 5,000 chars)</span>
                </label>
                <textarea
                  className="h-64 w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-[#C8A24A] focus:outline-none focus:ring-2 focus:ring-[#C8A24A]/20 font-mono"
                  value={brandingGuidelines}
                  onChange={(e) => {
                    setBrandingGuidelines(e.target.value);
                    setBrandingMsg(null);
                  }}
                  placeholder="=== COLOR PALETTE ===&#10;Primary: #hexcode - description&#10;&#10;=== COMPOSITION STYLE ===&#10;Abstract, flowing forms&#10;&#10;=== VISUAL TECHNIQUES ===&#10;Gradients, silhouettes&#10;&#10;=== MOOD & ATMOSPHERE ===&#10;Contemplative, sophisticated&#10;&#10;=== AVOID ===&#10;Literal scenes, photorealistic faces"
                  maxLength={5000}
                />
                <p className="mt-1 text-xs text-[#001f98]/70">{brandingGuidelines.length}/5,000 characters</p>
              </div>

              {brandingMsg && (
                <div className={`mt-3 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm ${
                  brandingMsg.includes("success") || brandingMsg.includes("saved")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {brandingMsg}
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-[#001f98]/70">
                  Used in DALL-E 3 and GPT-Image-1 prompts for autopost images.
                </div>
                <button
                  onClick={onSaveBrandingGuidelines}
                  disabled={brandingSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C8A24A] to-amber-600 px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {brandingSaving ? (
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
                      Save Branding
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logo Watermark Settings Card */}
        <div className="overflow-hidden rounded-2xl border border-purple-200/50 bg-white shadow-sm">
          <div className="flex items-start sm:items-center justify-between border-b border-purple-200/30 bg-gradient-to-r from-purple-50 to-violet-50 px-4 sm:px-6 py-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Logo Watermark</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
                  Add your logo to autopost images
                  {logoEnabled && logoUrl && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Active
                  </span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoSection(!showLogoSection)}
              className="rounded-lg p-2 transition-colors hover:bg-purple-100 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#001f98] transition-transform ${showLogoSection ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showLogoSection && (
            <div className="p-4 sm:p-6">
              {/* Enable Toggle */}
              <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={logoEnabled}
                          onChange={(e) => {
                            setLogoEnabled(e.target.checked);
                            setLogoMsg(null);
                          }}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors ${logoEnabled ? "bg-purple-600" : "bg-gray-300"}`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${logoEnabled ? "translate-x-5" : ""}`} />
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">Add logo to posts</span>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {logoEnabled ? "Logo will be added to autopost images" : "Logo disabled - posts will be generated without watermark"}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Logo Upload Section */}
              <div className={`space-y-4 ${!logoEnabled ? "opacity-50 pointer-events-none" : ""}`}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Logo Image
                    <span className="ml-2 text-xs font-normal text-[#001f98]/70">(PNG with transparency)</span>
                  </label>
                  
                  {logoUrl ? (
                    <div className="flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50/30 p-4">
                      <div className="relative">
                        <img
                          src={logoUrl}
                          alt="Agent Logo"
                          className="h-16 w-16 rounded-lg border border-purple-200 bg-white object-contain p-2"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Logo uploaded</p>
                        <p className="text-xs text-gray-600 mt-0.5">Will appear on generated images</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-50"
                        >
                          Replace
                        </button>
                        <button
                          onClick={removeLogo}
                          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/30 p-6 text-center">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        onChange={handleLogoUpload}
                        accept="image/png"
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                      <svg className="mx-auto h-12 w-12 text-purple-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploadingLogo ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload Logo
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-xs text-gray-500">PNG format only (supports transparency)</p>
                      <p className="mt-1 text-xs text-gray-400">Max file size: 5MB</p>
                    </div>
                  )}
                </div>

                {/* Position & Size Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">Position</label>
                    <select
                      value={logoPosition}
                      onChange={(e) => {
                        setLogoPosition(e.target.value as typeof logoPosition);
                        setLogoMsg(null);
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">Size</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={logoSize}
                          onChange={(e) => {
                            setLogoSize(parseInt(e.target.value));
                            setLogoMsg(null);
                          }}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <span className="min-w-[3.5rem] text-right text-sm font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-md">
                          {logoSize}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>5%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Size Preview Info */}
                <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-purple-800">
                      <span className="font-medium">Size reference (on 1024px image):</span>
                      <span className="block mt-1">
                        Current: ~{Math.round(1024 * logoSize / 100)}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {logoMsg && (
                <div className={`mt-4 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm ${
                  logoMsg.includes("success") || logoMsg.includes("saved")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : logoMsg.includes("uploaded") || logoMsg.includes("removed")
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {logoMsg}
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-[#001f98]/70">
                  Logo will be overlaid on images generated during autopost.
                </div>
                <button
                  onClick={onSaveLogoSettings}
                  disabled={logoSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {logoSaving ? (
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
                      Save Logo Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Post Preferences Card */}
        <div className="overflow-hidden rounded-2xl border border-emerald-200/50 bg-white shadow-sm">
          <div className="flex items-start sm:items-center justify-between border-b border-emerald-200/30 bg-gradient-to-r from-emerald-50 to-green-50 px-4 sm:px-6 py-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Auto-Post Preferences</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
                  Customize topic selection for automated posts
                  {(preferredTopics || agentLocation) && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Configured
                  </span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAutopostPrefsSection(!showAutopostPrefsSection)}
              className="rounded-lg p-2 transition-colors hover:bg-emerald-100 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#001f98] transition-transform ${showAutopostPrefsSection ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showAutopostPrefsSection && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Info Box */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-emerald-800">
                    <span className="font-medium">How it works:</span>
                    <span className="block mt-1">
                      When auto-posting, the AI will prioritize news articles that match your agent&apos;s preferred topics and location context.
                    </span>
                  </div>
                </div>
              </div>

              {/* Location Input */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Location
                  <span className="ml-2 text-xs font-normal text-[#001f98]/70">(optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={agentLocation}
                  onChange={(e) => {
                    setAgentLocation(e.target.value);
                    setAutopostPrefsMsg(null);
                  }}
                  placeholder="e.g., London, UK or New York, USA"
                />
                <p className="mt-1 text-xs text-[#001f98]/70">
                  Location context helps select relevant regional news topics
                </p>
              </div>

              {/* Preferred Topics Input */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Preferred Topics
                  <span className="ml-2 text-xs font-normal text-[#001f98]/70">(optional)</span>
                </label>
                <textarea
                  className="h-24 w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={preferredTopics}
                  onChange={(e) => {
                    setPreferredTopics(e.target.value);
                    setAutopostPrefsMsg(null);
                  }}
                  placeholder="e.g., music, technology, space exploration, art, sports"
                />
                <p className="mt-1 text-xs text-[#001f98]/70">
                  Comma-separated list of topics the agent is interested in
                </p>
              </div>

              {autopostPrefsMsg && (
                <div className={`rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm ${
                  autopostPrefsMsg.includes("success") || autopostPrefsMsg.includes("saved")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {autopostPrefsMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div className="text-xs text-[#001f98]/70">
                  These preferences influence which news articles are selected for auto-posts.
                </div>
                <button
                  onClick={onSaveAutopostPrefs}
                  disabled={autopostPrefsSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {autopostPrefsSaving ? (
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
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Twitter Settings Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DA1F2]">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Twitter Integration</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">Auto-post agent updates to Twitter</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {loadingTwitterConfig ? (
              <div className="flex items-center justify-center py-8">
                <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Loading Twitter status...</span>
              </div>
            ) : !userTwitterConfig?.connected ? (
              <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-900">Twitter Not Connected</p>
                <p className="mt-1 text-xs text-gray-600">
                  Connect your Twitter account in your profile settings to enable Twitter posting for this agent.
                </p>
                <Link
                  href="/profile"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8cd8]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Go to Profile Settings
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-900">
                      Connected as @{userTwitterConfig.twitter_username}
                    </span>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={twitterSharingEnabled}
                          onChange={(e) => {
                            setTwitterSharingEnabled(e.target.checked);
                            setTwitterSettingsMsg(null);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#1DA1F2] focus:ring-[#1DA1F2]"
                        />
                        Enable Twitter Posting
                      </label>
                      <p className="mt-1 text-xs text-gray-600">
                        Allow this agent to post updates to your Twitter account
                      </p>
                    </div>
                  </div>
                </div>

                {/* Posting Mode Selection */}
                {twitterSharingEnabled && (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Posting Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#1DA1F2] hover:bg-blue-50/50">
                        <input
                          type="radio"
                          name="postingMode"
                          value="auto"
                          checked={twitterPostingMode === "auto"}
                          onChange={() => {
                            setTwitterPostingMode("auto");
                            setTwitterSettingsMsg(null);
                          }}
                          className="mt-0.5 h-4 w-4 border-gray-300 text-[#1DA1F2] focus:ring-[#1DA1F2]"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Auto-post (Immediate)</div>
                          <div className="mt-1 text-xs text-gray-600">
                            Automatically post to Twitter when the agent creates new content
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#1DA1F2] hover:bg-blue-50/50">
                        <input
                          type="radio"
                          name="postingMode"
                          value="manual"
                          checked={twitterPostingMode === "manual"}
                          onChange={() => {
                            setTwitterPostingMode("manual");
                            setTwitterSettingsMsg(null);
                          }}
                          className="mt-0.5 h-4 w-4 border-gray-300 text-[#1DA1F2] focus:ring-[#1DA1F2]"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Manual Approval</div>
                          <div className="mt-1 text-xs text-gray-600">
                            Review and approve each post before it goes to Twitter
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Status Message */}
                {twitterSettingsMsg && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${
                    twitterSettingsMsg.includes("success") || twitterSettingsMsg.includes("saved")
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}>
                    {twitterSettingsMsg}
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={onSaveTwitterSettings}
                    disabled={savingTwitterSettings}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#1DA1F2] to-[#1a8cd8] px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingTwitterSettings ? (
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
                        Save Twitter Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LinkedIn Settings Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2]">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">LinkedIn Integration</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">Auto-post agent updates to LinkedIn</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {loadingLinkedinConfig ? (
              <div className="flex items-center justify-center py-8">
                <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Loading LinkedIn status...</span>
              </div>
            ) : !userLinkedinConfig?.connected ? (
              <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-900">LinkedIn Not Connected</p>
                <p className="mt-1 text-xs text-gray-600">
                  Connect your LinkedIn account in your profile settings to enable LinkedIn posting for this agent.
                </p>
                <Link
                  href="/profile"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004182]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Go to Profile Settings
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-900">
                      Connected as {userLinkedinConfig.linkedin_username}
                    </span>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={linkedinSharingEnabled}
                          onChange={(e) => {
                            setLinkedinSharingEnabled(e.target.checked);
                            setLinkedinSettingsMsg(null);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2]"
                        />
                        Enable LinkedIn Posting
                      </label>
                      <p className="mt-1 text-xs text-gray-600">
                        Allow this agent to post updates to your LinkedIn account
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Settings when enabled */}
                {linkedinSharingEnabled && (
                  <>
                    {/* Posting Mode Selection */}
                    <div className="rounded-lg border border-gray-200 p-4">
                      <label className="block text-sm font-medium text-gray-900 mb-3">
                        Posting Mode
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#0A66C2] hover:bg-blue-50/50">
                          <input
                            type="radio"
                            name="linkedinPostingMode"
                            value="auto"
                            checked={linkedinPostingMode === "auto"}
                            onChange={() => {
                              setLinkedinPostingMode("auto");
                              setLinkedinSettingsMsg(null);
                            }}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2]"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Auto-post (Immediate)</div>
                            <div className="mt-1 text-xs text-gray-600">
                              Automatically post to LinkedIn when the agent creates new content
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#0A66C2] hover:bg-blue-50/50">
                          <input
                            type="radio"
                            name="linkedinPostingMode"
                            value="manual"
                            checked={linkedinPostingMode === "manual"}
                            onChange={() => {
                              setLinkedinPostingMode("manual");
                              setLinkedinSettingsMsg(null);
                            }}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2]"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Manual Approval</div>
                            <div className="mt-1 text-xs text-gray-600">
                              Review and approve each post before it goes to LinkedIn
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Target Type Selection */}
                    <div className="rounded-lg border border-gray-200 p-4">
                      <label className="block text-sm font-medium text-gray-900 mb-3">
                        Post To
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#0A66C2] hover:bg-blue-50/50">
                          <input
                            type="radio"
                            name="linkedinTargetType"
                            value="personal"
                            checked={linkedinTargetType === "personal"}
                            onChange={() => {
                              setLinkedinTargetType("personal");
                              setLinkedinSettingsMsg(null);
                            }}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2]"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Personal Profile</div>
                            <div className="mt-1 text-xs text-gray-600">
                              Posts will appear on your personal LinkedIn feed
                            </div>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all hover:border-[#0A66C2] hover:bg-blue-50/50 ${!userLinkedinConfig.organizations?.length ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="radio"
                            name="linkedinTargetType"
                            value="organization"
                            checked={linkedinTargetType === "organization"}
                            onChange={() => {
                              setLinkedinTargetType("organization");
                              setLinkedinSettingsMsg(null);
                            }}
                            disabled={!userLinkedinConfig.organizations?.length}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-[#0A66C2] focus:ring-[#0A66C2] disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Company Page</div>
                            <div className="mt-1 text-xs text-gray-600">
                              {userLinkedinConfig.organizations?.length 
                                ? "Posts will appear on a company page you manage"
                                : "No company pages available. Reconnect LinkedIn with organization permissions."}
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Organization Selection */}
                    {linkedinTargetType === "organization" && userLinkedinConfig.organizations && userLinkedinConfig.organizations.length > 0 && (
                      <div className="rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Select Company Page
                        </label>
                        <select
                          value={linkedinOrganizationId || ""}
                          onChange={(e) => {
                            setLinkedinOrganizationId(e.target.value || null);
                            setLinkedinSettingsMsg(null);
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0A66C2] focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20"
                        >
                          <option value="">Select a company page...</option>
                          {userLinkedinConfig.organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* Status Message */}
                {linkedinSettingsMsg && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${
                    linkedinSettingsMsg.includes("success") || linkedinSettingsMsg.includes("saved")
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}>
                    {linkedinSettingsMsg}
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={onSaveLinkedInSettings}
                    disabled={savingLinkedinSettings}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0A66C2] to-[#004182] px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingLinkedinSettings ? (
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
                        Save LinkedIn Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reference Images for AutoPost (OpenAI Image Edits) */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-start sm:items-center justify-between border-b border-gray-200 bg-gray-50 px-4 sm:px-6 py-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-purple-600 shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">📸 Reference Images for AutoPost</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">
                  Upload images for OpenAI Image Edits mode
                  {referenceImageUrl && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Uploaded
                  </span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReferenceSection(!showReferenceSection)}
              className="rounded-lg p-2 transition-colors hover:bg-gray-200 shrink-0 ml-2"
            >
              <svg
                className={`h-5 w-5 text-[#001f98] transition-transform ${showReferenceSection ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showReferenceSection && agent?.id && (
            <div className="p-4 sm:p-6">
              <ReferenceImageUpload
                agentId={agent.id}
                agentHandle={handle}
                onUploadSuccess={() => {
                  load(); // Reload agent data
                }}
              />
            </div>
          )}
        </div>

        {/* Agent Updates Card */}
        {agent?.id && (
          <AgentUpdates agentId={agent.id} agentHandle={agent.handle} />
        )}

        {/* Training Documents List Card */}
        {agent?.id && (
          <TrainingDocuments agentId={agent.id} agentHandle={agent.handle} />
        )}

        {/* Training Data Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Training Data</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Add knowledge and context for this Agent</p>
          </div>
          <div className="p-4 sm:p-6">
            {/* Tab Selection */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              <button
                onClick={() => setTrainingMode("text")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "text"
                    ? "bg-[#001f98] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                📝 Text
              </button>
              <button
                onClick={() => setTrainingMode("file")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "file"
                    ? "bg-[#001f98] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                📁 Upload File
              </button>
              <button
                onClick={() => setTrainingMode("url")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  trainingMode === "url"
                    ? "bg-[#001f98] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                🔗 From URL
              </button>
            </div>

            {/* Common: Layer and Title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                  value={trainLayer}
                  onChange={(e) => setTrainLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Title (optional)</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
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
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Source (optional)</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                    value={trainSource}
                    onChange={(e) => setTrainSource(e.target.value)}
                    placeholder="e.g., LinkedIn, website, notes"
                  />
                </div>

                <div className="sm:col-span-3 mb-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Content</label>
                  <textarea
                    className="h-32 sm:h-40 w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                    value={trainContent}
                    onChange={(e) => setTrainContent(e.target.value)}
                    placeholder="Paste training content here..."
                  />
                </div>

                <button
                  onClick={onAddDoc}
                  disabled={training}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
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
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label className="mb-2 block text-sm font-semibold text-gray-900">URL</label>
                  <input
                    type="url"
                    className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>

                <button
                  onClick={handleExtractFromUrl}
                  disabled={extractingUrl || !extractUrl.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#C8A24A]/10 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Permissions</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Control who can access different layers</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Viewer Handle</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                  value={viewerHandle}
                  onChange={(e) => setViewerHandle(e.target.value)}
                  placeholder="e.g., john-doe"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Max Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-white px-4 sm:px-6 py-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Test Agent</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#001f98]/70">Ask questions to test responses</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
                  value={testLayer}
                  onChange={(e) => setTestLayer(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="intimate">Intimate</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Question</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 sm:px-4 py-2 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
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
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#001f98] to-[#001670] px-4 sm:px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-[#001f98] hover:bg-[#001f98]/5"
                >
                  Clear
                </button>
              )}
            </div>

            {answer && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-200/50 p-3 sm:p-4 text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">
                {answer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
