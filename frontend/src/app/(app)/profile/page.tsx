"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyProfile, saveMyProfile, deleteMyAccount, getTwitterConfig, initiateTwitterOAuth, disconnectTwitter } from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type Profile = {
  user_id?: string;
  handle?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  
  // Personal Information
  birthdate?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  
  // Contact Information
  phone?: string;
  email?: string;
  website?: string;
  
  // Professional Information
  occupation?: string;
  company?: string;
  industry?: string;
  education?: string;
  
  // Social Media Links
  twitter_handle?: string;
  linkedin_url?: string;
  github_username?: string;
  instagram_handle?: string;
  
  // Additional Information
  languages?: string;
  interests?: string;
  
  // Agent fields (for non-admin users)
  is_admin?: boolean;
  agent_id?: string;
  persona?: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draggingBanner, setDraggingBanner] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Twitter OAuth state
  const [twitterConfig, setTwitterConfig] = useState<{ connected: boolean; twitter_username?: string } | null>(null);
  const [connectingTwitter, setConnectingTwitter] = useState(false);

  const [form, setForm] = useState<Profile>({
    handle: "",
    display_name: "",
    bio: "",
    avatar_url: "",
    banner_url: "",
    location: "",
    latitude: "",
    longitude: "",
    timezone: "",
    birthdate: "",
    gender: "",
    marital_status: "",
    nationality: "",
    phone: "",
    email: "",
    website: "",
    occupation: "",
    company: "",
    industry: "",
    education: "",
    twitter_handle: "",
    linkedin_url: "",
    github_username: "",
    instagram_handle: "",
    languages: "",
    interests: "",
    is_admin: false,
    agent_id: undefined,
    persona: "",
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
      banner_url: (form.banner_url || "").trim(),
      location: (form.location || "").trim(),
      latitude: (form.latitude || "").trim(),
      longitude: (form.longitude || "").trim(),
      timezone: (form.timezone || "").trim(),
      birthdate: (form.birthdate || "").trim(),
      gender: (form.gender || "").trim(),
      marital_status: (form.marital_status || "").trim(),
      nationality: (form.nationality || "").trim(),
      phone: (form.phone || "").trim(),
      email: (form.email || "").trim(),
      website: (form.website || "").trim(),
      occupation: (form.occupation || "").trim(),
      company: (form.company || "").trim(),
      industry: (form.industry || "").trim(),
      education: (form.education || "").trim(),
      twitter_handle: (form.twitter_handle || "").trim(),
      linkedin_url: (form.linkedin_url || "").trim(),
      github_username: (form.github_username || "").trim(),
      instagram_handle: (form.instagram_handle || "").trim(),
      languages: (form.languages || "").trim(),
      interests: (form.interests || "").trim(),
    };
    const b = {
      handle: normalizeHandle(initial.handle || ""),
      display_name: (initial.display_name || "").trim(),
      bio: (initial.bio || "").trim(),
      avatar_url: (initial.avatar_url || "").trim(),
      banner_url: (initial.banner_url || "").trim(),
      location: (initial.location || "").trim(),
      latitude: (initial.latitude || "").trim(),
      longitude: (initial.longitude || "").trim(),
      timezone: (initial.timezone || "").trim(),
      birthdate: (initial.birthdate || "").trim(),
      gender: (initial.gender || "").trim(),
      marital_status: (initial.marital_status || "").trim(),
      nationality: (initial.nationality || "").trim(),
      phone: (initial.phone || "").trim(),
      email: (initial.email || "").trim(),
      website: (initial.website || "").trim(),
      occupation: (initial.occupation || "").trim(),
      company: (initial.company || "").trim(),
      industry: (initial.industry || "").trim(),
      education: (initial.education || "").trim(),
      twitter_handle: (initial.twitter_handle || "").trim(),
      linkedin_url: (initial.linkedin_url || "").trim(),
      github_username: (initial.github_username || "").trim(),
      instagram_handle: (initial.instagram_handle || "").trim(),
      languages: (initial.languages || "").trim(),
      interests: (initial.interests || "").trim(),
    };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [form, initial]);

  useEffect(() => {
    let alive = true;

    // Load Twitter config
    const loadTwitterConfig = async () => {
      try {
        const config = await getTwitterConfig();
        if (alive) {
          setTwitterConfig(config);
        }
      } catch (err) {
        // Not connected or error - that's ok
        if (alive) {
          setTwitterConfig({ connected: false });
        }
      }
    };

    loadTwitterConfig();

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
              banner_url: data.banner_url || "",
              location: data.location || "",
              latitude: data.latitude || "",
              longitude: data.longitude || "",
              timezone: data.timezone || "",
              birthdate: data.birthdate || "",
              gender: data.gender || "",
              marital_status: data.marital_status || "",
              nationality: data.nationality || "",
              phone: data.phone || "",
              email: data.email || "",
              website: data.website || "",
              occupation: data.occupation || "",
              company: data.company || "",
              industry: data.industry || "",
              education: data.education || "",
              twitter_handle: data.twitter_handle || "",
              linkedin_url: data.linkedin_url || "",
              github_username: data.github_username || "",
              instagram_handle: data.instagram_handle || "",
              languages: data.languages || "",
              interests: data.interests || "",
              is_admin: data.is_admin || false,
              agent_id: data.agent_id,
              persona: data.persona || "",
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
            banner_url: data.banner_url || "",
            location: data.location || "",
            latitude: data.latitude || "",
            longitude: data.longitude || "",
            timezone: data.timezone || "",
            birthdate: data.birthdate || "",
            gender: data.gender || "",
            marital_status: data.marital_status || "",
            nationality: data.nationality || "",
            phone: data.phone || "",
            email: data.email || "",
            website: data.website || "",
            occupation: data.occupation || "",
            company: data.company || "",
            industry: data.industry || "",
            education: data.education || "",
            twitter_handle: data.twitter_handle || "",
            linkedin_url: data.linkedin_url || "",
            github_username: data.github_username || "",
            instagram_handle: data.instagram_handle || "",
            languages: data.languages || "",
            interests: data.interests || "",
            is_admin: data.is_admin || false,
            agent_id: data.agent_id,
            persona: data.persona || "",
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
            banner_url: "",
            location: "",
            latitude: "",
            longitude: "",
            timezone: "",
            birthdate: "",
            gender: "",
            marital_status: "",
            nationality: "",
            phone: "",
            email: "",
            website: "",
            occupation: "",
            company: "",
            industry: "",
            education: "",
            twitter_handle: "",
            linkedin_url: "",
            github_username: "",
            instagram_handle: "",
            languages: "",
            interests: "",
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
            banner_url: "",
            location: "",
            latitude: "",
            longitude: "",
            timezone: "",
            birthdate: "",
            gender: "",
            marital_status: "",
            nationality: "",
            phone: "",
            email: "",
            website: "",
            occupation: "",
            company: "",
            industry: "",
            education: "",
            twitter_handle: "",
            linkedin_url: "",
            github_username: "",
            instagram_handle: "",
            languages: "",
            interests: "",
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

  // Check for Twitter OAuth callback status in URL
  useEffect(() => {
    const twitterStatus = searchParams.get('twitter');
    const username = searchParams.get('username');
    const reason = searchParams.get('reason');
    
    if (twitterStatus === 'connected' && username) {
      setOk(`Successfully connected to Twitter as @${username}!`);
      // Reload Twitter config
      getTwitterConfig().then(config => {
        if (config) {
          setTwitterConfig(config);
        }
      }).catch(console.error);
      // Clean up URL
      router.replace('/profile');
    } else if (twitterStatus === 'error') {
      setError(`Failed to connect Twitter: ${reason || 'Unknown error'}`);
      // Clean up URL
      router.replace('/profile');
    }
  }, [searchParams, router]);

  // Twitter OAuth handlers
  async function handleConnectTwitter() {
    setConnectingTwitter(true);
    setError(null);
    
    try {
      const result = await initiateTwitterOAuth();
      // Store the state in session storage for verification (optional)
      if (result.state) {
        sessionStorage.setItem('twitter_oauth_state', result.state);
      }
      // Redirect to Twitter authorization
      window.location.href = result.auth_url;
    } catch (err: any) {
      setError("Failed to connect Twitter: " + (err.message || "Unknown error"));
      setConnectingTwitter(false);
    }
  }

  async function handleDisconnectTwitter() {
    if (!confirm("Disconnect Twitter? Your agents will no longer be able to post to Twitter.")) {
      return;
    }

    try {
      await disconnectTwitter();
      setTwitterConfig({ connected: false });
      setOk("Twitter disconnected successfully");
    } catch (err: any) {
      setError("Failed to disconnect Twitter: " + (err.message || "Unknown error"));
    }
  }

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
        banner_url: (form.banner_url || "").trim(),
        location: (form.location || "").trim(),
        latitude: (form.latitude || "").trim(),
        longitude: (form.longitude || "").trim(),
        timezone: (form.timezone || "").trim(),
        birthdate: (form.birthdate || "").trim(),
        gender: (form.gender || "").trim(),
        marital_status: (form.marital_status || "").trim(),
        nationality: (form.nationality || "").trim(),
        phone: (form.phone || "").trim(),
        email: (form.email || "").trim(),
        website: (form.website || "").trim(),
        occupation: (form.occupation || "").trim(),
        company: (form.company || "").trim(),
        industry: (form.industry || "").trim(),
        education: (form.education || "").trim(),
        twitter_handle: (form.twitter_handle || "").trim(),
        linkedin_url: (form.linkedin_url || "").trim(),
        github_username: (form.github_username || "").trim(),
        instagram_handle: (form.instagram_handle || "").trim(),
        languages: (form.languages || "").trim(),
        interests: (form.interests || "").trim(),
        persona: (form.persona || "").trim(), // Include persona for non-admin users
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
            banner_url: data.banner_url || "",
            location: data.location || "",
            latitude: data.latitude || "",
            longitude: data.longitude || "",
            timezone: data.timezone || "",
            birthdate: data.birthdate || "",
            gender: data.gender || "",
            marital_status: data.marital_status || "",
            nationality: data.nationality || "",
            phone: data.phone || "",
            email: data.email || "",
            website: data.website || "",
            occupation: data.occupation || "",
            company: data.company || "",
            industry: data.industry || "",
            education: data.education || "",
            twitter_handle: data.twitter_handle || "",
            linkedin_url: data.linkedin_url || "",
            github_username: data.github_username || "",
            instagram_handle: data.instagram_handle || "",
            languages: data.languages || "",
            interests: data.interests || "",
            is_admin: data.is_admin || false,
            agent_id: data.agent_id,
            persona: data.persona || "",
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

  async function handleBannerFile(file: File) {
    setError(null);
    setOk(null);

    const folder = form.user_id || normalizedHandle || "me";

    setUploadingBanner(true);
    try {
      const { publicUrl } = await uploadImageToBucket({
        bucket: "banners",
        folder,
        file,
      });

      setForm((f) => {
        const updated = { ...f, banner_url: publicUrl };
        // 🚀 PERFORMANCE: Update cache immediately
        const cacheData = { ...updated };
        localStorage.setItem('user_profile', JSON.stringify(cacheData));
        return updated;
      });
      setOk("Banner uploaded. Click Save to store it.");
    } catch (e: any) {
      setError(friendlyError(e?.message || "Banner upload failed"));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function importFromAgent() {
    if (!form.agent_id) {
      setInfo("No agent found. Only non-admin users with agents can import profile data.");
      return;
    }

    // The profile data already has agent info loaded in form.display_name, form.bio, form.avatar_url
    // We just need to confirm if user wants to use agent data
    const confirmImport = window.confirm(
      "This will copy your agent's display name, bio, avatar, and persona to your profile. Continue?"
    );
    
    if (!confirmImport) return;

    setError(null);
    setInfo(null);
    setOk("Imported data from your agent. Click Save to keep these changes.");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    setOk(null);
    
    try {
      await deleteMyAccount();
      
      // Clear local storage
      localStorage.removeItem('user_profile');
      localStorage.removeItem('app_profile');
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Redirect to home page
      router.push('/');
    } catch (e: any) {
      setError(friendlyError(e?.message || "Failed to delete account"));
      setDeleting(false);
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

  const saveDisabled = saving || uploadingAvatar || uploadingBanner || !!handleError || !isDirty;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B0B0C]">
          {form.is_admin ? "Profile Settings" : "My Profile & Agent"}
        </h1>
        <p className="mt-2 text-[#2E3A59]/70">
          {!form.is_admin
            ? hasProfile 
              ? "Manage your profile and AI agent settings"
              : "Create your profile and set up your AI agent"
            : hasProfile
              ? "Manage your public profile information"
              : "Create your profile to get started"
          }
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
        {/* Banner Upload Section */}
        <div className="relative h-48 bg-gradient-to-r from-[#2E3A59] to-[#1a2236] rounded-t-2xl overflow-hidden">
          {form.banner_url ? (
            <img src={form.banner_url} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/30 text-sm">
              No banner image
            </div>
          )}
          
          {/* Banner Upload Overlay */}
          <label
            className={[
              "absolute inset-0 flex items-center justify-center cursor-pointer transition-all",
              draggingBanner ? "bg-black/70" : "bg-black/0 hover:bg-black/50",
              uploadingBanner ? "cursor-not-allowed" : "",
            ].join(" ")}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBanner(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBanner(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBanner(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBanner(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleBannerFile(file);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploadingBanner}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBannerFile(file);
              }}
            />
            {(draggingBanner || uploadingBanner) && (
              <div className="text-center text-white">
                {uploadingBanner ? (
                  <>
                    <svg className="h-12 w-12 animate-spin mx-auto mb-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-lg font-semibold">Uploading banner...</p>
                  </>
                ) : (
                  <>
                    <svg className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg font-semibold">Drop banner image here or click to upload</p>
                    <p className="text-sm mt-1 opacity-80">Recommended: 1500x500px, PNG/JPG/WEBP up to 5MB</p>
                  </>
                )}
              </div>
            )}
          </label>
        </div>

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

          {/* Import from Agent - Only for non-admin users with an agent */}
          {!form.is_admin && form.agent_id && (
            <div className="rounded-lg border-2 border-dashed border-[#2E3A59]/30 bg-[#2E3A59]/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#0B0B0C] mb-1 flex items-center gap-2">
                    🤖 Quick Import from Agent
                  </h3>
                  <p className="text-xs text-[#2E3A59]/70">
                    Copy your agent&apos;s display name, bio, avatar, and persona to your profile
                  </p>
                </div>
                <button
                  onClick={importFromAgent}
                  disabled={uploadingAvatar || uploadingBanner}
                  className="shrink-0 flex items-center gap-2 rounded-lg bg-[#2E3A59] px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1a2236] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import Now
                </button>
              </div>
            </div>
          )}

          {/* Persona Section - Only for non-admin users */}
          {!form.is_admin && (
            <>
              <div className="border-t border-[#E6E6E6]"></div>
              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                    🎭 AI Persona
                  </h2>
                  <p className="text-xs text-[#2E3A59]/70 mt-1">
                    Define your AI agent&apos;s personality, tone, and behavior
                  </p>
                </div>
                <textarea
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 font-mono text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  rows={8}
                  value={form.persona || ""}
                  onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value }))}
                  placeholder="Example: You are a friendly and helpful assistant. You respond in a casual, conversational tone..."
                  disabled={uploadingAvatar}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-[#2E3A59]/70">
                  <span>{form.persona?.length || 0} / 40,000 characters</span>
                  <span>This defines how your AI agent behaves in conversations</span>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Personal Information Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                👤 Personal Information
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">Basic personal details</p>
            </div>
            
            <div className="space-y-4">
              {/* Birthdate */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Date of Birth</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.birthdate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))}
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Gender</label>
                <select
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.gender || ""}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  disabled={uploadingAvatar}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              {/* Marital Status */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Marital Status</label>
                <select
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.marital_status || ""}
                  onChange={(e) => setForm((f) => ({ ...f, marital_status: e.target.value }))}
                  disabled={uploadingAvatar}
                >
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="In a relationship">In a relationship</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              {/* Nationality */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Nationality</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.nationality || ""}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                  placeholder="e.g., American, French, etc."
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Languages */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Languages</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.languages || ""}
                  onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
                  placeholder="e.g., English, French, Spanish"
                  disabled={uploadingAvatar}
                />
                <div className="mt-1 text-xs text-[#2E3A59]/70">Comma-separated list</div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Contact Information Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                📞 Contact Information
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">How people can reach you</p>
            </div>
            
            <div className="space-y-4">
              {/* Phone */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Phone Number</label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.phone || ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.email || ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Website */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Website</label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.website || ""}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://yourwebsite.com"
                  disabled={uploadingAvatar}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Professional Information Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                💼 Professional Information
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">Your work and education</p>
            </div>
            
            <div className="space-y-4">
              {/* Occupation */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Occupation</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.occupation || ""}
                  onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                  placeholder="e.g., Software Engineer, Designer"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Company */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Company</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.company || ""}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g., ABC Corp"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Industry */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Industry</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.industry || ""}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="e.g., Technology, Healthcare"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Education */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Education</label>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.education || ""}
                  onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                  placeholder="e.g., BS Computer Science, MIT"
                  disabled={uploadingAvatar}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Social Media Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                🔗 Social Media
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">Connect your social profiles</p>
            </div>
            
            <div className="space-y-4">
              {/* Twitter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Twitter / X</label>
                <div className="flex items-center gap-2">
                  <span className="text-[#2E3A59]/70">@</span>
                  <input
                    className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={form.twitter_handle || ""}
                    onChange={(e) => setForm((f) => ({ ...f, twitter_handle: e.target.value }))}
                    placeholder="username"
                    disabled={uploadingAvatar}
                  />
                </div>
              </div>

              {/* LinkedIn */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">LinkedIn</label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.linkedin_url || ""}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/username"
                  disabled={uploadingAvatar}
                />
              </div>

              {/* GitHub */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">GitHub</label>
                <div className="flex items-center gap-2">
                  <span className="text-[#2E3A59]/70">@</span>
                  <input
                    className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={form.github_username || ""}
                    onChange={(e) => setForm((f) => ({ ...f, github_username: e.target.value }))}
                    placeholder="username"
                    disabled={uploadingAvatar}
                  />
                </div>
              </div>

              {/* Instagram */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C]">Instagram</label>
                <div className="flex items-center gap-2">
                  <span className="text-[#2E3A59]/70">@</span>
                  <input
                    className="flex-1 rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={form.instagram_handle || ""}
                    onChange={(e) => setForm((f) => ({ ...f, instagram_handle: e.target.value }))}
                    placeholder="username"
                    disabled={uploadingAvatar}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Twitter OAuth Integration */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0B0B0C] flex items-center gap-2">
                🐦 Twitter Integration
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">Connect your Twitter account to enable agent posting</p>
            </div>
            
            {twitterConfig?.connected ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-green-900">
                        Connected as @{twitterConfig.twitter_username}
                      </div>
                      <div className="text-sm text-green-700">
                        Your agents can now post to Twitter
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectTwitter}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <strong>Connect your Twitter account</strong> to enable your agents to post automatically or with your approval.
                    Each agent can be configured independently.
                  </div>
                </div>
                <button
                  onClick={handleConnectTwitter}
                  disabled={connectingTwitter}
                  className="flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a8cd8] disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  {connectingTwitter ? "Connecting..." : "Connect Twitter Account"}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Interests Section */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#0B0B0C]">Interests & Hobbies</label>
            <textarea
              className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
              rows={3}
              value={form.interests || ""}
              onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value }))}
              placeholder="What do you enjoy doing in your free time?"
              disabled={uploadingAvatar}
            />
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Location Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="block text-sm font-semibold text-[#0B0B0C]">📍 Location</label>
              <span className="text-xs text-[#2E3A59]/70">(For weather & location-based agents)</span>
            </div>
            
            <div className="space-y-4">
              {/* Location Name */}
              <div>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.location || ""}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g., Paris, France"
                  disabled={uploadingAvatar}
                />
                <div className="mt-1 text-xs text-[#2E3A59]/70">City or address</div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={form.latitude || ""}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="Latitude (e.g., 48.8566)"
                    disabled={uploadingAvatar}
                  />
                  <div className="mt-1 text-xs text-[#2E3A59]/70">Latitude</div>
                </div>
                <div>
                  <input
                    className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                    value={form.longitude || ""}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="Longitude (e.g., 2.3522)"
                    disabled={uploadingAvatar}
                  />
                  <div className="mt-1 text-xs text-[#2E3A59]/70">Longitude</div>
                </div>
              </div>

              {/* Timezone */}
              <div>
                <input
                  className="w-full rounded-lg border border-[#E6E6E6] px-4 py-3 text-sm text-[#0B0B0C] transition-all focus:border-[#2E3A59] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20"
                  value={form.timezone || ""}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="e.g., Europe/Paris (auto-detected if empty)"
                  disabled={uploadingAvatar}
                />
                <div className="mt-1 text-xs text-[#2E3A59]/70">
                  Timezone (optional) • Current: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>

              {/* Helper Text */}
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <svg className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-800">
                  <strong>💡 Tip:</strong> Get coordinates from Google Maps by right-clicking any location and selecting the coordinates at the top.
                  This enables the Weather Agent and other location-based features.
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E6E6]"></div>

          {/* Danger Zone */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                ⚠️ Danger Zone
              </h2>
              <p className="text-xs text-[#2E3A59]/70 mt-1">Irreversible actions</p>
            </div>
            
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-red-900">Delete Account</h3>
                  <p className="mt-1 text-xs text-red-700">
                    Permanently delete your account, profile, and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="shrink-0 rounded-lg border-2 border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl">
            <div className="border-b border-red-200 bg-red-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-900">Delete Account?</h3>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-[#2E3A59]">
                This will permanently delete your account, including:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[#2E3A59]">
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Your profile and personal information</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>All your agents and their knowledge bases</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>All conversation history</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>All uploaded files and documents</span>
                </li>
              </ul>
              <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-900">
                  ⚠️ This action cannot be undone. All data will be permanently lost.
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-[#E6E6E6] bg-[#FAFAFA] px-6 py-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-[#E6E6E6] bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0B0C] transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDeleteAccount();
                }}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
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


