import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { name, config, handler } from 'src/tools/editTask';
import * as gitUtils from 'src/utils/git';
import * as dateUtils from 'src/utils/dates';

describe('editTask tool', () => {
  const testDir = '/tmp/mcp-tasks-test-edittask';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);

    // Create current.md with various task types
    writeFileSync(join(testDir, 'current.md'), `# This Week
- [ ] Simple task
- [x] Completed task
- [ ] Task with description
  Original description
  Multiple lines
- [ ] Task without description

# Next Week
- [ ] Future task`);

    // Create backlog.md with dated tasks
    writeFileSync(join(testDir, 'backlog.md'), `# Backlog
- [ ] Backlog task added on 2024-01-01
- [ ] Another backlog task added on 2024-01-02
  With description
- [x] Completed backlog task added on 2024-01-03`);

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
      expect(name).toBe('edit_task');
    });

    it('should export correct config structure', () => {
      expect(config).toEqual({
        title: 'Edit Task',
        description: 'Modify an existing task\'s text or description',
        inputSchema: {
          task_identifier: expect.any(Object),
          new_text: expect.any(Object),
          new_description: expect.any(Object),
        },
      });
    });

    it('should have optional new_text and new_description parameters', () => {
      expect(config.inputSchema.new_text._def.typeName).toBe('ZodOptional');
      expect(config.inputSchema.new_description._def.typeName).toBe('ZodOptional');
    });
  });

  describe('handler function', () => {
    describe('parameter validation', () => {
      it('should require at least one of new_text or new_description', async() => {
        const result = await handler({
          task_identifier: 'Simple task',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('At least one of new_text or new_description must be provided');
      });

      it('should reject empty new_text when no new_description provided', async() => {
        const result = await handler({
          task_identifier: 'Simple task',
          new_text: '',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('At least one of new_text or new_description must be provided');
      });

      it('should accept empty new_text when new_description is provided', async() => {
        const result = await handler({
          task_identifier: 'Simple task',
          new_text: '',
          new_description: 'New description',
        });

        expect(result).not.toHaveProperty('isError');

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('  New description');
      });
    });

    describe('text updates for current tasks', () => {
      it('should update task text in current file', async() => {
        const result = await handler({
          task_identifier: 'Simple task',
          new_text: 'Updated simple task',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Updated simple task');
        expect(currentContent).not.toContain('- [ ] Simple task');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Edited task: Simple task - Updated text');

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Successfully updated task "Simple task" - Updated text',
          }],
        });
      });

      it('should preserve task status when updating text', async() => {
        await handler({
          task_identifier: 'Completed task',
          new_text: 'Updated completed task',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [x] Updated completed task');
        expect(currentContent).not.toContain('- [x] Completed task');
      });

      it('should handle special characters in new text', async() => {
        await handler({
          task_identifier: 'Simple task',
          new_text: 'Task with "quotes" & symbols! 🚀',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with "quotes" & symbols! 🚀');
      });
    });

    describe('text updates for backlog tasks with date preservation', () => {
      it('should update backlog task text while preserving date', async() => {
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          new_text: 'Updated backlog task',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Updated backlog task added on 2024-01-01');
        expect(backlogContent).not.toContain('- [ ] Backlog task added on 2024-01-01');
      });

      it('should preserve date when updating completed backlog task', async() => {
        await handler({
          task_identifier: 'Completed backlog task added on 2024-01-03',
          new_text: 'Updated completed backlog task',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [x] Updated completed backlog task added on 2024-01-03');
      });

      it('should add current date if backlog task has no date', async() => {
        // Add a backlog task without date
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');
        const modifiedContent = `${backlogContent  }\n- [ ] Task without date\n`;

        writeFileSync(join(testDir, 'backlog.md'), modifiedContent);

        await handler({
          task_identifier: 'Task without date',
          new_text: 'Updated task without date',
        });

        const updatedContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(updatedContent).toContain('- [ ] Updated task without date added on 2024-01-15');
      });
    });

    describe('description updates', () => {
      it('should add description to task without one', async() => {
        const result = await handler({
          task_identifier: 'Task without description',
          new_description: 'Newly added description',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task without description');
        expect(currentContent).toContain('  Newly added description');

        expect(result.content[0].text).toContain('Successfully updated task "Task without description" - Updated description');
      });

      it('should update existing description', async() => {
        await handler({
          task_identifier: 'Task with description',
          new_description: 'Updated description\nWith new content',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).toContain('  Updated description');
        expect(currentContent).toContain('  With new content');
        expect(currentContent).not.toContain('  Original description');
        expect(currentContent).not.toContain('  Multiple lines');
      });

      it('should clear description when set to empty string', async() => {
        const result = await handler({
          task_identifier: 'Task with description',
          new_description: '',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).not.toContain('  Original description');
        expect(currentContent).not.toContain('  Multiple lines');

        expect(result.content[0].text).toContain('Successfully updated task "Task with description" - Updated description (cleared)');
      });

      it('should clear description when set to null', async() => {
        await handler({
          task_identifier: 'Task with description',
          new_description: null,
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).not.toContain('  Original description');
        expect(currentContent).not.toContain('  Multiple lines');
      });

      it('should handle multiline descriptions', async() => {
        await handler({
          task_identifier: 'Task without description',
          new_description: 'Line 1\nLine 2\nLine 3',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task without description');
        expect(currentContent).toContain('  Line 1');
        expect(currentContent).toContain('  Line 2');
        expect(currentContent).toContain('  Line 3');
      });

      it('should update descriptions for backlog tasks', async() => {
        await handler({
          task_identifier: 'Another backlog task added on 2024-01-02',
          new_description: 'Updated backlog description',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Another backlog task added on 2024-01-02');
        expect(backlogContent).toContain('  Updated backlog description');
        expect(backlogContent).not.toContain('  With description');
      });
    });

    describe('combined text and description updates', () => {
      it('should update both text and description', async() => {
        const result = await handler({
          task_identifier: 'Task with description',
          new_text: 'Updated task text',
          new_description: 'Updated description content',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Updated task text');
        expect(currentContent).toContain('  Updated description content');
        expect(currentContent).not.toContain('- [ ] Task with description');
        expect(currentContent).not.toContain('  Original description');

        expect(gitUtils.commitChanges).toHaveBeenCalledWith('Edited task: Task with description - Updated text and description');

        expect(result.content[0].text).toContain('Successfully updated task "Task with description" - Updated text and description');
      });

      it('should update text and clear description', async() => {
        const result = await handler({
          task_identifier: 'Task with description',
          new_text: 'New text without description',
          new_description: '',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] New text without description');
        expect(currentContent).not.toContain('  Original description');

        expect(result.content[0].text).toContain('Updated text and description (cleared)');
      });

      it('should handle combined updates for backlog tasks', async() => {
        await handler({
          task_identifier: 'Backlog task added on 2024-01-01',
          new_text: 'Updated backlog text',
          new_description: 'New backlog description',
        });

        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(backlogContent).toContain('- [ ] Updated backlog text added on 2024-01-01');
        expect(backlogContent).toContain('  New backlog description');
      });
    });

    describe('cross-file task identification', () => {
      it('should find and update tasks in different files', async() => {
        // Update task in current file
        await handler({
          task_identifier: 'Future task',
          new_text: 'Updated future task',
        });

        // Update task in backlog file
        await handler({
          task_identifier: 'Another backlog task',
          new_text: 'Updated another backlog task',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const backlogContent = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Updated future task');
        expect(backlogContent).toContain('- [ ] Updated another backlog task added on 2024-01-02');
      });

      it('should preserve content in non-target files', async() => {
        const originalBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        // Update task in current file
        await handler({
          task_identifier: 'Simple task',
          new_text: 'Updated simple task',
        });

        // Backlog should be unchanged
        const currentBacklog = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(currentBacklog).toBe(originalBacklog);
      });
    });

    describe('error scenarios', () => {
      it('should handle task not found', async() => {
        const result = await handler({
          task_identifier: 'Nonexistent task',
          new_text: 'New text',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error editing task:');
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
          new_text: 'Updated text',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Multiple matches found for "simple"');
      });

      it('should handle git commit failure', async() => {
        gitUtils.commitChanges.mockRejectedValueOnce(new Error('Git commit failed'));

        const result = await handler({
          task_identifier: 'Simple task',
          new_text: 'Updated text',
        });

        // Task should still be updated in file
        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Updated text');

        // But should return error due to git failure
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error editing task: Git commit failed');
      });
    });

    describe('file preservation', () => {
      it('should preserve file structure and other tasks', async() => {
        await handler({
          task_identifier: 'Simple task',
          new_text: 'Updated simple task',
          new_description: 'Added description',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should preserve headers
        expect(currentContent).toContain('# This Week');
        expect(currentContent).toContain('# Next Week');

        // Should preserve other tasks
        expect(currentContent).toContain('- [x] Completed task');
        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).toContain('- [ ] Future task');

        // Should preserve existing descriptions
        expect(currentContent).toContain('  Original description');
        expect(currentContent).toContain('  Multiple lines');
      });

      it('should maintain proper line structure', async() => {
        await handler({
          task_identifier: 'Task without description',
          new_description: 'New description',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');
        const lines = currentContent.split('\n');

        // Find the task line
        const taskLineIndex = lines.findIndex(line => line.includes('Task without description'));

        expect(taskLineIndex).toBeGreaterThan(-1);
        expect(lines[taskLineIndex + 1]).toBe('  New description');
      });
    });

    describe('edge cases', () => {
      it('should handle whitespace-only description as clear', async() => {
        await handler({
          task_identifier: 'Task with description',
          new_description: '   \n  \n',
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain('- [ ] Task with description');
        expect(currentContent).not.toContain('  Original description');
      });

      it('should handle empty task identifier', async() => {
        const result = await handler({
          task_identifier: '',
          new_text: 'New text',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Task identifier cannot be empty');
      });

      it('should handle very long text updates', async() => {
        const longText = 'Very long task text '.repeat(50);

        await handler({
          task_identifier: 'Simple task',
          new_text: longText,
        });

        const currentContent = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(currentContent).toContain(`- [ ] ${longText}`);
      });
    });

    describe('MCP response structure', () => {
      it('should return proper MCP structure for success', async() => {
        const result = await handler({
          task_identifier: 'Simple task',
          new_text: 'Updated text',
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
          new_text: 'New text',
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
