import { z } from 'zod';

/**
 * Validation schemas using Zod
 * Enforces hard bounds and business logic
 */

// Timeline validation
export const TimelineSchema = z.object({
  id: z.string().uuid().optional(),
  user_name: z.string().min(1, 'Name is required'),
  start_age: z.number().min(10).max(60),
  end_age: z.number().min(10).max(60),
  end_goal: z.string().min(1, 'Goal is required'),
  num_layers: z.number().int().min(2).max(3),
  global_research_model: z.enum(['lite', 'pro']).default('pro'),
}).refine(
  (data) => data.end_age > data.start_age,
  { message: 'End age must be greater than start age' }
);

export type Timeline = z.infer<typeof TimelineSchema>;

// Layer validation
export const LayerSchema = z.object({
  id: z.string().uuid().optional(),
  timeline_id: z.string().uuid(),
  layer_number: z.number().int().min(1).max(3),
  title: z.string().min(1),
  start_age: z.number().min(10).max(60),
  end_age: z.number().min(10).max(60),
}).refine(
  (data) => data.end_age > data.start_age,
  { message: 'Layer end age must be greater than start age' }
);

export type Layer = z.infer<typeof LayerSchema>;

// Block validation with hard bounds
export const BlockSchema = z.object({
  id: z.string().uuid().optional(),
  layer_id: z.string().uuid(),
  layer_number: z.number().int().min(1).max(3),
  position: z.number().int().min(0).default(0),
  title: z.string().min(1),
  description: z.string().optional(),
  start_age: z.number().min(10).max(60),
  end_age: z.number().min(10).max(60),
  duration_years: z.number().min(0).max(10),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
  research_data: z.string().optional(), // JSON string
  user_notes: z.string().optional(),
}).refine(
  (data) => data.end_age > data.start_age,
  { message: 'Block end age must be greater than start age' }
).refine(
  (data) => Math.abs((data.end_age - data.start_age) - data.duration_years) < 0.01,
  { message: 'Duration must match age range' }
).refine(
  (data) => {
    // Layer 1: 4-20 years
    if (data.layer_number === 1) {
      return data.duration_years >= 4.0 && data.duration_years <= 20.0;
    }
    // Layer 2: 0-5 years
    if (data.layer_number === 2) {
      return data.duration_years >= 0.0 && data.duration_years <= 5.0;
    }
    // Layer 3: 0-1 years
    if (data.layer_number === 3) {
      return data.duration_years >= 0.0 && data.duration_years <= 1.0;
    }
    return true;
  },
  (data) => ({
    message: `Layer ${data.layer_number} duration (${data.duration_years} years) violates hard bounds`,
  })
);

export type Block = z.infer<typeof BlockSchema>;

// Metadata (document) validation
export const MetadataSchema = z.object({
  id: z.string().uuid().optional(),
  block_id: z.string().uuid(),
  filename: z.string().min(1),
  file_type: z.string().min(1),
  file_path: z.string().min(1),
  file_size_bytes: z.number().int().min(0),
});

export type Metadata = z.infer<typeof MetadataSchema>;

// Conversation validation
export const ConversationSchema = z.object({
  id: z.string().uuid().optional(),
  timeline_id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export type Conversation = z.infer<typeof ConversationSchema>;

// Save history validation
export const SaveHistorySchema = z.object({
  id: z.string().uuid().optional(),
  timeline_id: z.string().uuid(),
  state_snapshot: z.string().min(1), // JSON string
  save_type: z.enum(['save_only', 'lite', 'refactor']),
  research_cost: z.number().min(0).default(0),
});

export type SaveHistory = z.infer<typeof SaveHistorySchema>;

/**
 * Validate data against schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns error instead of throwing
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
