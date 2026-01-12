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

export function GeneratePostModal({ isOpen, onClose, agent, onSuccess }: GeneratePostModalProps) {
  // Form state
  const [topic, setTopic] = useState("");
  const [imageEngine, setImageEngine] = useState<"dall-e-3" | "gpt-image-1">("dall-e-3");
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
  
  // Preview state (for approval workflow)
  const [previewData, setPreviewData] = useState<PreviewPostResponse | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch agent's reference images when modal opens
  useEffect(() => {
    if (isOpen && agent.id) {
      fetchReferenceImages();
    }
  }, [isOpen, agent.id]);

  // Clear reference image when switching to DALL-E 3
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
      setImageEngine("dall-e-3");
      setReferenceImageUrl(null);
      setUploadedImageUrl(null);
      setUploadError(null);
      setError(null);
      setPreviewData(null);
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
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Use the preview API instead of direct generate
      const preview = await previewGeneratePost({
        avee_id: agent.id,
        topic: topic.trim() || null,
        image_engine: imageEngine,
        reference_image_url: imageEngine === "gpt-image-1" ? referenceImageUrl : null,
        feedback: feedback || null,
        previous_preview_id: previousPreviewId || null,
      });
      
      // Show the preview modal
      setPreviewData(preview);
    } catch (e: any) {
      setError(e.message || "Failed to generate preview");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprove(editedTitle?: string, editedDescription?: string) {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    
    try {
      await confirmGeneratedPost({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
        title: editedTitle,
        description: editedDescription,
      });
      
      // Success!
      setPreviewData(null);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to publish post");
    } finally {
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
      await cancelPostPreview({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
      });
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
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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

          {/* Image Engine Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Image Generation Engine
            </label>
            <div className="space-y-2">
              {/* DALL-E 3 Option */}
              <label 
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  imageEngine === "dall-e-3" 
                    ? "border-[#001f98] bg-[#e6eaff]" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="imageEngine"
                  value="dall-e-3"
                  checked={imageEngine === "dall-e-3"}
                  onChange={() => setImageEngine("dall-e-3")}
                  disabled={isGenerating}
                  className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">DALL-E 3</div>
                  <div className="text-xs text-gray-500">
                    Pure image generation from prompt. Creates entirely new images.
                  </div>
                </div>
              </label>

              {/* GPT Image 1 Option */}
              <label 
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  imageEngine === "gpt-image-1" 
                    ? "border-[#001f98] bg-[#e6eaff]" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="imageEngine"
                  value="gpt-image-1"
                  checked={imageEngine === "gpt-image-1"}
                  onChange={() => setImageEngine("gpt-image-1")}
                  disabled={isGenerating}
                  className="mt-1 h-4 w-4 text-[#001f98] focus:ring-[#001f98]"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">GPT Image 1</div>
                  <div className="text-xs text-gray-500">
                    Supports reference images for semantic editing. Can transform existing images.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Reference Image Section - Only visible for GPT Image 1 */}
          {imageEngine === "gpt-image-1" && (
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
                Switch to GPT Image 1 to use reference images.
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
              {isGenerating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Post
                </>
              )}
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
