"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAvee, getMyAvees } from "@/lib/api";

type Avee = {
  id?: string;
  handle: string;
  display_name?: string;
  owner_user_id?: string;
  created_at?: string;
};

export default function MyAveesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [avees, setAvees] = useState<Avee[]>([]);

  const [newHandle, setNewHandle] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAvees();

      // backend might return {items:[...]} or just [...]
      const list = Array.isArray(data) ? data : data.items;
      setAvees(list || []);
    } catch (e: any) {
      setError(e.message || "Failed to load avees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setCreating(true);
    setError(null);

    try {
      const handle = newHandle.trim().toLowerCase();
      const display_name = newName.trim();

      if (!handle) throw new Error("Handle is required");
      if (!/^[a-z0-9-]+$/.test(handle)) {
        throw new Error("Handle must be lowercase letters, numbers, or hyphens");
      }

      await createAvee({
        handle,
        display_name: display_name || undefined,
      });

      setNewHandle("");
      setNewName("");
      await load();
    } catch (e: any) {
      setError(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Avees</h1>
        <button
          onClick={load}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg border p-4">
        <div className="mb-2 text-sm font-medium">Create a new Avee</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-gray-600">Handle</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="loic-avee"
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-gray-600">
              Display name (optional)
            </label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Loic Avee"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={onCreate}
            disabled={creating}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Handles become part of the URL. Example: <code>/avees/loic-avee</code>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-3 text-sm font-medium">Your Avees</div>

        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : avees.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No Avees yet.</div>
        ) : (
          <ul className="divide-y">
            {avees.map((a) => (
              <li key={a.handle} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">{a.display_name || a.handle}</div>
                  <div className="text-xs text-gray-500">@{a.handle}</div>
                </div>

                <div className="flex gap-2">
                  <Link
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    href={`/my-avees/${a.handle}`}
                  >
                    Edit
                  </Link>

                  <Link
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    href={`/chat/${a.handle}`}
                  >
                    Chat
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
