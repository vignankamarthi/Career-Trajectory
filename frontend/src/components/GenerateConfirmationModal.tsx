/**
 * Generate Confirmation Modal
 *
 * Confirms timeline generation before starting the 4-agent workflow.
 * Shows estimated cost if available.
 */

interface GenerateConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  estimatedCost?: number;
}

export default function GenerateConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  estimatedCost,
}: GenerateConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg p-6 max-w-md w-full shadow-xl border border-neutral-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Generate Timeline
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Ready to create your personalized career trajectory plan.
          </p>
        </div>

        {estimatedCost !== undefined && (
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Estimated Cost:
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                ${estimatedCost.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-green-500/30"
          >
            Generate
          </button>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-4">
          This will run the full 4-agent workflow to create your timeline.
        </p>
      </div>
    </div>
  );
}
