import { Block } from '../lib/api';
import TimelineBlock from './TimelineBlock';

interface LayerViewProps {
  layerNumber: number;
  blocks: Block[];
  onBlockClick: (block: Block) => void;
}

/**
 * Displays all blocks in a layer as a horizontal timeline
 * Dark mode support + responsive layout
 */
function LayerView({ layerNumber, blocks, onBlockClick }: LayerViewProps) {
  // Time bin labels for visual indication
  const timeBinLabel = {
    1: '4-10 years per block',
    2: '0-5 years per block',
    3: '0-1 years per block',
  }[layerNumber];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Layer {layerNumber}
          </h3>
          {/* Time bin indicator */}
          <span className="px-2 py-1 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded border border-neutral-300 dark:border-neutral-700">
            {timeBinLabel}
          </span>
        </div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </div>
      </div>

      {blocks.length > 0 ? (
        <div className="flex gap-6 overflow-x-auto pb-4 justify-center">
          {blocks.map((block) => (
            <TimelineBlock
              key={block.id}
              block={block}
              onClick={() => onBlockClick(block)}
            />
          ))}
        </div>
      ) : (
        <div className="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-center">
          <p className="text-neutral-600 dark:text-neutral-400">No blocks in this layer yet</p>
        </div>
      )}
    </div>
  );
}

export default LayerView;
