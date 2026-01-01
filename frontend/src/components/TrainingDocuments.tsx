"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type TrainingDocument = {
  id: string;
  title?: string | null;
  content: string;
  source?: string | null;
  layer: "public" | "friends" | "intimate";
  created_at: string;
};

type TrainingDocumentsProps = {
  agentId: string;
  agentHandle: string;
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in");
  return token;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE");
  return base;
}

export function TrainingDocuments({ agentId, agentHandle }: TrainingDocumentsProps) {
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formLayer, setFormLayer] = useState<"public" | "friends" | "intimate">("public");
  const [submitting, setSubmitting] = useState(false);

  // View document modal state
  const [viewingDocument, setViewingDocument] = useState<TrainingDocument | null>(null);

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/avees/${agentId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load documents: ${res.status}`);
      }

      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Failed to load training documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (agentId) loadDocuments();
  }, [agentId]);

  function openEditModal(doc: TrainingDocument) {
    setEditingId(doc.id);
    setFormTitle(doc.title || "");
    setFormContent(doc.content);
    setFormSource(doc.source || "");
    setFormLayer(doc.layer);
    setShowEditModal(true);
  }

  function closeModal() {
    setShowEditModal(false);
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormSource("");
    setFormLayer("public");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !formContent.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/avees/${agentId}/documents/${editingId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formTitle.trim() || null,
          content: formContent.trim(),
          source: formSource.trim() || null,
          layer: formLayer,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update document: ${res.status}`);
      }

      closeModal();
      await loadDocuments();
    } catch (e: any) {
      setError(e.message || "Failed to update document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this training document? This will also remove all associated embeddings from the agent's knowledge base.")) {
      return;
    }

    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${apiBase()}/avees/${agentId}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to delete document: ${res.status}`);
      }

      await loadDocuments();
    } catch (e: any) {
      setError(e.message || "Failed to delete document");
    }
  }

  function openViewModal(doc: TrainingDocument) {
    setViewingDocument(doc);
  }

  function closeViewModal() {
    setViewingDocument(null);
  }

  const sortedDocuments = [...documents].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-green-50 to-teal-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-green-600 to-teal-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">📚 Training Documents</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage knowledge base documents ({documents.length} total)
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-2 transition-colors hover:bg-white/50"
          >
            <svg
              className={`h-5 w-5 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {expanded && (
          <div className="p-6">
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-600">
                <svg className="h-5 w-5 animate-spin mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading documents...</span>
              </div>
            ) : sortedDocuments.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No training documents yet</h3>
                <p className="text-sm text-gray-600">
                  Add training documents in the section above to enhance your agent's knowledge base
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {doc.title || "Untitled Document"}
                          </h3>
                        </div>
                        <div className="mb-3 text-sm text-gray-700 line-clamp-2">
                          {doc.content}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                            {doc.layer}
                          </span>
                          {doc.source && (
                            <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700">
                              {doc.source}
                            </span>
                          )}
                          <span>{formatRelativeTime(doc.created_at)}</span>
                          <span className="text-gray-400">•</span>
                          <span>{doc.content.length} chars</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => openViewModal(doc)}
                          className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          title="View full document"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEditModal(doc)}
                          className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          title="Edit"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="rounded p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && sortedDocuments.length > 0 && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-xs text-green-800">
                <strong>💡 Tip:</strong> Training documents are chunked and embedded for semantic search. Edit or delete documents to keep your agent's knowledge up to date.
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Document Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                📄 {viewingDocument.title || "Untitled Document"}
              </h3>
              <button
                onClick={closeViewModal}
                className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    Layer: {viewingDocument.layer}
                  </span>
                  {viewingDocument.source && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                      Source: {viewingDocument.source}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {formatRelativeTime(viewingDocument.created_at)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {viewingDocument.content.length} characters
                  </span>
                </div>

                {/* Content */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
                    {viewingDocument.content}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  openEditModal(viewingDocument);
                  closeViewModal();
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Edit Document
              </button>
              <button
                onClick={closeViewModal}
                className="rounded-lg bg-gradient-to-r from-green-600 to-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleUpdate}>
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">✏️ Edit Training Document</h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="max-h-[70vh] overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">
                      Title <span className="text-xs font-normal text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g., Bio, FAQ, Memories"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-all focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      maxLength={200}
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">
                      Content <span className="text-red-600">*</span>
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({formContent.length} characters)
                      </span>
                    </label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="Training content..."
                      className="h-48 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      required
                    />
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Source */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">
                        Source <span className="text-xs font-normal text-gray-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formSource}
                        onChange={(e) => setFormSource(e.target.value)}
                        placeholder="e.g., LinkedIn, website, notes"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                        maxLength={200}
                      />
                    </div>

                    {/* Layer */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Layer</label>
                      <select
                        value={formLayer}
                        onChange={(e) => setFormLayer(e.target.value as any)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      >
                        <option value="public">Public</option>
                        <option value="friends">Friends</option>
                        <option value="intimate">Intimate</option>
                      </select>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                    <strong>💡 Note:</strong> Updating this document will re-chunk and re-embed the content. This may take a few seconds.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitting || !formContent.trim()}
                >
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}






