"use client";

import { useState, useRef, useCallback } from "react";

interface MoodBoardUploadProps {
  agentId: string;
  agentHandle: string;
  currentGuidelines?: string;
  onGuidelinesExtracted: (guidelines: string) => void;
}

interface AnalysisResult {
  formatted_guidelines: string;
  sections: Record<string, string>;
  image_count: number;
  tokens_used: number | string;
}

export function MoodBoardUpload({
  agentId,
  agentHandle,
  currentGuidelines,
  onGuidelinesExtracted,
}: MoodBoardUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [editedGuidelines, setEditedGuidelines] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [];
    
    for (const file of fileArray) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      
      if (!isImage && !isPdf) {
        setError(`Unsupported file: ${file.name}. Use PNG, JPG, WebP, GIF, or PDF.`);
        continue;
      }
      
      // Validate size (10MB max per file)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Max 10MB per file.`);
        continue;
      }
      
      validFiles.push(file);
      
      // Create preview for images only
      if (isImage) {
        newPreviewUrls.push(URL.createObjectURL(file));
      } else {
        // PDF placeholder
        newPreviewUrls.push("");
      }
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
      setError(null);
      setAnalysisResult(null);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      // Revoke URL to free memory
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return prev.filter((_, i) => i !== index);
    });
    setAnalysisResult(null);
  };

  const clearAll = () => {
    previewUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setAnalysisResult(null);
    setEditedGuidelines("");
    setError(null);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one mood board image");
      return;
    }
    
    setAnalyzing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      
      for (const file of selectedFiles) {
        formData.append("files", file);
      }
      
      // Add context about the agent
      if (currentGuidelines) {
        formData.append("additional_context", `Current branding guidelines:\n${currentGuidelines}`);
      }
      
      const { getAccessToken } = await import("@/lib/supabaseClient");
      const token = await getAccessToken();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE 
        || process.env.NEXT_PUBLIC_API_URL 
        || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
      
      if (!API_BASE) {
        throw new Error("API base URL not configured");
      }
      
      const response = await fetch(
        `${API_BASE}/avees/${agentId}/analyze-mood-board`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Analysis failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      setAnalysisResult({
        formatted_guidelines: result.formatted_guidelines,
        sections: result.sections,
        image_count: result.image_count,
        tokens_used: result.tokens_used,
      });
      
      // Pre-populate editable textarea
      setEditedGuidelines(result.formatted_guidelines);
      
    } catch (err: any) {
      console.error("Mood board analysis failed:", err);
      setError(err.message || "Failed to analyze mood board");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyGuidelines = () => {
    if (editedGuidelines.trim()) {
      onGuidelinesExtracted(editedGuidelines.trim());
      // Clear state after applying
      clearAll();
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all
          ${isDragging 
            ? "border-amber-500 bg-amber-50" 
            : "border-gray-300 bg-gray-50 hover:border-amber-400 hover:bg-amber-50/50"
          }
          ${analyzing ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={analyzing}
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`rounded-full p-3 ${isDragging ? "bg-amber-200" : "bg-amber-100"}`}>
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div>
            <p className="font-semibold text-gray-900">
              {isDragging ? "Drop files here" : "Upload Mood Board"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Drag & drop images or PDF, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PNG, JPG, WebP, GIF, PDF • Max 10MB per file • Up to 10 images
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              Selected Files ({selectedFiles.length})
            </h4>
            <button
              onClick={clearAll}
              disabled={analyzing}
              className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="group relative aspect-square rounded-lg border border-gray-200 bg-white overflow-hidden"
              >
                {previewUrls[index] ? (
                  <img
                    src={previewUrls[index]}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // PDF placeholder
                  <div className="flex h-full w-full items-center justify-center bg-red-50">
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-1 text-xs text-red-600 font-medium">PDF</p>
                    </div>
                  </div>
                )}
                
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  disabled={analyzing}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                {/* File name tooltip */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="truncate text-xs text-white" title={file.name}>
                    {file.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Analyze Button */}
          {!analysisResult && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || selectedFiles.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing with GPT-4o Vision...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze Mood Board
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-green-100 p-1.5">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900">Visual Direction Extracted</h4>
            </div>
            <span className="text-xs text-gray-500">
              {analysisResult.image_count} image(s) • {analysisResult.tokens_used} tokens
            </span>
          </div>
          
          {/* Section Pills */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(analysisResult.sections).map((section) => (
              <span
                key={section}
                className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
              >
                {section}
              </span>
            ))}
          </div>
          
          {/* Editable Guidelines */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Review & Edit Guidelines
              <span className="ml-2 text-xs font-normal text-gray-500">
                (edit before applying)
              </span>
            </label>
            <textarea
              value={editedGuidelines}
              onChange={(e) => setEditedGuidelines(e.target.value)}
              className="h-64 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-mono transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Extracted visual direction will appear here..."
            />
            <p className="mt-1 text-xs text-gray-500">
              {editedGuidelines.length} characters
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleApplyGuidelines}
              disabled={!editedGuidelines.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Apply to Branding Guidelines
            </button>
            
            <button
              onClick={() => {
                setAnalysisResult(null);
                setEditedGuidelines("");
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
