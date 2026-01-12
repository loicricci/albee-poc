'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  previewGeneratePost, 
  confirmGeneratedPost, 
  cancelPostPreview,
  PreviewPostResponse 
} from '@/lib/api';
import { PostPreviewModal } from '@/components/PostPreviewModal';

interface Avee {
  avee_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  auto_post_enabled: boolean;
  last_auto_post_at: string | null;
  auto_post_settings: {
    frequency?: string;
    preferred_time?: string;
    categories?: string[];
  };
  reference_images?: Array<{
    id: string;
    reference_image_url: string;
    mask_image_url?: string | null;
    is_primary: boolean;
  }>;
}

interface AutoPostStatus {
  is_admin: boolean;
  avees: Avee[];
  total_count: number;
  enabled_count: number;
}

export default function AutoPostGeneratorPage() {
  const [status, setStatus] = useState<AutoPostStatus | null>(null);
  const [selectedAvees, setSelectedAvees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const [imageEngine, setImageEngine] = useState<'dall-e-3' | 'gpt-image-1'>('dall-e-3'); // Image engine selection
  const [selectedReferenceImage, setSelectedReferenceImage] = useState<string | null>(null); // NEW: Selected reference image
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Preview/Approval workflow state
  const [previewData, setPreviewData] = useState<PreviewPostResponse | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  const [usePreviewMode, setUsePreviewMode] = useState(true); // Toggle for preview mode

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      const url = `${API_BASE}/auto-post/status`;
      console.log('Fetching auto-post status from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to load status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error loading status:', error);
      showMessage('error', 'Failed to load auto post status');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvee = async (aveeId: string, enabled: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

      const response = await fetch(`${API_BASE}/auto-post/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avee_id: aveeId, enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle auto post');
      }

      // Reload status
      await loadStatus();
      
      showMessage('success', `Auto post ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling auto post:', error);
      showMessage('error', 'Failed to toggle auto post');
    }
  };

  const generatePosts = async (aveeIds: string[], feedback?: string, previousPreviewId?: string) => {
    if (aveeIds.length === 0) {
      showMessage('error', 'Please select at least one agent');
      return;
    }

    // Use preview mode for single agent generation
    if (usePreviewMode && aveeIds.length === 1) {
      await generateWithPreview(aveeIds[0], feedback, previousPreviewId);
      return;
    }

    // Bulk generation (without preview)
    try {
      setGenerating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

      const response = await fetch(`${API_BASE}/auto-post/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avee_ids: aveeIds,
          topic: topic || null,
          category: category || null,
          image_engine: imageEngine,
          reference_image_url: imageEngine === 'gpt-image-1' ? selectedReferenceImage : null, // Reference for GPT-Image-1 editing
        }),
      });

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage = errorData.detail || 'Failed to generate posts';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.status === 'completed') {
        const successful = result.results.filter((r: any) => r.success).length;
        const failed = result.results.filter((r: any) => !r.success);
        
        if (failed.length > 0) {
          // Show detailed error for first failure
          const firstFailure = failed[0];
          const errorMessage = firstFailure.error || 'Unknown error';
          showMessage('error', `Failed for @${firstFailure.handle}: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? '...' : ''}`);
        } else if (successful > 0) {
          showMessage('success', `Generated ${successful}/${result.total} posts successfully`);
        } else {
          showMessage('error', 'No posts were generated');
        }
      } else {
        showMessage('success', `Generating posts for ${result.avee_count} agents in background`);
      }

      // Clear selections and reload
      setSelectedAvees(new Set());
      setTopic('');
      setCategory('');
      setImageEngine('dall-e-3'); // Reset to default
      setSelectedReferenceImage(null); // Reset selected image
      await loadStatus();
      
    } catch (error) {
      console.error('Error generating posts:', error);
      showMessage('error', 'Failed to generate posts');
    } finally {
      setGenerating(false);
    }
  };

  // Generate with preview for single agent
  const generateWithPreview = async (aveeId: string, feedback?: string, previousPreviewId?: string) => {
    try {
      setGenerating(true);
      
      const preview = await previewGeneratePost({
        avee_id: aveeId,
        topic: topic || null,
        category: category || null,
        image_engine: imageEngine,
        reference_image_url: imageEngine === 'gpt-image-1' ? selectedReferenceImage : null,
        feedback: feedback || null,
        previous_preview_id: previousPreviewId || null,
      });
      
      setPreviewData(preview);
    } catch (error: any) {
      console.error('Error generating preview:', error);
      showMessage('error', error.message || 'Failed to generate preview');
    } finally {
      setGenerating(false);
    }
  };

  // Handle preview approval
  const handleApprovePreview = async (editedTitle?: string, editedDescription?: string) => {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    
    try {
      await confirmGeneratedPost({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
        title: editedTitle,
        description: editedDescription,
      });
      
      showMessage('success', 'Post published successfully!');
      
      // Clear state and reload
      setPreviewData(null);
      setSelectedAvees(new Set());
      setTopic('');
      setCategory('');
      setImageEngine('dall-e-3');
      setSelectedReferenceImage(null);
      await loadStatus();
    } catch (error: any) {
      console.error('Error confirming post:', error);
      showMessage('error', error.message || 'Failed to publish post');
    } finally {
      setIsProcessingPreview(false);
    }
  };

  // Handle regeneration with feedback
  const handleRegeneratePreview = async (feedback: string) => {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    await generateWithPreview(previewData.avee_id, feedback, previewData.preview_id);
    setIsProcessingPreview(false);
  };

  // Handle preview cancellation
  const handleCancelPreview = async () => {
    if (!previewData) return;
    
    setIsProcessingPreview(true);
    
    try {
      await cancelPostPreview({
        preview_id: previewData.preview_id,
        avee_id: previewData.avee_id,
      });
    } catch (error) {
      console.error('Failed to cancel preview:', error);
    } finally {
      setPreviewData(null);
      setIsProcessingPreview(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleSelection = (aveeId: string) => {
    const newSelection = new Set(selectedAvees);
    if (newSelection.has(aveeId)) {
      newSelection.delete(aveeId);
    } else {
      newSelection.add(aveeId);
    }
    setSelectedAvees(newSelection);
  };

  const selectAll = () => {
    if (!status) return;
    setSelectedAvees(new Set(status.avees.map(a => a.avee_id)));
  };

  const selectNone = () => {
    setSelectedAvees(new Set());
  };

  const selectEnabled = () => {
    if (!status) return;
    setSelectedAvees(new Set(status.avees.filter(a => a.auto_post_enabled).map(a => a.avee_id)));
  };

  // Check if selected agents have reference images (for OpenAI Edits mode)
  const hasReferenceImages = () => {
    if (!status || selectedAvees.size === 0) return false;
    
    // Check if all selected agents have reference images
    const selectedAveesList = status.avees.filter(a => selectedAvees.has(a.avee_id));
    return selectedAveesList.every(avee => 
      avee.reference_images && avee.reference_images.length > 0
    );
  };

  // Get available reference images from selected agents
  const getAvailableReferenceImages = () => {
    if (!status || selectedAvees.size === 0) return [];
    
    const selectedAveesList = status.avees.filter(a => selectedAvees.has(a.avee_id));
    const images: Array<{ 
      id: string;
      url: string; 
      agentHandle: string; 
      agentName: string;
      isPrimary: boolean;
    }> = [];
    
    selectedAveesList.forEach(avee => {
      if (avee.reference_images) {
        avee.reference_images.forEach(img => {
          images.push({
            id: img.id,
            url: img.reference_image_url,
            agentHandle: avee.handle,
            agentName: avee.display_name || avee.handle,
            isPrimary: img.is_primary
          });
        });
      }
    });
    
    // Sort by primary first
    return images.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading auto post status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Failed to load auto post status</p>
          <button
            onClick={loadStatus}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 Auto Post Generator
        </h1>
        <p className="text-gray-600">
          {status.is_admin
            ? 'Manage auto post generation for all agents'
            : 'Manage auto post generation for your agents'}
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">{status.total_count}</div>
          <div className="text-sm text-gray-600">Total Agents</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">{status.enabled_count}</div>
          <div className="text-sm text-gray-600">Auto Post Enabled</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">{selectedAvees.size}</div>
          <div className="text-sm text-gray-600">Selected</div>
        </div>
      </div>

      {/* Generation Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Generate Posts</h2>
        
        {/* Selection Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={selectAll}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            Select All
          </button>
          <button
            onClick={selectEnabled}
            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
          >
            Select Enabled
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            Clear Selection
          </button>
        </div>

        {/* Image Engine Selector */}
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            🎨 Image Generation Engine
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setImageEngine('dall-e-3')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                imageEngine === 'dall-e-3'
                  ? 'border-purple-600 bg-purple-100 shadow-md'
                  : 'border-gray-300 bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  imageEngine === 'dall-e-3' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'
                }`}>
                  {imageEngine === 'dall-e-3' && (
                    <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5"></div>
                  )}
                </div>
                <span className="font-semibold text-sm">DALL-E 3</span>
              </div>
              <p className="text-xs text-gray-600 ml-6">
                Fully AI-generated images from text prompts
              </p>
            </button>
            
            <button
              onClick={() => setImageEngine('gpt-image-1')}
              disabled={selectedAvees.size > 0 && !hasReferenceImages()}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                imageEngine === 'gpt-image-1'
                  ? 'border-purple-600 bg-purple-100 shadow-md'
                  : 'border-gray-300 bg-white hover:border-purple-300'
              } ${selectedAvees.size > 0 && !hasReferenceImages() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  imageEngine === 'gpt-image-1' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'
                }`}>
                  {imageEngine === 'gpt-image-1' && (
                    <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5"></div>
                  )}
                </div>
                <span className="font-semibold text-sm">GPT-Image-1 ✨</span>
              </div>
              <p className="text-xs text-gray-600 ml-6">
                Latest OpenAI model - works with or without reference images
              </p>
              {selectedAvees.size > 0 && hasReferenceImages() && (
                <p className="text-xs text-green-600 ml-6 mt-1">
                  ✓ Reference images available (optional)
                </p>
              )}
            </button>
          </div>
        </div>

        {/* Reference Image Selector (Optional for GPT-Image-1) */}
        {imageEngine === 'gpt-image-1' && selectedAvees.size > 0 && hasReferenceImages() && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              🖼️ Select Reference Image (Optional)
            </label>
            <p className="text-xs text-gray-600 mb-3">
              <strong>With reference:</strong> GPT-Image-1 will edit the image semantically based on your topic.<br/>
              <strong>Without reference:</strong> GPT-Image-1 will generate a brand new image from text.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {getAvailableReferenceImages().map((image) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedReferenceImage(image.url)}
                  className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                    selectedReferenceImage === image.url
                      ? 'border-blue-600 ring-2 ring-blue-300 shadow-lg'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img
                      src={image.url}
                      alt={`${image.agentName} reference`}
                      className="w-full h-full object-cover"
                    />
                    {image.isPrimary && (
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                        ⭐
                      </div>
                    )}
                    {selectedReferenceImage === image.url && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {image.agentName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      @{image.agentHandle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {!selectedReferenceImage && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                ℹ️ No reference selected - GPT-Image-1 will generate a new image from text
              </div>
            )}
          </div>
        )}

        {/* Topic and Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manual Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Space exploration"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to fetch automatic news topic
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category (Optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Any Category</option>
              <option value="business">Business</option>
              <option value="entertainment">Entertainment</option>
              <option value="general">General</option>
              <option value="health">Health</option>
              <option value="science">Science</option>
              <option value="sports">Sports</option>
              <option value="technology">Technology</option>
            </select>
          </div>
        </div>

        {/* Preview Mode Toggle */}
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usePreviewMode}
              onChange={(e) => setUsePreviewMode(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <div>
              <span className="font-medium text-gray-900">Preview before publishing</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Review and approve posts before they go live (single agent only). Provide feedback to regenerate if needed.
              </p>
            </div>
          </label>
        </div>

        {/* Generate Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => generatePosts(Array.from(selectedAvees))}
            disabled={generating || selectedAvees.size === 0}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {generating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              `Generate for Selected (${selectedAvees.size})`
            )}
          </button>
          <button
            onClick={() => generatePosts(status.avees.filter(a => a.auto_post_enabled).map(a => a.avee_id))}
            disabled={generating || status.enabled_count === 0}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Generate for All Enabled ({status.enabled_count})
          </button>
        </div>
      </div>

      {/* Agents List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Agents</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {status.avees.map((avee) => (
            <div key={avee.avee_id} className="p-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedAvees.has(avee.avee_id)}
                    onChange={() => toggleSelection(avee.avee_id)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {avee.avatar_url ? (
                      <img
                        src={avee.avatar_url}
                        alt={avee.display_name || avee.handle}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
                        {(avee.display_name || avee.handle).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {avee.display_name || avee.handle}
                      </h3>
                      {avee.auto_post_enabled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Enabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">@{avee.handle}</p>
                    {avee.last_auto_post_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last post: {new Date(avee.last_auto_post_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={avee.auto_post_enabled}
                      onChange={(e) => toggleAvee(avee.avee_id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      Auto Post
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status.avees.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No agents found. {status.is_admin ? 'No agents in the system.' : 'Create an agent to get started.'}
        </div>
      )}

      {/* Post Preview Modal */}
      {previewData && (
        <PostPreviewModal
          preview={previewData}
          isOpen={true}
          isLoading={isProcessingPreview || generating}
          onApprove={handleApprovePreview}
          onRegenerate={handleRegeneratePreview}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  );
}

