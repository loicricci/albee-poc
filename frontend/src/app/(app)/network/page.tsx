"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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
  if (!token) throw new Error("Not logged in (no access token).");
  return token;
}

function apiBase(): string {
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

async function apiPostQuery<T>(
  path: string,
  query: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  // some endpoints may return empty; handle both
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : { ok: true }) as T;
}

export default function NetworkPage() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [items, setItems] = useState<FollowingAvee[]>([]);
  const [handleInput, setHandleInput] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);

  const normalizedHandle = useMemo(() => handleInput.trim().toLowerCase(), [handleInput]);

  const load = async () => {
    setPhase("loading");
    setErrorMsg("");

    try {
      const token = await getAccessToken();
      const data = await apiGet<FollowingAvee[]>("/network/following-avees", token);
      setItems(Array.isArray(data) ? data : []);
      setPhase("ready");
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e?.message || "Failed to load network.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("API_BASE:", process.env.NEXT_PUBLIC_API_BASE);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const follow = async () => {
    if (!normalizedHandle) return;

    setIsFollowing(true);
    setErrorMsg("");

    try {
      const token = await getAccessToken();
      await apiPostQuery("/relationships/follow-by-handle", { handle: normalizedHandle }, token);

      setHandleInput("");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to follow.");
    } finally {
      setIsFollowing(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <div className="text-sm text-gray-500">Network</div>
        <div className="text-2xl font-semibold">Following</div>
        <div className="text-sm text-gray-600 mt-1">
          Follow a person by handle, then chat with their Avee.
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-4 text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">
          {errorMsg}
        </div>
      ) : null}

      {/* Follow box */}
      <div className="border rounded-lg p-4 mb-6">
        <div className="font-medium mb-2">Follow someone</div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="handle (example: tom-avee)"
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") follow();
            }}
            disabled={isFollowing}
          />
          <button
            className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            disabled={!normalizedHandle || isFollowing}
            onClick={follow}
          >
            Follow
          </button>
          <button
            className="border rounded px-4 py-2 text-sm disabled:opacity-50"
            disabled={phase === "loading"}
            onClick={load}
          >
            Refresh
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Tip: you’re following the person (profile handle), then we show their Avees.
        </div>
      </div>

      {/* List */}
      <div className="border rounded-lg">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">Avees you can interact with</div>
          <div className="text-sm text-gray-500">
            {phase === "loading" ? "Loading…" : `${items.length} item(s)`}
          </div>
        </div>

        {phase === "error" ? (
          <div className="p-4 text-sm text-gray-600">
            Could not load your network. Check backend is running and endpoints exist.
          </div>
        ) : null}

        {phase !== "error" && items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            You’re not following anyone yet. Add a handle above.
          </div>
        ) : null}

        <div className="divide-y">
          {items.map((x) => (
            <div key={x.avee_id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-500">
                  {x.avee_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.avee_avatar_url} alt="" className="h-10 w-10 object-cover" />
                  ) : (
                    "AVEE"
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {x.avee_display_name || x.avee_handle}
                    <span className="text-gray-500 font-normal"> @{x.avee_handle}</span>
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    Owner: {x.owner_display_name || x.owner_handle} (@{x.owner_handle})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  className="bg-black text-white rounded px-3 py-2 text-sm"
                  href={`/chat/${encodeURIComponent(x.avee_handle)}`}
                >
                  Chat
                </Link>

                <Link
                  className="border rounded px-3 py-2 text-sm"
                  href={`/my-avees/${encodeURIComponent(x.avee_handle)}`}
                  title="If you own it you can edit; otherwise it may 403"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mt-6 text-xs text-gray-500">
        Notes:
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            “Chat” opens a conversation using your existing chat flow.
          </li>
          <li>
            The “Layer” you get is enforced server-side by permissions at conversation creation time.
          </li>
        </ul>
      </div>
    </div>
  );
}
 