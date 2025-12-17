"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

type Avee = { id: string; handle: string; display_name: string | null };

export default function AppPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");

  // profile
  const [handle, setHandle] = useState("loic");
  const [displayName, setDisplayName] = useState("Loic");
  const [status, setStatus] = useState<string>("");

  // avees
  const [avees, setAvees] = useState<Avee[]>([]);
  const [newAveeHandle, setNewAveeHandle] = useState("loic-avee");
  const [newAveeName, setNewAveeName] = useState("Loic Avee");

  // chat
  const [convoId, setConvoId] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return router.push("/login");
      setToken(session.access_token);

      supabase.auth.onAuthStateChange((_event, session2) => {
        if (!session2) router.push("/login");
        else setToken(session2.access_token);
      });
    })();
  }, [router]);

  const loadAvees = async () => {
    const res = await apiFetch("/me/avees", token);
    const data = await res.json();
    setAvees(data);
  };

  useEffect(() => {
    if (token) loadAvees();
  }, [token]);

  const saveProfile = async () => {
    setStatus("");
    await apiFetch(
      `/me/profile?handle=${encodeURIComponent(handle)}&display_name=${encodeURIComponent(displayName)}`,
      token,
      { method: "POST" }
    );
    setStatus("Profile saved");
    await loadAvees();
  };

  const createAvee = async () => {
    setStatus("");
    await apiFetch(
      `/avees?handle=${encodeURIComponent(newAveeHandle)}&display_name=${encodeURIComponent(newAveeName)}`,
      token,
      { method: "POST" }
    );
    setStatus("Avee created");
    await loadAvees();
  };

  const startConversation = async (aveeId: string) => {
    const res = await apiFetch(`/conversations/with-avee?avee_id=${encodeURIComponent(aveeId)}`, token, {
      method: "POST",
    });
    const data = await res.json();
    setConvoId(data.id);
    setMessages([]);
    setStatus(`Conversation started (${data.layer_used})`);
  };

  const ask = async () => {
    if (!convoId || !question.trim()) return;
    setBusy(true);

    const q = question.trim();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");

    try {
      const res = await apiFetch(
        `/chat/ask?conversation_id=${encodeURIComponent(convoId)}&question=${encodeURIComponent(q)}`,
        token,
        { method: "POST" }
      );
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">Avee MVP</h1>
        <button className="border rounded px-3 py-1" onClick={signOut}>Sign out</button>
      </div>

      {status && <div className="text-sm text-green-700">{status}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">1) Profile</div>
          <input className="w-full border p-2 rounded" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle" />
          <input className="w-full border p-2 rounded" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="display name" />
          <button className="border rounded px-3 py-2" onClick={saveProfile} disabled={!token}>
            Save profile
          </button>
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">2) Create Avee</div>
          <input className="w-full border p-2 rounded" value={newAveeHandle} onChange={(e) => setNewAveeHandle(e.target.value)} placeholder="avee handle" />
          <input className="w-full border p-2 rounded" value={newAveeName} onChange={(e) => setNewAveeName(e.target.value)} placeholder="avee name" />
          <button className="border rounded px-3 py-2" onClick={createAvee} disabled={!token}>
            Create Avee
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">3) My Avees</div>
          <button className="border rounded px-3 py-1" onClick={loadAvees} disabled={!token}>Refresh</button>

          <div className="space-y-2">
            {avees.map((a) => (
              <button
                key={a.id}
                className="w-full text-left border rounded p-2"
                onClick={() => startConversation(a.id)}
                disabled={!token}
              >
                <div className="font-medium">{a.display_name || a.handle}</div>
                <div className="text-xs text-gray-600">{a.handle}</div>
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-600">Convo: {convoId || "-"}</div>
        </div>

        <div className="md:col-span-2 border rounded p-4 flex flex-col h-[520px]">
          <div className="font-semibold mb-3">4) Chat</div>

          <div className="flex-1 overflow-auto border rounded p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i}>
                <div className="text-xs text-gray-500">{m.role}</div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {!convoId && <div className="text-sm text-gray-500">Click an Avee to start a chat.</div>}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 border p-2 rounded"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask…"
              disabled={!convoId || busy}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            />
            <button className="border rounded px-4" onClick={ask} disabled={!convoId || busy}>
              {busy ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
