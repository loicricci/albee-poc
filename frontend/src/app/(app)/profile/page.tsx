"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyProfile, saveMyProfile } from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

type Profile = {
  user_id?: string;
  handle?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

function normalizeHandle(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

function validateHandle(handle: string): string | null {
  if (!handle.trim()) return "Handle is required.";
  if (handle.length < 3) return "Handle must be at least 3 characters.";
  if (handle.length > 24) return "Handle must be 24 characters max.";
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(handle)) {
    return "Use only lowercase letters, numbers, - and _. Must start with a letter or number.";
  }
  return null;
}

function friendlyError(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("duplicate") || m.includes("already exists") || m.includes("unique")) {
    return "This handle is already taken. Pick another one.";
  }
  if (m.includes("invalid") && m.includes("token")) {
    return "Session expired. Please log in again.";
  }
  return msg || "Something went wrong.";
}

function ProfileContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    handle: "",
    display_name: "",
    bio: "",
    avatar_url: "",
  });

  const [initial, setInitial] = useState<Profile | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  const normalizedHandle = normalizeHandle(form.handle || "");
  const handleError = validateHandle(normalizedHandle);

  const isDirty = useMemo(() => {
    if (!initial) return true;
    const a = {
      handle: normalizeHandle(form.handle || ""),
      display_name: (form.display_name || "").trim(),
      bio: (form.bio || "").trim(),
      avatar_url: (form.avatar_url || "").trim(),
    };
    const b = {
      handle: normalizeHandle(initial.handle || ""),
      display_name: (initial.display_name || "").trim(),
      bio: (initial.bio || "").trim(),
      avatar_url: (initial.avatar_url || "").trim(),
    };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [form, initial]);

  useEffect(() => {
    let alive = true;

    // 🚀 PERFORMANCE: Load from cache immediately for instant UI
    const loadFromCache = () => {
      const cached = localStorage.getItem('user_profile') || localStorage.getItem('app_profile');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data?.handle) {
            const next: Profile = {
              user_id: data.user_id,
              handle: data.handle || "",
              display_name: data.display_name || "",
              bio: data.bio || "",
              avatar_url: data.avatar_url || "",
            };
            setForm(next);
            setInitial(next);
            setHasProfile(true);
            setLoading(false); // Show UI immediately
            return true;
          }
        } catch (e) {
          console.warn("Failed to parse cached profile");
        }
      }
      return false;
    };

    const cachedLoaded = loadFromCache();

    // Fetch fresh data in background
    (async () => {
      try {
        if (!cachedLoaded) {
          setLoading(true);
        }
        setError(null);
        setOk(null);
        setInfo(null);

        const data = await getMyProfile();
        if (!alive) return;

        if (data?.handle) {
          const next: Profile = {
            user_id: data.user_id,
            handle: data.handle || "",
            display_name: data.display_name || "",
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
          };
          setForm(next);
          setInitial(next);
          setHasProfile(true);
          setInfo(null);
          
          // Update cache
          localStorage.setItem('user_profile', JSON.stringify(data));
        } else {
          setHasProfile(false);
          const empty: Profile = {
            handle: "",
            display_name: "",
            bio: "",
            avatar_url: "",
          };
          setForm(empty);
          setInitial(empty);
          setInfo("No profile yet. Fill the form and click Save.");
        }
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("404")) {
          setHasProfile(false);
          const empty: Profile = {
            handle: "",
            display_name: "",
            bio: "",
            avatar_url: "",
          };
          setForm(empty);
          setInitial(empty);
          setInfo("No profile yet. Fill the form and click Save.");
          setError(null);
        } else {
          setError(friendlyError(msg || "Failed to load profile"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    setOk(null);
    setInfo(null);

    try {
      const cleanHandle = normalizeHandle(form.handle || "");
      const err = validateHandle(cleanHandle);
      if (err) throw new Error(err);

      const updatedProfile = {
        handle: cleanHandle,
        display_name: (form.display_name || "").trim(),
        bio: (form.bio || "").trim(),
        avatar_url: (form.avatar_url || "").trim(),
      };

      // 🚀 PERFORMANCE: Update cache immediately for instant feedback
      const cacheData = {
        ...form,
        ...updatedProfile,
      };
      localStorage.setItem('user_profile', JSON.stringify(cacheData));
      localStorage.setItem('app_profile', JSON.stringify(cacheData));

      await saveMyProfile(updatedProfile);

      const next: Profile = {
        ...form,
        ...updatedProfile,
      };

      setForm(next);
      setInitial(next);
      setHasProfile(true);
      setOk("Saved.");
    } catch (e: any) {
      setError(friendlyError(e?.message || "Save failed"));
      // Reload from server on error
      try {
        const data = await getMyProfile();
        if (data?.handle) {
          const serverProfile: Profile = {
            user_id: data.user_id,
            handle: data.handle || "",
            display_name: data.display_name || "",
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
          };
          setForm(serverProfile);
          setInitial(serverProfile);
          localStorage.setItem('user_profile', JSON.stringify(data));
        }
      } catch (reloadError) {
        console.error("Failed to reload profile after save error", reloadError);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFile(file: File) {
    setError(null);
    setOk(null);

    const folder = form.user_id || normalizedHandle || "me";

    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadImageToBucket({
        bucket: "avatars",
        folder,
        file,
      });

      setForm((f) => {
        const updated = { ...f, avatar_url: publicUrl };
        // 🚀 PERFORMANCE: Update cache immediately
        const cacheData = { ...updated };
        localStorage.setItem('user_profile', JSON.stringify(cacheData));
        return updated;
      });
      setOk("Avatar uploaded. Click Save to store it.");
    } catch (e: any) {
      setError(friendlyError(e?.message || "Avatar upload failed"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) return (
    <div className="mx-auto max-w-3xl">
      {/* Skeleton Header */}
      <div className="mb-8 animate-pulse">
        <div className="h-9 w-64 bg-gray-200 rounded-lg mb-3"></div>
        <div className="h-5 w-96 bg-gray-100 rounded"></div>
      </div>

      {/* Skeleton Form */}
      <div className="rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="space-y-6 p-6">
          {/* Avatar skeleton */}
          <div className="animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded mb-3"></div>
            <div className="flex items-start gap-6">
              <div className="h-24 w-24 rounded-xl bg-gray-200"></div>
              <div className="flex-1 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 h-32"></div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Username skeleton */}
          <div className="animate-pulse">
            <div className="h-5 w-24 bg-gray-200 rounded mb-2"></div>
            <div className="h-11 w-full bg-gray-100 rounded-lg"></div>
            <div className="h-4 w-64 bg-gray-100 rounded mt-2"></div>
          </div>

          {/* Display name skeleton */}
          <div className="animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded mb-2"></div>
            <div className="h-11 w-full bg-gray-100 rounded-lg"></div>
            <div className="h-4 w-48 bg-gray-100 rounded mt-2"></div>
          </div>

          {/* Bio skeleton */}
          <div className="animate-pulse">
            <div className="h-5 w-16 bg-gray-200 rounded mb-2"></div>
            <div className="h-24 w-full bg-gray-100 rounded-lg"></div>
            <div className="h-4 w-32 bg-gray-100 rounded mt-2"></div>
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="flex items-center justify-between border-t border-[#E6E6E6] bg-[#FAFAFA] px-6 py-4 rounded-b-2xl animate-pulse">
          <div className="h-4 w-40 bg-gray-200 rounded"></div>
          <div className="h-11 w-36 bg-gray-300 rounded-lg"></div>
        </div>
      </div>
    </div>
  );

  const saveDisabled = saving || uploadingAvatar || !!handleError || !isDirty;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B0B0C]">Profile Settings</h1>
        <p className="mt-2 text-[#2E3A59]/70">
          {hasProfile ? "Manage your public profile information" : "Create your profile to get started"}
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
      {ok && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-green-800">{ok}</div>
        </div>
      )}
      {info && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 animate-slide-up">
          <svg className="h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">{info}</div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="space-y-6 p-6">
          {/* Avatar */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-[#0B0B0C]">Profile Picture</label>
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-xl border-2 border-[#E6E6E6] bg-gradient-to-br from-[#FAFAFA] to-[#E6E6E6] flex items-center justify-center shadow-sm">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <svg className="h-12 w-12 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                    <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>

              <label
                className={[
                  "flex-1 cursor-pointer rounded-lg border-2 border-dashed p-6 transition-all",
                  dragging ? "border-[#2E3A59] bg-[#2E3A59]/5" : "border-[#E6E6E6] bg-[#FAFAFA] hover:border-[#2E3A59] hover:bg-[#2E3A59]/5",
                  uploadingAvatar ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleAvatarFile(file);
                }}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatarFile(file);
                  }}
                />
                <div className="text-center">
                  <svg className="mx-auto h-10 w-10 text-[#2E3A59]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className="mt-2 text-sm font-medium text-[#0B0B0C]">
                    {uploadingAvatar ? "Uploading..." : "Drop image here, or click to upload"}
                  </div>
                  <div className="mt-1 text-xs text-[#2E3A59]/70">PNG, JPG, WEBP up to 5MB</div>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Handle */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
              value={form.handle || ""}
              onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
              onBlur={() => setForm((f) => ({ ...f, handle: normalizeHandle(f.handle || "") }))}
              placeholder="johndoe"
              disabled={uploadingAvatar}
            />
            <div className="mt-2 flex items-start gap-2 text-xs">
              {handleError ? (
                <>
                  <svg className="h-4 w-4 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-600">{handleError}</span>
                </>
              ) : form.handle ? (
                <>
                  <svg className="h-4 w-4 shrink-0 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[#2E3A59]/70">
                    Your profile will be accessible at <span className="font-medium text-[#0B0B0C]">@{normalizedHandle}</span>
                  </span>
                </>
              ) : (
                <span className="text-[#2E3A59]/70">Lowercase letters, numbers, dashes and underscores only</span>
              )}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Display Name</label>
            <input
              className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
              value={form.display_name || ""}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="John Doe"
              disabled={uploadingAvatar}
            />
            <div className="mt-2 text-xs text-[#2E3A59]/70">Your full name or display name</div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Bio</label>
            <textarea
              className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
              rows={4}
              value={form.bio || ""}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell us about yourself..."
              disabled={uploadingAvatar}
            />
            <div className="mt-2 text-xs text-[#2E3A59]/70">
              {form.bio?.length || 0} / 500 characters
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E6E6E6] bg-[#FAFAFA] px-6 py-4 rounded-b-2xl">
          <div className="text-xs text-[#2E3A59]/70">
            {!isDirty ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No changes to save
              </span>
            ) : (
              <span className="flex items-center gap-2 text-[#C8A24A]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                You have unsaved changes
              </span>
            )}
          </div>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
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
                {hasProfile ? "Save changes" : "Create profile"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <NewLayoutWrapper>
      <ProfileContent />
    </NewLayoutWrapper>
  );
}

