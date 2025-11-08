import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ResearchTierProvider } from './contexts/ResearchTierContext';
import Navigation from './components/Navigation';
import ConversationalConfigView from './views/ConversationalConfigView';
import TimelineView from './views/TimelineView';
import { useWebSocket } from './hooks/useWebSocket';
import { ResearchNotificationContainer } from './components/ResearchNotification';
import type { ResearchUpdate } from './hooks/useWebSocket';

/**
 * Main App Component
 *
 * Manages the application flow:
 * 1. Configuration phase (Configuration Agent creates timeline)
 * 2. Timeline management phase (user interacts with timeline, blocks, and chat)
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export type AppPhase = 'configuration' | 'timeline';

const STORAGE_KEYS = {
  PHASE: 'career-trajectory-phase',
  TIMELINE_ID: 'career-trajectory-timeline-id',
};

function App() {
  const [phase, setPhase] = useState<AppPhase>('configuration');
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ResearchUpdate[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // WebSocket connection for async research updates
  const { isConnected, lastMessage, researchingBlocks, completedBlocks } = useWebSocket();

  // Load state from localStorage on mount
  useEffect(() => {
    const loadPersistedState = () => {
      try {
        const savedPhase = localStorage.getItem(STORAGE_KEYS.PHASE) as AppPhase | null;
        const savedTimelineId = localStorage.getItem(STORAGE_KEYS.TIMELINE_ID);

        if (savedPhase && savedTimelineId) {
          setPhase(savedPhase);
          setTimelineId(savedTimelineId);
        }
      } catch (error) {
        console.error('Failed to load persisted state:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPersistedState();
  }, []);

  // Save phase to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEYS.PHASE, phase);
    }
  }, [phase, isInitialized]);

  // Save timelineId to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      if (timelineId) {
        localStorage.setItem(STORAGE_KEYS.TIMELINE_ID, timelineId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TIMELINE_ID);
      }
    }
  }, [timelineId, isInitialized]);

  // Handle new WebSocket messages
  useEffect(() => {
    if (lastMessage && (
      lastMessage.type === 'research_started' ||
      lastMessage.type === 'research_complete' ||
      lastMessage.type === 'research_error'
    )) {
      setNotifications(prev => [...prev, lastMessage]);
    }
  }, [lastMessage]);

  const handleTimelineCreated = (id: string) => {
    setTimelineId(id);
    setPhase('timeline');
  };

  const handleResetTimeline = () => {
    setTimelineId(null);
    setPhase('configuration');
    // Clear conversation state when resetting to configuration
    localStorage.removeItem('career-trajectory-conversation');
  };

  const handleDismissNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <ThemeProvider>
      <ResearchTierProvider>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-200">
            <Navigation
              showHome={phase === 'timeline'}
              onHomeClick={handleResetTimeline}
            />
            {phase === 'configuration' ? (
              <ConversationalConfigView
                onTimelineCreated={handleTimelineCreated}
              />
            ) : (
              <TimelineView
                timelineId={timelineId!}
                onResetTimeline={handleResetTimeline}
                researchingBlocks={researchingBlocks}
                completedBlocks={completedBlocks}
              />
            )}

            {/* Research notification toasts */}
            <ResearchNotificationContainer
              updates={notifications}
              onDismiss={handleDismissNotification}
            />
          </div>
        </QueryClientProvider>
      </ResearchTierProvider>
    </ThemeProvider>
  );
}

export default App;
