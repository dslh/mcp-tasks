import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/addTask';

// Mock only git operations and dates
const mockCommitChanges = mock(() => Promise.resolve());
const mockGetCurrentDate = mock(() => '2024-01-15');

mock.module('src/utils/git', () => ({
  commitChanges: mockCommitChanges,
}));

mock.module('src/utils/dates', () => ({
  getCurrentDate: mockGetCurrentDate,
}));

describe('addTask tool', () => {
  const testDir = '/tmp/mcp-tasks-test-addtask';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with existing sections
    writeFileSync(join(testDir, 'current.md'), `# Last Week
- [x] Completed task

# This Week
- [ ] Existing current task

# Next Week
- [ ] Existing future task`);

    // Create backlog.md with existing content
    writeFileSync(join(testDir, 'backlog.md'), `# Backlog
- [ ] Existing backlog task added on 2024-01-01`);

    // Reset mocks
    mockCommitChanges.mockClear();
    mockGetCurrentDate.mockReturnValue('2024-01-15');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('tool metadata', () => {
    it('should export correct tool name', () => {
      expect(name).toBe('add_task');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Add Task',
        description: 'Add a new task to the system',
        inputSchema: {
          task_text: expect.any(Object),
          target: expect.any(Object),
          description: expect.any(Object),
        },
      });
    });

    it('should have proper Zod schema for target enum', () => {
      expect(config.inputSchema.target._def.values).toEqual(['backlog', 'current_week', 'next_week']);
    });

    it('should have optional description parameter', () => {
      expect(config.inputSchema.description._def.typeName).toBe('ZodOptional');
    });
  });

  describe('handler function', () => {
    describe('adding tasks to different targets', () => {
      it('should add task to current week', async () => {
        const result = await handler({
          task_text: 'New current task',
          target: 'current_week',
        });

        // Verify file was updated
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] New current task');
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('- [ ] Existing current task');

        // Verify git commit
        expect(mockCommitChanges).toHaveBeenCalledWith('Added task: New current task');

        // Verify response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully added task "New current task" to This Week',
          }],
        });
      });

      it('should add task to next week', async () => {
        const result = await handler({
          task_text: 'New future task',
          target: 'next_week',
        });

        // Verify file was updated
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] New future task');
        expect(currentContent).toContain('# Next Week');
        expect(currentContent).toContain('- [ ] Existing future task');

        expect(mockCommitChanges).toHaveBeenCalledWith('Added task: New future task');

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully added task "New future task" to Next Week',
          }],
        });
      });

      it('should add task to backlog with date', async () => {
        const result = await handler({
          task_text: 'New backlog task',
          target: 'backlog',
        });

        // Verify backlog file was updated
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] New backlog task added on 2024-01-15');
        expect(backlogContent).toContain('# Backlog');
        expect(backlogContent).toContain('- [ ] Existing backlog task added on 2024-01-01');

        // Verify current file unchanged
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).not.toContain('New backlog task');

        expect(mockCommitChanges).toHaveBeenCalledWith('Added task: New backlog task');

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully added task "New backlog task" to Backlog',
          }],
        });
      });
    });

    describe('tasks with descriptions', () => {
      it('should add task with description to current week', async () => {
        const result = await handler({
          task_text: 'Task with description',
          target: 'current_week',
          description: 'This is a detailed description\nWith multiple lines',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).toContain('  This is a detailed description');
        expect(currentContent).toContain('  With multiple lines');

        expect(result.content[0].text).toContain('Successfully added task "Task with description" to This Week');
      });

      it('should add task with description to backlog', async () => {
        await handler({
          task_text: 'Backlog task',
          target: 'backlog',
          description: 'Future implementation notes',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Backlog task added on 2024-01-15');
        expect(backlogContent).toContain('  Future implementation notes');
      });

      it('should handle empty description as undefined', async () => {
        await handler({
          task_text: 'Task without description',
          target: 'current_week',
          description: '',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task without description');
        // Should not have description lines
        const lines = currentContent.split('\n');
        const taskLineIndex = lines.findIndex(line => line.includes('Task without description'));

        expect(lines[taskLineIndex + 1]).not.toMatch(/^  /);
      });
    });

    describe('date handling for backlog tasks', () => {
      it('should append current date to backlog tasks', async () => {
        mockGetCurrentDate.mockReturnValue('2024-03-20');

        await handler({
          task_text: 'Time-sensitive task',
          target: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Time-sensitive task added on 2024-03-20');
      });

      it('should not append date to current_week tasks', async () => {
        await handler({
          task_text: 'Current task',
          target: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Current task');
        expect(currentContent).not.toContain('added on');
      });

      it('should not append date to next_week tasks', async () => {
        await handler({
          task_text: 'Future task',
          target: 'next_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Future task');
        expect(currentContent).not.toContain('added on');
      });
    });

    describe('error scenarios', () => {
      it('should handle git commit failure', async () => {
        mockCommitChanges.mockRejectedValueOnce(new Error('Git commit failed'));

        const result = await handler({
          task_text: 'Test task',
          target: 'current_week',
        });

        // Task should still be added to file
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Test task');

        // But should return error due to git failure
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error adding task: Git commit failed');
      });

      it('should handle missing sections gracefully', async () => {
        // Create file without required sections
        writeFileSync(join(testDir, 'current.md'), `# Random Section
- [ ] Random task`);

        const result = await handler({
          task_text: 'Test task',
          target: 'current_week',
        });

        // Should return error about missing section
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error adding task:');
        expect(result.content[0].text).toContain('This Week');
      });

      it('should handle missing backlog file', async () => {
        // Remove backlog file
        rmSync(join(testDir, 'backlog.md'));

        const result = await handler({
          task_text: 'Test task',
          target: 'backlog',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error adding task:');
      });
    });

    describe('file preservation', () => {
      it('should preserve existing content and structure', async () => {
        const originalContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        await handler({
          task_text: 'New task',
          target: 'current_week',
        });

        const updatedContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should preserve headers
        expect(updatedContent).toContain('# Last Week');
        expect(updatedContent).toContain('# This Week');
        expect(updatedContent).toContain('# Next Week');

        // Should preserve existing tasks
        expect(updatedContent).toContain('- [x] Completed task');
        expect(updatedContent).toContain('- [ ] Existing current task');
        expect(updatedContent).toContain('- [ ] Existing future task');

        // Should add new task
        expect(updatedContent).toContain('- [ ] New task');
      });

      it('should only modify the target file', async () => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Add task to current file
        await handler({
          task_text: 'Current task',
          target: 'current_week',
        });

        // Backlog should be unchanged
        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentBacklog).toBe(originalBacklog);
      });
    });

    describe('section handling', () => {
      it('should add tasks to correct sections', async () => {
        // Add tasks to different sections
        await handler({ task_text: 'Task 1', target: 'current_week' });
        await handler({ task_text: 'Task 2', target: 'next_week' });
        await handler({ task_text: 'Task 3', target: 'backlog' });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Verify tasks in correct sections
        expect(currentContent).toContain('- [ ] Task 1');
        expect(currentContent).toContain('- [ ] Task 2');
        expect(currentContent).not.toContain('Task 3');

        expect(backlogContent).toContain('- [ ] Task 3 added on 2024-01-15');
        expect(backlogContent).not.toContain('Task 1');
        expect(backlogContent).not.toContain('Task 2');
      });

      it('should handle tasks with special characters', async () => {
        await handler({
          task_text: 'Task with "quotes" & symbols!',
          target: 'current_week',
          description: 'Description with émojis 🚀 and unicode ñ',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with "quotes" & symbols!');
        expect(currentContent).toContain('  Description with émojis 🚀 and unicode ñ');
      });
    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async () => {
        const result = await handler({
          task_text: 'Test task',
          target: 'current_week',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });

      it('should return proper MCP structure for errors', async () => {
        mockCommitChanges.mockRejectedValueOnce(new Error('Test error'));

        const result = await handler({
          task_text: 'Test task',
          target: 'current_week',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });
    });

    describe('target determination logic', () => {
      it('should map targets to correct files and sections', async () => {
        // Test all target mappings
        const testCases = [
          { target: 'backlog', expectedFile: 'backlog.md', expectedSection: 'Backlog' },
          { target: 'current_week', expectedFile: 'current.md', expectedSection: 'This Week' },
          { target: 'next_week', expectedFile: 'current.md', expectedSection: 'Next Week' },
        ];

        for (const testCase of testCases) {
          mockCommitChanges.mockClear();

          await handler({
            task_text: `Task for ${testCase.target}`,
            target: testCase.target as 'backlog' | 'current_week' | 'next_week',
          });

          const fileContent = readFileSync(join(testDir, testCase.expectedFile), 'utf-8');

          if (testCase.target === 'backlog') {
            expect(fileContent).toContain(`- [ ] Task for ${testCase.target} added on 2024-01-15`);
          } else {
            expect(fileContent).toContain(`- [ ] Task for ${testCase.target}`);
          }
        }
      });
    });
  });
});