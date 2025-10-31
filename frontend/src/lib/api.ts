import axios from 'axios';

/**
 * API Client for Career Trajectory Backend
 * Handles all communication with Express backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds (some operations like research can take time)
});

// Types (matching backend validation schemas)

export interface Timeline {
  id?: string;
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
  global_research_model?: 'lite' | 'pro';
  created_at?: string;
  updated_at?: string;
}

export interface Layer {
  id?: string;
  timeline_id: string;
  layer_number: number;
  title: string;
  start_age: number;
  end_age: number;
  created_at?: string;
}

export interface Block {
  id?: string;
  layer_id: string;
  layer_number: number;
  position?: number;
  title: string;
  description?: string;
  start_age: number;
  end_age: number;
  duration_years: number;
  status?: 'not_started' | 'in_progress' | 'completed';
  research_data?: string; // JSON string
  user_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationMessage {
  id?: string;
  timeline_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SaveHistoryEntry {
  id?: string;
  timeline_id: string;
  state_snapshot: string; // JSON string
  save_type: 'save_only' | 'lite' | 'refactor';
  research_cost?: number;
  timestamp?: string;
}

// API Methods

export const apiClient = {
  // Health Check
  health: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Timeline Operations
  timelines: {
    create: async (timeline: Omit<Timeline, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await api.post<Timeline>('/api/timelines', timeline);
      return response.data;
    },

    get: async (id: string) => {
      const response = await api.get<Timeline>(`/api/timelines/${id}`);
      return response.data;
    },

    update: async (id: string, updates: Partial<Timeline>) => {
      const response = await api.patch<Timeline>(`/api/timelines/${id}`, updates);
      return response.data;
    },

    delete: async (id: string) => {
      const response = await api.delete(`/api/timelines/${id}`);
      return response.data;
    },

    list: async () => {
      const response = await api.get<Timeline[]>('/api/timelines');
      return response.data;
    },

    // Export timeline in LLM-friendly format
    export: async (id: string) => {
      const response = await api.get(`/api/timelines/${id}/export`, {
        responseType: 'blob',
      });
      return response.data;
    },
  },

  // Layer Operations
  layers: {
    create: async (layer: Omit<Layer, 'id' | 'created_at'>) => {
      const response = await api.post<Layer>('/api/layers', layer);
      return response.data;
    },

    getByTimeline: async (timelineId: string) => {
      const response = await api.get<Layer[]>(`/api/layers/timeline/${timelineId}`);
      return response.data;
    },

    update: async (id: string, updates: Partial<Layer>) => {
      const response = await api.patch<Layer>(`/api/layers/${id}`, updates);
      return response.data;
    },

    delete: async (id: string) => {
      const response = await api.delete(`/api/layers/${id}`);
      return response.data;
    },
  },

  // Block Operations
  blocks: {
    create: async (block: Omit<Block, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await api.post<Block>('/api/blocks', block);
      return response.data;
    },

    getByLayer: async (layerId: string) => {
      const response = await api.get<Block[]>(`/api/blocks/layer/${layerId}`);
      return response.data;
    },

    update: async (id: string, updates: Partial<Block>) => {
      const response = await api.patch<Block>(`/api/blocks/${id}`, updates);
      return response.data;
    },

    delete: async (id: string) => {
      const response = await api.delete(`/api/blocks/${id}`);
      return response.data;
    },

    // Research a specific block
    research: async (id: string, processor: 'base' | 'pro' = 'pro') => {
      const response = await api.post(`/api/blocks/${id}/research`, { processor });
      return response.data;
    },
  },

  // Chat Operations (Conversational Assistant)
  chat: {
    send: async (timelineId: string, message: string) => {
      const response = await api.post<ConversationMessage>('/api/chat', {
        timeline_id: timelineId,
        message,
      });
      return response.data;
    },

    getHistory: async (timelineId: string) => {
      const response = await api.get<ConversationMessage[]>(`/api/chat/${timelineId}`);
      return response.data;
    },
  },

  // Save Operations (with modes)
  save: {
    saveOnly: async (timelineId: string) => {
      const response = await api.post('/api/save/save-only', { timeline_id: timelineId });
      return response.data;
    },

    liteCheck: async (timelineId: string) => {
      const response = await api.post('/api/save/lite', { timeline_id: timelineId });
      return response.data;
    },

    refactor: async (timelineId: string) => {
      const response = await api.post('/api/save/refactor', { timeline_id: timelineId });
      return response.data;
    },

    getHistory: async (timelineId: string) => {
      const response = await api.get<SaveHistoryEntry[]>(`/api/save/history/${timelineId}`);
      return response.data;
    },
  },

  // Configuration Agent (Timeline generation)
  configure: {
    generateTimeline: async (config: Omit<Timeline, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await api.post('/api/configure/generate', config);
      return response.data;
    },
  },

  // Configuration with Context (New 4-agent workflow)
  configureWithContext: {
    // Initialize conversation with Pre-Validation Agent
    init: async (config: {
      user_name: string;
      start_age: number;
      end_age: number;
      end_goal: string;
      num_layers: number;
    }, files?: File[]) => {
      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append('user_name', config.user_name);
        formData.append('start_age', config.start_age.toString());
        formData.append('end_age', config.end_age.toString());
        formData.append('end_goal', config.end_goal);
        formData.append('num_layers', config.num_layers.toString());

        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await api.post('/api/configure-with-context/init', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } else {
        const response = await api.post('/api/configure-with-context/init', config);
        return response.data;
      }
    },

    // Continue conversational clarification
    clarify: async (contextId: string, userMessage: string, files?: File[]) => {
      const formData = new FormData();
      formData.append('context_id', contextId);
      formData.append('user_message', userMessage);

      if (files) {
        files.forEach((file) => {
          formData.append('files', file);
        });
      }

      const response = await api.post('/api/configure-with-context/clarify', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    // Generate final timeline
    generate: async (contextId: string, confidenceThreshold?: number) => {
      const response = await api.post('/api/configure-with-context/generate', {
        context_id: contextId,
        confidence_threshold: confidenceThreshold,
      });
      return response.data;
    },

    // Get timeline history (max 15 active + 5 deleted)
    history: async () => {
      const response = await api.get('/api/configure-with-context/history');
      return response.data;
    },

    // Delete timeline (soft delete to trash)
    deleteTimeline: async (timelineId: string) => {
      const response = await api.delete(`/api/configure-with-context/timeline/${timelineId}`);
      return response.data;
    },

    // Restore timeline from trash
    restoreTimeline: async (timelineId: string) => {
      const response = await api.post(`/api/configure-with-context/timeline/${timelineId}/restore`);
      return response.data;
    },

    // Permanently delete timeline
    permanentDeleteTimeline: async (timelineId: string) => {
      const response = await api.delete(`/api/configure-with-context/timeline/${timelineId}/permanent`);
      return response.data;
    },
  },
};

export default api;
