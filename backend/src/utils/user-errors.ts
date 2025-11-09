/**
 * User-Facing Error System
 *
 * This is SEPARATE from the Logger system:
 * - Logger = developer tool (logs to files, can be toggled on/off)
 * - UserError = user-facing messages (shown in UI)
 *
 * Hierarchy:
 * - UserErrors ARE logged (Logger.error includes them)
 * - Logger output is NOT shown to users (separate concerns)
 *
 * Usage:
 * ```
 * throw new UserError(
 *   'Target age must be after your starting age.',
 *   ['Choose an age at least 4 years after your starting age'],
 *   'end_age'
 * );
 * ```
 */

import Logger from './logger';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface UserErrorResponse {
  type: 'user_error';
  severity: ErrorSeverity;
  userMessage: string;
  suggestions: string[];
  field?: string;
  code?: string;
}

export class UserError extends Error {
  public severity: ErrorSeverity;
  public userMessage: string;
  public suggestions: string[];
  public field?: string;
  public code?: string;

  constructor(
    userMessage: string,
    suggestions: string[] = [],
    field?: string,
    severity: ErrorSeverity = 'error',
    code?: string
  ) {
    super(userMessage);
    this.name = 'UserError';
    this.userMessage = userMessage;
    this.suggestions = suggestions;
    this.field = field;
    this.severity = severity;
    this.code = code;

    // IMPORTANT: UserErrors ARE logged (but logs are NOT shown to users)
    Logger.error('User-facing error occurred', undefined, {
      severity: this.severity,
      userMessage: this.userMessage,
      field: this.field,
      code: this.code,
      suggestions: this.suggestions,
    });
  }

  /**
   * Convert to API response format
   */
  toResponse(): UserErrorResponse {
    return {
      type: 'user_error',
      severity: this.severity,
      userMessage: this.userMessage,
      suggestions: this.suggestions,
      field: this.field,
      code: this.code,
    };
  }
}

/**
 * Common validation errors
 */
export const ValidationErrors = {
  MISSING_FIELD: (fieldName: string) =>
    new UserError(
      `Please provide your ${fieldName}.`,
      [`The ${fieldName} field is required to continue.`],
      fieldName,
      'error',
      'MISSING_FIELD'
    ),

  INVALID_AGE_RANGE: (startAge: number, endAge: number) =>
    new UserError(
      'Target age must be after your starting age.',
      [
        `Your starting age is ${startAge}.`,
        `Choose a target age at least 4 years later (minimum: ${startAge + 4}).`,
      ],
      'end_age',
      'error',
      'INVALID_AGE_RANGE'
    ),

  AGE_TOO_HIGH: (maxAge: number) =>
    new UserError(
      `Target age cannot exceed ${maxAge}.`,
      [`The maximum allowed age is ${maxAge}.`, 'Please choose a lower target age.'],
      'end_age',
      'error',
      'AGE_TOO_HIGH'
    ),

  INVALID_LAYERS: () =>
    new UserError(
      'Please select 2 or 3 planning layers.',
      ['2 layers is recommended for shorter timelines.', '3 layers is recommended for longer timelines.'],
      'num_layers',
      'error',
      'INVALID_LAYERS'
    ),

  FILE_TOO_LARGE: (filename: string, maxSize: number) =>
    new UserError(
      `File "${filename}" is too large.`,
      [`Maximum file size is ${maxSize}MB.`, 'Please upload a smaller file.'],
      undefined,
      'error',
      'FILE_TOO_LARGE'
    ),

  INVALID_FILE_TYPE: (filename: string, allowedTypes: string[]) =>
    new UserError(
      `File "${filename}" has an invalid type.`,
      [`Allowed types: ${allowedTypes.join(', ')}.`, 'Please upload a supported file.'],
      undefined,
      'error',
      'INVALID_FILE_TYPE'
    ),

  TIMELINE_LIMIT_REACHED: (limit: number) =>
    new UserError(
      `Timeline limit reached.`,
      [
        `You have the maximum of ${limit} timelines.`,
        'Please delete one from the Timelines tab before creating a new one.',
      ],
      undefined,
      'warning',
      'TIMELINE_LIMIT_REACHED'
    ),
};
