"use client";

import { useEffect, useState } from "react";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { getAppConfig, updateConfigValue, type AppConfig } from "@/lib/config";
import { uploadImageToBucket } from "@/lib/upload";
import { supabase } from "@/lib/supabaseClient";

export default function AppSettingsPage() {
  return (
    <NewLayoutWrapper>
      <AppSettingsContent />
    </NewLayoutWrapper>
  );
}

function AppSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [config, setConfig] = useState<AppConfig>({});
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const data = await getAppConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(file: File, configKey: string) {
    setError(null);
    setSuccess(null);
    setUploading(configKey);

    try {
      // Upload to app-images bucket
      const { publicUrl } = await uploadImageToBucket({
        bucket: "app-images",
        folder: "app-" + configKey.replace("app_", "").replace("_url", ""),
        file,
      });

      // Get auth token
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Update config in database
      await updateConfigValue(configKey, publicUrl, data.session.access_token);

      // Update local state
      setConfig((prev) => ({ ...prev, [configKey]: publicUrl }));
      setSuccess(`${configKey.replace("app_", "").replace("_url", "")} uploaded successfully!`);
    } catch (e: any) {
      if (e.message?.includes("403") || e.message?.toLowerCase().includes("access denied")) {
        setAccessDenied(true);
      } else {
        setError(e.message || "Upload failed");
      }
    } finally {
      setUploading(null);
    }
  }

  async function handleTextUpdate(configKey: string, value: string) {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        throw new Error("Not authenticated");
      }

      await updateConfigValue(configKey, value, data.session.access_token);
      setConfig((prev) => ({ ...prev, [configKey]: value }));
      setSuccess(`${configKey} updated successfully!`);
    } catch (e: any) {
      if (e.message?.includes("403") || e.message?.toLowerCase().includes("access denied")) {
        setAccessDenied(true);
      } else {
        setError(e.message || "Update failed");
      }
    } finally {
      setSaving(false);
    }
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <div className="mb-4 flex justify-center">
            <svg
              className="h-16 w-16 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-red-900">Access Denied</h2>
          <p className="mb-4 text-red-700">
            You do not have permission to modify app settings. This area is restricted to authorized administrators only.
          </p>
          <a
            href="/"
            className="inline-block rounded-lg bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Loading app settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">App Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your platform branding and appearance
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <div className="space-y-6">
        {/* App Name */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">App Name</h2>
          <input
            type="text"
            value={config.app_name || ""}
            onChange={(e) => setConfig((prev) => ({ ...prev, app_name: e.target.value }))}
            onBlur={(e) => handleTextUpdate("app_name", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Enter app name (e.g., Gabee)"
            disabled={saving}
          />
          <p className="mt-2 text-xs text-gray-500">
            The name of your platform (shown in navigation if no logo is uploaded)
          </p>
        </div>

        {/* Logo Upload */}
        <ImageUploadSection
          title="App Logo"
          description="Main logo displayed in the navigation bar. Recommended: PNG with transparent background, 200x50px or similar aspect ratio."
          configKey="app_logo_url"
          currentUrl={config.app_logo_url}
          uploading={uploading === "app_logo_url"}
          dragging={dragging === "app_logo_url"}
          onDragStateChange={(isDragging) => setDragging(isDragging ? "app_logo_url" : null)}
          onFileSelect={(file) => handleImageUpload(file, "app_logo_url")}
        />

        {/* Cover Image Upload */}
        <ImageUploadSection
          title="Cover Image"
          description="Hero/cover image for landing pages. Recommended: 1920x600px or similar wide format."
          configKey="app_cover_url"
          currentUrl={config.app_cover_url}
          uploading={uploading === "app_cover_url"}
          dragging={dragging === "app_cover_url"}
          onDragStateChange={(isDragging) => setDragging(isDragging ? "app_cover_url" : null)}
          onFileSelect={(file) => handleImageUpload(file, "app_cover_url")}
        />

        {/* Favicon Upload */}
        <ImageUploadSection
          title="Favicon"
          description="Small icon shown in browser tabs. Recommended: Square PNG or ICO, 32x32px or 64x64px."
          configKey="app_favicon_url"
          currentUrl={config.app_favicon_url}
          uploading={uploading === "app_favicon_url"}
          dragging={dragging === "app_favicon_url"}
          onDragStateChange={(isDragging) => setDragging(isDragging ? "app_favicon_url" : null)}
          onFileSelect={(file) => handleImageUpload(file, "app_favicon_url")}
          compact
        />
      </div>
    </div>
  );
}

type ImageUploadSectionProps = {
  title: string;
  description: string;
  configKey: string;
  currentUrl?: string;
  uploading: boolean;
  dragging: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onFileSelect: (file: File) => void;
  compact?: boolean;
};

function ImageUploadSection({
  title,
  description,
  currentUrl,
  uploading,
  dragging,
  onDragStateChange,
  onFileSelect,
  compact = false,
}: ImageUploadSectionProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>

      <div className="flex items-start gap-6">
        {/* Preview */}
        <div className="relative">
          <div
            className={[
              "overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm",
              compact ? "h-16 w-16" : "h-32 w-48",
            ].join(" ")}
          >
            {currentUrl ? (
              <img src={currentUrl} alt={title} className="h-full w-full object-contain p-2" />
            ) : (
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
              <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <label
          className={[
            "flex-1 cursor-pointer rounded-lg border-2 border-dashed p-6 transition-all",
            dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50",
            uploading ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStateChange(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStateChange(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStateChange(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStateChange(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFileSelect(file);
          }}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
          />
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {uploading ? "Uploading..." : "Drop image here, or click to upload"}
            </div>
            <div className="mt-1 text-xs text-gray-500">{description}</div>
          </div>
        </label>
      </div>
    </div>
  );
}

