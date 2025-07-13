/**
 * Shared response utilities for MCP tools
 * Provides consistent response formatting and error handling across all tools
 */

export interface MCPResponse {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(message: string): MCPResponse {
  return {
    content: [{
      type: 'text' as const,
      text: message,
    }],
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(operation: string, error: unknown): MCPResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return {
    content: [{
      type: 'text' as const,
      text: `Error ${operation}: ${errorMessage}`,
    }],
    isError: true,
  };
}
