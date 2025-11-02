import { useState } from 'react';
import { Block, apiClient } from '../lib/api';
import { useResearchTier } from '../contexts/ResearchTierContext';

interface BlockEditorProps {
  block: Block;
  onClose: () => void;
  onSave: (updatedBlock: Block) => void;
}

/**
 * Modal for editing block details
 * - Edit title, description, notes, status
 * - Research block
 * - Display research results
 */
function BlockEditor({ block, onClose, onSave }: BlockEditorProps) {
  const { selectedTier, getTierInfo } = useResearchTier();

  const [formData, setFormData] = useState({
    title: block.title,
    description: block.description || '',
    user_notes: block.user_notes || '',
    status: block.status || 'not_started',
  });

  const [isResearching, setIsResearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchResults, setResearchResults] = useState<any | null>(null);

  const selectedTierInfo = getTierInfo(selectedTier);

  // Parse existing research data if available
  const existingResearch = block.research_data
    ? JSON.parse(block.research_data)
    : null;

  const handleResearch = async (type: 'quick' | 'deep') => {
    setIsResearching(true);
    setError(null);

    // Quick = always LITE, Deep = user's selected tier
    const processor = type === 'quick' ? 'lite' : selectedTier;

    try {
      const result = await apiClient.blocks.research(block.id!, processor as any);
      setResearchResults(result.research);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Research failed');
    } finally {
      setIsResearching(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updated = await apiClient.blocks.update(block.id!, formData);
      onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const currentResearch = researchResults || existingResearch;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Edit Block</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Block Info */}
          <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-neutral-400">Age Range:</span>
              <span className="font-medium text-gray-900 dark:text-neutral-100">{block.start_age} - {block.end_age}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-neutral-400">Duration:</span>
              <span className="font-medium text-gray-900 dark:text-neutral-100">{block.duration_years} years</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-neutral-400">Layer:</span>
              <span className="font-medium text-gray-900 dark:text-neutral-100">Layer {block.layer_number}</span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Block Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* User Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Personal Notes
              </label>
              <textarea
                value={formData.user_notes}
                onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder-gray-500 dark:placeholder-neutral-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Add your own notes about this block..."
              />
            </div>
          </div>

          {/* Research Section */}
          <div className="border-t border-gray-200 dark:border-neutral-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Research</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResearch('quick')}
                  disabled={isResearching}
                  className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  title="Always uses Lite tier - fastest, cheapest"
                >
                  Quick Research ($0.005)
                </button>
                <button
                  onClick={() => handleResearch('deep')}
                  disabled={isResearching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  title={`Uses your selected tier: ${selectedTierInfo.name} ($${(selectedTierInfo.price / 1000).toFixed(2)} per query)`}
                >
                  {isResearching ? 'Researching...' : `Deep Research ($${(selectedTierInfo.price / 1000).toFixed(2)})`}
                </button>
              </div>
            </div>

            {currentResearch && (
              <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
                <div className="text-sm text-gray-600 dark:text-neutral-400">
                  Found {currentResearch.results?.length || 0} resources
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {currentResearch.results?.slice(0, 5).map((result: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-neutral-700 p-3 rounded border border-gray-200 dark:border-neutral-600">
                      <div className="font-medium text-sm text-gray-900 dark:text-neutral-100">{result.title}</div>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {result.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BlockEditor;
