import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { setWorkingDirectory } from 'src/config';
import { readFile, changeFile, appendToFile, addTaskToFile } from 'src/utils/fileOperations';

describe('fileOperations', () => {
  const testDir = '/tmp/mcp-tasks-test-fileoperations';

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    setWorkingDirectory(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('readFile', () => {
    it('should read current file contents', () => {
      const content = '# Current Tasks\n- [ ] Task 1\n';

      writeFileSync(join(testDir, 'current.md'), content);

      const result = readFile('current');

      expect(result).toBe(content);
    });

    it('should read backlog file contents', () => {
      const content = '# Backlog\n- [ ] Future task\n';

      writeFileSync(join(testDir, 'backlog.md'), content);

      const result = readFile('backlog');

      expect(result).toBe(content);
    });

    it('should read archive file contents', () => {
      const content = '# Archive\n- [x] Completed task\n';

      writeFileSync(join(testDir, 'archive.md'), content);

      const result = readFile('archive');

      expect(result).toBe(content);
    });

    it('should throw error when file does not exist', () => {
      expect(() => readFile('current')).toThrow();
    });
  });

  describe('changeFile', () => {
    it('should modify file content using modifier function', () => {
      const originalContent = '# Tasks\n- [ ] Original task\n';

      writeFileSync(join(testDir, 'current.md'), originalContent);

      changeFile('current', (content) => content.replace('Original', 'Modified'));

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Tasks\n- [ ] Modified task\n');
    });

    it('should handle empty content modification', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      changeFile('current', (content) => `${content}# New Content\n`);

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# New Content\n');
    });

    it('should preserve original content when modifier returns same content', () => {
      const originalContent = '# Tasks\n- [ ] Task 1\n';

      writeFileSync(join(testDir, 'current.md'), originalContent);

      changeFile('current', (content) => content);

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe(originalContent);
    });

    it('should work with different file types', () => {
      writeFileSync(join(testDir, 'backlog.md'), 'Original');

      changeFile('backlog', () => 'Modified');

      const result = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

      expect(result).toBe('Modified');
    });
  });

  describe('appendToFile', () => {
    it('should append content to existing file with content', () => {
      const existingContent = '# Existing Content\n- [ ] Task 1';

      writeFileSync(join(testDir, 'current.md'), existingContent);

      appendToFile('current', '- [ ] New task');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Existing Content\n- [ ] Task 1\n\n- [ ] New task');
    });

    it('should append content to empty file', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      appendToFile('current', '# New Content\n- [ ] Task 1');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# New Content\n- [ ] Task 1');
    });

    it('should append content to file with only whitespace', () => {
      writeFileSync(join(testDir, 'current.md'), '   \n  \n');

      appendToFile('current', '# Content');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Content');
    });

    it('should handle multiline content append', () => {
      writeFileSync(join(testDir, 'current.md'), '# Tasks');

      appendToFile('current', 'New section:\n- [ ] Task 1\n- [ ] Task 2');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toBe('# Tasks\n\nNew section:\n- [ ] Task 1\n- [ ] Task 2');
    });

    it('should work with different file types', () => {
      writeFileSync(join(testDir, 'archive.md'), '# Archive');

      appendToFile('archive', '## Week 1\n- [x] Completed');

      const result = readFileSync(join(testDir, 'archive.md'), 'utf-8');

      expect(result).toBe('# Archive\n\n## Week 1\n- [x] Completed');
    });
  });

  describe('addTaskToFile', () => {
    it('should add task to existing section', () => {
      const content = `# Today
- [ ] Existing task

# Later
- [ ] Other task`;

      writeFileSync(join(testDir, 'current.md'), content);

      addTaskToFile('current', 'Today', 'New task');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toContain('- [ ] New task');
      expect(result).toContain('# Today');
    });

    it('should add task with description', () => {
      const content = `# Today
- [ ] Existing task`;

      writeFileSync(join(testDir, 'current.md'), content);

      addTaskToFile('current', 'Today', 'Complex task', 'This task needs\nmultiple steps');

      const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

      expect(result).toContain('- [ ] Complex task');
      expect(result).toContain('  This task needs');
      expect(result).toContain('  multiple steps');
    });

    it('should throw error for non-existent section', () => {
      const content = '# Tasks\n\n## Existing\n- [ ] Task';

      writeFileSync(join(testDir, 'current.md'), content);

      expect(() => {
        addTaskToFile('current', 'New Section', 'New task');
      }).toThrow('Section "New Section" not found');
    });

    it('should throw error when file has no sections', () => {
      writeFileSync(join(testDir, 'current.md'), '');

      expect(() => {
        addTaskToFile('current', 'First Section', 'First task');
      }).toThrow('Section "First Section" not found');
    });

    it('should work with different file types', () => {
      const content = `# Future
- [ ] Existing task`;

      writeFileSync(join(testDir, 'backlog.md'), content);

      addTaskToFile('backlog', 'Future', 'Future task', 'For later');

      const result = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

      expect(result).toContain('# Future');
      expect(result).toContain('- [ ] Future task');
      expect(result).toContain('  For later');
    });

    describe('status parameter', () => {
      it('should add task with default new status', () => {
        const content = `# Today
- [ ] Existing task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'Default task');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(result).toContain('- [ ] Default task');
        expect(result).not.toContain('- [x] Default task');
        expect(result).not.toContain('- [-] Default task');
      });

      it('should add task with explicit new status', () => {
        const content = `# Today
- [ ] Existing task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'New task', undefined, 'new');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(result).toContain('- [ ] New task');
      });

      it('should add completed task', () => {
        const content = `# Today
- [ ] Existing task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'Completed task', undefined, 'completed');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(result).toContain('- [x] Completed task');
        expect(result).not.toContain('- [ ] Completed task');
      });

      it('should add closed task', () => {
        const content = `# Today
- [ ] Existing task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'Closed task', undefined, 'closed');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(result).toContain('- [-] Closed task');
        expect(result).not.toContain('- [ ] Closed task');
      });

      it('should add completed task with description', () => {
        const content = `# Today
- [ ] Existing task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'Done task', 'This was finished', 'completed');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        expect(result).toContain('- [x] Done task');
        expect(result).toContain('  This was finished');
      });

      it('should add closed task with multiline description', () => {
        const content = `# Backlog
- [ ] Existing task`;

        writeFileSync(join(testDir, 'backlog.md'), content);

        const description = 'Task cancelled\nNo longer needed';
        addTaskToFile('backlog', 'Backlog', 'Cancelled task', description, 'closed');

        const result = readFileSync(join(testDir, 'backlog.md'), 'utf-8');

        expect(result).toContain('- [-] Cancelled task');
        expect(result).toContain('  Task cancelled');
        expect(result).toContain('  No longer needed');
      });

      it('should preserve existing tasks when adding different status tasks', () => {
        const content = `# Today
- [ ] Existing new task
- [x] Existing completed task
- [-] Existing closed task`;

        writeFileSync(join(testDir, 'current.md'), content);

        addTaskToFile('current', 'Today', 'Another completed task', undefined, 'completed');

        const result = readFileSync(join(testDir, 'current.md'), 'utf-8');

        // Should preserve all existing tasks
        expect(result).toContain('- [ ] Existing new task');
        expect(result).toContain('- [x] Existing completed task');
        expect(result).toContain('- [-] Existing closed task');
        // Should add new completed task
        expect(result).toContain('- [x] Another completed task');
      });

      it('should work with all file types and statuses', () => {
        // Test archive file with closed status
        const content = `# Archive
- [x] Old completed task`;

        writeFileSync(join(testDir, 'archive.md'), content);

        addTaskToFile('archive', 'Archive', 'Archived task', 'No longer relevant', 'closed');

        const result = readFileSync(join(testDir, 'archive.md'), 'utf-8');

        expect(result).toContain('- [-] Archived task');
        expect(result).toContain('  No longer relevant');
        expect(result).toContain('- [x] Old completed task');
      });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from readFileSync in readFile', () => {
      expect(() => readFile('current')).toThrow();
    });

    it('should propagate errors from readFileSync in changeFile', () => {
      expect(() => changeFile('current', (content) => content)).toThrow();
    });

    it('should propagate errors from readFileSync in appendToFile', () => {
      expect(() => appendToFile('current', 'content')).toThrow();
    });

    it('should propagate errors from readFileSync in addTaskToFile', () => {
      expect(() => addTaskToFile('current', 'section', 'task')).toThrow();
    });
  });
});
