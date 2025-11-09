import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, Block } from '../lib/api';
import LayerView from '../components/LayerView';
import BlockEditor from '../components/BlockEditor';

/**
 * Timeline View - FULL TIMELINE DISPLAY (Top-Down Flowchart)
 *
 * Shows all layers at once in vertical flow
 * - Layer 1 (top row) → Layer 2 (middle) → Layer 3 (bottom)
 * - Zoom/bubble hover effects
 * - Dark mode support
 */

interface TimelineViewProps {
  timelineId: string;
  onResetTimeline: () => void;
  researchingBlocks: Set<string>;
  completedBlocks: Set<string>;
}

function TimelineView({ timelineId, onResetTimeline, researchingBlocks, completedBlocks }: TimelineViewProps) {
  const queryClient = useQueryClient();
  const [showChat, setShowChat] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Fetch timeline data
  const { data: timelineData, isLoading, error } = useQuery({
    queryKey: ['timeline', timelineId],
    queryFn: () => apiClient.timelines.get(timelineId),
  });

  // Fetch chat history
  const { data: chatHistory } = useQuery({
    queryKey: ['chat', timelineId],
    queryFn: () => apiClient.chat.getHistory(timelineId),
    enabled: showChat,
  });

  // Load chat history when available
  useEffect(() => {
    if (chatHistory) {
      setChatMessages(chatHistory);
    }
  }, [chatHistory]);

  // Send chat message mutation
  const sendChatMutation = useMutation({
    mutationFn: (message: string) =>
      apiClient.chat.send(timelineId, message),
    onSuccess: (response) => {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: chatMessage },
        { role: 'assistant', content: response.message },
      ]);
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat', timelineId] });
    },
  });

  // Save mutations
  const saveOnlyMutation = useMutation({
    mutationFn: () => apiClient.save.saveOnly(timelineId),
    onSuccess: () => {
      alert('Timeline saved successfully!');
      setShowSaveMenu(false);
    },
  });

  const liteCheckMutation = useMutation({
    mutationFn: () => apiClient.save.liteCheck(timelineId),
    onSuccess: (response) => {
      if (response.validationPassed) {
        alert(`✓ Validation passed! (Cost: $${response.cost.toFixed(4)})`);
      } else {
        alert(`Validation issues found:\n\n${response.validationMessage}\n\nCost: $${response.cost.toFixed(4)}`);
      }
      setShowSaveMenu(false);
    },
  });

  const refactorMutation = useMutation({
    mutationFn: () => apiClient.save.refactor(timelineId),
    onSuccess: (response) => {
      const recommendations = response.recommendations.join('\n\n');
      alert(`Research complete!\n\nRecommendations:\n${recommendations}\n\nCost: $${response.cost.toFixed(4)}`);
      setShowSaveMenu(false);
    },
  });

  // Export timeline mutation
  const exportMutation = useMutation({
    mutationFn: () => apiClient.timelines.export(timelineId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${timeline.user_name}-career-timeline.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      sendChatMutation.mutate(chatMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !timelineData) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Failed to load timeline</p>
          <button
            onClick={onResetTimeline}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create New Timeline
          </button>
        </div>
      </div>
    );
  }

  const { timeline, layers } = timelineData;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{timeline.user_name}'s Timeline</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Goal: {timeline.end_goal} | Age {timeline.start_age}-{timeline.end_age}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Chat Toggle */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showChat
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>

            {/* Save Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSaveMenu(!showSaveMenu)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Save
              </button>

              {showSaveMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 py-2 z-10">
                  <button
                    onClick={() => saveOnlyMutation.mutate()}
                    disabled={saveOnlyMutation.isPending}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">Save Only</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">No AI review</div>
                  </button>
                  <button
                    onClick={() => liteCheckMutation.mutate()}
                    disabled={liteCheckMutation.isPending}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {liteCheckMutation.isPending ? 'Validating...' : 'Lite Check'}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Quick validation (~$0.005)</div>
                  </button>
                  <button
                    onClick={() => refactorMutation.mutate()}
                    disabled={refactorMutation.isPending}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {refactorMutation.isPending ? 'Researching...' : 'Refactor'}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">Deep analysis + research (~$0.15)</div>
                  </button>
                </div>
              )}
            </div>

            {/* Export Button */}
            <button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {exportMutation.isPending ? 'Exporting...' : 'Export for LLM'}
            </button>

            {/* Reset Button */}
            <button
              onClick={onResetTimeline}
              className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium transition-colors"
            >
              New Timeline
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Full Timeline Display (All Layers Vertically) */}
        <div className={`flex-1 p-6 overflow-auto ${showChat ? 'pr-0' : ''} bg-neutral-50 dark:bg-neutral-950`}>
          <div className="w-full space-y-8">
            {/* Render all layers vertically with pyramid scaling effect */}
            {layers.map((layer: any) => {
              // Calculate scale: Layer 1 = 100%, Layer 2 = 90%, Layer 3 = 80%
              const scale = 100 - (layer.layer_number - 1) * 10;

              return (
                <div
                  key={layer.layer_number}
                  className="rounded-lg shadow-lg p-6 border border-neutral-200 dark:border-neutral-800 transition-all"
                  style={{
                    transform: `scale(${scale / 100})`,
                    transformOrigin: 'top center'
                  }}
                >
                  <LayerView
                    layerNumber={layer.layer_number}
                    blocks={layer.blocks}
                    onBlockClick={setSelectedBlock}
                    researchingBlocks={researchingBlocks}
                    completedBlocks={completedBlocks}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-96 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">LLM Assistant</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Ask questions about your timeline</p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.role === 'assistant' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-neutral-600 dark:bg-neutral-700'
                      }`}>
                        <span className="text-white text-xs font-semibold">
                          {msg.role === 'assistant' ? 'LLM' : 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className={`rounded-xl p-3 ${
                          msg.role === 'assistant'
                            ? 'bg-neutral-100 dark:bg-neutral-800'
                            : 'bg-blue-50 dark:bg-blue-950/30'
                        }`}>
                          <p className="text-sm text-neutral-900 dark:text-neutral-100">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask a question..."
                  disabled={sendChatMutation.isPending}
                  className="flex-1 px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={handleSendChat}
                  disabled={sendChatMutation.isPending || !chatMessage.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {sendChatMutation.isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Block Editor Modal */}
      {selectedBlock && (
        <BlockEditor
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onSave={(updatedBlock) => {
            setSelectedBlock(null);
            queryClient.invalidateQueries({ queryKey: ['timeline', timelineId] });
          }}
        />
      )}
    </div>
  );
}

export default TimelineView;
