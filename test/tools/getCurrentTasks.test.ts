import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { name, config, handler } from 'src/tools/getCurrentTasks';
import * as fileOperations from 'src/utils/fileOperations';

describe('getCurrentTasks tool', () => {
  beforeEach(() => {
    // Set up mocks for this test
    spyOn(fileOperations, 'readFile').mockReturnValue('default content');
  });

  afterEach(() => {
    // Clear all spies
    mock.restore();
  });

  describe('tool metadata', () => {
    it('should export correct tool name', () => {
      expect(name).toBe('get_current_tasks');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Get Current Tasks',
        description: 'Retrieve all current, recent, and upcoming tasks',
        inputSchema: {},
      });
    });
  });

  describe('handler function', () => {
    describe('successful file read', () => {
      it('should return current file content in proper MCP format', () => {
        const mockContent = 'test file content';

        fileOperations.readFile.mockReturnValue(mockContent);

        const result = handler();

        expect(fileOperations.readFile).toHaveBeenCalledWith('current');
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: mockContent,
          }],
        });
      });
    });

    describe('error handling', () => {
      it('should handle Error objects', () => {
        const error = new Error('File not found');

        fileOperations.readFile.mockImplementation(() => {
          throw error;
        });

        const result = handler();

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error reading current task list: File not found',
          }],
          isError: true,
        });
      });

      it('should handle non-Error exceptions', () => {
        fileOperations.readFile.mockImplementation(() => {
          // eslint-disable-next-line no-throw-literal
          throw 'String error';
        });

        const result = handler();

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error reading current task list: Unknown error',
          }],
          isError: true,
        });
      });
    });

    describe('MCP response structure validation', () => {
      it('should always return content as array', () => {
        fileOperations.readFile.mockReturnValue('test content');

        const result = handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
      });

      it('should always use type "text" for content items', () => {
        fileOperations.readFile.mockReturnValue('test content');

        const result = handler();

        expect(result.content[0].type).toBe('text');
      });

      it('should include text field in content items', () => {
        const testContent = 'test content';

        fileOperations.readFile.mockReturnValue(testContent);

        const result = handler();

        expect(result.content[0]).toHaveProperty('text');
        expect(result.content[0].text).toBe(testContent);
      });

      it('should not include isError in successful responses', () => {
        fileOperations.readFile.mockReturnValue('test content');

        const result = handler();

        expect(result).not.toHaveProperty('isError');
      });

      it('should include isError: true in error responses', () => {
        fileOperations.readFile.mockImplementation(() => {
          throw new Error('test error');
        });

        const result = handler();

        expect(result.isError).toBe(true);
      });

      it('should maintain consistent response structure for errors', () => {
        fileOperations.readFile.mockImplementation(() => {
          throw new Error('test error');
        });

        const result = handler();

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });
    });

    describe('file reading behavior', () => {
      it('should call readFile with correct filename', () => {
        fileOperations.readFile.mockReturnValue('content');

        handler();

        expect(fileOperations.readFile).toHaveBeenCalledWith('current');
        expect(fileOperations.readFile).toHaveBeenCalledTimes(1);
      });
    });
  });
});
