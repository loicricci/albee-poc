'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface UserInfo {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

interface Escalation {
  id: string;
  conversation_id: string;
  user_info: UserInfo;
  original_message: string;
  context_summary: string | null;
  escalation_reason: string;
  status: string;
  offered_at: string;
  accepted_at: string | null;
}

export default function EscalationsPage() {
  const router = useRouter();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerLayer, setAnswerLayer] = useState<'public' | 'friends' | 'intimate'>('public');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEscalations();
  }, []);

  const loadEscalations = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/orchestrator/queue`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setEscalations(data.escalations || []);
      }

    } catch (error) {
      console.error('Error loading escalations:', error);
    } finally {
      setLoading(false);
    }
  };

  const answerEscalation = async () => {
    if (!selectedEscalation || !answerText.trim()) return;

    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/orchestrator/queue/${selectedEscalation.id}/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: answerText,
          layer: answerLayer
        })
      });

      if (res.ok) {
        // Close modal and refresh
        setSelectedEscalation(null);
        setAnswerText('');
        loadEscalations();
      } else {
        alert('Failed to send answer');
      }

    } catch (error) {
      console.error('Error answering escalation:', error);
      alert('Error sending answer');
    } finally {
      setSubmitting(false);
    }
  };

  const declineEscalation = async (escalationId: string) => {
    if (!confirm('Are you sure you want to decline this escalation?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/orchestrator/queue/${escalationId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        loadEscalations();
      }

    } catch (error) {
      console.error('Error declining escalation:', error);
    }
  };

  const getReasonBadge = (reason: string) => {
    const badges = {
      novel: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🆕 Novel' },
      strategic: { bg: 'bg-purple-100', text: 'text-purple-800', label: '🎯 Strategic' },
      complex: { bg: 'bg-orange-100', text: 'text-orange-800', label: '🧠 Complex' }
    };

    const badge = badges[reason as keyof typeof badges] || badges.novel;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Escalation Queue</h1>
          <p className="text-gray-600">
            Answer questions that require your personal attention
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-orange-600">
              {escalations.filter(e => e.status === 'pending').length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Accepted</div>
            <div className="text-2xl font-bold text-blue-600">
              {escalations.filter(e => e.status === 'accepted').length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900">
              {escalations.length}
            </div>
          </div>
        </div>

        {/* Escalation List */}
        {escalations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📬</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No escalations</h3>
            <p className="text-gray-600">
              When users ask complex questions, they'll appear here for you to answer
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {escalations.map((escalation) => (
              <div
                key={escalation.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {escalation.user_info.avatar_url ? (
                        <img src={escalation.user_info.avatar_url}
                          alt={escalation.user_info.handle}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {escalation.user_info.handle[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-medium text-gray-900">
                        {escalation.user_info.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{escalation.user_info.handle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getReasonBadge(escalation.escalation_reason)}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      escalation.status === 'pending' 
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {escalation.status}
                    </span>
                  </div>
                </div>

                {/* Question */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Question:</div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-900">{escalation.original_message}</p>
                  </div>
                </div>

                {/* Context Summary */}
                {escalation.context_summary && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-600 mb-2">Context:</div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {escalation.context_summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-gray-500 mb-4">
                  {escalation.accepted_at 
                    ? `Accepted ${new Date(escalation.accepted_at).toLocaleString()}`
                    : `Offered ${new Date(escalation.offered_at).toLocaleString()}`
                  }
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setSelectedEscalation(escalation);
                      setAnswerText('');
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => declineEscalation(escalation.id)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answer Modal */}
        {selectedEscalation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Answer Escalation</h2>

                {/* Original Question */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Original Question:</div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-900">{selectedEscalation.original_message}</p>
                  </div>
                </div>

                {/* Answer Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Answer:
                  </label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type your answer here... (Markdown supported)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This answer will be saved and can be reused for similar questions
                  </p>
                </div>

                {/* Layer Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Layer:
                  </label>
                  <div className="flex space-x-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="public"
                        checked={answerLayer === 'public'}
                        onChange={(e) => setAnswerLayer(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm">Public</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="friends"
                        checked={answerLayer === 'friends'}
                        onChange={(e) => setAnswerLayer(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm">Friends</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="intimate"
                        checked={answerLayer === 'intimate'}
                        onChange={(e) => setAnswerLayer(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm">Intimate</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setSelectedEscalation(null);
                      setAnswerText('');
                    }}
                    disabled={submitting}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={answerEscalation}
                    disabled={submitting || !answerText.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send Answer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}








