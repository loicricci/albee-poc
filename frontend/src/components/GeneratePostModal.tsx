"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  previewGeneratePost, 
  confirmGeneratedPost, 
  cancelPostPreview,
  PreviewPostResponse 
} from "@/lib/api";
import { PostPreviewModal } from "./PostPreviewModal";

// Track confirmed preview IDs to prevent duplicate submissions
const confirmedPreviewIds = new Set<string>();

// Generation steps configuration
type GenerationStep = {
  id: string;
  label: string;
  description: string;
  duration: number; // estimated duration in ms
};

const GENERATION_STEPS: GenerationStep[] = [
  { id: "profile", label: "Loading Profile", description: "Analyzing agent personality and style...", duration: 2000 },
  { id: "topic", label: "Generating Content", description: "Creating engaging topic and message...", duration: 8000 },
  { id: "image", label: "Creating Image", description: "Generating stunning visual with AI...", duration: 35000 },
  { id: "preview", label: "Preparing Preview", description: "Finalizing your post for review...", duration: 3000 },
];

// Progress Overlay Component
function GenerationProgressOverlay({ 
  currentStep, 
  isComplete 
}: { 
  currentStep: number; 
  isComplete: boolean;
}) {
  const totalSteps = GENERATION_STEPS.length;
  const progress = isComplete ? 100 : Math.min(((currentStep + 0.5) / totalSteps) * 100, 95);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl">
      {/* Central animated icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#001f98] to-[#3366cc] flex items-center justify-center shadow-lg shadow-[#001f98]/30">
          {isComplete ? (
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>
        {/* Animated ring */}
        {!isComplete && (
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-[#001f98]/20 border-t-[#001f98] animate-spin" />
        )}
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {isComplete ? "Almost Done!" : "Creating Your Post"}
      </h3>
      <p className="text-sm text-gray-500 mb-8 text-center max-w-xs">
        {isComplete 
          ? "Your post is ready for preview" 
          : "Please wait while we craft something amazing"}
      </p>

      {/* Progress bar */}
      <div className="w-64 mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#001f98] to-[#3366cc] rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          {Math.round(progress)}% complete
        </p>
      </div>

      {/* Steps list */}
      <div className="w-72 space-y-3">
        {GENERATION_STEPS.map((step, index) => {
          const isActive = index === currentStep && !isComplete;
          const isCompleted = index < currentStep || isComplete;
          const isPending = index > currentStep && !isComplete;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                isActive 
                  ? "bg-[#e6eaff] border-2 border-[#001f98] shadow-md" 
                  : isCompleted
                    ? "bg-green-50 border-2 border-green-200"
                    : "bg-gray-50 border-2 border-transparent"
              }`}
            >
              {/* Step indicator */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCompleted 
                  ? "bg-green-500 text-white" 
                  : isActive 
                    ? "bg-[#001f98] text-white"
                    : "bg-gray-200 text-gray-400"
              }`}>
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold transition-colors duration-300 ${
                  isCompleted 
                    ? "text-green-700" 
                    : isActive 
                      ? "text-[#001f98]"
                      : "text-gray-400"
                }`}>
                  {step.label}
                </p>
                <p className={`text-xs truncate transition-colors duration-300 ${
                  isActive ? "text-[#001f98]/70" : isPending ? "text-gray-300" : "text-gray-400"
                }`}>
                  {isCompleted ? "Completed" : step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtle animation dots at the bottom */}
      {!isComplete && (
        <div className="mt-8 flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#001f98] animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-[#001f98] animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-[#001f98] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}
    </div>
  );
}

type ReferenceImage = {
  id: string;
  reference_image_url: string;
  mask_image_url: string | null;
  edit_instructions: string | null;
  image_dimensions: string | null;
  is_primary: boolean;
  created_at: string | null;
};

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type GeneratePostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
  onSuccess: () => void;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in");
  return token;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE");
  return base;
}

// Image style options
const IMAGE_STYLES = [
  { value: "", label: "Auto / Default", description: "Let AI choose the best style" },
  { value: "realistic", label: "Realistic", description: "Natural light. Real faces and places." },
  { value: "cartoon", label: "Cartoon", description: "Simple shapes. Bold lines. Exaggerated features." },
  { value: "anime", label: "Anime", description: "Japanese-style illustration. Big eyes. Clean colors." },
  { value: "futuristic", label: "Futuristic / Sci-Fi", description: "Advanced tech. Neon lights. Cyber themes." },
  { value: "illustration", label: "Illustration / Digital Art", description: "Painterly or graphic. Often used for covers." },
  { value: "3d_render", label: "3D Render", description: "Depth and volume. Looks like CGI or game assets." },
  { value: "sketch", label: "Sketch / Hand-drawn", description: "Pencil or ink style. Rough and expressive." },
  { value: "fantasy", label: "Fantasy", description: "Mythical worlds. Magic. Creatures and heroes." },
];

export function GeneratePostModal({ isOpen, onClose, agent, onSuccess }: GeneratePostModalProps) {
  // Form state
  const [topic, setTopic] = useState("");
  const [imageStyle, setImageStyle] = useState<string>("");
  // Engine options: OpenAI (dall-e, gpt-image, sora) + Black Forest Labs (flux)
  const [imageEngine, setImageEngine] = useState<
    "dall-e-3" | "gpt-image-1" | "gpt-image-1.5" | 
    "flux-2-pro" | "flux-2-max" | "flux-2-klein" |
    "sora-2-video" | "sora-2-pro"
  >("dall-e-3");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  
  // Reference images from agent's library
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationComplete, setGenerationComplete] = useState(false);
  
  // Preview state (for approval workflow)
  const [previewData, setPreviewData] = useState<PreviewPostResponse | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch agent's reference images when modal opens
  useEffect(() => {
    if (isOpen && agent.id) {
      fetchReferenceImages();
    }
  }, [isOpen, agent.id]);

  // Progress through generation steps based on estimated timings
  useEffect(() => {
    if (isGenerating && generationStep < GENERATION_STEPS.length) {
      const currentStepDuration = GENERATION_STEPS[generationStep]?.duration || 2000;
      
      stepTimerRef.current = setTimeout(() => {
        if (generationStep < GENERATION_STEPS.length - 1) {
          setGenerationStep(prev => prev + 1);
        }
      }, currentStepDuration);
    }
    
    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    };
  }, [isGenerating, generationStep]);

  // Reset generation progress when modal closes or generation stops
  useEffect(() => {
    if (!isGenerating && !generationComplete) {
      setGenerationStep(0);
    }
  }, [isGenerating, generationComplete]);

  // Clear reference image when switching to DALL-E 3 (only dall-e-3 doesn't support reference images)
  useEffect(() => {
    if (imageEngine === "dall-e-3") {
      setReferenceImageUrl(null);
      setUploadedImageUrl(null);
    }
  }, [imageEngine]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTopic("");
      setImageStyle("");
      setImageEngine("dall-e-3");
      setReferenceImageUrl(null);
      setUploadedImageUrl(null);
      setUploadError(null);
      setError(null);
      setPreviewData(null);
      setGenerationStep(0);
      setGenerationComplete(false);
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    }
  }, [isOpen]);

  async function fetchReferenceImages() {
    setLoadingImages(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/auto-post/agents/${agent.id}/reference-images`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        console.error("Failed to fetch reference images");
        return;
      }
      
      const data = await res.json();
      setReferenceImages(data.images || []);
    } catch (e) {
      console.error("Error fetching reference images:", e);
    } finally {
      setLoadingImages(false);
    }
  }

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  }, [agent.id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  };

  async function handleFileUpload(file: File) {
    setUploadError(null);
    
    // Validate file type
    if (!file.type.includes("png")) {
      setUploadError("Only PNG files are supported");
      return;
    }
    
    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Image must be less than 4MB");
      return;
    }
    
    // Validate dimensions (must be square)
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          if (img.width !== img.height) {
            reject(new Error(`Image must be square. Got ${img.width}x${img.height}`));
          } else {
            resolve();
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = objectUrl;
      });
    } catch (e: any) {
      setUploadError(e.message);
      URL.revokeObjectURL(objectUrl);
      return;
    }
    
    // Upload via backend API (which uses service role key to bypass RLS)
    setIsUploading(true);
    try {
      const token = await getAccessToken();
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append("reference_image", file);
      
      const res = await fetch(`${apiBase()}/auto-post/agents/${agent.id}/reference-images/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: Don't set Content-Type for FormData, browser sets it with boundary
        },
        body: formData,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Upload failed: ${res.status}`);
      }
      
      const data = await res.json();
      
      setUploadedImageUrl(data.reference_image_url);
      setReferenceImageUrl(data.reference_image_url);
    } catch (e: any) {
      setUploadError(e.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleGenerate(feedback?: string, previousPreviewId?: string) {
    if (!agent.id) return;
    
    // Reset and start generation progress
    setGenerationStep(0);
    setGenerationComplete(false);
    setIsGenerating(true);
    setError(null);
    
    try {
      // Use the preview API instead of direct generate
      const preview = await previewGeneratePost({
        avee_id: agent.id,
        topic: topic.trim() || null,
        image_engine: imageEngine,
        image_style: imageStyle || null,
        // Pass reference image for both GPT-Image-1 (editing) and Sora 2 Video (image-to-video)
        reference_image_url: (imageEngine === "gpt-image-1" || imageEngine === "sora-2-video") ? referenceImageUrl : null,
        feedback: feedback || null,
        previous_preview_id: previousPreviewId || null,
      });
      
      // Mark generation as complete before showing preview
      setGenerationComplete(true);
      
      // Brief delay to show completion state, then show preview
      setTimeout(() => {
        setPreviewData(preview);
        setIsGenerating(false);
        setGenerationStep(0);
        setGenerationComplete(false);
      }, 800);
    } catch (e: any) {
      setError(e.message || "Failed to generate preview");
      setIsGenerating(false);
      setGenerationStep(0);
      setGenerationComplete(false);
    }
  }

  // Ref to prevent duplicate submissions
  const isSubmittingRef = useRef(false);
  
  async function handleApprove(editedTitle?: string, editedDescription?: string) {
    if (!previewData) return;
    
    // Prevent duplicate submissions using ref (immediate check)
    if (isSubmittingRef.current) {
      console.log("[GeneratePostModal] Preventing duplicate submission");
      return;
    }
    
    // Check if this preview was already confirmed
    if (confirmedPreviewIds.has(previewData.preview_id)) {
      console.log("[GeneratePostModal] Preview already confirmed, closing modal");
      setPreviewData(null);
      onSuccess();
      onClose();
      return;
    }
    
    isSubmittingRef.current = true;
    setIsProcessingPreview(true);
    
    try {
      // Check if this is a video preview
      const isVideo = imageEngine === "sora-2-video" || !!previewData.video_url;
      
      await confirmGeneratedPost({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
        title: editedTitle,
        description: editedDescription,
      }, isVideo);
      
      // Mark this preview as confirmed to handle any duplicate calls
      confirmedPreviewIds.add(previewData.preview_id);
      
      // Cleanup old entries (keep last 50)
      if (confirmedPreviewIds.size > 50) {
        const oldestIds = Array.from(confirmedPreviewIds).slice(0, confirmedPreviewIds.size - 50);
        oldestIds.forEach(id => confirmedPreviewIds.delete(id));
      }
      
      // Success!
      setPreviewData(null);
      onSuccess();
      onClose();
    } catch (e: any) {
      // If we get a 404, the preview might have already been confirmed
      // Check if status is 404 and handle gracefully
      if (e.status === 404 && e.message?.includes("Preview not found")) {
        console.log("[GeneratePostModal] Preview already consumed, treating as success");
        confirmedPreviewIds.add(previewData.preview_id);
        setPreviewData(null);
        onSuccess();
        onClose();
      } else {
        setError(e.message || "Failed to publish post");
      }
    } finally {
      isSubmittingRef.current = false;
      setIsProcessingPreview(false);
    }
  }

  async function handleRegenerate(feedback: string) {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    
    // Regenerate with feedback, passing the previous preview ID for cleanup
    await handleGenerate(feedback, previewData.preview_id);
    
    setIsProcessingPreview(false);
  }

  async function handleCancelPreview() {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    
    try {
      // Check if this is a video preview
      const isVideo = imageEngine === "sora-2-video" || !!previewData.video_url;
      
      await cancelPostPreview({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
      }, isVideo);
    } catch (e) {
      // Silently ignore - cleanup failure is not critical
      console.error("Failed to cancel preview:", e);
    } finally {
      setPreviewData(null);
      setIsProcessingPreview(false);
    }
  }

  function selectReferenceImage(url: string) {
    setReferenceImageUrl(url);
    setUploadedImageUrl(null); // Clear any uploaded image
  }

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onClose();
      }}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Generation Progress Overlay */}
        {isGenerating && (
          <GenerationProgressOverlay 
            currentStep={generationStep} 
            isComplete={generationComplete} 
          />
        )}

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Generate Post</h2>
                <p className="text-sm text-gray-500">
                  For @{agent.handle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Topic Override */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave empty to auto-generate from trending topics"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-gray-500">
              Override the auto-generated topic with your own
            </p>
          </div>

          {/* Image Style Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Image Style (Optional)
            </label>
            <select
              value={imageStyle}
              onChange={(e) => setImageStyle(e.target.value)}
              disabled={isGenerating}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
            >
              {IMAGE_STYLES.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
            {imageStyle && (
              <p className="mt-1 text-xs text-gray-500">
                {IMAGE_STYLES.find((s) => s.value === imageStyle)?.description}
              </p>
            )}
          </div>

          {/* Image/Video Engine Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Generation Engine
            </label>
            
            {/* OpenAI Image Engines */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">📷 OpenAI Images</p>
              <div className="space-y-2">
                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "dall-e-3" 
                      ? "border-[#001f98] bg-[#e6eaff]" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="dall-e-3"
                    checked={imageEngine === "dall-e-3"} onChange={() => setImageEngine("dall-e-3")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">DALL-E 3</div>
                    <div className="text-xs text-gray-500">Pure image generation from text prompts</div>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "gpt-image-1" 
                      ? "border-[#001f98] bg-[#e6eaff]" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="gpt-image-1"
                    checked={imageEngine === "gpt-image-1"} onChange={() => setImageEngine("gpt-image-1")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">GPT-Image-1</div>
                    <div className="text-xs text-gray-500">Semantic editing with reference images</div>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "gpt-image-1.5" 
                      ? "border-[#001f98] bg-[#e6eaff]" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="gpt-image-1.5"
                    checked={imageEngine === "gpt-image-1.5"} onChange={() => setImageEngine("gpt-image-1.5")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      GPT-Image-1.5
                      <span className="text-[10px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full font-semibold">NEW</span>
                    </div>
                    <div className="text-xs text-gray-500">Latest OpenAI model with improved quality</div>
                  </div>
                </label>
              </div>
            </div>

            {/* FLUX.2 Engines */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">⚡ FLUX.2 (Black Forest Labs)</p>
              <div className="space-y-2">
                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "flux-2-pro" 
                      ? "border-amber-500 bg-amber-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="flux-2-pro"
                    checked={imageEngine === "flux-2-pro"} onChange={() => setImageEngine("flux-2-pro")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-amber-500 focus:ring-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">FLUX.2 Pro</div>
                    <div className="text-xs text-gray-500">Best balance of speed & quality (~10s)</div>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "flux-2-max" 
                      ? "border-amber-500 bg-amber-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="flux-2-max"
                    checked={imageEngine === "flux-2-max"} onChange={() => setImageEngine("flux-2-max")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-amber-500 focus:ring-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">FLUX.2 Max ✨</div>
                    <div className="text-xs text-gray-500">Highest quality output</div>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "flux-2-klein" 
                      ? "border-amber-500 bg-amber-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="flux-2-klein"
                    checked={imageEngine === "flux-2-klein"} onChange={() => setImageEngine("flux-2-klein")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-amber-500 focus:ring-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">FLUX.2 Klein</div>
                    <div className="text-xs text-gray-500">Fastest & cheapest (sub-second)</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Video Engines */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">🎬 Video (SORA 2)</p>
              <div className="space-y-2">
                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "sora-2-video" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="sora-2-video"
                    checked={imageEngine === "sora-2-video"} onChange={() => setImageEngine("sora-2-video")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-blue-500 focus:ring-blue-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">SORA 2</div>
                    <div className="text-xs text-gray-500">Standard 10-second AI video clips</div>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    imageEngine === "sora-2-pro" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="imageEngine" value="sora-2-pro"
                    checked={imageEngine === "sora-2-pro"} onChange={() => setImageEngine("sora-2-pro")}
                    disabled={isGenerating} className="mt-1 h-4 w-4 text-blue-500 focus:ring-blue-500" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      SORA 2 Pro
                      <span className="text-[10px] bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-1.5 py-0.5 rounded-full font-semibold">NEW</span>
                    </div>
                    <div className="text-xs text-gray-500">Higher quality, longer 12-second videos</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Reference Image Section - Visible for engines that support it */}
          {(imageEngine === "gpt-image-1" || imageEngine === "gpt-image-1.5" || 
            imageEngine.startsWith("flux-2") || imageEngine.startsWith("sora-2")) && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-900">
                Reference Image (Optional)
              </label>
              
              {/* Currently selected image preview */}
              {referenceImageUrl && (
                <div className="relative">
                  <img 
                    src={referenceImageUrl} 
                    alt="Selected reference" 
                    className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={() => {
                      setReferenceImageUrl(null);
                      setUploadedImageUrl(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                    disabled={isGenerating}
                  >
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Upload area - only show if no image selected */}
              {!referenceImageUrl && (
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                    dragActive 
                      ? "border-[#001f98] bg-[#e6eaff]" 
                      : "border-gray-300 hover:border-gray-400"
                  } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isGenerating || isUploading}
                  />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-8 w-8 animate-spin text-[#001f98]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-gray-600">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        Drag & drop a PNG image here, or{" "}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#001f98] font-medium hover:underline"
                          disabled={isGenerating}
                        >
                          browse
                        </button>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        PNG only, square dimensions, max 4MB
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}

              {/* Agent's existing reference images */}
              {!referenceImageUrl && referenceImages.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Or select from library ({referenceImages.length} image{referenceImages.length !== 1 ? "s" : ""})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {referenceImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => selectReferenceImage(img.reference_image_url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-[#001f98] ${
                          img.is_primary ? "border-[#C8A24A]" : "border-gray-200"
                        }`}
                        disabled={isGenerating}
                      >
                        <img 
                          src={img.reference_image_url} 
                          alt="Reference" 
                          className="w-full h-full object-cover"
                        />
                        {img.is_primary && (
                          <div className="absolute top-1 right-1 bg-[#C8A24A] text-white text-[8px] px-1 rounded">
                            Primary
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state for reference images */}
              {loadingImages && (
                <div className="flex items-center justify-center py-4">
                  <svg className="h-5 w-5 animate-spin text-gray-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Info box for DALL-E 3 */}
          {imageEngine === "dall-e-3" && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                DALL-E 3 generates images from scratch based on the post topic. 
                Switch to GPT Image 1 to use reference images, or Sora 2 Video for video content.
              </span>
            </div>
          )}

          {/* Info box for Sora 2 Video */}
          {imageEngine === "sora-2-video" && (
            <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>
                Sora 2 generates <strong>10-second AI video</strong> clips based on the topic.
                Optionally add a reference image to animate it into a video.
                Video generation takes 1-2 minutes.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-all hover:border-[#001f98] hover:text-[#001f98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3366cc] to-[#001f98] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Post
            </button>
          </div>
        </div>
      </div>

      {/* Post Preview Modal - For approval workflow */}
      {previewData && (
        <PostPreviewModal
          preview={previewData}
          isOpen={true}
          isLoading={isProcessingPreview || isGenerating}
          onApprove={handleApprove}
          onRegenerate={handleRegenerate}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  );
}
