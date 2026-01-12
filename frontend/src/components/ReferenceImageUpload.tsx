"use client";

import { useState, useRef, useEffect } from "react";

interface ReferenceImageUploadProps {
  agentId: string;
  agentHandle: string;
  onUploadSuccess?: () => void;
}

interface ReferenceImage {
  id: string;
  reference_image_url: string;
  mask_image_url?: string | null;
  edit_instructions?: string | null;
  image_dimensions?: string | null;
  is_primary: boolean;
  created_at?: string | null;
}

export function ReferenceImageUpload({
  agentId,
  agentHandle,
  onUploadSuccess,
}: ReferenceImageUploadProps) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedReferenceFile, setSelectedReferenceFile] = useState<File | null>(null);
  const [selectedMaskFile, setSelectedMaskFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  
  const [previewReferenceUrl, setPreviewReferenceUrl] = useState<string | null>(null);
  const [previewMaskUrl, setPreviewMaskUrl] = useState<string | null>(null);

  // Fetch existing images
  const fetchImages = async () => {
    try {
      const { getAccessToken } = await import("@/lib/supabaseClient");
      const token = await getAccessToken();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE 
        || process.env.NEXT_PUBLIC_API_URL 
        || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
      
      const response = await fetch(
        `${API_BASE}/auto-post/agents/${agentId}/reference-images`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (err) {
      console.error("Failed to fetch images:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [agentId]);

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate PNG
    if (!file.type.startsWith("image/png")) {
      setError("Reference image must be PNG format");
      return;
    }
    
    // Validate size (4MB)
    if (file.size > 4 * 1024 * 1024) {
      setError("Reference image must be less than 4MB");
      return;
    }
    
    setSelectedReferenceFile(file);
    setPreviewReferenceUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleMaskSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate PNG
    if (!file.type.startsWith("image/png")) {
      setError("Mask image must be PNG format");
      return;
    }
    
    setSelectedMaskFile(file);
    setPreviewMaskUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedReferenceFile) {
      setError("Please select a reference image");
      return;
    }
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const formData = new FormData();
      formData.append("reference_image", selectedReferenceFile);
      
      if (selectedMaskFile) {
        formData.append("mask_image", selectedMaskFile);
      }
      
      if (instructions) {
        formData.append("edit_instructions", instructions);
      }
      
      formData.append("is_primary", isPrimary.toString());
      
      const { getAccessToken } = await import("@/lib/supabaseClient");
      const token = await getAccessToken();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE 
        || process.env.NEXT_PUBLIC_API_URL 
        || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
      
      if (!API_BASE) {
        throw new Error("API base URL not configured. Please set NEXT_PUBLIC_API_BASE in .env.local");
      }
      
      const response = await fetch(
        `${API_BASE}/auto-post/agents/${agentId}/reference-images/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        let errorMessage = "Upload failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Reset form
      setSelectedReferenceFile(null);
      setSelectedMaskFile(null);
      setPreviewReferenceUrl(null);
      setPreviewMaskUrl(null);
      setInstructions("");
      setIsPrimary(false);
      
      setSuccess(`✅ Reference image uploaded successfully! Dimensions: ${result.image_dimensions}`);
      
      // Refresh images list
      await fetchImages();
      
      setTimeout(() => {
        setSuccess(null);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to upload images");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this reference image?")) {
      return;
    }
    
    setDeleting(imageId);
    setError(null);
    setSuccess(null);
    
    try {
      const { getAccessToken } = await import("@/lib/supabaseClient");
      const token = await getAccessToken();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE 
        || process.env.NEXT_PUBLIC_API_URL 
        || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
      
      const response = await fetch(
        `${API_BASE}/auto-post/agents/${agentId}/reference-images/${imageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        let errorMessage = "Delete failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      setSuccess("✅ Reference image deleted successfully!");
      
      // Refresh images list
      await fetchImages();
      
      setTimeout(() => {
        setSuccess(null);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete image");
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      const { getAccessToken } = await import("@/lib/supabaseClient");
      const token = await getAccessToken();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE 
        || process.env.NEXT_PUBLIC_API_URL 
        || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
      
      const response = await fetch(
        `${API_BASE}/auto-post/agents/${agentId}/reference-images/${imageId}/set-primary`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to set primary image");
      }
      
      // Refresh images list
      await fetchImages();
      setSuccess("✅ Primary image updated!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to set primary image");
      console.error("Set primary error:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Multiple Reference Images</p>
            <p className="text-blue-700">
              Upload multiple reference images for OpenAI Image Edits. You can mark one as primary (default) for autoposts.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-blue-600">
              <li>• Reference image: PNG, square (1024x1024 recommended), max 4MB</li>
              <li>• Mask (optional): PNG with transparency, same dimensions as reference</li>
              <li>• Each image can have its own edit instructions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="rounded-lg border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 mt-0.5">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-green-900">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Existing Images Gallery */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading images...</div>
      ) : images.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Your Reference Images ({images.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className={`rounded-lg border-2 p-4 ${
                  image.is_primary 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {image.is_primary && (
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-blue-700">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Primary
                  </div>
                )}
                
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Reference Image</p>
                  <img 
                    src={image.reference_image_url} 
                    alt="Reference" 
                    className="w-full rounded border border-gray-300"
                  />
                  {image.image_dimensions && (
                    <p className="text-xs text-gray-500 mt-1">{image.image_dimensions}</p>
                  )}
                </div>
                
                {image.mask_image_url && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Mask Image</p>
                    <img 
                      src={image.mask_image_url} 
                      alt="Mask" 
                      className="w-full rounded border border-gray-300 bg-checkered"
                    />
                  </div>
                )}
                
                {image.edit_instructions && (
                  <div className="mb-3 rounded bg-white p-2 border border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-1">Instructions:</p>
                    <p className="text-xs text-gray-600">{image.edit_instructions}</p>
                  </div>
                )}
                
                <div className="flex gap-2 mt-3">
                  {!image.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(image.id)}
                      className="flex-1 rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(image.id)}
                    disabled={deleting === image.id}
                    className="flex-1 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === image.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">No reference images uploaded yet.</p>
        </div>
      )}

      {/* Upload Form */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">Upload New Reference Image</h4>
        
        {/* Reference Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Image <span className="text-red-500">*</span>
          </label>
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/png"
            onChange={handleReferenceSelect}
            className="hidden"
          />
          <button
            onClick={() => referenceInputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-100"
          >
            {selectedReferenceFile ? selectedReferenceFile.name : "Click to select reference image (PNG, square, max 4MB)"}
          </button>
          {previewReferenceUrl && (
            <div className="mt-2">
              <img src={previewReferenceUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
            </div>
          )}
        </div>

        {/* Mask Image Upload (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mask Image <span className="text-gray-400">(optional)</span>
          </label>
          <input
            ref={maskInputRef}
            type="file"
            accept="image/png"
            onChange={handleMaskSelect}
            className="hidden"
          />
          <button
            onClick={() => maskInputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-100"
          >
            {selectedMaskFile ? selectedMaskFile.name : "Click to select mask image (optional, PNG, same size as reference)"}
          </button>
          {previewMaskUrl && (
            <div className="mt-2">
              <img src={previewMaskUrl} alt="Mask Preview" className="w-32 h-32 object-cover rounded-lg border border-gray-300 bg-checkered" />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            If no mask is provided, the entire image will be edited. Transparent areas = keep, opaque areas = edit.
          </p>
        </div>

        {/* Edit Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Edit Instructions <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Optional instructions to enhance the editing prompt (e.g., 'Keep the background bright and colorful')"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Set as Primary Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPrimary"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isPrimary" className="text-sm text-gray-700">
            Set as primary (default for autoposts)
          </label>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedReferenceFile || uploading}
          className="w-full rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#001670] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Reference Image"}
        </button>
      </div>
    </div>
  );
}
