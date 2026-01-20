"use client";

import { useState } from "react";
import { PreviewPostResponse } from "@/lib/api";

type PostPreviewModalProps = {
  preview: PreviewPostResponse;
  isOpen: boolean;
  isLoading?: boolean;
  onApprove: (title?: string, description?: string) => void;
  onRegenerate: (feedback: string) => void;
  onCancel: () => void;
};

export function PostPreviewModal({
  preview,
  isOpen,
  isLoading = false,
  onApprove,
  onRegenerate,
  onCancel,
}: PostPreviewModalProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editedTitle, setEditedTitle] = useState(preview.title);
  const [editedDescription, setEditedDescription] = useState(preview.description);
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const handleApprove = () => {
    // Pass edited values if changed, otherwise undefined
    const titleToSend = editedTitle !== preview.title ? editedTitle : undefined;
    const descToSend = editedDescription !== preview.description ? editedDescription : undefined;
    onApprove(titleToSend, descToSend);
  };

  const handleRegenerate = () => {
    if (feedback.trim()) {
      onRegenerate(feedback.trim());
      setFeedback("");
      setShowFeedback(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <svg className="h-10 w-10 animate-spin text-[#001f98]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Processing...</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-[#001f98]/5 to-[#f8fafc] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#001f98] text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preview Generated Post</h2>
              <p className="text-sm text-gray-600">Review before publishing</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Agent Info */}
          <div className="mb-4 flex items-center gap-3">
            <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-gray-200 ${preview.avatar_url ? 'bg-white' : 'bg-gradient-to-br from-[#001f98] to-[#001670]'}`}>
              {preview.avatar_url ? (
                <img 
                  src={preview.avatar_url} 
                  alt={preview.display_name || preview.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white font-bold">
                  {(preview.display_name || preview.handle)[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{preview.display_name || preview.handle}</div>
              <div className="text-sm text-gray-500">@{preview.handle}</div>
            </div>
            <div className="ml-auto text-xs text-gray-400">
              {formatDate(preview.generated_at)}
            </div>
          </div>

          {/* Generated Image or Video */}
          <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-black">
            {preview.video_url ? (
              <video
                src={preview.video_url}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full object-contain max-h-[400px]"
                poster={preview.thumbnail_url || undefined}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={preview.image_url}
                alt="Generated post image"
                className="w-full object-contain max-h-[400px]"
              />
            )}
          </div>

          {/* Title and Description */}
          <div className="mb-4 space-y-3">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#001f98] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#001f98] focus:border-transparent resize-none"
                  />
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-sm text-[#001f98] hover:underline"
                >
                  Done editing
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{editedTitle}</h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-[#001f98] hover:underline shrink-0 ml-2"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{editedDescription}</p>
              </>
            )}
          </div>

          {/* Topic Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Topic:</span>
              <span className="text-gray-600">{preview.topic.topic}</span>
              {preview.topic.category && (
                <span className="ml-auto px-2 py-0.5 bg-[#001f98]/10 text-[#001f98] text-xs rounded-full">
                  {preview.topic.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs mt-1 text-gray-500">
              <span>Engine: {preview.image_engine}</span>
              {preview.topic.source && (
                <span className="ml-2">Source: {preview.topic.source}</span>
              )}
            </div>
          </div>

          {/* Feedback Section */}
          {showFeedback && (
            <div className="mb-4 p-4 border-2 border-amber-200 bg-amber-50 rounded-lg animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span className="font-medium text-amber-800">Provide Feedback for Regeneration</span>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                Describe what you&apos;d like changed. Your feedback will guide the AI in creating a new version.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., 'Make the image brighter and more colorful' or 'Focus more on technology themes' or 'Use a more formal tone'"
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRegenerate}
                  disabled={!feedback.trim() || isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate with Feedback
                </button>
                <button
                  onClick={() => {
                    setShowFeedback(false);
                    setFeedback("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {!showFeedback && (
              <button
                onClick={() => setShowFeedback(true)}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-400 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
            )}
            <button
              onClick={handleApprove}
              disabled={isLoading || showFeedback}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#001f98] text-white rounded-lg font-semibold hover:bg-[#001670] transition-colors shadow-md disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve &amp; Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
