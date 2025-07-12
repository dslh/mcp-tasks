import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/moveTask';
import * as gitUtils from 'src/utils/git';
import * as dateUtils from 'src/utils/dates';

describe('moveTask tool', () => {
  const testDir = '/tmp/mcp-tasks-test-movetask';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with tasks in different sections
    writeFileSync(join(testDir, 'current.md'), `# This Week
- [ ] Simple current task
- [x] Completed task
- [ ] Current task with description
  Current description
  Multiple lines

# Next Week
- [ ] Simple next task
- [ ] Next task with description
  Next description`);

    // Create backlog.md with dated tasks
    writeFileSync(join(testDir, 'backlog.md'), `# Backlog
- [ ] Backlog task added on 2024-01-01
- [x] Completed backlog task added on 2024-01-02
- [ ] Backlog task with description added on 2024-01-03
  Backlog description
  With details`);

    // Set up mocks for this test
    spyOn(gitUtils, 'commitChanges').mockResolvedValue();
    spyOn(dateUtils, 'getCurrentDate').mockReturnValue('2024-01-15');
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
      expect(name).toBe('move_task');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Move Task',
        description: 'Move a task between backlog, current week, and next week',
        inputSchema: {
          task_identifier: expect.any(Object),
          destination: expect.any(Object),
        },
      });
    });

    it('should have proper Zod schema for destination enum', () => {
      expect(config.inputSchema.destination._def.values).toEqual(['backlog', 'current_week', 'next_week']);
    });
  });

  describe('handler function', () => {
    describe('successful moves between sections', () => {
      it('should move task from current week to next week', async() => {
        const result = await handler({
          task_identifier: 'Simple current task',
          destination: 'next_week',
        });

        // Verify task moved in current.md
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find where task appears - should only be in Next Week section
        const thisWeekSection = lines.findIndex(line => line === '# This Week');
        const nextWeekSection = lines.findIndex(line => line === '# Next Week');
        const thisWeekLines = lines.slice(thisWeekSection, nextWeekSection);
        const nextWeekLines = lines.slice(nextWeekSection);

        // Should NOT be in This Week section
        expect(thisWeekLines.join('\n')).not.toContain('- [ ] Simple current task');
        // Should be in Next Week section
        expect(nextWeekLines.join('\n')).toContain('- [ ] Simple current task');

        // Should preserve other tasks
        expect(currentContent).toContain('- [x] Completed task');
        expect(currentContent).toContain('- [ ] Simple next task');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Simple current task from current week to next week');

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully moved task "Simple current task" from current week to next week',
          }],
        });
      });

      it('should move task from next week to current week', async() => {
        await handler({
          task_identifier: 'Simple next task',
          destination: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should be added to This Week
        expect(currentContent).toContain('- [ ] Simple next task');
        // Should be removed from Next Week (but we can't easily test this without complex parsing)

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Simple next task from next week to current week');
      });

      it('should move task from current week to backlog with date addition', async() => {
        await handler({
          task_identifier: 'Simple current task',
          destination: 'backlog',
        });

        // Verify task moved to backlog with date
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Simple current task added on 2024-01-15');

        // Verify removed from current
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).not.toContain('- [ ] Simple current task');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Simple current task from current week to backlog');
      });

      it('should move task from backlog to current week with date removal', async() => {
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          destination: 'current_week',
        });

        // Verify task moved to current without date
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Backlog task');
        expect(currentContent).not.toContain('added on 2024-01-01');

        // Verify removed from backlog
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).not.toContain('- [ ] Backlog task added on 2024-01-01');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Backlog task added on 2024-01-01 from backlog to current week');
      });

      it('should move task from backlog to next week with date removal', async() => {
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          destination: 'next_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Backlog task');
        expect(currentContent).not.toContain('added on 2024-01-01');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Backlog task added on 2024-01-01 from backlog to next week');
      });

      it('should move task from next week to backlog with date addition', async() => {
        await handler({
          task_identifier: 'Simple next task',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Simple next task added on 2024-01-15');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Moved task: Simple next task from next week to backlog');
      });
    });

    describe('description preservation', () => {
      it('should preserve description when moving from current to next week', async() => {
        await handler({
          task_identifier: 'Current task with description',
          destination: 'next_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Current task with description');
        expect(currentContent).toContain('  Current description');
        expect(currentContent).toContain('  Multiple lines');
      });

      it('should preserve description when moving from backlog to current week', async() => {
        await handler({
          task_identifier: 'Backlog task with description added on 2024-01-03',
          destination: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Backlog task with description');
        expect(currentContent).toContain('  Backlog description');
        expect(currentContent).toContain('  With details');
        expect(currentContent).not.toContain('added on 2024-01-03');
      });

      it('should preserve description when moving from current to backlog', async() => {
        await handler({
          task_identifier: 'Current task with description',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Current task with description added on 2024-01-15');
        expect(backlogContent).toContain('  Current description');
        expect(backlogContent).toContain('  Multiple lines');
      });
    });

    describe('task status preservation', () => {
      it('should preserve completed status when moving tasks', async() => {
        await handler({
          task_identifier: 'Completed task',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [x] Completed task added on 2024-01-15');
      });

      it('should preserve completed status for backlog tasks', async() => {
        await handler({
          task_identifier: 'Completed backlog task added on 2024-01-02',
          destination: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Completed backlog task');
      });
    });

    describe('already at destination scenarios', () => {
      it('should handle task already in current week', async() => {
        const result = await handler({
          task_identifier: 'Simple current task',
          destination: 'current_week',
        });

        // Verify no file changes
        const originalContent = `# This Week
- [ ] Simple current task
- [x] Completed task
- [ ] Current task with description
  Current description
  Multiple lines

# Next Week
- [ ] Simple next task
- [ ] Next task with description
  Next description`;

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toBe(originalContent);

        // Verify no git commit
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Task "Simple current task" is already in current week',
          }],
        });
      });

      it('should handle task already in backlog', async() => {
        const result = await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          destination: 'backlog',
        });

        expect(result.content[0].text).toBe('Task "Backlog task added on 2024-01-01" is already in backlog');
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();
      });

      it('should handle task already in next week', async() => {
        const result = await handler({
          task_identifier: 'Simple next task',
          destination: 'next_week',
        });

        expect(result.content[0].text).toBe('Task "Simple next task" is already in next week');
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();
      });
    });

    describe('error scenarios', () => {
      it('should handle task not found', async() => {
        const result = await handler({
          task_identifier: 'Nonexistent task',
          destination: 'backlog',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error moving task:');
        expect(result.content[0].text).toContain('No matching tasks found for "Nonexistent task"');

        // Verify no git commit
        expect(gitUtils.commitChanges).not.toHaveBeenCalled();
      });

      it('should handle ambiguous task identifier', async() => {
        // Add another task with similar text
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const modifiedContent = `${currentContent  }\n- [ ] Another simple task\n`;

        writeFileSync(join(testDir, 'current.md'), modifiedContent);

        const result = await handler({
          task_identifier: 'simple',
          destination: 'backlog',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Multiple matches found for "simple"');
      });

      it('should handle git commit failure', async() => {
        gitUtils.commitChanges.mockRejectedValueOnce(new Error('Git commit failed'));

        const result = await handler({
          task_identifier: 'Simple current task',
          destination: 'backlog',
        });

        // Task should still be moved in files
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Simple current task added on 2024-01-15');

        // But should return error due to git failure
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error moving task: Git commit failed');
      });
    });

    describe('cross-file operations', () => {
      it('should only modify target files when moving between current sections', async() => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        await handler({
          task_identifier: 'Current task',
          destination: 'next_week',
        });

        // Backlog should be unchanged
        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentBacklog).toBe(originalBacklog);
      });

      it('should only modify target files when moving to/from backlog', async() => {
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          destination: 'current_week',
        });

        // Original current content structure should be preserved (minus the added task)
        const newCurrentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Headers should be preserved
        expect(newCurrentContent).toContain('# This Week');
        expect(newCurrentContent).toContain('# Next Week');

        // Existing tasks should be preserved
        expect(newCurrentContent).toContain('- [ ] Simple current task');
        expect(newCurrentContent).toContain('- [ ] Simple next task');
      });
    });

    describe('file structure preservation', () => {
      it('should preserve file headers and structure', async() => {
        await handler({
          task_identifier: 'Current task',
          destination: 'backlog',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Should preserve headers
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');
        expect(backlogContent).toContain('# Backlog');

        // Should preserve other tasks
        expect(currentContent).toContain('- [x] Completed task');
        expect(backlogContent).toContain('- [x] Completed backlog task added on 2024-01-02');
      });
    });

    describe('text transformation edge cases', () => {
      it('should handle backlog task without date when moving out', async() => {
        // Add a backlog task without date
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');
        const modifiedContent = `${backlogContent  }\n- [ ] Task without date\n`;

        writeFileSync(join(testDir, 'backlog.md'), modifiedContent);

        await handler({
          task_identifier: 'Task without date',
          destination: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task without date');
        expect(currentContent).not.toContain('added on');
      });

      it('should handle special characters in task text during transformation', async() => {
        // Add task with special characters
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const modifiedContent = `${currentContent  }\n- [ ] Task with "quotes" & symbols!\n`;

        writeFileSync(join(testDir, 'current.md'), modifiedContent);

        await handler({
          task_identifier: 'Task with "quotes" & symbols!',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Task with "quotes" & symbols! added on 2024-01-15');
      });
    });

    describe('task status preservation', () => {
      it('should preserve completed status when moving task', async() => {
        const result = await handler({
          task_identifier: 'Completed task',
          destination: 'next_week',
        });

        expect(result).not.toHaveProperty('isError');

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Task should be moved to Next Week section with completed status preserved
        expect(currentContent).toContain('- [x] Completed task');
        expect(currentContent).not.toContain('- [ ] Completed task');

        // Verify it's in the correct section
        const lines = currentContent.split('\n');
        const nextWeekIndex = lines.findIndex(line => line === '# Next Week');
        const taskIndex = lines.findIndex(line => line.includes('- [x] Completed task'));

        expect(taskIndex).toBeGreaterThan(nextWeekIndex);
      });

      it('should preserve completed status when moving from backlog', async() => {
        await handler({
          task_identifier: 'Completed backlog task added on 2024-01-02',
          destination: 'current_week',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Status should be preserved, but date should be removed
        expect(currentContent).toContain('- [x] Completed backlog task');
        expect(currentContent).not.toContain('added on 2024-01-02');
      });

      it('should preserve new status when moving task', async() => {
        await handler({
          task_identifier: 'Simple current task',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Status should remain new ([ ]) and date should be added
        expect(backlogContent).toContain('- [ ] Simple current task added on 2024-01-15');
      });

      it('should preserve closed status when moving task', async() => {
        // Add a closed task to test with
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const modifiedContent = `${currentContent}\n- [-] Closed task\n`;

        writeFileSync(join(testDir, 'current.md'), modifiedContent);

        await handler({
          task_identifier: 'Closed task',
          destination: 'backlog',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Closed status should be preserved
        expect(backlogContent).toContain('- [-] Closed task added on 2024-01-15');
      });
    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async() => {
        const result = await handler({
          task_identifier: 'Simple current task',
          destination: 'next_week',
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
          destination: 'backlog',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result.isError).toBe(true);
      });

      it('should return proper MCP structure for already at destination', async() => {
        const result = await handler({
          task_identifier: 'Simple current task',
          destination: 'current_week',
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('text');
        expect(result).not.toHaveProperty('isError');
      });
    });
  });
});
