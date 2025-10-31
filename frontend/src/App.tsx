import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import Navigation from './components/Navigation';
import ConversationalConfigView from './views/ConversationalConfigView';
import TimelineView from './views/TimelineView';

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

function App() {
  const [phase, setPhase] = useState<AppPhase>('configuration');
  const [timelineId, setTimelineId] = useState<string | null>(null);

  const handleTimelineCreated = (id: string) => {
    setTimelineId(id);
    setPhase('timeline');
  };

  const handleResetTimeline = () => {
    setTimelineId(null);
    setPhase('configuration');
  };

  return (
    <ThemeProvider>
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
            />
          )}
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
