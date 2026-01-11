"use client";

import { useEffect, useState } from "react";
import { api, diagnosticGeneratePost, DiagnosticResult } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

interface Agent {
  avee_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  auto_post_enabled: boolean;
  last_auto_post_at: string | null;
  reference_images: any[];
}


export default function DiagnosticPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [imageEngine, setImageEngine] = useState<string>("dall-e-3");
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkAuth();
  }, []);

  // Load agents when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated]);

  async function loadAgents() {
    setLoadingAgents(true);
    try {
      console.log("[Diagnostic] Loading agents from /auto-post/status");
      const data = await api.get<{ avees: Agent[]; is_admin: boolean; total_count: number }>("/auto-post/status");
      console.log("[Diagnostic] API Response:", data);
      console.log("[Diagnostic] Is admin:", data.is_admin);
      console.log("[Diagnostic] Total count:", data.total_count);
      console.log("[Diagnostic] Avees array:", data.avees);
      console.log("[Diagnostic] Avees length:", data.avees?.length || 0);
      
      const agentsList = data.avees || [];
      setAgents(agentsList);
      setAccessDenied(false);
      
      console.log("[Diagnostic] Agents state set to:", agentsList.length, "agents");
    } catch (err: any) {
      console.error("[Diagnostic] Failed to load agents:", err);
      console.error("[Diagnostic] Error status:", err?.status);
      console.error("[Diagnostic] Error message:", err?.message);
      if (err?.status === 403 || err?.message?.includes("403")) {
        console.log("[Diagnostic] Setting access denied");
        setAccessDenied(true);
      }
    } finally {
      setLoadingAgents(false);
    }
  }

  async function generatePost() {
    if (!selectedAgentId) {
      alert("Please select an agent");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await diagnosticGeneratePost({
        avee_id: selectedAgentId,
        topic: topic || null,
        category: category || null,
        image_engine: imageEngine,
      });

      setResult(data);
      // Auto-expand all steps
      setExpandedSteps(new Set(data.steps.map((_, idx) => idx)));
    } catch (err: any) {
      console.error("Failed to generate post:", err);
      alert(`Error: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(index: number) {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  }

  function renderJSON(obj: any) {
    return (
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        {JSON.stringify(obj, null, 2)}
      </pre>
    );
  }

  if (accessDenied) {
    return (
      <NewLayoutWrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-red-900">Access Denied</h2>
            <p className="mb-4 text-red-700">
              This diagnostic tool is restricted to authorized administrators only.
            </p>
            <a href="/backoffice" className="inline-block rounded-lg bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700">
              Return to Backoffice
            </a>
          </div>
        </div>
      </NewLayoutWrapper>
    );
  }

  return (
    <NewLayoutWrapper>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">🔍 AutoPost Diagnostic Tool</h1>
              <p className="mt-2 text-gray-600">End-to-end analysis of autopost generation flow</p>
            </div>
            <a href="/backoffice" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              ← Back to Backoffice
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold text-gray-900">Configuration</h2>

              <div className="space-y-5">
                {/* Agent Selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Select Agent</label>
                  {loadingAgents ? (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-8">
                      <div className="text-sm text-gray-600">Loading agents...</div>
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
                      <div className="text-sm font-medium text-yellow-900">No agents found</div>
                      <div className="mt-1 text-xs text-yellow-700">
                        Make sure you're logged in as an admin or have created agents.
                      </div>
                      <button
                        onClick={loadAgents}
                        className="mt-3 w-full rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 transition-colors hover:bg-yellow-50"
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Choose an agent...</option>
                      {agents.map((agent) => (
                        <option key={agent.avee_id} value={agent.avee_id}>
                          {agent.display_name || agent.handle} (@{agent.handle})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{agents.length} agent{agents.length !== 1 ? 's' : ''} available</p>
                </div>

                {/* Topic */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Topic (Optional)</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Leave empty for auto-fetch"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="mt-1 text-xs text-gray-500">Override or let it fetch from news</p>
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Category (Optional)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Auto</option>
                    <option value="technology">Technology</option>
                    <option value="science">Science</option>
                    <option value="business">Business</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="health">Health</option>
                    <option value="sports">Sports</option>
                  </select>
                </div>

                {/* Image Engine */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Image Engine</label>
                  <select
                    value={imageEngine}
                    onChange={(e) => setImageEngine(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="dall-e-3">DALL-E 3</option>
                    <option value="gpt-image-1">GPT-Image-1</option>
                  </select>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generatePost}
                  disabled={loading || !selectedAgentId}
                  className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 font-semibold text-white shadow-sm transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Post"}
                </button>

                {result && (
                  <button
                    onClick={() => setResult(null)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Clear Output
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {!result && !loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="mt-4 text-gray-600">Configure settings and click "Generate Post" to start analysis</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-gray-200 bg-white">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                  <p className="mt-4 font-medium text-gray-900">Generating post...</p>
                  <p className="mt-1 text-sm text-gray-600">This may take 10-20 seconds</p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`rounded-xl border-2 p-4 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="flex-1">
                      <div className={`font-semibold ${result.success ? "text-green-900" : "text-red-900"}`}>
                        {result.success ? "✅ Post generated successfully!" : "❌ Generation failed"}
                      </div>
                      {result.error && <div className="mt-1 text-sm text-red-700">{result.error}</div>}
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-medium text-gray-600">Total Duration</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{result.total_duration.toFixed(2)}s</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-medium text-gray-600">Steps Completed</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{result.steps.length}</div>
                  </div>
                </div>

                {/* Steps */}
                {result.steps.map((step, index) => (
                  <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      onClick={() => toggleStep(index)}
                      className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${step.success ? "" : "opacity-50"}`}>
                          {step.success ? "✅" : "❌"}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">
                            {step.step_number}. {step.step_name}
                          </div>
                          <div className="text-sm text-gray-600">Duration: {step.duration.toFixed(3)}s</div>
                        </div>
                      </div>
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${expandedSteps.has(index) ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSteps.has(index) && (
                      <div className="border-t border-gray-200 p-4">
                        {step.error && (
                          <div className="mb-4 rounded-lg bg-red-50 p-3">
                            <div className="font-medium text-red-900">Error:</div>
                            <div className="mt-1 text-sm text-red-700">{step.error}</div>
                          </div>
                        )}
                        {step.data && Object.keys(step.data).length > 0 && (
                          <div>
                            <div className="mb-2 font-medium text-gray-900">Step Data:</div>
                            {renderJSON(step.data)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Final Result */}
                {result.final_result && (
                  <div className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50">
                    <div className="border-b border-indigo-200 bg-indigo-100 p-4">
                      <h3 className="font-bold text-indigo-900">📊 Final Result</h3>
                    </div>
                    <div className="p-4">
                      {renderJSON(result.final_result)}
                      {result.final_result.view_url && (
                        <div className="mt-4">
                          <a
                            href={result.final_result.view_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                          >
                            🔗 View Post
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </NewLayoutWrapper>
  );
}

