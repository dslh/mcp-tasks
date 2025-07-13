/**
 * Central task status handling utilities
 * Provides consistent status-to-checkbox mapping, parsing, and validation
 */

export type TaskStatus = 'new' | 'completed' | 'closed';

/**
 * Maps task status to checkbox character
 */
export function getStatusChar(status: TaskStatus): string {
  switch (status) {
    case 'completed':
      return 'x';
    case 'closed':
      return '-';
    case 'new':
    default:
      return ' ';
  }
}

/**
 * Parses checkbox character to task status
 */
export function parseStatusChar(char: string): TaskStatus {
  switch (char) {
    case 'x':
      return 'completed';
    case '-':
      return 'closed';
    case ' ':
    default:
      return 'new';
  }
}

/**
 * Gets the full checkbox string for a task status
 */
export function getTaskCheckbox(status: TaskStatus): string {
  return `- [${getStatusChar(status)}]`;
}

/**
 * Checks if a status represents a finished task
 */
export function isFinishedStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'closed';
}

/**
 * Gets display string for status with icon
 */
export function getStatusDisplay(status: TaskStatus): string {
  switch (status) {
    case 'completed':
      return 'completed [x]';
    case 'closed':
      return 'closed [-]';
    case 'new':
    default:
      return 'new [ ]';
  }
}

/**
 * Validates that a string is a valid task status
 */
export function isValidStatus(status: string): status is TaskStatus {
  return status === 'new' || status === 'completed' || status === 'closed';
}
