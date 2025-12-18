"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Avee = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type FollowingAvee = {
  avee_id: string;
  avee_handle: string;
  avee_display_name?: string | null;
  avee_avatar_url?: string | null;
  owner_handle: string;
  owner_display_name?: string | null;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in.");
  return token;
}

function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE.");
  return base;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export default function AppHomePage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avees, setAvees] = useState<Avee[]>([]);
  const [following, setFollowing] = useState<FollowingAvee[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const token = await getAccessToken();

        const [p, a] = await Promise.all([
          apiGet<Profile>("/me/profile", token).catch(() => null),
          apiGet<Avee[]>("/me/avees", token).catch(() => []),
        ]);

        // Network endpoint may not exist yet — keep it optional.
        const f = await apiGet<FollowingAvee[]>("/network/following-avees", token).catch(() => []);

        if (!alive) return;

        setProfile(p);
        setAvees(Array.isArray(a) ? a : []);
        setFollowing(Array.isArray(f) ? f : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load app summary.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const topAvees = avees.slice(0, 3);
  const topFollowing = following.slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">App</h1>
          <p className="mt-1 text-sm text-gray-600">
            Quick summary of your profile, your Avees, and your network.
          </p>
        </div>

        <Link
          href="/my-avees"
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Go to My Avees
        </Link>
      </div>

      {err ? (
        <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">
          {err}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Profile</div>
            <Link href="/profile" className="text-sm underline">
              Open
            </Link>
          </div>

          {profile ? (
            <div className="mt-3 space-y-2">
              <div className="text-sm">
                <span className="text-gray-500">Handle:</span>{" "}
                <span className="font-medium">@{profile.handle}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Name:</span>{" "}
                <span>{profile.display_name || "—"}</span>
              </div>
              <div className="text-sm text-gray-600 line-clamp-3">
                {profile.bio || "No bio yet."}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600">
              No profile found yet. Create it in the Profile page.
            </div>
          )}
        </div>

        {/* My Avees */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">My Avees</div>
            <Link href="/my-avees" className="text-sm underline">
              Open
            </Link>
          </div>

          <div className="mt-2 text-sm text-gray-600">
            {avees.length} Avee(s)
          </div>

          {topAvees.length ? (
            <div className="mt-3 space-y-3">
              {topAvees.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {a.display_name || a.handle}
                    </div>
                    <div className="text-xs text-gray-600 truncate">@{a.handle}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/my-avees/${encodeURIComponent(a.handle)}`}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/chat/${encodeURIComponent(a.handle)}`}
                      className="rounded-md bg-black text-white px-2 py-1 text-xs hover:bg-gray-800"
                    >
                      Chat
                    </Link>
                  </div>
                </div>
              ))}
              {avees.length > 3 ? (
                <div className="text-xs text-gray-500">…and {avees.length - 3} more</div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-600">
              No Avees yet. Create one in “My Avees”.
            </div>
          )}
        </div>

        {/* Network */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Network</div>
            <Link href="/network" className="text-sm underline">
              Open
            </Link>
          </div>

          <div className="mt-2 text-sm text-gray-600">
            {following.length
              ? `${following.length} Avee(s) from people you follow`
              : "No items yet (or network endpoint not enabled)."}
          </div>

          {topFollowing.length ? (
            <div className="mt-3 space-y-3">
              {topFollowing.map((x) => (
                <div key={x.avee_id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {x.avee_display_name || x.avee_handle}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      @{x.avee_handle} · owner @{x.owner_handle}
                    </div>
                  </div>

                  <Link
                    href={`/chat/${encodeURIComponent(x.avee_handle)}`}
                    className="rounded-md bg-black text-white px-2 py-1 text-xs hover:bg-gray-800 shrink-0"
                  >
                    Chat
                  </Link>
                </div>
              ))}
              {following.length > 3 ? (
                <div className="text-xs text-gray-500">…and {following.length - 3} more</div>
              ) : null}
            </div>
          ) : null}

          {!topFollowing.length ? (
            <div className="mt-3 text-sm text-gray-600">
              Follow someone in the Network page to see their Avees here.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
