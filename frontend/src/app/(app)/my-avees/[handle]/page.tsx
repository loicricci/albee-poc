"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addTrainingDocument,
  chatAsk,
  getAveeByHandle,
  setAveePermission,
  updateAvee, // ✅ NEW
} from "@/lib/api";

type Avee = {
  id: string;
  handle: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;

  // ✅ NEW: persona is returned only for the owner (recommended backend behavior)
  persona?: string | null;
};

export default function AveeEditorPage() {
  const params = useParams<{ handle: string }>();
  const handle = useMemo(() => (params?.handle || "").toString(), [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [avee, setAvee] = useState<Avee | null>(null);

  // ✅ Persona
  const [persona, setPersona] = useState("");
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaMsg, setPersonaMsg] = useState<string | null>(null);

  // Training
  const [trainLayer, setTrainLayer] = useState<"public" | "friends" | "intimate">(
    "public"
  );
  const [trainTitle, setTrainTitle] = useState("");
  const [trainSource, setTrainSource] = useState("");
  const [trainContent, setTrainContent] = useState("");
  const [training, setTraining] = useState(false);

  // Permissions
  const [viewerHandle, setViewerHandle] = useState("");
  const [maxLayer, setMaxLayer] = useState<"public" | "friends" | "intimate">(
    "friends"
  );
  const [savingPerm, setSavingPerm] = useState(false);

  // Test
  const [testLayer, setTestLayer] = useState<"public" | "friends" | "intimate">(
    "public"
  );
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const personaMeta = useMemo(() => {
    const lines = persona ? persona.split("\n").length : 0;
    return { chars: persona.length, lines };
  }, [persona]);

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    setAnswer(null);
    setPersonaMsg(null);

    try {
      const data = await getAveeByHandle(handle);
      setAvee(data);

      // ✅ persona is optional (owner-only). If not present, keep it empty.
      setPersona((data?.persona || "").toString());
    } catch (e: any) {
      setError(e.message || "Failed to load Avee");
      setAvee(null);
      setPersona("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (handle) load();
  }, [handle]);

  async function onSavePersona() {
    if (!avee?.id) return;

    setPersonaSaving(true);
    setError(null);
    setOkMsg(null);
    setPersonaMsg(null);

    try {
      const p = persona.trim();

      // Keep the same limit as backend (40k) to fail early in UI
      if (p.length > 40000) {
        throw new Error("Persona too long (max 40,000 characters)");
      }

      await updateAvee({ aveeId: avee.id, persona: p });
      setPersona(p);
      setPersonaMsg("Persona saved.");
    } catch (e: any) {
      setPersonaMsg(e.message || "Failed to save persona");
    } finally {
      setPersonaSaving(false);
    }
  }

  async function onAddDoc() {
    if (!avee?.id) return;

    setTraining(true);
    setError(null);
    setOkMsg(null);

    try {
      const content = trainContent.trim();
      if (!content) throw new Error("Content is required");

      const res = await addTrainingDocument({
        aveeId: avee.id,
        layer: trainLayer,
        title: trainTitle.trim() || undefined,
        source: trainSource.trim() || undefined,
        content,
      });

      setTrainTitle("");
      setTrainSource("");
      setTrainContent("");

      setOkMsg(
        `Training saved. Layer "${res.layer}". Chunks created: ${res.chunks ?? "ok"}.`
      );
    } catch (e: any) {
      setError(e.message || "Failed to add training document");
    } finally {
      setTraining(false);
    }
  }

  async function onSetPermission() {
    if (!avee?.id) return;

    setSavingPerm(true);
    setError(null);
    setOkMsg(null);

    try {
      const vh = viewerHandle.trim().toLowerCase();
      if (!vh) throw new Error("viewer_handle is required");

      await setAveePermission({
        aveeId: avee.id,
        viewerHandle: vh,
        maxLayer,
      });

      setOkMsg(`Permission saved: ${vh} → max layer "${maxLayer}".`);
      setViewerHandle("");
    } catch (e: any) {
      setError(e.message || "Failed to set permission");
    } finally {
      setSavingPerm(false);
    }
  }

  async function onAsk() {
    if (!avee?.handle) return;

    setAsking(true);
    setError(null);
    setOkMsg(null);
    setAnswer(null);

    try {
      const q = question.trim();
      if (!q) throw new Error("Question is required");

      const res = await chatAsk({
        aveeHandle: avee.handle,
        layer: testLayer,
        question: q,
      });

      const textOut =
        typeof res === "string"
          ? res
          : res.answer || res.text || JSON.stringify(res, null, 2);

      setAnswer(textOut);
    } catch (e: any) {
      setError(e.message || "Failed to ask");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Avee Editor</h1>
          <div className="text-sm text-gray-600">@{handle}</div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/my-avees"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
          <Link
            href={`/chat/${handle}`}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Chat
          </Link>
          <button
            onClick={load}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">
          {okMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded border p-4 text-sm text-gray-600">Loading…</div>
      ) : !avee ? (
        <div className="rounded border p-4 text-sm text-gray-600">
          Avee not found.
        </div>
      ) : (
        <>
          {/* 1) Details */}
          <div className="mb-6 rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Avee details</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">Handle</div>
                <div className="text-sm font-medium">@{avee.handle}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Display name</div>
                <div className="text-sm">{avee.display_name || "—"}</div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500">Bio</div>
                <div className="text-sm whitespace-pre-wrap">{avee.bio || "—"}</div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500">Avatar URL</div>
                <div className="text-sm break-all">{avee.avatar_url || "—"}</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Editing these fields will need a backend update endpoint (we’ll add later).
            </div>
          </div>

          {/* ✅ 2) Persona */}
          <div className="mb-6 rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Persona</div>
              <div className="text-xs text-gray-500">
                {personaMeta.chars} chars • {personaMeta.lines} lines
              </div>
            </div>

            <div className="mb-2 text-xs text-gray-600">
              This defines the personality, tone, values, and boundaries of this Avee.
              It is injected into chat as a system prompt. (Owner only.)
            </div>

            <textarea
              className="h-56 w-full rounded border px-3 py-2 text-sm font-mono"
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setPersonaMsg(null);
              }}
              placeholder="Paste the full persona here (up to ~500 lines)…"
            />

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={onSavePersona}
                disabled={personaSaving}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {personaSaving ? "Saving…" : "Save persona"}
              </button>

              {personaMsg ? (
                <div className="text-sm text-gray-600">{personaMsg}</div>
              ) : null}
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Tip: write short rules. Tone, do/don’t, boundaries, and how it behaves in public vs friends vs intimate.
            </div>
          </div>

          {/* 3) Training */}
          <div className="mb-6 rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Training data</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Layer</label>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={trainLayer}
                  onChange={(e) => setTrainLayer(e.target.value as any)}
                >
                  <option value="public">public</option>
                  <option value="friends">friends</option>
                  <option value="intimate">intimate</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-gray-600">
                  Title (optional)
                </label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={trainTitle}
                  onChange={(e) => setTrainTitle(e.target.value)}
                  placeholder="Bio, FAQ, Memories…"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-gray-600">
                  Source (optional)
                </label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={trainSource}
                  onChange={(e) => setTrainSource(e.target.value)}
                  placeholder="linkedin, website, notes…"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-gray-600">Content</label>
                <textarea
                  className="h-40 w-full rounded border px-3 py-2 text-sm"
                  value={trainContent}
                  onChange={(e) => setTrainContent(e.target.value)}
                  placeholder="Paste text to train this Avee…"
                />
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={onAddDoc}
                disabled={training}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {training ? "Saving…" : "Add document"}
              </button>
            </div>
          </div>

          {/* 4) Permissions */}
          <div className="mb-6 rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Permissions</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-gray-600">
                  Viewer handle
                </label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={viewerHandle}
                  onChange={(e) => setViewerHandle(e.target.value)}
                  placeholder="e.g. adrien"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-600">Max layer</label>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={maxLayer}
                  onChange={(e) => setMaxLayer(e.target.value as any)}
                >
                  <option value="public">public</option>
                  <option value="friends">friends</option>
                  <option value="intimate">intimate</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={onSetPermission}
                disabled={savingPerm}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {savingPerm ? "Saving…" : "Grant / update access"}
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              This sets the maximum layer this viewer can access for this Avee.
            </div>
          </div>

          {/* 5) Test */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Test this Avee</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Layer</label>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={testLayer}
                  onChange={(e) => setTestLayer(e.target.value as any)}
                >
                  <option value="public">public</option>
                  <option value="friends">friends</option>
                  <option value="intimate">intimate</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-gray-600">Question</label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask something…"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={onAsk}
                disabled={asking}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {asking ? "Asking…" : "Ask"}
              </button>

              <button
                type="button"
                onClick={() => setAnswer(null)}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            {answer && (
              <div className="mt-3 rounded border bg-white p-3 text-sm whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
