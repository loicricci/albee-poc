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

// Generation steps configuration
type GenerationStep = {
  id: string;
  label: string;
  description: string;
  duration: number;
};

const GENERATION_STEPS: GenerationStep[] = [
  { id: "profile", label: "Loading Profile", description: "Analyzing your agent's personality...", duration: 2000 },
  { id: "topic", label: "Generating Content", description: "Creating engaging topic and message...", duration: 8000 },
  { id: "image", label: "Creating Image", description: "Generating stunning visual with AI...", duration: 35000 },
  { id: "preview", label: "Preparing Preview", description: "Finalizing your first post...", duration: 3000 },
];

// Topic suggestions for first post
const TOPIC_SUGGESTIONS = [
  "My first day on the platform",
  "Hello world! Introducing myself",
  "What I'm passionate about",
  "A beautiful moment in time",
  "Technology and innovation",
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
        {!isComplete && (
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-[#001f98]/20 border-t-[#001f98] animate-spin" />
        )}
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {isComplete ? "Almost Done!" : "Creating Your First Post"}
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
                  isActive ? "text-[#001f98]/70" : "text-gray-400"
                }`}>
                  {isCompleted ? "Completed" : step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

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

type Agent = {
  id: string;
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type FirstPostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
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

// Track confirmed preview IDs
const confirmedPreviewIds = new Set<string>();

export function FirstPostModal({ isOpen, onClose, onSkip, agent, onSuccess }: FirstPostModalProps) {
  // Form state
  const [topic, setTopic] = useState("");
  const [imageEngine, setImageEngine] = useState<"gpt-image-1.5" | "dall-e-3">("gpt-image-1.5");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
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
  
  // Preview state
  const [previewData, setPreviewData] = useState<PreviewPostResponse | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);

  // Progress through generation steps
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

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTopic("");
      setImageEngine("gpt-image-1.5");
      setUploadedImageUrl(null);
      setUploadError(null);
      setError(null);
      setPreviewData(null);
      setGenerationStep(0);
      setGenerationComplete(false);
      setShowAdvanced(false);
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    }
  }, [isOpen]);

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
    
    if (!file.type.includes("png")) {
      setUploadError("Only PNG files are supported");
      return;
    }
    
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Image must be less than 4MB");
      return;
    }
    
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
    
    setIsUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("reference_image", file);
      
      const res = await fetch(`${apiBase()}/auto-post/agents/${agent.id}/reference-images/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Upload failed: ${res.status}`);
      }
      
      const data = await res.json();
      setUploadedImageUrl(data.reference_image_url);
    } catch (e: any) {
      setUploadError(e.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleGenerate(feedback?: string, previousPreviewId?: string) {
    if (!agent.id) return;
    
    setGenerationStep(0);
    setGenerationComplete(false);
    setIsGenerating(true);
    setError(null);
    
    try {
      const preview = await previewGeneratePost({
        avee_id: agent.id,
        topic: topic.trim() || null,
        image_engine: imageEngine,
        image_style: null,
        reference_image_url: imageEngine === "gpt-image-1.5" ? uploadedImageUrl : null,
        feedback: feedback || null,
        previous_preview_id: previousPreviewId || null,
      });
      
      setGenerationComplete(true);
      
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

  async function handleApprove(editedTitle?: string, editedDescription?: string) {
    if (!previewData) return;
    
    if (isSubmittingRef.current) return;
    
    if (confirmedPreviewIds.has(previewData.preview_id)) {
      setPreviewData(null);
      onSuccess();
      onClose();
      return;
    }
    
    isSubmittingRef.current = true;
    setIsProcessingPreview(true);
    
    try {
      await confirmGeneratedPost({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
        title: editedTitle,
        description: editedDescription,
      }, false);
      
      confirmedPreviewIds.add(previewData.preview_id);
      
      setPreviewData(null);
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.status === 404 && e.message?.includes("Preview not found")) {
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
    await handleGenerate(feedback, previewData.preview_id);
    setIsProcessingPreview(false);
  }

  async function handleCancelPreview() {
    if (!previewData) return;
    setIsProcessingPreview(true);
    
    try {
      await cancelPostPreview({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
      }, false);
    } catch (e) {
      console.error("Failed to cancel preview:", e);
    } finally {
      setPreviewData(null);
      setIsProcessingPreview(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onSkip();
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
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg" style={{background: 'linear-gradient(135deg, #001f98 0%, #3366cc 100%)'}}>
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create Your First Post!</h2>
                <p className="text-sm text-gray-500">
                  Let AI generate amazing content for @{agent.handle}
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
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
          {/* Welcome message */}
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Welcome to the platform!</p>
              <p className="text-sm text-green-700">
                Create your first post to introduce yourself to the community. 
                Our AI will generate stunning visuals to make your post stand out.
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Topic Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              What would you like to post about?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave empty to auto-generate a topic"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-all focus:border-[#001f98] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20"
              disabled={isGenerating}
            />
            {/* Topic suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Suggestions:</span>
              {TOPIC_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setTopic(suggestion)}
                  disabled={isGenerating}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-[#001f98]/10 hover:text-[#001f98] transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Engine Selection (Simplified) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Choose AI Engine
            </label>
            <div className="space-y-2">
              <label 
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  imageEngine === "gpt-image-1.5" 
                    ? "border-[#001f98] bg-[#e6eaff]" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input 
                  type="radio" 
                  name="engine" 
                  value="gpt-image-1.5"
                  checked={imageEngine === "gpt-image-1.5"} 
                  onChange={() => setImageEngine("gpt-image-1.5")}
                  disabled={isGenerating} 
                  className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]" 
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    GPT-Image-1.5
                    <span className="text-[10px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full font-semibold">RECOMMENDED</span>
                  </div>
                  <div className="text-sm text-gray-500">Latest OpenAI model with the best quality and creativity</div>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  imageEngine === "dall-e-3" 
                    ? "border-[#001f98] bg-[#e6eaff]" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input 
                  type="radio" 
                  name="engine" 
                  value="dall-e-3"
                  checked={imageEngine === "dall-e-3"} 
                  onChange={() => setImageEngine("dall-e-3")}
                  disabled={isGenerating} 
                  className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]" 
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">DALL-E 3</div>
                  <div className="text-sm text-gray-500">Classic and reliable image generation</div>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Image Upload (for GPT-Image-1.5) */}
          {imageEngine === "gpt-image-1.5" && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Reference Image (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Upload a PNG image to influence the generated visual style
              </p>
              
              {uploadedImageUrl ? (
                <div className="relative">
                  <img 
                    src={uploadedImageUrl} 
                    alt="Uploaded reference" 
                    className="w-full h-40 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={() => setUploadedImageUrl(null)}
                    className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                    disabled={isGenerating}
                  >
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
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
                        Drag & drop a PNG, or{" "}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#001f98] font-medium hover:underline"
                          disabled={isGenerating}
                        >
                          browse
                        </button>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Square PNG, max 4MB
                      </p>
                    </>
                  )}
                </div>
              )}
              
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              disabled={isGenerating}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3366cc] to-[#001f98] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#001f98]/25 transition-all hover:shadow-[#001f98]/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate My First Post
            </button>
          </div>
        </div>
      </div>

      {/* Post Preview Modal */}
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
