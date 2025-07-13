import { describe, expect, test } from 'bun:test';
import { createSuccessResponse, createErrorResponse, type MCPResponse } from '../../src/utils/responses';

describe('response utilities', () => {
  describe('createSuccessResponse', () => {
    test('should create proper success response structure', () => {
      const result = createSuccessResponse('Task completed successfully');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Task completed successfully',
        }],
      });
      expect(result.isError).toBeUndefined();
    });

    test('should handle empty message', () => {
      const result = createSuccessResponse('');

      expect(result.content[0].text).toBe('');
    });
  });

  describe('createErrorResponse', () => {
    test('should create proper error response with Error object', () => {
      const error = new Error('File not found');
      const result = createErrorResponse('reading file', error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Error reading file: File not found',
        }],
        isError: true,
      });
    });

    test('should handle non-Error exceptions', () => {
      const result = createErrorResponse('parsing data', 'Invalid JSON');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Error parsing data: Unknown error',
        }],
        isError: true,
      });
    });

    test('should handle null/undefined errors', () => {
      const result = createErrorResponse('processing request', null);

      expect(result.content[0].text).toBe('Error processing request: Unknown error');
    });
  });

  describe('MCPResponse interface compliance', () => {
    test('success responses should match MCPResponse interface', () => {
      const response: MCPResponse = createSuccessResponse('test');

      expect(response.content).toBeArray();
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
    });

    test('error responses should match MCPResponse interface', () => {
      const response: MCPResponse = createErrorResponse('test', new Error('test'));

      expect(response.content).toBeArray();
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(response.isError).toBe(true);
    });
  });
});
