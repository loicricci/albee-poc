'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface OrchestratorConfig {
  avee_id: string;
  max_escalations_per_day: number;
  max_escalations_per_week: number;
  escalation_enabled: boolean;
  auto_answer_confidence_threshold: number;
  clarification_enabled: boolean;
  blocked_topics: string[];
  allowed_user_tiers: string[];
}

interface Metrics {
  total_messages: number;
  auto_answered: number;
  escalations_offered: number;
  escalations_accepted: number;
  escalations_answered: number;
  canonical_reused: number;
  avg_confidence: number;
  avg_novelty: number;
  auto_answer_rate: number;
}

export default function OrchestratorConfigPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params?.handle as string;

  const [aveeId, setAveeId] = useState<string | null>(null);
  const [config, setConfig] = useState<OrchestratorConfig | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    loadData();
  }, [handle]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get agent ID from handle
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Get agent by handle
      const aveeRes = await fetch(`${backendUrl}/avees?handle=${handle}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!aveeRes.ok) {
        throw new Error('Failed to load agent');
      }

      const avees = await aveeRes.json();
      if (!avees || avees.length === 0) {
        throw new Error('Agent not found');
      }

      const agentId = avees[0].id;
      setAveeId(agentId);

      // Load config
      const configRes = await fetch(`${backendUrl}/orchestrator/config/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }

      // Load metrics
      const metricsRes = await fetch(`${backendUrl}/orchestrator/metrics/${agentId}?days=7`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

    } catch (error) {
      console.error('Error loading orchestrator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config || !aveeId) return;

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/orchestrator/config/${aveeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          max_escalations_per_day: config.max_escalations_per_day,
          max_escalations_per_week: config.max_escalations_per_week,
          escalation_enabled: config.escalation_enabled,
          auto_answer_confidence_threshold: config.auto_answer_confidence_threshold,
          clarification_enabled: config.clarification_enabled,
          blocked_topics: config.blocked_topics,
          allowed_user_tiers: config.allowed_user_tiers
        })
      });

      if (res.ok) {
        alert('Configuration saved successfully!');
      } else {
        alert('Failed to save configuration');
      }

    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const addBlockedTopic = () => {
    if (!config || !newTopic.trim()) return;
    
    setConfig({
      ...config,
      blocked_topics: [...config.blocked_topics, newTopic.trim()]
    });
    setNewTopic('');
  };

  const removeBlockedTopic = (topic: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      blocked_topics: config.blocked_topics.filter(t => t !== topic)
    });
  };

  const toggleUserTier = (tier: string) => {
    if (!config) return;
    
    const tiers = config.allowed_user_tiers.includes(tier)
      ? config.allowed_user_tiers.filter(t => t !== tier)
      : [...config.allowed_user_tiers, tier];
    
    setConfig({
      ...config,
      allowed_user_tiers: tiers
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Failed to load orchestrator configuration</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Orchestrator Settings</h1>
          <p className="text-gray-600">
            Control how your agent handles incoming messages and escalations
          </p>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Auto-Answer Rate</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">
                {(metrics.auto_answer_rate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Escalations Today</div>
              <div className="text-3xl font-bold text-orange-600 mt-2">
                {metrics.escalations_offered}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.escalations_accepted} accepted
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Answer Reuse</div>
              <div className="text-3xl font-bold text-green-600 mt-2">
                {metrics.canonical_reused}
              </div>
              <div className="text-xs text-gray-500 mt-1">Canonical answers served</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Total Messages</div>
              <div className="text-3xl font-bold text-purple-600 mt-2">
                {metrics.total_messages}
              </div>
              <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
            </div>
          </div>
        )}

        {/* Configuration Sections */}
        <div className="space-y-6">
          {/* Escalation Limits */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Escalation Limits</h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-3 mb-2">
                  <input
                    type="checkbox"
                    checked={config.escalation_enabled}
                    onChange={(e) => setConfig({ ...config, escalation_enabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-gray-700 font-medium">Enable escalations</span>
                </label>
                <p className="text-sm text-gray-500 ml-8">
                  Allow users to escalate complex questions to you
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily limit: {config.max_escalations_per_day}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.max_escalations_per_day}
                  onChange={(e) => setConfig({ ...config, max_escalations_per_day: parseInt(e.target.value) })}
                  className="w-full"
                  disabled={!config.escalation_enabled}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum escalations per day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weekly limit: {config.max_escalations_per_week}
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={config.max_escalations_per_week}
                  onChange={(e) => setConfig({ ...config, max_escalations_per_week: parseInt(e.target.value) })}
                  className="w-full"
                  disabled={!config.escalation_enabled}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum escalations per week
                </p>
              </div>
            </div>
          </div>

          {/* Auto-Answer Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Auto-Answer Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence threshold: {config.auto_answer_confidence_threshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={config.auto_answer_confidence_threshold}
                  onChange={(e) => setConfig({ ...config, auto_answer_confidence_threshold: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum confidence required for AI to auto-answer (higher = fewer but more accurate auto-answers)
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={config.clarification_enabled}
                    onChange={(e) => setConfig({ ...config, clarification_enabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-gray-700 font-medium">Enable clarification questions</span>
                </label>
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  Ask users to clarify vague questions before answering
                </p>
              </div>
            </div>
          </div>

          {/* User Access */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Access</h2>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-3">
                Select which user tiers can send escalations:
              </p>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={config.allowed_user_tiers.includes('free')}
                  onChange={() => toggleUserTier('free')}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <span className="text-gray-700 font-medium">Free users</span>
                  <p className="text-xs text-gray-500">Anyone can escalate questions</p>
                </div>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={config.allowed_user_tiers.includes('follower')}
                  onChange={() => toggleUserTier('follower')}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <span className="text-gray-700 font-medium">Followers</span>
                  <p className="text-xs text-gray-500">Only users who follow your agent</p>
                </div>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={config.allowed_user_tiers.includes('paid')}
                  onChange={() => toggleUserTier('paid')}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <span className="text-gray-700 font-medium">Paid users</span>
                  <p className="text-xs text-gray-500">Premium/paid subscribers (coming soon)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Blocked Topics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Blocked Topics</h2>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Topics that should never trigger escalations:
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {config.blocked_topics.map((topic) => (
                  <div
                    key={topic}
                    className="inline-flex items-center bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{topic}</span>
                    <button
                      onClick={() => removeBlockedTopic(topic)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addBlockedTopic()}
                  placeholder="Add blocked topic..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addBlockedTopic}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}








