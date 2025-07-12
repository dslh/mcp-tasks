import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/finishTask';
import * as gitUtils from 'src/utils/git';

describe('finishTask tool', () => {
  const testDir = '/tmp/mcp-tasks-test-finishtask';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with test tasks
    writeFileSync(join(testDir, 'current.md'), `# This Week
- [ ] Incomplete task
- [x] Already completed task
- [-] Already closed task
- [ ] Task with description
  This is a detailed description
  Multiple lines here

# Next Week
- [ ] Future task
- [ ] Unique test task`);

    // Create backlog.md with test tasks
    writeFileSync(join(testDir, 'backlog.md'), `# Backlog
- [ ] Backlog task added on 2024-01-01
- [x] Completed backlog task added on 2024-01-02`);

    // Set up mocks for this test
    spyOn(gitUtils, 'commitChanges').mockResolvedValue();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    // Clear all spies
    mock.restore();
  });

  describe('tool metadata', () => {
    it('should export correct tool name', () => {
      expect(name).toBe('finish_task');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Finish Task',
        description: 'Mark a task as completed or closed',
        inputSchema: {
          task_identifier: expect.any(Object),
          status: expect.any(Object),
        },
      });
    });

    it('should have proper Zod schema for status enum', () => {
      // Test the enum validation by checking the schema
      expect(config.inputSchema.status._def.values).toEqual(['completed', 'closed']);
    });
  });

  describe('handler function', () => {
    describe('successful task completion', () => {
      it('should complete an incomplete task in current file', async() => {
        const result = await handler({
          task_identifier: 'Incomplete task',
          status: 'completed',
        });

        // Verify file was updated
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Incomplete task');
        expect(currentContent).not.toContain('- [ ] Incomplete task');

        // Verify other tasks unchanged
        expect(currentContent).toContain('- [x] Already completed task');
        expect(currentContent).toContain('- [-] Already closed task');

        // Verify git commit
        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Completed task: Incomplete task');

        // Verify response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully marked task "Incomplete task" as completed [x]',
          }],
        });
      });

      it('should close an incomplete task in current file', async() => {
        const result = await handler({
          task_identifier: 'Incomplete task',
          status: 'closed',
        });

        // Verify file was updated
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [-] Incomplete task');
        expect(currentContent).not.toContain('- [ ] Incomplete task');

        // Verify git commit
        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Closed task: Incomplete task');

        // Verify response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully marked task "Incomplete task" as closed [-]',
          }],
        });
      });

      it('should complete a task in backlog file', async() => {
        const result = await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          status: 'completed',
        });

        // Verify backlog file was updated
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [x] Backlog task added on 2024-01-01');
        expect(backlogContent).not.toContain('- [ ] Backlog task added on 2024-01-01');

        // Verify current file unchanged
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Incomplete task');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Completed task: Backlog task added on 2024-01-01');
      });

      it('should handle task with description', async() => {
        const result = await handler({
          task_identifier: 'Task with description',
          status: 'completed',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Task with description');
        expect(currentContent).toContain('  This is a detailed description');
        expect(currentContent).toContain('  Multiple lines here');
      });
    });

    describe('already in requested state', () => {
      it('should handle task already completed', async() => {
        const result = await handler({
          task_identifier: 'Already completed task',
          status: 'completed',
        });

        // Verify no file changes
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Already completed task');

        // Verify no git commit
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();

        // Verify response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Task "Already completed task" is already marked as completed',
          }],
        });
      });

      it('should handle task already closed', async() => {
        const result = await handler({
          task_identifier: 'Already closed task',
          status: 'closed',
        });

        // Verify no file changes
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [-] Already closed task');

        // Verify no git commit
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();

        // Verify response
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Task "Already closed task" is already marked as closed',
          }],
        });
      });
    });

    describe('error scenarios', () => {
      it('should handle task not found', async() => {
        const result = await handler({
          task_identifier: 'Nonexistent task',
          status: 'completed',
        });

        // Verify no file changes
        const originalCurrent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(originalCurrent).toContain('- [ ] Incomplete task');
        expect(originalBacklog).toContain('- [ ] Backlog task added on 2024-01-01');

        // Verify no git commit
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();

        // Verify error response
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error finishing task:');
        expect(result.content[0].text).toContain('No matching tasks found for "Nonexistent task"');
      });

      it('should handle ambiguous task identifier', async() => {
        // Add another task with similar text
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const modifiedContent = `${currentContent  }\n- [ ] Another incomplete task\n`;

        writeFileSync(join(testDir, 'current.md'), modifiedContent);

        const result = await handler({
          task_identifier: 'task',
          status: 'completed',
        });

        // Verify error response for multiple matches
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Multiple matches found for "task"');
      });

      it('should handle git commit failure', async() => {
        gitUtils.commitChanges.mockRejectedValueOnce(new Error('Git commit failed'));

        const result = await handler({
          task_identifier: 'Incomplete task',
          status: 'completed',
        });

        // Task should still be updated in file
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Incomplete task');

        // But should return error due to git failure
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error finishing task: Git commit failed');
      });
    });

    describe('file preservation', () => {
      it('should preserve file structure and other content', async() => {
        const originalContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        await handler({
          task_identifier: 'Incomplete task',
          status: 'completed',
        });

        const updatedContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should preserve headers
        expect(updatedContent).toContain('# This Week');
        expect(updatedContent).toContain('# Next Week');

        // Should preserve other tasks
        expect(updatedContent).toContain('- [x] Already completed task');
        expect(updatedContent).toContain('- [-] Already closed task');
        expect(updatedContent).toContain('- [ ] Future task');

        // Should preserve task descriptions
        expect(updatedContent).toContain('  This is a detailed description');
        expect(updatedContent).toContain('  Multiple lines here');
      });

      it('should only modify the target file', async() => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Modify current file
        await handler({
          task_identifier: 'Incomplete task',
          status: 'completed',
        });

        // Backlog should be unchanged
        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentBacklog).toBe(originalBacklog);
      });
    });

    describe('cross-file task identification', () => {
      it('should find and update tasks across both files', async() => {
        // Test updating current file task
        await handler({
          task_identifier: 'Future task',
          status: 'completed',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Future task');

        gitUtils.commitChanges.mockClear();

        // Test updating backlog file task
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          status: 'closed',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [-] Backlog task added on 2024-01-01');
      });
    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async() => {
        const result = await handler({
          task_identifier: 'Unique test task',
          status: 'completed',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });

      it('should return proper MCP structure for errors', async() => {
        const result = await handler({
          task_identifier: 'Nonexistent task',
          status: 'completed',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });
    });
  });
});
