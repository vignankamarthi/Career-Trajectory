import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../lib/api';
import ErrorModal from '../components/ErrorModal';
import GenerateConfirmationModal from '../components/GenerateConfirmationModal';

/**
 * Conversational Configuration View
 *
 * New 4-agent workflow with ChatGPT-style interface:
 * - Collapsible sidebar with timeline history (max 15) and trash (max 5)
 * - Chat interface with confidence progress bar
 * - Generate button (always visible, enabled at >=90%)
 * - File upload support
 */

interface ConversationalConfigViewProps {
  onTimelineCreated: (timelineId: string) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TimelineItem {
  id: string;
  user_name: string;
  end_goal: string;
  created_at: string;
}

interface UserErrorResponse {
  type: 'user_error';
  severity: 'info' | 'warning' | 'error' | 'critical';
  userMessage: string;
  suggestions: string[];
  field?: string;
  code?: string;
}

const CONVERSATION_STORAGE_KEY = 'career-trajectory-conversation';

interface PersistedConversationState {
  contextId: string | null;
  messages: Message[];
  confidence: number;
  showInitialForm: boolean;
  isReadyToGenerate: boolean;
  initialFormData: {
    user_name: string;
    start_age: number;
    end_age: number;
    end_goal: string;
    num_layers: number;
  };
}

function ConversationalConfigView({ onTimelineCreated }: ConversationalConfigViewProps) {
  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [contextId, setContextId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);
  const [error, setError] = useState<UserErrorResponse | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initial form state
  const [showInitialForm, setShowInitialForm] = useState(true);
  const [initialFormData, setInitialFormData] = useState({
    user_name: '',
    start_age: 14,
    end_age: 18,
    end_goal: '',
    num_layers: 2,
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [chatFiles, setChatFiles] = useState<File[]>([]); // Files for chat messages

  // Timeline history and trash
  const [timelines, setTimelines] = useState<TimelineItem[]>([]);
  const [trash, setTrash] = useState<TimelineItem[]>([]);
  const [activeView, setActiveView] = useState<'timelines' | 'trash'>('timelines');

  // Ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted conversation state on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (savedState) {
        const parsed: PersistedConversationState = JSON.parse(savedState);
        setContextId(parsed.contextId);
        setMessages(parsed.messages);
        setConfidence(parsed.confidence);
        setShowInitialForm(parsed.showInitialForm);
        setIsReadyToGenerate(parsed.isReadyToGenerate);
        setInitialFormData(parsed.initialFormData);
      }
    } catch (error) {
      console.error('Failed to load conversation state:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save conversation state to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized) {
      const stateToSave: PersistedConversationState = {
        contextId,
        messages,
        confidence,
        showInitialForm,
        isReadyToGenerate,
        initialFormData,
      };
      localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [contextId, messages, confidence, showInitialForm, isReadyToGenerate, initialFormData, isInitialized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch timeline history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await apiClient.configureWithContext.history();
      setTimelines(response.timelines);
      setTrash(response.trash);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check if we've reached the 15-timeline limit
    if (timelines.length >= 15) {
      setError({
        type: 'user_error',
        severity: 'warning',
        userMessage: 'Timeline limit reached.',
        suggestions: [
          `You have the maximum of 15 timelines.`,
          'Please delete one from the Timelines tab before creating a new one.',
        ],
      });
      return;
    }

    setIsConversing(true);

    try {
      const response = await apiClient.configureWithContext.init(
        initialFormData,
        uploadedFiles.length > 0 ? uploadedFiles : undefined
      );
      setContextId(response.context_id);
      setConfidence(response.confidence_score);

      // ALWAYS enter chat (backend now always returns chat-ready state)
      setShowInitialForm(false);
      setIsReadyToGenerate(response.ready_for_generation || response.confidence_score >= 90);

      // Add first assistant message to chat
      setMessages([
        {
          role: 'assistant',
          content: response.next_question,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      // Handle UserError responses from backend
      if (err.response?.data?.type === 'user_error') {
        setError(err.response.data);
      } else {
        setError({
          type: 'user_error',
          severity: 'error',
          userMessage: err.message || 'Failed to initialize.',
          suggestions: ['Check your internet connection', 'Try refreshing the page'],
        });
      }
    } finally {
      setIsConversing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !contextId) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    const filesToSend = chatFiles;
    setChatFiles([]); // Clear files immediately after capturing them
    setIsConversing(true);
    setError(null);

    try {
      const response = await apiClient.configureWithContext.clarify(
        contextId,
        userMessage.content,
        filesToSend.length > 0 ? filesToSend : undefined
      );
      setConfidence(response.confidence_score);

      if (response.ready_for_generation) {
        // Ready to generate!
        setIsReadyToGenerate(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I have all the information I need! Your planning confidence is high. Click 'Generate Timeline' when you're ready.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        // Continue conversation
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.next_question,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      if (err.response?.data?.type === 'user_error') {
        setError(err.response.data);
      } else {
        setError({
          type: 'user_error',
          severity: 'error',
          userMessage: err.message || 'Failed to send message.',
          suggestions: ['Check your internet connection', 'Try sending again'],
        });
      }
    } finally {
      setIsConversing(false);
    }
  };

  const handleGenerateClick = () => {
    if (!contextId) return;

    // Check if we've reached the 15-timeline limit
    if (timelines.length >= 15) {
      setError({
        type: 'user_error',
        severity: 'warning',
        userMessage: 'Timeline limit reached.',
        suggestions: [
          `You have the maximum of 15 timelines.`,
          'Please delete one from the Timelines tab before creating a new one.',
        ],
      });
      return;
    }

    // Show confirmation modal
    setShowGenerateModal(true);
  };

  const handleGenerateConfirm = async () => {
    if (!contextId) return;

    setShowGenerateModal(false);
    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.configureWithContext.generate(contextId);
      await fetchHistory(); // Refresh timeline list

      // Clear conversation state from localStorage on successful generation
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);

      onTimelineCreated(response.timeline_id);
    } catch (err: any) {
      if (err.response?.data?.type === 'user_error') {
        setError(err.response.data);
      } else {
        setError({
          type: 'user_error',
          severity: 'error',
          userMessage: err.message || 'Failed to generate timeline.',
          suggestions: ['Try again', 'Check your settings in the Pricing tab'],
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteTimeline = async (timelineId: string) => {
    try {
      await apiClient.configureWithContext.deleteTimeline(timelineId);
      await fetchHistory();
    } catch (err) {
      console.error('Failed to delete timeline:', err);
    }
  };

  const handleRestoreTimeline = async (timelineId: string) => {
    try {
      await apiClient.configureWithContext.restoreTimeline(timelineId);
      await fetchHistory();
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(err.response.data.error);
      } else {
        console.error('Failed to restore timeline:', err);
      }
    }
  };

  const handlePermanentDelete = async (timelineId: string) => {
    if (!confirm('Permanently delete this timeline? This cannot be undone.')) return;

    try {
      await apiClient.configureWithContext.permanentDeleteTimeline(timelineId);
      await fetchHistory();
    } catch (err) {
      console.error('Failed to permanently delete timeline:', err);
    }
  };

  const handleBackToHome = () => {
    // Navigate back to home without clearing conversation state
    setShowInitialForm(true);
  };

  const handleContinueChat = () => {
    // Resume saved conversation
    setShowInitialForm(false);
  };

  const handleStartNewChat = () => {
    // Clear conversation state and start fresh
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setContextId(null);
    setMessages([]);
    setConfidence(0);
    setIsReadyToGenerate(false);
    setInitialFormData({
      user_name: '',
      start_age: 14,
      end_age: 18,
      end_goal: '',
      num_layers: 2,
    });
    setUploadedFiles([]);
    setChatFiles([]);
    setShowInitialForm(true);
  };

  // Check if there's a saved conversation
  const hasSavedConversation = contextId !== null && messages.length > 0;

  return (
    <div className="h-screen flex bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Career Trajectory Builder</h2>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveView('timelines')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeView === 'timelines'
                ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            Timelines ({timelines.length}/15)
          </button>
          <button
            onClick={() => setActiveView('trash')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeView === 'trash'
                ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            Trash ({trash.length}/5)
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'timelines' ? (
            <div className="p-2 space-y-1">
              {timelines.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 p-2">No timelines yet</p>
              ) : (
                timelines.map((timeline) => (
                  <div
                    key={timeline.id}
                    className="group p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    onClick={() => onTimelineCreated(timeline.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {timeline.user_name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {timeline.end_goal}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTimeline(timeline.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2 text-neutral-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {trash.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 p-2">Trash is empty</p>
              ) : (
                trash.map((timeline) => (
                  <div
                    key={timeline.id}
                    className="group p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {timeline.user_name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {timeline.end_goal}
                        </p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleRestoreTimeline(timeline.id)}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-green-500"
                          title="Restore"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(timeline.id)}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600"
                          title="Permanently Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Chat Content */}
        <div className="flex-1 flex flex-col">
        {/* Header with Sidebar Toggle and Confidence Bar */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {!showInitialForm && (
                <button
                  onClick={handleBackToHome}
                  className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  Home
                </button>
              )}
            </div>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 text-center flex-1">
              Career Trajectory Builder
            </h1>
            <div className="w-6" />
          </div>

          {/* Confidence Progress Bar */}
          {!showInitialForm && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Planning Confidence</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{confidence}%</span>
              </div>
              <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    confidence >= 90
                      ? 'bg-green-500'
                      : confidence >= 75
                      ? 'bg-yellow-500'
                      : 'bg-neutral-400'
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {showInitialForm ? (
            // Initial Configuration Form
            <div className="max-w-2xl mx-auto">
              {/* Continue or Start New Chat Section */}
              {hasSavedConversation && (
                <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                    You have a conversation in progress
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={handleContinueChat}
                      className="flex-1 px-4 py-2.5 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium rounded-lg transition-colors"
                    >
                      Continue Chat
                    </button>
                    <button
                      onClick={handleStartNewChat}
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-medium rounded-lg transition-colors"
                    >
                      Start New Chat
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleInitialSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={initialFormData.user_name}
                    onChange={(e) =>
                      setInitialFormData({ ...initialFormData, user_name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500"
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Starting Age
                    </label>
                    <select
                      value={initialFormData.start_age}
                      onChange={(e) =>
                        setInitialFormData({ ...initialFormData, start_age: parseInt(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg"
                    >
                      <option value={10}>10 (Middle School)</option>
                      <option value={14}>14 (High School)</option>
                      <option value={18}>18 (Post-Secondary)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Target Age
                    </label>
                    <input
                      type="number"
                      value={initialFormData.end_age}
                      onChange={(e) =>
                        setInitialFormData({ ...initialFormData, end_age: parseInt(e.target.value) })
                      }
                      min={initialFormData.start_age + 4}
                      max={60}
                      placeholder="Maximum 60"
                      className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg"
                      required
                    />
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Max age: 60 | Must be at least 4 years after starting age
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    What's Your Goal?
                  </label>
                  <textarea
                    value={initialFormData.end_goal}
                    onChange={(e) =>
                      setInitialFormData({ ...initialFormData, end_goal: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg"
                    placeholder="e.g., Get into MIT for Computer Science"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Planning Detail Level
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <input
                        type="radio"
                        value={2}
                        checked={initialFormData.num_layers === 2}
                        onChange={(e) =>
                          setInitialFormData({ ...initialFormData, num_layers: parseInt(e.target.value) })
                        }
                        className="mr-3"
                      />
                      <span className="text-neutral-900 dark:text-neutral-100">2 Layers</span>
                    </label>
                    <label className="flex items-center cursor-pointer p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <input
                        type="radio"
                        value={3}
                        checked={initialFormData.num_layers === 3}
                        onChange={(e) =>
                          setInitialFormData({ ...initialFormData, num_layers: parseInt(e.target.value) })
                        }
                        className="mr-3"
                      />
                      <span className="text-neutral-900 dark:text-neutral-100">3 Layers</span>
                    </label>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Upload Files (Optional)
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          Upload resume, transcripts, or other files
                        </span>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          if (e.target.files) {
                            setUploadedFiles(Array.from(e.target.files));
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
                          >
                            <span className="text-sm text-neutral-900 dark:text-neutral-100 truncate">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
                              }}
                              className="text-neutral-500 hover:text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Upload files to provide additional context (resume, transcripts, etc.)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isConversing}
                  className="w-full bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:bg-neutral-400 text-white dark:text-neutral-900 font-medium py-3 px-6 rounded-lg"
                >
                  {isConversing ? 'Starting...' : 'Start Planning'}
                </button>
              </form>
            </div>
          ) : (
            // Chat Messages
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                        : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {/* Thinking/Loading Indicator */}
              {isConversing && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-4 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {!showInitialForm && (
          <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-4">
            <div className="max-w-3xl mx-auto">
              {/* Selected Chat Files Display */}
              {chatFiles.length > 0 && (
                <div className="mb-3 space-y-1">
                  {chatFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                      <span className="text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setChatFiles(chatFiles.filter((_, i) => i !== index));
                        }}
                        className="text-neutral-500 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* File Upload Button */}
                <label className="cursor-pointer p-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg transition-colors">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files) {
                        setChatFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                    className="hidden"
                    disabled={isConversing || isGenerating}
                  />
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </label>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-neutral-500 resize-none"
                  disabled={isConversing || isGenerating}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isConversing || isGenerating}
                  className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:bg-neutral-400 text-white dark:text-neutral-900 font-medium rounded-lg"
                >
                  Send
                </button>

                <button
                  onClick={handleGenerateClick}
                  disabled={!isReadyToGenerate || isGenerating || confidence < 90}
                  className={`px-6 py-2.5 font-medium rounded-lg transition-all ${
                    confidence >= 90
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50'
                      : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {isGenerating ? 'Generating...' : 'Generate Timeline'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Files Sidebar (Claude-style) */}
        {!showInitialForm && (uploadedFiles.length > 0 || chatFiles.length > 0) && (
          <div className="w-64 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Uploaded Files
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Files in context
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Files from initial form */}
              {uploadedFiles.map((file, index) => (
                <div
                  key={`initial-${index}`}
                  className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-neutral-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ErrorModal error={error} onClose={() => setError(null)} />

      <GenerateConfirmationModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onConfirm={handleGenerateConfirm}
        onChangePricing={() => {
          setShowGenerateModal(false);
          // User will manually navigate to pricing tab
          alert('Please use the Pricing tab to change your model selection, then return here to generate.');
        }}
        selectedModel="Claude Sonnet 4" // Using Sonnet 4 (claude-sonnet-4-20250514)
        estimatedCost={0.0045} // TODO: Calculate based on actual model and context
      />
    </div>
  );
}

export default ConversationalConfigView;
