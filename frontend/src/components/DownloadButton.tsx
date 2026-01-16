"use client";

import { useState } from "react";

type DownloadButtonProps = {
  imageUrl: string;
  filename?: string;
  variant?: "icon" | "button";
  className?: string;
};

/**
 * Extract filename from URL or generate a default one
 */
function getFilename(url: string, customFilename?: string): string {
  if (customFilename) return customFilename;
  
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    
    // If the URL has a valid filename with extension, use it
    if (lastPart && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(lastPart)) {
      return lastPart;
    }
  } catch {
    // Invalid URL, use default
  }
  
  // Default filename with timestamp
  return `gabee-image-${Date.now()}.jpg`;
}

/**
 * Download an image using fetch + blob approach
 * This handles cross-origin images (like from Supabase storage)
 */
async function downloadImage(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up blob URL after a short delay
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}

export function DownloadButton({
  imageUrl,
  filename,
  variant = "button",
  className = "",
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setError(null);
    setDownloadSuccess(false);

    try {
      const finalFilename = getFilename(imageUrl, filename);
      await downloadImage(imageUrl, finalFilename);
      setDownloadSuccess(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Download failed");
      
      // Reset error state after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  // Icon variants
  const DownloadIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );

  const SpinnerIcon = () => (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const CheckIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const ErrorIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  // Determine which icon to show
  const renderIcon = () => {
    if (isDownloading) return <SpinnerIcon />;
    if (downloadSuccess) return <CheckIcon />;
    if (error) return <ErrorIcon />;
    return <DownloadIcon />;
  };

  // Determine button text
  const getButtonText = () => {
    if (isDownloading) return "Downloading...";
    if (downloadSuccess) return "Downloaded!";
    if (error) return "Failed";
    return "Download";
  };

  // Determine button color based on state
  const getButtonColorClasses = () => {
    if (downloadSuccess) return "text-green-600";
    if (error) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-all ${
        variant === "icon"
          ? "p-2 hover:bg-gray-100 hover:text-[#001f98]"
          : "px-4 py-2 hover:bg-[#e6eaff] hover:text-[#001f98]"
      } ${getButtonColorClasses()} ${
        isDownloading ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      title={error || (downloadSuccess ? "Downloaded!" : "Download image")}
    >
      {renderIcon()}
      {variant === "button" && <span>{getButtonText()}</span>}
    </button>
  );
}

/**
 * Inline download button for use in share sections
 * Styled as a circular button similar to ShareButtonsInline
 */
export function DownloadButtonInline({
  imageUrl,
  filename,
  className = "",
}: Omit<DownloadButtonProps, "variant">) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const finalFilename = getFilename(imageUrl, filename);
      await downloadImage(imageUrl, finalFilename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
        downloadSuccess
          ? "bg-green-500 text-white"
          : "bg-[#001f98] text-white hover:bg-[#001670]"
      } ${isDownloading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      title={downloadSuccess ? "Downloaded!" : "Download image"}
    >
      {isDownloading ? (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : downloadSuccess ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      )}
    </button>
  );
}
