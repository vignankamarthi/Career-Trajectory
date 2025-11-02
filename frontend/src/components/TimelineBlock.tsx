import { Block } from '../lib/api';

interface TimelineBlockProps {
  block: Block;
  onClick: () => void;
  isResearching?: boolean;
  isResearchComplete?: boolean;
}

/**
 * Individual block visualization with BUBBLE HOVER EFFECT + ASYNC RESEARCH INDICATORS
 * - Color-coded by status
 * - Dark mode support
 * - Zoom/scale on hover (fancy bubble effect)
 * - Pulsing blue dot when research in progress
 * - Green glow animation when research completes
 */
function TimelineBlock({ block, onClick, isResearching = false, isResearchComplete = false }: TimelineBlockProps) {
  // Status colors with dark mode variants
  const statusColors = {
    not_started: 'bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300',
    in_progress: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300',
    completed: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
  };

  const colorClass = statusColors[block.status || 'not_started'];

  // Calculate width based on duration (relative)
  const widthClass = block.duration_years >= 5 ? 'min-w-64' : 'min-w-48';

  // Add green border when research complete
  const researchBorder = isResearchComplete ? 'border-green-500 dark:border-green-400' : '';

  // Add green glow animation when research completes
  const researchGlow = isResearchComplete ? 'animate-glow-green' : '';

  return (
    <button
      onClick={onClick}
      className={`
        relative
        ${widthClass} px-4 py-3 rounded-xl border-2
        ${isResearchComplete ? researchBorder : colorClass}
        ${researchGlow}
        text-left flex flex-col gap-1
        transition-all duration-300 ease-out
        hover:shadow-2xl hover:scale-110 hover:z-10
        hover:-translate-y-1
        cursor-pointer
      `}
    >
      {/* Pulsing blue dot for researching */}
      {isResearching && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-pulse-dot shadow-lg" />
      )}

      <div className="font-semibold text-sm text-center">{block.title}</div>
      <div className="text-xs opacity-75 text-left">
        Age {block.start_age} - {block.end_age}
      </div>
      <div className="text-xs font-medium text-left">
        {block.duration_years} {block.duration_years === 1 ? 'year' : 'years'}
      </div>
      {block.research_data && (
        <div className="text-xs mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
          </svg>
          <span>Researched</span>
        </div>
      )}
    </button>
  );
}

export default TimelineBlock;
