/**
 * PRICING MODAL - Parallel AI Style (Table Layout)
 * Clean table format matching Parallel's actual pricing page
 */

import { useResearchTier, RESEARCH_TIERS, ResearchTier } from '../contexts/ResearchTierContext';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { selectedTier, setSelectedTier } = useResearchTier();

  if (!isOpen) return null;

  const handleSelectTier = (tier: ResearchTier) => {
    setSelectedTier(tier);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Research Processor Selection</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">
              Allocate compute based on task complexity
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pricing Breakdown */}
        <div className="px-8 py-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              Pricing breakdown
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Select your research processor. All deep research will use your selected tier.
            </p>
          </div>

          {/* Pricing Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Processor
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Cost (per 1K requests)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Best for
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Latency
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {RESEARCH_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;

                  // Latency estimates
                  const latencyMap: Record<string, string> = {
                    'lite': '5s-60s',
                    'base': '15s-100s',
                    'core': '1min-5min',
                    'core2x': '2min-5min',
                    'pro': '3min-9min',
                    'ultra': '5min-25min',
                    'ultra2x': '5min-25min',
                    'ultra4x': '8min-30min',
                    'ultra8x': '8min-30min',
                  };

                  return (
                    <tr
                      key={tier.id}
                      className={`
                        border-b border-neutral-200 dark:border-neutral-700 transition-colors
                        ${isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/30'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }
                      `}
                    >
                      {/* Processor Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {tier.name}
                          </span>
                          {isSelected && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                              SELECTED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cost */}
                      <td className="py-4 px-4">
                        <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          ${tier.price.toFixed(2)}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {tier.description}
                        </span>
                      </td>

                      {/* Latency */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {latencyMap[tier.id] || '5s-60s'}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleSelectTier(tier.id)}
                          className={`
                            px-4 py-2 rounded-lg font-medium transition-all duration-200
                            ${isSelected
                              ? 'bg-blue-600 text-white cursor-default'
                              : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:scale-105'
                            }
                          `}
                        >
                          {isSelected ? 'Current' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-8 py-6 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 mt-1">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                How Research Tiers Work
              </p>
              <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                <li>• <strong>Quick Research</strong> always uses Lite tier (fastest, cheapest)</li>
                <li>• <strong>Deep Research</strong> uses your selected tier (more comprehensive)</li>
                <li>• Your selection persists across sessions</li>
                <li>• Change anytime by clicking the pricing button</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="px-8 py-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
