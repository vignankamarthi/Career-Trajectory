import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

/**
 * Configuration View
 *
 * Phase 1: Configuration Agent (LLM Role 1)
 * - Collects user info (name, start age, end age, goal)
 * - Uses Anthropic API to generate timeline structure
 * - Creates initial timeline with layers and blocks
 */

interface ConfigurationViewProps {
  onTimelineCreated: (timelineId: string) => void;
  selectedTier: string;
}

// Map Parallel AI tier to research model
const getResearchModel = (tier: string): 'lite' | 'pro' => {
  // Only 'lite' tier uses 'lite' model, all others use 'pro'
  return tier === 'lite' ? 'lite' : 'pro';
};

function ConfigurationView({ onTimelineCreated, selectedTier }: ConfigurationViewProps) {
  const [formData, setFormData] = useState({
    user_name: '',
    start_age: 14,
    end_age: 18,
    end_goal: '',
    num_layers: 2,
    global_research_model: getResearchModel(selectedTier),
  });

  // Update research model when selected tier changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      global_research_model: getResearchModel(selectedTier)
    }));
  }, [selectedTier]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      console.log('Creating timeline with:', formData);

      // Call Configuration Agent API to generate timeline
      const result = await apiClient.configure.generateTimeline(formData);

      console.log('Timeline generated:', result);

      // Notify parent component with the new timeline ID
      onTimelineCreated(result.timeline.id);
    } catch (err: any) {
      console.error('Timeline generation error:', err);
      const errorMessage =
        err.response?.data?.message || err.message || 'Failed to create timeline';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Career Trajectory Planner
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 font-light">
            Create a personalized career roadmap with AI-powered research and recommendations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Name */}
          <div>
            <label htmlFor="user_name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="user_name"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-600 focus:border-transparent transition-colors"
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Age Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_age" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Starting Age
              </label>
              <select
                id="start_age"
                value={formData.start_age}
                onChange={(e) => setFormData({ ...formData, start_age: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-600 focus:border-transparent transition-colors"
              >
                <option value={10}>10 (Middle School)</option>
                <option value={14}>14 (High School)</option>
                <option value={18}>18 (Post-Secondary)</option>
              </select>
            </div>

            <div>
              <label htmlFor="end_age" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Target Age
              </label>
              <input
                type="number"
                id="end_age"
                value={formData.end_age}
                onChange={(e) => setFormData({ ...formData, end_age: parseInt(e.target.value) })}
                min={formData.start_age + 4}
                max={60}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-600 focus:border-transparent transition-colors"
                required
              />
            </div>
          </div>

          {/* End Goal */}
          <div>
            <label htmlFor="end_goal" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              What's Your Goal?
            </label>
            <textarea
              id="end_goal"
              value={formData.end_goal}
              onChange={(e) => setFormData({ ...formData, end_goal: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-600 focus:border-transparent transition-colors"
              placeholder="e.g., Get into MIT for Computer Science, Become a cardiologist, Launch a startup"
              rows={3}
              required
            />
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 font-light">
              Be specific about what you want to achieve by age {formData.end_age}
            </p>
          </div>

          {/* Number of Layers */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Planning Detail Level
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <input
                  type="radio"
                  value={2}
                  checked={formData.num_layers === 2}
                  onChange={(e) => setFormData({ ...formData, num_layers: parseInt(e.target.value) })}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">2 Layers</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2 font-light">(Broad + Medium detail)</span>
                </div>
              </label>
              <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <input
                  type="radio"
                  value={3}
                  checked={formData.num_layers === 3}
                  onChange={(e) => setFormData({ ...formData, num_layers: parseInt(e.target.value) })}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">3 Layers</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2 font-light">(Broad + Medium + Fine detail)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Research Model */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Research Quality
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <input
                  type="radio"
                  value="lite"
                  checked={formData.global_research_model === 'lite'}
                  onChange={(e) => setFormData({ ...formData, global_research_model: e.target.value as 'lite' | 'pro' })}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">Lite</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2 font-light">(Faster)</span>
                </div>
              </label>
              <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <input
                  type="radio"
                  value="pro"
                  checked={formData.global_research_model === 'pro'}
                  onChange={(e) => setFormData({ ...formData, global_research_model: e.target.value as 'lite' | 'pro' })}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">Pro</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2 font-light">(More Comprehensive)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 font-light">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:bg-neutral-400 dark:disabled:bg-neutral-700 text-white dark:text-neutral-900 font-medium py-3 px-6 rounded-lg transition-all duration-200"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating your timeline...
              </span>
            ) : (
              'Create My Timeline'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ConfigurationView;
