"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyProfile, saveMyProfile } from "@/lib/api";
import { uploadImageToBucket } from "@/lib/upload";

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

export default function ProfilePage() {
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

  const normalizedHandle = useMemo(() => normalizeHandle(form.handle || ""), [form.handle]);
  const handleError = useMemo(() => validateHandle(normalizedHandle), [normalizedHandle]);

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

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setOk(null);
        setInfo(null);

        const data = await getMyProfile();
        if (!alive) return;

        if (data?.handle) {
          const next: Profile = {
            user_id: data.user_id, // ✅ keep user_id for avatar folder
            handle: data.handle || "",
            display_name: data.display_name || "",
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
          };
          setForm(next);
          setInitial(next);
          setHasProfile(true);
          setInfo(null);
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

      await saveMyProfile({
        handle: cleanHandle,
        display_name: (form.display_name || "").trim(),
        bio: (form.bio || "").trim(),
        avatar_url: (form.avatar_url || "").trim(),
      });

      const next: Profile = {
        ...form,
        handle: cleanHandle,
        display_name: (form.display_name || "").trim(),
        bio: (form.bio || "").trim(),
        avatar_url: (form.avatar_url || "").trim(),
      };

      setForm(next);
      setInitial(next);
      setHasProfile(true);
      setOk("Saved.");
    } catch (e: any) {
      setError(friendlyError(e?.message || "Save failed"));
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

      setForm((f) => ({ ...f, avatar_url: publicUrl }));
      setOk("Avatar uploaded. Click Save to store it.");
    } catch (e: any) {
      setError(friendlyError(e?.message || "Avatar upload failed"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-600">Loading…</div>;

  const saveDisabled = saving || uploadingAvatar || !!handleError || !isDirty;

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Profile</h1>
        <div className="mt-1 text-sm text-gray-600">
          {hasProfile ? "Update your public profile." : "Create your profile to get started."}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}
      {ok && (
        <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">{ok}</div>
      )}
      {info && (
        <div className="mb-3 rounded bg-blue-50 p-2 text-sm text-blue-700">{info}</div>
      )}

      <div className="space-y-3">
        {/* Handle */}
        <div>
          <label className="mb-1 block text-sm">Handle (required)</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={form.handle || ""}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
            onBlur={() => setForm((f) => ({ ...f, handle: normalizeHandle(f.handle || "") }))}
            placeholder="loic"
            disabled={uploadingAvatar}
          />
          <div className="mt-1 text-xs text-gray-500">
            Public username. Lowercase. Letters, numbers, "-" and "_".
          </div>
          {handleError ? (
            <div className="mt-1 text-xs text-red-600">{handleError}</div>
          ) : form.handle ? (
            <div className="mt-1 text-xs text-gray-600">
              Will be saved as: <span className="font-medium">@{normalizedHandle}</span>
            </div>
          ) : null}
        </div>

        {/* Display name */}
        <div>
          <label className="mb-1 block text-sm">Display name</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={form.display_name || ""}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            placeholder="Loic"
            disabled={uploadingAvatar}
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-sm">Bio</label>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={4}
            value={form.bio || ""}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Short bio…"
            disabled={uploadingAvatar}
          />
        </div>

        {/* Avatar */}
        <div>
          <label className="mb-1 block text-sm">Avatar</label>

          <label
            className={[
              "block w-full rounded border p-3 cursor-pointer select-none",
              dragging ? "border-black" : "border-gray-300",
              uploadingAvatar ? "opacity-60" : "",
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

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-500">
                {form.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatar_url} alt="" className="h-12 w-12 object-cover" />
                ) : (
                  "IMG"
                )}
              </div>

              <div className="flex-1">
                <div className="text-sm">
                  {uploadingAvatar ? "Uploading…" : "Drop image here, or click to upload"}
                </div>
                <div className="mt-1 text-xs text-gray-500">PNG, JPG, WEBP. Max 5MB.</div>
              </div>
            </div>
          </label>

          {form.avatar_url ? (
            <div className="mt-2 text-xs text-gray-500 break-all">{form.avatar_url}</div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : hasProfile ? "Save changes" : "Create profile"}
          </button>

          {!isDirty ? <div className="text-xs text-gray-500">No changes to save.</div> : null}
        </div>
      </div>
    </div>
  );
}

