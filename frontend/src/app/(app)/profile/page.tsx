"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyProfile, saveMyProfile } from "@/lib/api";

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

        // If profile exists, populate.
        if (data?.handle) {
          const next: Profile = {
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
          // "No profile yet" (some implementations return empty object)
          setHasProfile(false);
          setInitial({
            handle: "",
            display_name: "",
            bio: "",
            avatar_url: "",
          });
          setInfo("No profile yet. Fill the form and click Save.");
        }
      } catch (e: any) {
        // Important: treat 404 as normal (no profile yet)
        const msg = String(e?.message || "");
        if (msg.includes("404")) {
          setHasProfile(false);
          setInitial({
            handle: "",
            display_name: "",
            bio: "",
            avatar_url: "",
          });
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

  if (loading) return <div className="text-sm text-gray-600">Loading…</div>;

  const saveDisabled = saving || !!handleError || !isDirty;

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
            onBlur={() =>
              setForm((f) => ({ ...f, handle: normalizeHandle(f.handle || "") }))
            }
            placeholder="loic"
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
          />
        </div>

        {/* Avatar */}
        <div>
          <label className="mb-1 block text-sm">Avatar URL</label>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-500">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.avatar_url} alt="" className="h-10 w-10 object-cover" />
              ) : (
                "IMG"
              )}
            </div>
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              value={form.avatar_url || ""}
              onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Optional. Use a direct image URL.
          </div>
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

          {!isDirty ? (
            <div className="text-xs text-gray-500">No changes to save.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

