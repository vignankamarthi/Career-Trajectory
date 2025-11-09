/**
 * RESEARCH NOTIFICATION COMPONENT
 * Toast notifications for async research updates
 */

import { useEffect, useState } from 'react';
import { ResearchUpdate } from '../hooks/useWebSocket';

interface Props {
  update: ResearchUpdate;
  onDismiss: () => void;
}

export function ResearchNotification({ update, onDismiss }: Props) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) {
    return null;
  }

  const getIcon = () => {
    switch (update.type) {
      case 'research_started':
        return 'STARTED';
      case 'research_progress':
        return 'PROGRESS';
      case 'research_complete':
        return 'COMPLETE';
      case 'research_error':
        return 'ERROR';
      default:
        return 'UPDATE';
    }
  };

  const getTitle = () => {
    switch (update.type) {
      case 'research_started':
        return 'Research Started';
      case 'research_progress':
        return 'Research in Progress';
      case 'research_complete':
        return 'Research Complete';
      case 'research_error':
        return 'Research Failed';
      default:
        return 'Update';
    }
  };

  const getBgColor = () => {
    switch (update.type) {
      case 'research_started':
        return 'bg-blue-900/90 border-blue-500';
      case 'research_progress':
        return 'bg-yellow-900/90 border-yellow-500';
      case 'research_complete':
        return 'bg-green-900/90 border-green-500';
      case 'research_error':
        return 'bg-red-900/90 border-red-500';
      default:
        return 'bg-neutral-900/90 border-neutral-500';
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-xl border-2 ${getBgColor()}
                  backdrop-blur-sm shadow-2xl z-50 animate-slide-in-right
                  transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getIcon()}</div>
        <div className="flex-1">
          <h3 className="font-bold text-white mb-1">
            {getTitle()}
          </h3>
          <p className="text-sm text-neutral-300">
            {update.message || update.blockTitle}
          </p>
          {update.estimatedTime && (
            <p className="text-xs text-neutral-400 mt-1">
              Estimated time: ~{update.estimatedTime}s
            </p>
          )}
          {update.processor && (
            <p className="text-xs text-neutral-400">
              Processor: {update.processor.toUpperCase()}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * RESEARCH NOTIFICATION CONTAINER
 * Manages multiple toast notifications
 */

interface NotificationContainerProps {
  updates: ResearchUpdate[];
  onDismiss: (index: number) => void;
}

export function ResearchNotificationContainer({ updates, onDismiss }: NotificationContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {updates.map((update, index) => (
        <ResearchNotification
          key={`${update.type}-${update.taskId}-${index}`}
          update={update}
          onDismiss={() => onDismiss(index)}
        />
      ))}
    </div>
  );
}
