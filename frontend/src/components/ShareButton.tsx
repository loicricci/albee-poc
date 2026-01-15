"use client";

import { useState, useRef, useEffect } from "react";

type ShareButtonProps = {
  url: string;
  title: string;
  description?: string;
  variant?: "icon" | "button";
  className?: string;
};

type SharePlatform = "whatsapp" | "linkedin" | "facebook" | "twitter" | "copy" | "native";

const PLATFORMS = [
  {
    id: "native" as SharePlatform,
    name: "Share",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    color: "bg-gray-600 hover:bg-gray-700",
    mobileOnly: true,
  },
  {
    id: "whatsapp" as SharePlatform,
    name: "WhatsApp",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    color: "bg-[#25D366] hover:bg-[#20BD5A]",
    getUrl: (url: string, text: string) => 
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  },
  {
    id: "linkedin" as SharePlatform,
    name: "LinkedIn",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    color: "bg-[#0A66C2] hover:bg-[#004182]",
    getUrl: (url: string) => 
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook" as SharePlatform,
    name: "Facebook",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: "bg-[#1877F2] hover:bg-[#0D65D9]",
    getUrl: (url: string) => 
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "twitter" as SharePlatform,
    name: "X",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: "bg-black hover:bg-gray-800",
    getUrl: (url: string, text: string) => 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "copy" as SharePlatform,
    name: "Copy Link",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: "bg-gray-500 hover:bg-gray-600",
  },
];

export function ShareButton({ 
  url, 
  title, 
  description, 
  variant = "icon",
  className = "" 
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if native share is available (typically on mobile)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const shareText = description ? `${title} - ${description}` : title;

  const handleShare = async (platform: SharePlatform) => {
    switch (platform) {
      case "native":
        try {
          await navigator.share({
            title,
            text: description || title,
            url,
          });
        } catch (err) {
          // User cancelled or error occurred
          console.log("Native share cancelled or failed");
        }
        break;

      case "copy":
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
        }
        break;

      case "whatsapp":
      case "linkedin":
      case "facebook":
      case "twitter":
        const platformConfig = PLATFORMS.find(p => p.id === platform);
        if (platformConfig && platformConfig.getUrl) {
          const shareUrl = platformConfig.getUrl(url, shareText);
          window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=400");
        }
        break;
    }
    setIsOpen(false);
  };

  // Filter platforms based on native share availability
  const visiblePlatforms = PLATFORMS.filter(p => {
    if (p.id === "native") return canNativeShare;
    return true;
  });

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-all ${
          variant === "icon"
            ? "p-2 text-gray-600 hover:bg-gray-100 hover:text-[#001f98]"
            : "px-4 py-2 text-gray-600 hover:bg-[#e6eaff] hover:text-[#001f98]"
        }`}
        title="Share"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {variant === "button" && <span>Share</span>}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[200px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Share to</p>
          </div>
          
          {visiblePlatforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handleShare(platform.id)}
              className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-white ${platform.color}`}>
                {platform.id === "copy" && copied ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  platform.icon
                )}
              </span>
              <span className="font-medium">
                {platform.id === "copy" && copied ? "Copied!" : platform.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline share buttons for horizontal layout
export function ShareButtonsInline({ 
  url, 
  title, 
  description,
  className = "" 
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareText = description ? `${title} - ${description}` : title;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShare = (platform: "whatsapp" | "linkedin" | "facebook" | "twitter") => {
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    };
    window.open(urls[platform], "_blank", "noopener,noreferrer,width=600,height=400");
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* WhatsApp */}
      <button
        onClick={() => handleShare("whatsapp")}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#25D366] text-white hover:bg-[#20BD5A] transition-colors"
        title="Share on WhatsApp"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => handleShare("linkedin")}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0A66C2] text-white hover:bg-[#004182] transition-colors"
        title="Share on LinkedIn"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </button>

      {/* Facebook */}
      <button
        onClick={() => handleShare("facebook")}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1877F2] text-white hover:bg-[#0D65D9] transition-colors"
        title="Share on Facebook"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </button>

      {/* X/Twitter */}
      <button
        onClick={() => handleShare("twitter")}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
        title="Share on X"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </button>

      {/* Copy Link */}
      <button
        onClick={handleCopy}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
          copied 
            ? "bg-green-500 text-white" 
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        title={copied ? "Copied!" : "Copy link"}
      >
        {copied ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
      </button>
    </div>
  );
}
