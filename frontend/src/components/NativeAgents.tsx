"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AgentCapabilities {
  agent_id: string;
  name: string;
  description: string;
  requires_location: boolean;
  supported_queries: string[];
}

interface AgentResponse {
  content: string;
  data?: any;
  metadata?: any;
  timestamp?: string;
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

interface UserLocation {
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string | null;
  has_location: boolean;
}

export default function NativeAgents() {
  const [agents, setAgents] = useState<AgentCapabilities[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  
  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  
  // Location setup
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");

  // Fetch available agents
  useEffect(() => {
    fetchAgents();
    fetchUserLocation();
    fetchConversationHistory();
  }, []);

  const fetchAgents = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const response = await fetch(`${apiBase}/native-agents/`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch agents");

      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };

  const fetchUserLocation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const response = await fetch(
        `${apiBase}/native-agents/me/location`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserLocation(data);
      }
    } catch (err) {
      console.error("Error fetching location:", err);
    }
  };

  const fetchConversationHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const response = await fetch(
        `${apiBase}/native-agents/context`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConversationHistory(data.messages || []);
      }
    } catch (err) {
      console.error("Error fetching conversation history:", err);
    }
  };

  const clearConversationHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
      const response = await fetch(
        `${apiBase}/native-agents/context/clear`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        setConversationHistory([]);
        setResponse(null);
      }
    } catch (err) {
      console.error("Error clearing conversation history:", err);
    }
  };

  const updateLocation = async () => {
    if (!locationInput || !latInput || !lonInput) {
      setError("Please fill in all location fields");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      setLoading(true);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

      const response = await fetch(
        `${apiBase}/native-agents/me/location`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: locationInput,
            latitude: latInput,
            longitude: lonInput,
            timezone,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update location");

      const data = await response.json();
      setUserLocation({
        location: data.location,
        latitude: data.coordinates.latitude,
        longitude: data.coordinates.longitude,
        timezone: data.timezone,
        has_location: true,
      });

      setShowLocationSetup(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const queryAgent = async () => {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      setLoading(true);
      setError(null);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

      const response = await fetch(
        `${apiBase}/native-agents/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            agent_id: selectedAgent || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to query agent");
      }

      const data = await response.json();
      setResponse(data);
      
      // Refresh conversation history
      await fetchConversationHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickWeather = async () => {
    if (!userLocation?.has_location) {
      setError("Please set your location first");
      setShowLocationSetup(true);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      setLoading(true);
      setError(null);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

      const response = await fetch(
        `${apiBase}/native-agents/weather`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch weather");

      const data = await response.json();
      setResponse(data);
      setQuery("What's the current weather?");
      
      // Refresh conversation history
      await fetchConversationHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
          🤖 Native Agents
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          System-level agents that provide contextual information based on your profile
        </p>

        {/* Location Status */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                📍 Your Location
              </h3>
              {userLocation?.has_location ? (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {userLocation.location} ({userLocation.latitude}, {userLocation.longitude})
                </p>
              ) : (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Location not set (required for weather and location-based agents)
                </p>
              )}
            </div>
            <button
              onClick={() => setShowLocationSetup(!showLocationSetup)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {userLocation?.has_location ? "Update" : "Set Location"}
            </button>
          </div>

          {/* Location Setup Form */}
          {showLocationSetup && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="Location (e.g., Paris, France)"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Latitude (e.g., 48.8566)"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Longitude (e.g., 2.3522)"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={updateLocation}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Location"}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Tip: Get coordinates from Google Maps by right-clicking a location
              </p>
            </div>
          )}
        </div>

        {/* Available Agents */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
            Available Agents ({agents.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.agent_id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedAgent === agent.agent_id
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-400"
                }`}
                onClick={() => setSelectedAgent(agent.agent_id)}
              >
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {agent.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {agent.description}
                </p>
                {agent.requires_location && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                    📍 Requires Location
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Weather Button */}
        {userLocation?.has_location && (
          <div className="mb-6">
            <button
              onClick={quickWeather}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 font-semibold"
            >
              {loading ? "Loading..." : "🌤️ Get Current Weather"}
            </button>
          </div>
        )}

        {/* Query Interface */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Ask a question:
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., What's the weather like? Will it rain tomorrow?"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  queryAgent();
                }
              }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Press Ctrl+Enter to send
            </p>
          </div>

          <button
            onClick={queryAgent}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
          >
            {loading ? "Processing..." : "Ask Agent"}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                💬 Conversation History
                {conversationHistory.length > 0 && (
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
                    {conversationHistory.length} messages
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  {showHistory ? "Hide" : "Show"}
                </button>
                <button
                  onClick={clearConversationHistory}
                  className="text-sm px-3 py-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {showHistory && (
              <div className="space-y-3 max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                {conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">
                          {msg.role === "user" ? "You" : "Agent"}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      {msg.metadata?.response_method && (
                        <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                          <span className="text-xs opacity-70">
                            {msg.metadata.response_method === "llm" ? "🤖 AI Response" : "⚡ Quick Response"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Latest Response (if not in history yet) */}
        {response && conversationHistory.length === 0 && (
          <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
              Response:
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                {response.content}
              </pre>
            </div>

            {response.metadata && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Source: {response.metadata.source || "Unknown"}
                  {response.metadata.location &&
                    ` • Location: ${response.metadata.location}`}
                  {response.metadata.response_method &&
                    ` • Method: ${response.metadata.response_method === "llm" ? "AI Response" : "Quick Response"}`}
                  {response.timestamp &&
                    ` • Time: ${new Date(response.timestamp).toLocaleString()}`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage Tips */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
          💡 Usage Tips
        </h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>• Set your location to enable weather and location-based agents</li>
          <li>• You can specify an agent or let the system auto-detect</li>
          <li>• Try natural language: "Will it rain?", "Can I wear shorts tomorrow?"</li>
          <li>• Ask follow-up questions: "And the day after?", "What about next week?"</li>
          <li>• Complex questions use AI for contextual answers 🤖</li>
          <li>• Simple queries get instant responses ⚡</li>
        </ul>
      </div>
    </div>
  );
}

