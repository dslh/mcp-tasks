import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { name, config, handler } from 'src/tools/getTaskBacklog';
import * as fileOperations from 'src/utils/fileOperations';

describe('getTaskBacklog tool', () => {
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
      expect(name).toBe('get_task_backlog');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Get Task Backlog',
        description: 'Retrieve the backlog of as-yet unscheduled tasks',
        inputSchema: {},
      });
    });

    it('should have empty input schema', () => {
      expect(config.inputSchema).toEqual({});
    });
  });

  describe('handler function', () => {
    describe('successful file read', () => {
      it('should return backlog file content in proper MCP format', () => {
        const mockContent = 'test backlog content';

        fileOperations.readFile.mockReturnValue(mockContent);

        const result = handler();

        expect(fileOperations.readFile).toHaveBeenCalledWith('backlog');
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
        const error = new Error('Backlog file not found');

        fileOperations.readFile.mockImplementation(() => {
          throw error;
        });

        const result = handler();

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error reading task backlog: Backlog file not found',
          }],
          isError: true,
        });
      });

      it('should handle non-Error exceptions', () => {
        fileOperations.readFile.mockImplementation(() => {
          throw 'String error';
        });

        const result = handler();

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error reading task backlog: Unknown error',
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

        expect(fileOperations.readFile).toHaveBeenCalledWith('backlog');
        expect(fileOperations.readFile).toHaveBeenCalledTimes(1);
      });
    });
  });
});
